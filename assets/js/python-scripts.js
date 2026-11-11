// Up to three scripts use the same editor and the same result/file workspace.
(() => {
  'use strict';
  const storageKey = 'py_editor_scripts_v1';
  const editor = document.getElementById('code');
  const badges = document.getElementById('scriptBadges');
  const add = document.getElementById('addPythonScript');
  const nodes = new Map();
  const baseTitle = 'Python';
  let scripts = [];
  let active = null;
  let nextId = 1;
  let template = '';
  let changing = false;
  let executing = false;
  let fileOperation = false;

  function message(key) {
    const lang = document.documentElement.lang || 'fr';
    return translations[lang]?.[key] || translations.fr[key];
  }

  function label(script) {
    return script.name || `${message('pyUntitledScript')} ${script.id}.py`;
  }

  function dirty(script) {
    return script.code !== script.savedCode;
  }

  function create(code = template) {
    return {id: nextId++, name: null, handle: null, code, savedCode: code,
      start: code.length, end: code.length, scrollTop: 0, scrollLeft: 0, history: null};
  }

  function capture() {
    if (!active || changing) return;
    Object.assign(active, {code: editor.value, start: editor.selectionStart,
      end: editor.selectionEnd, scrollTop: editor.scrollTop, scrollLeft: editor.scrollLeft,
      history: editor.editorHistory?.capture() ?? null});
  }

  function render() {
    if (!active) return;
    const busy = executing || fileOperation;
    for (const [id, node] of nodes) {
      if (scripts.some(script => script.id === id)) continue;
      node.pill.remove();
      nodes.delete(id);
    }
    for (const script of scripts) {
      let node = nodes.get(script.id);
      if (!node) {
        const pill = document.createElement('span');
        pill.className = 'badge rounded-pill python-script-badge';
        pill.setAttribute('role', 'presentation');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'python-script-name';
        button.id = `python-script-${script.id}`;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', 'pythonEditorPanel');
        button.addEventListener('click', () => select(script));
        button.addEventListener('keydown', event => {
          if (busyNow() || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          let index = scripts.indexOf(script);
          if (event.key === 'Home') index = 0;
          else if (event.key === 'End') index = scripts.length - 1;
          else index = (index + (event.key === 'ArrowRight' ? 1 : -1) + scripts.length) % scripts.length;
          select(scripts[index]);
          nodes.get(active.id).button.focus();
        });
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'python-script-close';
        close.textContent = '×';
        close.addEventListener('click', () => closeScript(script));
        pill.append(button, close);
        badges.append(pill);
        node = {pill, button, close};
        nodes.set(script.id, node);
      }
      const selected = script === active;
      node.pill.classList.toggle('text-bg-success', selected);
      node.pill.classList.toggle('text-bg-info', !selected);
      node.button.textContent = label(script) + (dirty(script) ? ' ●' : '');
      node.button.title = label(script);
      node.button.setAttribute('aria-label', label(script));
      node.button.setAttribute('aria-selected', String(selected));
      node.button.tabIndex = selected ? 0 : -1;
      node.button.disabled = busy;
      node.close.hidden = scripts.length === 1;
      node.close.disabled = busy;
      node.close.title = `${message('pyCloseScript')} ${label(script)}`;
      node.close.setAttribute('aria-label', node.close.title);
    }
    add.hidden = scripts.length >= 3;
    add.disabled = busy;
    add.title = message('pyNewScript');
    add.setAttribute('aria-label', message('pyNewScript'));
    badges.setAttribute('aria-label', message('pyScripts'));
    document.getElementById('pythonEditorPanel').setAttribute('aria-labelledby', `python-script-${active.id}`);
    document.getElementById('dirtyDot').style.display = dirty(active) ? '' : 'none';
    document.title = `${baseTitle} | ${label(active)}${dirty(active) ? ' ●' : ''}`;
    document.getElementById('dropdownFiles').disabled = busy;
    document.getElementById('reset').disabled = busy;
    document.getElementById('run').disabled = busy || typeof window.pythonTurtleRequest !== 'function';
    const saveButton = document.getElementById('saveLocal');
    saveButton.classList.toggle('disabled', busy);
    saveButton.setAttribute('aria-disabled', String(busy));
  }

  function save() {
    if (!active || changing) return;
    capture();
    render();
    try {
      const states = scripts.map(({handle, history, ...state}) => state);
      localStorage.setItem(storageKey, JSON.stringify({activeId: active.id, scripts: states}));
      // Preserve the old single-script keys for migration and older installations.
      localStorage.setItem('py_editor_code_v1', active.code);
      localStorage.setItem('py_editor_caret_v1', JSON.stringify({s: active.start, e: active.end}));
      localStorage.setItem('py_editor_scroll_v1', String(active.scrollTop));
    } catch (_) {
      document.getElementById('filesStatus').textContent = message('pyStorageError');
    }
  }

  function show(focus = true) {
    changing = true;
    try {
      editor.value = active.code;
      editor.editorHistory?.restore(active.history);
      editor.setSelectionRange(active.start, active.end);
      editor.dispatchEvent(new Event('input', {bubbles: true}));
      if (focus) editor.focus({preventScroll: true});
      editor.scrollTop = active.scrollTop;
      editor.scrollLeft = active.scrollLeft;
      editor.dispatchEvent(new Event('scroll'));
      document.getElementById('ac')?.classList.add('hidden');
      window.highlight_error_line(0);
    } finally {
      changing = false;
    }
    save();
  }

  function busyNow() { return executing || fileOperation; }

  function select(script) {
    if (busyNow() || script === active) return;
    capture();
    active = script;
    show();
  }

  function closeScript(script) {
    if (busyNow() || scripts.length <= 1) return;
    capture();
    if (dirty(script) && !window.confirm(`${message('pyCloseUnsavedScript')} ${label(script)} ?`)) return;
    const index = scripts.indexOf(script);
    scripts.splice(index, 1);
    if (active === script) {
      active = scripts[Math.min(index, scripts.length - 1)];
      show();
    } else save();
    nodes.get(active.id).button.focus();
  }

  function restore(defaultCode, linked) {
    template = defaultCode;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (stored && Array.isArray(stored.scripts)) {
        for (const state of stored.scripts.slice(0, 3)) {
          if (!state || typeof state.code !== 'string' || !Number.isSafeInteger(state.id) || state.id < 1
              || scripts.some(script => script.id === state.id)) continue;
          scripts.push({id: state.id, code: state.code,
            name: typeof state.name === 'string' ? state.name : null,
            savedCode: typeof state.savedCode === 'string' ? state.savedCode : state.code,
            start: Number.isInteger(state.start) ? state.start : state.code.length,
            end: Number.isInteger(state.end) ? state.end : state.code.length,
            scrollTop: Number.isFinite(state.scrollTop) ? state.scrollTop : 0,
            scrollLeft: Number.isFinite(state.scrollLeft) ? state.scrollLeft : 0,
            handle: null, history: null});
        }
        active = scripts.find(script => script.id === stored.activeId) || scripts[0];
      }
      if (!scripts.length) {
        active = create(localStorage.getItem('py_editor_code_v1') ?? template);
        scripts.push(active);
        const caret = JSON.parse(localStorage.getItem('py_editor_caret_v1') || 'null');
        if (caret && Number.isInteger(caret.s) && Number.isInteger(caret.e)) {
          active.start = caret.s;
          active.end = caret.e;
        }
        active.scrollTop = Number(localStorage.getItem('py_editor_scroll_v1')) || 0;
      }
    } catch (_) { /* A malformed preference must not prevent opening the editor. */ }
    if (!scripts.length) { active = create(); scripts.push(active); }
    nextId = Math.max(...scripts.map(script => script.id)) + 1;
    if (linked !== null) {
      const existing = scripts.find(script => script.code === linked);
      if (existing) active = existing;
      else if (scripts.length === 1 && !active.name && active.code === template) {
        Object.assign(active, {code: linked, savedCode: linked, start: linked.length, end: linked.length});
      }
      else if (scripts.length < 3) { active = create(linked); scripts.push(active); }
      else if (window.confirm(message('pyReplaceSharedScript'))) {
        Object.assign(active, {code: linked, savedCode: linked, name: null, handle: null,
          start: linked.length, end: linked.length, scrollTop: 0, scrollLeft: 0, history: null});
      }
    }
    show(false);
  }

  function loaded(text, name = null, handle = null) {
    Object.assign(active, {code: text, savedCode: text, name, handle,
      start: text.length, end: text.length, scrollTop: 0, scrollLeft: 0, history: null});
    show();
  }

  add.addEventListener('click', () => {
    if (busyNow() || !active || scripts.length >= 3) return;
    capture();
    active = create();
    scripts.push(active);
    show();
  });
  editor.addEventListener('select', save);
  window.addEventListener('pagehide', save);
  new MutationObserver(render).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
  window.pythonScripts = {
    restore, save, loaded,
    snapshot: () => { capture(); return scripts.map(({id, name, code}) => ({id, name, code})); },
    current: () => { capture(); return active; },
    busy: busyNow,
    setExecuting(value) { executing = value; render(); },
    beginFileOperation() {
      if (!active || busyNow()) return false;
      fileOperation = true;
      render();
      return true;
    },
    endFileOperation() { fileOperation = false; save(); },
    saved(text, name, handle = active.handle) {
      active.savedCode = text;
      active.name = name;
      active.handle = handle;
      save();
    },
    reset() {
      if (busyNow()) return;
      loaded(template);
    }
  };
})();
