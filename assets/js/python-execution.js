// Keep the interpreter warm; replace its Worker only after an interruption/failure.
(() => {
  'use strict';
  const run = document.getElementById('run');
  const stop = document.getElementById('stopPython');
  const output = document.getElementById('output');
  const MAX_OUTPUT = 100000;
  const STOP_DELAY = 3500;
  const encoder = new TextEncoder();
  const bridgeUrl = new URL('_bridge/', window.location.href).href;
  let engine = null;
  let active = null;

  function message(key) {
    const lang = document.documentElement.lang || 'fr';
    return translations[lang]?.[key] || translations.fr[key];
  }

  function append(text) {
    const atEnd = output.scrollHeight - output.scrollTop - output.clientHeight < 24;
    output.textContent = (output.textContent + text).slice(-MAX_OUTPUT);
    if (atEnd) output.scrollTop = output.scrollHeight;
  }

  function discard(currentEngine) {
    currentEngine.worker.terminate();
    if (engine === currentEngine) engine = null;
  }

  async function bridgeCall(action, data, keepalive = false) {
    const response = await fetch(bridgeUrl + action, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data), cache: 'no-store', keepalive,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(message('pyBridgeUnavailable'));
    return response.json();
  }

  function closeRelay(relay) {
    if (relay) bridgeCall('close', {token: relay.token}, true).catch(() => {});
  }

  function relayFailed(current) {
    if (active !== current) return;
    append(`${message('pyBridgeUnavailable')}\n`);
    finish(current, true);
  }

  function finish(current, interrupted = false) {
    if (active !== current) return;
    clearTimeout(current.timer);
    clearInterval(current.heartbeat);
    closeRelay(current.relay);
    if (interrupted) discard(current.engine);
    active = null;
    window.pythonScripts.setExecuting(false);
    run.disabled = false;
    run.removeAttribute('aria-busy');
    stop.hidden = true;
    window.pythonFiles.save();
  }

  async function execute(current) {
    if (active !== current || current.started || !current.engine.ready) return;
    current.started = true;
    if (!current.engine.shared) {
      try {
        const {token} = await bridgeCall('open', {});
        if (typeof token !== 'string') throw new Error('Invalid relay session');
        const relay = {token, url: bridgeUrl};
        if (active !== current) { closeRelay(relay); return; }
        current.relay = relay;
        current.heartbeat = setInterval(() => {
          bridgeCall('touch', {token}).catch(() => relayFailed(current));
        }, 30000);
      } catch (_) {
        // A static server can still run calculations without the optional bridge.
      }
    }
    if (active !== current) return;
    current.engine.worker.postMessage({type: 'run', code: current.code, files: current.files,
      relay: current.relay, bridgeError: message('pyBridgeUnavailable')});
  }

  function prepare() {
    if (engine) return engine;
    const shared = window.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined'
      ? new SharedArrayBuffer(8 * 1024 * 1024 + 8) : null;
    const worker = new Worker('worker.js?v=20261111-network');
    const prepared = engine = {worker, shared, ready: false};
    function failed(text) {
      if (engine !== prepared) return;
      if (active?.engine === prepared) {
        append(`${message('pyExecutionError')}\n${text}\n`);
        finish(active, true);
      } else discard(prepared);
    }
    worker.onmessage = ({data}) => {
      if (engine !== prepared) return;
      if (data.type === 'ready') {
        prepared.ready = true;
        if (active?.engine === prepared) execute(active);
        return;
      }
      if (data.type === 'error') {
        failed(data.text);
        return;
      }
      const current = active;
      if (!current || current.engine !== prepared) return;
      if (data.type === 'output') append(data.text);
      else if (data.type === 'request') handleRequest(current, data);
      else if (data.type === 'done') {
        if (data.line) window.highlight_error_line(data.line);
        finish(current);
      }
    };
    worker.onerror = event => {
      event.preventDefault();
      failed(event.message);
    };
    worker.postMessage({type: 'init', shared});
    return prepared;
  }

  function prewarm() {
    // A preload failure must not disable the page. The next click retries it.
    try { prepare(); } catch (_) { if (engine) discard(engine); }
  }

  function answer(current, requestId, response) {
    if (active !== current) return;
    let encoded = encoder.encode(JSON.stringify(response));
    if (encoded.length > 8 * 1024 * 1024) {
      encoded = encoder.encode(JSON.stringify({error: {type: 'ValueError', message: message('pyFileTooLarge')}}));
    }
    if (current.relay) {
      bridgeCall('answer', {token: current.relay.token, id: requestId,
        response: JSON.parse(new TextDecoder().decode(encoded))}).catch(() => relayFailed(current));
      return;
    }
    if (!current.engine.shared) return;
    const control = new Int32Array(current.engine.shared, 0, 2);
    const data = new Uint8Array(current.engine.shared, 8);
    data.set(encoded);
    Atomics.store(control, 1, encoded.length);
    Atomics.store(control, 0, 1);
    Atomics.notify(control, 0);
  }

  function handleRequest(current, event) {
    const {kind, payload, id} = event;
    try {
      let value;
      if (kind === 'file_read') value = window.pythonFiles.read(payload.name);
      else if (kind === 'file_write') window.pythonFiles.update(payload.name, payload.content);
      else if (kind === 'input') value = window.prompt(payload.message, '');
      else if (kind === 'turtle') {
        answer(current, id, JSON.parse(window.pythonTurtleRequest(JSON.stringify(payload))));
        return;
      } else throw new Error('Requête Python inconnue.');
      answer(current, id, {value: value ?? null});
    } catch (error) {
      answer(current, id, {error: {type: 'RuntimeError', message: error.message || String(error)}});
    }
  }

  run.addEventListener('click', () => {
    if (active || window.pythonScripts.busy()) return;
    output.textContent = '';
    window.highlight_error_line(0);
    window.pythonTurtleReset();
    run.disabled = true;
    run.setAttribute('aria-busy', 'true');
    window.pythonScripts.setExecuting(true);
    stop.hidden = true;
    let current;
    try {
      current = active = {engine: prepare(), timer: null, started: false,
        code: document.getElementById('code').value, files: window.pythonFiles.serialize()};
      current.timer = setTimeout(() => {
        if (active === current) stop.hidden = false;
      }, STOP_DELAY);
      execute(current);
    } catch (error) {
      append(`${message('pyExecutionError')}\n${error.message}\n`);
      if (current) finish(current, true);
      else {
        if (engine) discard(engine);
        window.pythonScripts.setExecuting(false);
        run.disabled = false;
        run.removeAttribute('aria-busy');
      }
    }
  });

  function interrupt() {
    if (!active) return;
    finish(active, true);
    append(`\n${message('pyInterrupted')}\n`);
    prewarm();
  }
  stop.addEventListener('click', interrupt);
  // Capture also works when an editor completion menu handles Escape itself.
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.isComposing || !active) return;
    event.preventDefault();
    interrupt();
  }, true);
  window.addEventListener('pagehide', () => {
    if (active) finish(active, true);
    if (engine) discard(engine);
  });
  window.addEventListener('pageshow', prewarm);
  prewarm();
})();
