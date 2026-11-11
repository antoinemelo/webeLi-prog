// CSS files belong to the active HTML document; closing a tab keeps its contents.
(() => {
  'use strict';
  const files = new Map();
  const tabbar = document.getElementById('fileTabsCss');
  const content = document.getElementById('fileTabContentCss');
  let activeName = null, serial = 0, restoring = false;
  const storageKey = 'html_workspace_css_v1';
  const handles = Object.create(null);
  let savedSignature = '[]';
  const msg = key => workshopMessage(key);
  const valid = name => typeof name === 'string' && name.length <= 200 && /\.css$/i.test(name)
    && !/[:\\\x00-\x1f<>"?#]/.test(name) && !name.startsWith('/')
    && name.split('/').every(part => part && part !== '.' && part !== '..');
  function signature(state) {
    return JSON.stringify((state.files || []).map(({name, value}) => [name, value]).sort((a, b) => a[0].localeCompare(b[0])));
  }
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify({...snapshot(), savedSignature})); }
    catch (_) { document.getElementById('filesStatus').textContent = msg('docStorageError'); }
  }
  function changed() {
    if (restoring) return;
    persist(); window.workshopDocuments?.save();
  }
  function render() {
    const opened = [...files.values()].filter(file => !file.closed);
    if (!opened.some(file => file.name === activeName)) activeName = opened[0]?.name || null;
    for (const file of files.values()) {
      const selected = !file.closed && file.name === activeName;
      file.tab.hidden = file.closed;
      file.button.classList.toggle('active', selected);
      file.button.setAttribute('aria-selected', String(selected));
      file.button.tabIndex = selected ? 0 : -1;
      file.pane.classList.toggle('active', selected);
      file.pane.classList.toggle('show', selected);
      file.close.title = `${msg('pyCloseFile')} ${file.name}`;
      file.close.setAttribute('aria-label', file.close.title);
    }
    document.getElementById('cssFileTabs').classList.toggle('d-none', !opened.length);
    content.classList.toggle('d-none', !opened.length);
    for (const id of ['exportCssFile', 'deleteCssFile']) document.getElementById(id).disabled = !activeName;
    const closedList = document.getElementById('closedCssFileList');
    closedList.replaceChildren();
    for (const file of files.values()) {
      if (!file.closed) continue;
      const item = document.createElement('li'), button = document.createElement('button');
      button.className = 'dropdown-item'; button.textContent = file.name; button.type = 'button';
      button.addEventListener('click', () => open(file.name));
      item.append(button); closedList.append(item);
    }
    document.getElementById('closedCssFiles').hidden = !closedList.children.length;
    const add = document.getElementById('addCssFile');
    add.title = msg('cssNewFile'); add.setAttribute('aria-label', add.title);
  }
  function addFile(name, value = '', closed = false) {
    const tab = document.createElement('li');
    tab.className = 'nav-item css-file-tab'; tab.setAttribute('role', 'presentation');
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'nav-link'; button.textContent = name;
    button.setAttribute('role', 'tab'); button.id = `css-tab-${++serial}`;
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'css-file-close'; close.textContent = '×';
    const pane = document.createElement('div');
    pane.className = 'tab-pane'; pane.id = `css-pane-${serial}`; pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('aria-labelledby', button.id); button.setAttribute('aria-controls', pane.id);
    const editor = document.createElement('textarea');
    editor.className = 'css-text-file'; editor.spellcheck = false; editor.value = value;
    editor.setAttribute('aria-label', name); pane.append(editor); content.append(pane);
    tab.append(button, close); tabbar.append(tab);
    const file = {name, closed, editor, tab, button, close, pane};
    files.set(name, file);
    window.openCssFiles[name] = editor; // Includes closed files for preview and export.
    button.addEventListener('click', () => { activeName = name; render(); changed(); });
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const opened = [...files.values()].filter(item => !item.closed);
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? opened.length - 1
        : (opened.indexOf(file) + (event.key === 'ArrowRight' ? 1 : -1) + opened.length) % opened.length;
      activeName = opened[index].name; render(); changed(); opened[index].button.focus();
    });
    close.addEventListener('click', () => { file.closed = true; render(); changed(); });
    ['input', 'select', 'scroll'].forEach(event => editor.addEventListener(event, changed));
    return file;
  }
  function open(name) {
    if (!valid(name)) return null;
    const file = files.get(name) || addFile(name);
    file.closed = false; activeName = name; render(); changed(); return file.editor;
  }
  function snapshot() {
    return {files: [...files.values()].map(file => ({name: file.name, value: file.editor.value,
      closed: file.closed, start: file.editor.selectionStart, end: file.editor.selectionEnd,
      scrollTop: file.editor.scrollTop, scrollLeft: file.editor.scrollLeft})), activeName};
  }
  function validate(state) {
    const seen = new Set();
    return {files: (Array.isArray(state?.files) ? state.files : []).filter(file => {
      if (!valid(file?.name) || typeof file.value !== 'string' || seen.has(file.name)) return false;
      seen.add(file.name); return true;
    }), activeName: state?.activeName || null, preview: typeof state?.preview === 'string' ? state.preview : ''};
  }
  function restore(state) {
    restoring = true;
    files.clear(); tabbar.replaceChildren(); content.replaceChildren(); window.openCssFiles = Object.create(null);
    for (const data of validate(state).files) {
      const file = addFile(data.name, data.value, !!data.closed);
      file.editor.setSelectionRange(data.start || 0, data.end || 0);
      file.editor.scrollTop = data.scrollTop || 0; file.editor.scrollLeft = data.scrollLeft || 0;
    }
    activeName = state?.activeName || null; render(); restoring = false;
  }
  function linkedNames(code) {
    const parsed = new DOMParser().parseFromString(code, 'text/html');
    return [...parsed.querySelectorAll('link[rel~="stylesheet"][href]')].map(link => link.getAttribute('href').replace(/^\.\//, ''));
  }
  function attach(name) {
    const editor = document.getElementById('code');
    if (linkedNames(editor.value).includes(name)) return;
    const link = `<link rel="stylesheet" href="${name.replace(/&/g, '&amp;')}">`;
    editor.value = /<\/head\s*>/i.test(editor.value) ? editor.value.replace(/<\/head\s*>/i, `${link}\n</head>`)
      : link + '\n' + editor.value;
    editor.dispatchEvent(new Event('input', {bubbles: true}));
  }
  function newFile() {
    if (window.workshopDocuments?.busy()) return;
    const missing = linkedNames(document.getElementById('code').value).find(name => valid(name) && !files.has(name));
    let name = prompt(msg('cssNamePrompt'), missing || 'style.css');
    if (name === null) return;
    name = name.trim();
    if (!valid(name)) { alert(msg('cssInvalidName')); return; }
    if (!files.has(name)) addFile(name, name === 'style_ini.css'
      ? 'header, footer { background:#BEBEBE; color:white; padding:0.5rem; }\nmain { padding:1rem; }\nh1 { color:red; }' : '');
    open(name); attach(name); changed();
  }
  async function importFiles() {
    await workshopDocuments.operation(async () => {
      let picked;
      if (typeof window.showOpenFilePicker === 'function') {
        const handles = await window.showOpenFilePicker({types: [{description: 'CSS', accept: {'text/css': ['.css']}}], multiple: true});
        picked = await Promise.all(handles.map(async handle => ({file: await handle.getFile(), handle})));
      } else picked = (await workshopPickFiles('.css,text/css', true)).map(file => ({file, handle: null}));
      for (const {file, handle} of picked) {
        const matches = linkedNames(document.getElementById('code').value).filter(name => name === file.name || name.endsWith('/' + file.name));
        const name = matches.length === 1 ? matches[0] : file.name;
        if (!valid(name)) { alert(msg('cssInvalidName')); continue; }
        if (files.has(name) && !confirm(`${msg('pyReplaceFile')} ${name} ?`)) continue;
        const value = await file.text();
        open(name).value = value;
        handles[name] = handle;
        attach(name); changed();
      }
    });
  }
  function inline(code, transform = value => value) {
    return code.replace(/<!--[\s\S]*?-->|<link\b[^>]*>/gi, tag => {
      if (tag.startsWith('<!--')) return tag;
      const element = new DOMParser().parseFromString(tag, 'text/html').querySelector('link[rel~="stylesheet"][href]');
      const name = element?.getAttribute('href').replace(/^\.\//, '');
      const file = files.get(name);
      return file ? `<style>\n${transform(file.editor.value).replace(/<\/style/gi, '<\\/style')}\n</style>` : tag;
    });
  }
  document.getElementById('newCssFile').addEventListener('click', newFile);
  document.getElementById('addCssFile').addEventListener('click', newFile);
  document.getElementById('importCssFiles').addEventListener('click', importFiles);
  document.getElementById('exportCssFile').addEventListener('click', () => {
    const file = files.get(activeName);
    if (file) workshopDownload(file.name, file.editor.value, 'text/css;charset=utf-8');
  });
  document.getElementById('deleteCssFile').addEventListener('click', () => {
    if (workshopDocuments.busy()) return;
    const file = files.get(activeName);
    if (!file || !confirm(`${msg('pyDeleteConfirm')} ${file.name} ?`)) return;
    files.delete(file.name); delete window.openCssFiles[file.name]; delete handles[file.name];
    file.tab.remove(); file.pane.remove(); render(); changed();
  });
  new MutationObserver(render).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
  window.openCssFiles = Object.create(null);
  window.openCssFile = open;
  function initialize(documents, activeDocument) {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) {}
    if (stored && Array.isArray(stored.files)) {
      restore(stored);
      savedSignature = typeof stored.savedSignature === 'string' ? stored.savedSignature : signature(snapshot());
    } else {
      // Migrate the former per-document CSS without dropping conflicting files.
      const merged = new Map();
      const ordered = [activeDocument, ...documents.filter(doc => doc !== activeDocument)];
      const used = new Set(ordered.flatMap(doc => validate(doc.extras).files.map(file => file.name.toLowerCase())));
      for (const doc of ordered) {
        for (const data of validate(doc.extras).files) {
          let name = data.name;
          const previous = merged.get(name);
          if (previous && previous.value !== data.value) {
            name = WorkshopProject.uniqueName(name, used);
            const rewrite = code => code.replace(/<!--[\s\S]*?-->|<link\b[^>]*>/gi, tag => {
              if (tag.startsWith('<!--')) return tag;
              return tag.replace(/(\bhref\s*=\s*)(["'])(.*?)\2/i, (match, prefix, quote, href) =>
                href.replace(/^\.\//, '') === data.name ? prefix + quote + name + quote : match);
            });
            doc.code = rewrite(doc.code);
          }
          if (!merged.has(name)) merged.set(name, {...data, name});
          else if (!data.closed) merged.get(name).closed = false;
        }
      }
      restore({files: [...merged.values()], activeName: activeDocument.extras?.activeName});
      savedSignature = signature(snapshot());
    }
    for (const doc of documents) {
      doc.extras = {preview: doc.extras?.preview || ''};
      doc.savedExtras = '';
    }
    persist();
  }
  function merge(state) {
    for (const data of validate(state).files) {
      const existing = files.get(data.name);
      if (existing && existing.editor.value !== data.value && !confirm(`${msg('pyReplaceFile')} ${data.name} ?`)) continue;
      const editor = open(data.name);
      editor.value = data.value;
      delete handles[data.name];
    }
    changed();
  }
  window.addEventListener('pagehide', persist);
  window.htmlCssFiles = {snapshot, restore, validate, inline, initialize, merge, handles, signature,
    dirty: () => signature(snapshot()) !== savedSignature,
    markSaved(state) { savedSignature = signature(state); persist(); }};
})();
