// ZIP exports snapshot all open scripts and their shared project files.
(() => {
  'use strict';
  const cleanPath = (name, fallback) => {
    const parts = String(name || '').replace(/\\/g, '/').split('/');
    if (parts.some(part => !part || part === '.' || part === '..' || /[:\x00-\x1f]/.test(part))) return fallback;
    return parts.join('/');
  };
  function uniqueName(name, used) {
    const dot = name.lastIndexOf('.');
    const stem = dot > name.lastIndexOf('/') ? name.slice(0, dot) : name;
    const extension = dot > name.lastIndexOf('/') ? name.slice(dot) : '';
    let candidate = name, index = 2;
    while (used.has(candidate.toLowerCase())) candidate = `${stem}-${index++}${extension}`;
    used.add(candidate.toLowerCase());
    return candidate;
  }
  async function download({scripts, files = [], extension, filename}) {
    const zip = new JSZip(), used = new Set();
    // Reserve data filenames first: scripts may refer to them by name.
    for (const file of files) {
      const name = cleanPath(file.name, 'fichier');
      zip.file(name, file.data);
      used.add(name.toLowerCase());
    }
    scripts.forEach((script, index) => {
      const fallback = `${extension === 'py' ? 'programme' : 'document'}${index ? '-' + (index + 1) : ''}.${extension}`;
      const name = cleanPath(script.name, fallback).split('/').pop();
      zip.file(uniqueName(name, used), script.code);
    });
    const blob = await zip.generateAsync({type: 'blob'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = filename;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  window.WorkshopProject = {download, uniqueName};
})();
