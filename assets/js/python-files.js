// Text workspace shared by the tabs and the Brython runner. No server writes.
(() => {
  'use strict';
  const storageKey = 'py_workspace_files_v1';
  const files = new Map();
  const tabs = new Map();
  const tabbar = document.getElementById('fileTabs');
  const panes = document.getElementById('fileTabContent');
  const status = document.getElementById('filesStatus');
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
      status.textContent = '';
    } catch (_) {
      status.textContent = message('pyStorageError');
    }
  }

  function select(name) {
    selected = name;
    for (const [key, tab] of tabs) {
      const active = key === name;
      tab.button.classList.toggle('active', active);
      tab.button.setAttribute('aria-selected', String(active));
      tab.button.tabIndex = active ? 0 : -1;
      tab.pane.hidden = !active;
      tab.pane.classList.toggle('active', active);
    }
    const empty = files.size === 0;
    tabbar.classList.toggle('d-none', empty);
    panes.classList.toggle('d-none', empty);
    document.getElementById('exportTextFile').disabled = empty;
    document.getElementById('deleteTextFile').disabled = empty;
  }

  function update(name, text) {
    files.set(name, text);
    let tab = tabs.get(name);
    if (!tab) {
      const id = `python-text-${++nextId}`;
      const item = document.createElement('li');
      item.className = 'nav-item';
      item.setAttribute('role', 'presentation');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-link';
      button.id = `${id}-tab`;
      button.textContent = name;
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
      item.append(button);
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
      tab = {item, button, pane, textarea};
      tabs.set(name, tab);
    }
    if (tab.textarea.value !== text) {
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
    update(name, text.replace(/\r\n?/g, '\n'));
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
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [name, text] of Object.entries(saved)) {
        if (validName(name) && typeof text === 'string') update(name, text);
      }
    }
  } catch (_) {
    status.textContent = message('pyStorageError');
  }
  select(selected);
  window.addEventListener('pagehide', save);

  document.getElementById('newTextFile').addEventListener('click', () => {
    const answer = window.prompt(message('pyNamePrompt'), 'essai.txt');
    if (answer === null) return;
    const name = answer.trim();
    if (!validName(name)) return window.alert(message('pyInvalidName'));
    if (files.has(name)) {
      select(name);
      return;
    }
    put(name, '');
    tabs.get(name).textarea.focus();
  });

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
      const zip = new JSZip();
      let scriptName = 'programme.py';
      for (let i = 1; files.has(scriptName); i++) scriptName = `programme-${i}.py`;
      zip.file(scriptName, document.getElementById('code').value);
      for (const [name, text] of files) zip.file(name, text);
      download(await zip.generateAsync({type: 'blob'}), 'atelier-python.zip');
    } catch (error) {
      window.alert(error.message);
    }
  });
  document.getElementById('deleteTextFile').addEventListener('click', () => {
    if (selected === null || !window.confirm(`${message('pyDeleteConfirm')} ${selected} ?`)) return;
    const tab = tabs.get(selected);
    tab.item.remove();
    tab.pane.remove();
    files.delete(selected);
    tabs.delete(selected);
    select(files.keys().next().value ?? null);
    save();
  });
})();
