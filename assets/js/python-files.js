// Text workspace shared by the tabs and the Brython runner. No server writes.
(() => {
  'use strict';
  const storageKey = 'py_workspace_files_v1';
  const closedStorageKey = 'py_workspace_closed_files_v1';
  const files = new Map();
  const tabs = new Map();
  const tabbar = document.getElementById('fileTabs');
  const tabrow = document.getElementById('pythonFileTabs');
  const panes = document.getElementById('fileTabContent');
  const status = document.getElementById('filesStatus');
  const addButton = document.getElementById('addTextFileTab');
  const closedMenu = document.getElementById('closedTextFiles');
  const closedList = document.getElementById('closedTextFileList');
  let selected = null;
  let nextId = 0;
  let saveTimer;

  function message(key) {
    const lang = document.documentElement.lang || 'fr';
    return translations[lang]?.[key] || translations.fr[key] || key;
  }

  function save() {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(files)));
      localStorage.setItem(closedStorageKey, JSON.stringify([...files.keys()].filter(name => !tabs.has(name))));
      status.textContent = '';
    } catch (_) {
      status.textContent = message('pyStorageError');
    }
  }

  function select(name) {
    selected = tabs.has(name) ? name : (tabs.keys().next().value ?? null);
    for (const [key, tab] of tabs) {
      const active = key === selected;
      tab.button.classList.toggle('active', active);
      tab.button.setAttribute('aria-selected', String(active));
      tab.button.tabIndex = active ? 0 : -1;
      tab.pane.hidden = !active;
      tab.pane.classList.toggle('active', active);
    }
    const empty = tabs.size === 0;
    tabrow.classList.toggle('d-none', empty);
    panes.classList.toggle('d-none', empty);
    document.getElementById('exportTextFile').disabled = empty;
    document.getElementById('deleteTextFile').disabled = empty;
  }

  function refreshLabels() {
    addButton.title = message('pyNewFile');
    addButton.setAttribute('aria-label', message('pyNewFile'));
    for (const [name, tab] of tabs) {
      const label = `${message('pyCloseFile')} ${name}`;
      tab.close.title = label;
      tab.close.setAttribute('aria-label', label);
    }
  }

  function refreshClosedFiles() {
    closedList.replaceChildren();
    for (const name of files.keys()) {
      if (tabs.has(name)) continue;
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dropdown-item';
      button.textContent = name;
      button.title = name;
      button.addEventListener('click', () => openFile(name));
      item.append(button);
      closedList.append(item);
    }
    closedMenu.hidden = !closedList.children.length;
  }

  function closeFile(name) {
    const tab = tabs.get(name);
    if (!tab) return;
    const names = [...tabs.keys()];
    const index = names.indexOf(name);
    const next = selected === name ? (names[index + 1] ?? names[index - 1] ?? null) : selected;
    tab.item.remove();
    tab.pane.remove();
    tabs.delete(name);
    select(next);
    refreshClosedFiles();
    save();
    (tabs.get(selected)?.button ?? addButton).focus();
  }

  function openFile(name) {
    update(name, files.get(name), true);
    select(name);
    save();
    tabs.get(name).textarea.focus();
  }

  function update(name, text, open = !files.has(name)) {
    files.set(name, text);
    let tab = tabs.get(name);
    if (!tab && open) {
      const id = `python-text-${++nextId}`;
      const item = document.createElement('li');
      item.className = 'nav-item python-file-tab';
      item.setAttribute('role', 'presentation');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-link';
      button.id = `${id}-tab`;
      button.textContent = name;
      button.title = name;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', id);
      button.addEventListener('click', () => select(name));
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const names = [...tabs.keys()];
        let index = names.indexOf(name);
        if (event.key === 'Home') index = 0;
        else if (event.key === 'End') index = names.length - 1;
        else index = (index + (event.key === 'ArrowRight' ? 1 : -1) + names.length) % names.length;
        select(names[index]);
        tabs.get(names[index]).button.focus();
      });
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'python-file-close';
      close.textContent = '×';
      close.addEventListener('click', () => closeFile(name));
      item.append(button, close);
      tabbar.append(item);
      const pane = document.createElement('div');
      pane.id = id;
      pane.className = 'tab-pane h-100';
      pane.setAttribute('role', 'tabpanel');
      pane.setAttribute('aria-labelledby', button.id);
      const textarea = document.createElement('textarea');
      textarea.className = 'python-text-file';
      textarea.spellcheck = false;
      textarea.setAttribute('aria-label', name);
      textarea.addEventListener('input', () => {
        files.set(name, textarea.value);
        clearTimeout(saveTimer);
        saveTimer = setTimeout(save, 250);
      });
      pane.append(textarea);
      panes.append(pane);
      tab = {item, button, close, pane, textarea};
      tabs.set(name, tab);
      refreshLabels();
      refreshClosedFiles();
    }
    if (tab && tab.textarea.value !== text) {
      const {selectionStart, selectionEnd, scrollTop, scrollLeft} = tab.textarea;
      const editing = document.activeElement === tab.textarea;
      tab.textarea.value = text;
      if (editing) {
        tab.textarea.setSelectionRange(selectionStart, selectionEnd);
        tab.textarea.scrollTop = scrollTop;
        tab.textarea.scrollLeft = scrollLeft;
      }
    }
    select(selected ?? name);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 250);
  }

  function validName(name) {
    return name && name !== '.' && name !== '..' && !/[\/\\\u0000-\u001f]/.test(name);
  }

  function put(name, text) {
    update(name, text.replace(/\r\n?/g, '\n'), true);
    select(name);
    save();
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Only this small bridge is exposed to Python; names are never HTML or selectors.
  window.pythonFiles = {
    serialize: () => JSON.stringify(Object.fromEntries(files)),
    read: name => files.get(name) ?? null,
    update,
    save
  };
  try {
    let closed = [];
    try {
      const savedClosed = JSON.parse(localStorage.getItem(closedStorageKey) || '[]');
      if (Array.isArray(savedClosed)) closed = savedClosed;
    } catch (_) { /* File contents can still be restored if tab preferences are invalid. */ }
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [name, text] of Object.entries(saved)) {
        if (validName(name) && typeof text === 'string') update(name, text, !closed.includes(name));
      }
    }
  } catch (_) {
    status.textContent = message('pyStorageError');
  }
  select(selected);
  refreshClosedFiles();
  refreshLabels();
  new MutationObserver(refreshLabels).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
  window.addEventListener('pagehide', save);

  function newFile() {
    const answer = window.prompt(message('pyNamePrompt'), 'essai.txt');
    if (answer === null) return;
    const name = answer.trim();
    if (!validName(name)) return window.alert(message('pyInvalidName'));
    if (files.has(name)) {
      openFile(name);
      return;
    }
    put(name, '');
    tabs.get(name).textarea.focus();
  }
  document.getElementById('newTextFile').addEventListener('click', newFile);
  addButton.addEventListener('click', newFile);

  const picker = document.getElementById('textFileInput');
  document.getElementById('importTextFiles').addEventListener('click', () => picker.click());
  picker.addEventListener('change', async () => {
    try {
      for (const file of picker.files) {
        if (!validName(file.name)) throw new Error(message('pyInvalidName'));
        if (files.has(file.name) && !window.confirm(`${message('pyReplaceFile')} ${file.name} ?`)) continue;
        const text = new TextDecoder('utf-8', {fatal: true}).decode(await file.arrayBuffer());
        put(file.name, text);
      }
    } catch (error) {
      window.alert(`${message('pyImportError')}\n${error.message}`);
    } finally {
      picker.value = '';
    }
  });

  document.getElementById('exportTextFile').addEventListener('click', () => {
    if (selected !== null) download(new Blob([files.get(selected)], {type: 'text/plain;charset=utf-8'}), selected);
  });
  document.getElementById('exportPythonProject').addEventListener('click', async () => {
    try {
      const scripts = window.pythonScripts.snapshot();
      const data = [...files].map(([name, text]) => ({name, data: text}));
      await WorkshopProject.download({scripts, files: data, extension: 'py', filename: 'atelier-python.zip'});
    } catch (error) {
      window.alert(error.message);
    }
  });
  document.getElementById('deleteTextFile').addEventListener('click', () => {
    if (selected === null || !window.confirm(`${message('pyDeleteConfirm')} ${selected} ?`)) return;
    const name = selected;
    files.delete(name);
    closeFile(name);
  });
})();
