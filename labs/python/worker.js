// This thread can be terminated even while Python never yields.
'use strict';
let control;
let bytes;
let output = '';
let lastOutput = 0;
let initializing = false;
let ready = false;
let running = false;
const decoder = new TextDecoder();
const MAX_OUTPUT = 100000;

function flushOutput(force = false) {
  if (output && (force || performance.now() - lastOutput >= 100)) {
    self.postMessage({type: 'output', text: output});
    output = '';
    lastOutput = performance.now();
  }
}

self.workshopOutput = text => {
  output = (output + text).slice(-MAX_OUTPUT);
  flushOutput();
};
self.workshopRequest = (kind, json) => {
  if (!control) {
    return JSON.stringify({error: {type: 'RuntimeError', message:
      'Les fichiers en direct, input() et Turtle nécessitent le serveur local fourni (python3 ServeurHTTP_Web.py).'}});
  }
  flushOutput(true);
  Atomics.store(control, 0, 0);
  self.postMessage({type: 'request', kind, payload: JSON.parse(json)});
  Atomics.wait(control, 0, 0);
  // TextDecoder accepts ordinary buffers, not a view over shared memory.
  return decoder.decode(new Uint8Array(bytes.subarray(0, Atomics.load(control, 1))));
};
self.workshopFinished = line => {
  flushOutput(true);
  running = false;
  self.postMessage({type: 'done', line: Number.isInteger(line) ? line : null});
};
self.workshopReady = () => {
  ready = true;
  self.postMessage({type: 'ready'});
};

async function initialize(shared) {
  if (shared) {
    control = new Int32Array(shared, 0, 2);
    bytes = new Uint8Array(shared, 8);
  }
  try {
    const runtime = new URL('../../assets/js/dist/brython@3.13.2/', self.location.href);
    self.__BRYTHON__ = {brython_path: runtime.href};
    importScripts(new URL('brython_min.js', runtime).href, new URL('brython_stdlib.js', runtime).href);
    __BRYTHON__.handle_error = error => {
      flushOutput(true);
      self.postMessage({type: 'error', text: String(error.message || error)});
    };
    const modules = ['virtual_files', 'execution', 'worker_runtime'];
    const sources = await Promise.all(modules.map(async name => {
      const response = await fetch(`${name}.py`);
      if (!response.ok) throw new Error(`Chargement impossible : ${name}.py`);
      return [name, ['.py', await response.text(), []]];
    }));
    __BRYTHON__.update_VFS(Object.fromEntries(sources));
    brython({debug: 1, indexedDB: false});
    __BRYTHON__.runPythonSource('import worker_runtime', {id: 'workshop_worker'});
  } catch (error) {
    flushOutput(true);
    self.postMessage({type: 'error', text: String(error.message || error)});
  }
}

self.onmessage = event => {
  if (event.data.type === 'init' && !initializing) {
    initializing = true;
    initialize(event.data.shared);
  } else if (event.data.type === 'run' && ready && !running) {
    running = true;
    output = '';
    lastOutput = performance.now() - 100;
    try {
      self.workshopRun(event.data.code, event.data.files);
    } catch (error) {
      flushOutput(true);
      self.postMessage({type: 'error', text: String(error.message || error)});
    }
  }
};
