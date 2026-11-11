// Three independent documents share the existing editor and toolbar.
(() => {
  'use strict';
  window.workshopMessage = key => {
    const lang = document.documentElement.lang || 'fr';
    return translations[lang]?.[key] || translations.fr[key];
  };
  window.workshopDownload = (name, data, type = 'text/plain;charset=utf-8') => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], {type}));
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  window.workshopPickFiles = (accept, multiple = false) => new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener('change', () => resolve([...input.files]), {once: true});
    input.addEventListener('cancel', () => resolve([]), {once: true});
    input.click();
  });
  window.createWorkshopDocuments = options => {
    const editor = document.getElementById('code');
    const badges = document.getElementById('documentBadges');
    const add = document.getElementById('addDocument');
    const storageKey = `${options.prefix}_documents_v1`;
    const msg = window.workshopMessage;
    const panelId = options.panelId || 'documentEditorPanel';
    const legacyVersion = options.legacyVersion || 'v1';
    const saveId = options.saveId || 'saveLocal';
    let documents = [], active, nextId = 1, changing = false, locked = false;
    const nodes = new Map();
    const extraSignature = extra => options.signature?.(extra) || '';
    const fresh = (code = options.template) => ({id: nextId++, name: null, handle: null,
      code, savedCode: code, start: code.length, end: code.length, scrollTop: 0, scrollLeft: 0,
      extras: options.empty?.() || {}, savedExtras: extraSignature(options.empty?.() || {}),
      history: null, runtime: {}});
    const label = doc => doc.name || `${msg('pyUntitledScript')} ${doc.id}.${options.extension}`;
    const dirty = doc => doc.code !== doc.savedCode || extraSignature(doc.extras) !== doc.savedExtras;
    function capture() {
      if (!active || changing) return;
      Object.assign(active, {code: editor.value, start: editor.selectionStart, end: editor.selectionEnd,
        scrollTop: editor.scrollTop, scrollLeft: editor.scrollLeft, history: editor.editorHistory?.capture() || null});
      options.capture?.(active);
    }
    function render() {
      if (!active) return;
      for (const [id, node] of nodes) {
        if (documents.some(doc => doc.id === id)) continue;
        node.pill.remove(); nodes.delete(id);
      }
      for (const doc of documents) {
        let node = nodes.get(doc.id);
        if (!node) {
          const pill = document.createElement('span');
          pill.className = 'badge rounded-pill document-badge';
          pill.setAttribute('role', 'presentation');
          const button = document.createElement('button');
          button.type = 'button'; button.className = 'document-name'; button.id = `document-${doc.id}`;
          button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panelId);
          button.addEventListener('click', () => select(doc));
          button.addEventListener('keydown', event => {
            if (locked || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const index = event.key === 'Home' ? 0 : event.key === 'End' ? documents.length - 1
              : (documents.indexOf(doc) + (event.key === 'ArrowRight' ? 1 : -1) + documents.length) % documents.length;
            select(documents[index]); nodes.get(active.id).button.focus();
          });
          const close = document.createElement('button');
          close.type = 'button'; close.className = 'document-close'; close.textContent = '×';
          close.addEventListener('click', () => {
            if (locked || documents.length < 2) return;
            capture();
            if (dirty(doc) && !confirm(`${msg('docCloseUnsaved')} ${label(doc)} ?`)) return;
            const index = documents.indexOf(doc);
            documents.splice(index, 1);
            if (active === doc) { active = documents[Math.min(index, documents.length - 1)]; show(); }
            else save();
            nodes.get(active.id).button.focus();
          });
          pill.append(button, close); badges.append(pill);
          node = {pill, button, close}; nodes.set(doc.id, node);
        }
        const selected = active === doc;
        node.pill.classList.toggle('text-bg-success', selected);
        node.pill.classList.toggle('text-bg-info', !selected);
        node.button.textContent = label(doc) + (dirty(doc) ? ' ●' : '');
        node.button.title = label(doc);
        node.button.setAttribute('aria-label', label(doc));
        node.button.setAttribute('aria-selected', String(selected));
        node.button.tabIndex = selected ? 0 : -1;
        node.button.disabled = node.close.disabled = locked;
        node.close.hidden = documents.length === 1;
        node.close.title = `${msg('docClose')} ${label(doc)}`;
        node.close.setAttribute('aria-label', node.close.title);
      }
      add.hidden = documents.length >= 3; add.disabled = locked;
      add.title = msg('docNew'); add.setAttribute('aria-label', add.title);
      badges.setAttribute('aria-label', msg('docDocuments'));
      document.getElementById(panelId).setAttribute('aria-labelledby', `document-${active.id}`);
      document.getElementById('dirtyDot').style.display = dirty(active) ? '' : 'none';
      document.title = `${options.title} | ${label(active)}${dirty(active) ? ' ●' : ''}`;
      for (const id of ['dropdownFiles', 'reset', 'run', 'projectMenu', 'clear']) {
        const element = document.getElementById(id);
        if (element) element.disabled = locked;
      }
      const saveButton = document.getElementById(saveId);
      saveButton.classList.toggle('disabled', locked);
      saveButton.setAttribute('aria-disabled', String(locked));
    }
    function save() {
      if (!active || changing) return;
      capture(); render();
      try {
        localStorage.setItem(storageKey, JSON.stringify({activeId: active.id,
          documents: documents.map(({handle, history, runtime, ...state}) => state)}));
        localStorage.setItem(`${options.prefix}_code_${legacyVersion}`, active.code);
        localStorage.setItem(`${options.prefix}_caret_${legacyVersion}`, JSON.stringify({s: active.start, e: active.end}));
        localStorage.setItem(`${options.prefix}_scroll_${legacyVersion}`, String(active.scrollTop));
      } catch (_) {
        const status = document.getElementById('filesStatus');
        if (status) status.textContent = msg('docStorageError');
        else window.toast?.(msg('docStorageError'));
      }
    }
    function show(focus = true) {
      changing = true;
      try {
        editor.value = active.code;
        editor.editorHistory?.restore(active.history);
        editor.setSelectionRange(active.start, active.end);
        options.show?.(active);
        editor.dispatchEvent(new Event('input', {bubbles: true}));
        if (focus) editor.focus({preventScroll: true});
        editor.scrollTop = active.scrollTop; editor.scrollLeft = active.scrollLeft;
        editor.dispatchEvent(new Event('scroll'));
        document.getElementById('ac')?.classList.add('hidden');
      } finally { changing = false; }
      save();
    }
    function select(doc) {
      if (locked || doc === active) return;
      capture(); active = doc; show();
    }
    function loaded(code, name = null, handle = null, extras = options.empty?.() || {}) {
      Object.assign(active, {code, savedCode: code, name, handle, extras, savedExtras: extraSignature(extras),
        start: code.length, end: code.length, scrollTop: 0, scrollLeft: 0, history: null, runtime: {}});
      show();
    }
    function begin() {
      if (!active || locked) return false;
      locked = true; render(); return true;
    }
    function end() { locked = false; save(); }
    async function operation(callback) {
      if (!begin()) return;
      try { return await callback(); }
      catch (error) {
        if (error?.name !== 'AbortError') { console.error(error); alert(msg('docFileError')); }
      } finally { end(); }
    }
    async function saveFile(saveAs = false) {
      return operation(async () => {
        capture();
        const snapshot = {code: active.code, extras: structuredClone(options.snapshotExtras?.() || active.extras)};
        let handle = active.handle;
        let name = active.name || options.filename();
        if (typeof window.showSaveFilePicker === 'function') {
          if (!handle || saveAs) handle = await window.showSaveFilePicker({suggestedName: name, types: options.types});
          const writable = await handle.createWritable();
          await writable.write(snapshot.code); await writable.close();
          // Commit the HTML/Markdown identity only after the write succeeds.
          active.handle = handle; active.name = handle.name; active.savedCode = snapshot.code;
          await options.saveExtras?.(snapshot.extras, active, saveAs);
          active.savedExtras = extraSignature(snapshot.extras);
          options.savedExtras?.(snapshot.extras);
        } else {
          await downloadSnapshot(snapshot, name);
          Object.assign(active, {name, savedCode: snapshot.code, savedExtras: extraSignature(snapshot.extras)});
          options.savedExtras?.(snapshot.extras);
        }
      });
    }
    async function downloadSnapshot(snapshot, name) {
      if (options.download) await options.download(snapshot, name);
      else workshopDownload(name, snapshot.code, options.mime);
    }
    async function importFile(file, handle = null) {
      if (dirty(active) && !confirm(msg('docReplace'))) return;
      if (options.importFile) await options.importFile(file, handle, loaded);
      else loaded(await file.text(), file.name, handle);
    }
    document.getElementById(options.openId || 'openLocal').addEventListener('click', event => {
      event.preventDefault();
      operation(async () => {
        if (typeof window.showOpenFilePicker === 'function') {
          const [handle] = await window.showOpenFilePicker({types: options.openTypes || options.types, multiple: false});
          await importFile(await handle.getFile(), handle);
        } else {
          const [file] = await workshopPickFiles(options.accept);
          if (file) await importFile(file);
        }
      });
    });
    for (const [id, saveAs] of [[saveId, false], [options.saveAsId, true]]) {
      document.getElementById(id).addEventListener('click', event => { event.preventDefault(); saveFile(saveAs); });
    }
    editor.addEventListener('dragover', event => { event.preventDefault(); });
    editor.addEventListener('drop', event => {
      event.stopPropagation();
      event.preventDefault(); editor.classList.remove('dragover');
      const file = event.dataTransfer.files[0];
      if (file) operation(() => importFile(file));
    });
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault(); saveFile(event.shiftKey);
      }
    });
    document.getElementById('reset').addEventListener('click', () => {
      if (!locked && confirm(msg('docReset'))) loaded(options.template);
    });
    add.addEventListener('click', () => {
      if (locked || documents.length >= 3) return;
      capture(); active = fresh(); documents.push(active); show();
    });
    ['input', 'select', 'scroll'].forEach(event => editor.addEventListener(event, save));
    window.addEventListener('pagehide', save);
    window.addEventListener('beforeunload', event => {
      save();
      if (documents.some(dirty) || options.sharedDirty?.()) { event.preventDefault(); event.returnValue = ''; }
    });
    new MutationObserver(render).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
    const api = {save, loaded, operation, busy: () => locked, current: () => { capture(); return active; },
      snapshot: () => { capture(); return documents.map(({id, name, code}) => ({id, name, code})); },
      exportProject: () => operation(async () => {
        const scripts = api.snapshot();
        const extras = structuredClone(options.snapshotExtras?.() || {});
        const files = options.projectFiles?.() || [];
        await WorkshopProject.download({scripts, files, extension: options.extension, filename: `atelier-${options.projectName || options.extension}.zip`});
        for (const snapshot of scripts) {
          const doc = documents.find(doc => doc.id === snapshot.id);
          if (doc) doc.savedCode = snapshot.code;
        }
        options.savedExtras?.(extras);
      }),
      download: () => operation(async () => {
        capture();
        const snapshot = {code: active.code, extras: structuredClone(options.snapshotExtras?.() || active.extras)};
        const name = active.name || options.filename();
        await downloadSnapshot(snapshot, name);
        Object.assign(active, {name, savedCode: snapshot.code, savedExtras: extraSignature(snapshot.extras)});
        options.savedExtras?.(snapshot.extras);
      })};
    window.workshopDocuments = api;
    document.getElementById(options.projectButton || 'exportProject')?.addEventListener('click', api.exportProject);
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
      for (const state of (Array.isArray(stored?.documents) ? stored.documents.slice(0, 3) : [])) {
        if (!state || typeof state.code !== 'string' || !Number.isSafeInteger(state.id) || state.id < 1
            || documents.some(doc => doc.id === state.id)) continue;
        const doc = fresh(state.code);
        for (const key of ['id', 'start', 'end', 'scrollTop', 'scrollLeft']) {
          if (Number.isFinite(state[key])) doc[key] = state[key];
        }
        for (const key of ['name', 'savedCode', 'savedExtras']) if (typeof state[key] === 'string') doc[key] = state[key];
        doc.extras = options.validate?.(state.extras) || {};
        documents.push(doc);
      }
      active = documents.find(doc => doc.id === stored?.activeId) || documents[0];
      if (!active) {
        active = fresh(localStorage.getItem(`${options.prefix}_code_${legacyVersion}`) ?? options.template); documents.push(active);
        const caret = JSON.parse(localStorage.getItem(`${options.prefix}_caret_${legacyVersion}`) || 'null');
        if (Number.isInteger(caret?.s) && Number.isInteger(caret?.e)) { active.start = caret.s; active.end = caret.e; }
        active.scrollTop = Number(localStorage.getItem(`${options.prefix}_scroll_${legacyVersion}`)) || 0;
      }
    } catch (_) { /* Malformed storage must not prevent editing. */ }
    if (!active) { active = fresh(); documents.push(active); }
    nextId = Math.max(...documents.map(doc => doc.id)) + 1;
    const linked = options.linked;
    if (typeof linked === 'string') {
      const existing = documents.find(doc => doc.code === linked);
      if (existing) active = existing;
      else if (documents.length === 1 && !active.name && active.code === options.template) {
        documents[0] = active = fresh(linked);
      } else if (documents.length < 3) { active = fresh(linked); documents.push(active); }
      else if (confirm(msg('docReplaceShared'))) {
        const index = documents.indexOf(active);
        documents[index] = active = fresh(linked);
      }
    }
    options.prepare?.(documents, active);
    show(false);
    return api;
  };
})();
