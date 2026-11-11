
	  // Line numbers (wrap-aware + "…")
	  (function(){
		const codeEl = document.getElementById('code');
		const gutter = document.getElementById('gutter');
		const url = new URL(window.location.href);
		const light = url.searchParams.get("light");
		if (light !== "1") {
		  document.getElementById("btnHelp")?.classList.add("d-none");
		}
		if (light == "1") {
		  document.getElementById("lightCopyLink")?.classList.remove("d-none");
		  document.getElementById("ShareIframe")?.classList.add("d-none");
		  document.getElementById("reset")?.classList.add("d-none");
		  document.getElementById("saveAsLocal")?.classList.add("d-none");
		}

		function updateGutter(){
		  if(!codeEl || !gutter) return;

		  const lines = codeEl.value.split(/\r?\n/);
		  let html = '';
		  for (let index = 0; index < lines.length; index++){
			const line = index + 1;
			html += `<div data-line="${line}">${line}</div>`;
		  }

		  gutter.innerHTML = html;
		  gutter.scrollTop = codeEl.scrollTop;
		}

		const ro = new ResizeObserver(() => updateGutter());
		ro.observe(codeEl);

		// Évènements
		codeEl.addEventListener('input', updateGutter);
		codeEl.addEventListener('scroll', ()=>{
		  gutter.scrollTop = codeEl.scrollTop;

		  const hi = document.getElementById('highlighting');
		  if (hi){
			hi.scrollTop  = codeEl.scrollTop;
			hi.scrollLeft = codeEl.scrollLeft;
		  }
		});

		// La hauteur reste pilotée par CSS; le ResizeObserver gère la largeur.
		window.addEventListener('load',  updateGutter);
	  })();

    // Draggable splitter
    (function(){
      const root = document.documentElement;
      const divider = document.getElementById('divider');
      const split = document.querySelector('.split');
      const lsKey = 'split_left_percent_v1';
      const saved = localStorage.getItem(lsKey);
      if(saved){ root.style.setProperty('--left', saved); }
      let dragging = false;

      function onMove(clientX){
        const rect = split.getBoundingClientRect();
        let x = clientX - rect.left;
        const min = 200; // px
        const max = rect.width - 200;
        x = Math.max(min, Math.min(max, x));
        const percent = (x / rect.width) * 100;
        const val = percent.toFixed(1) + '%';
        root.style.setProperty('--left', val);
      }

      divider.addEventListener('mousedown', (e)=>{
        dragging = true; document.body.classList.add('dragging'); e.preventDefault();
      });
      window.addEventListener('mousemove', (e)=>{ if(dragging) onMove(e.clientX); });
      window.addEventListener('mouseup', ()=>{
        if(dragging){
          dragging = false; document.body.classList.remove('dragging');
          localStorage.setItem(lsKey, getComputedStyle(root).getPropertyValue('--left').trim());
        }
      });
      // Touch
      divider.addEventListener('touchstart', (e)=>{ dragging = true; document.body.classList.add('dragging'); }, {passive:true});
      window.addEventListener('touchmove', (e)=>{ if(dragging) onMove(e.touches[0].clientX); }, {passive:false});
      window.addEventListener('touchend', ()=>{
        if(dragging){
          dragging = false; document.body.classList.remove('dragging');
          localStorage.setItem(lsKey, getComputedStyle(root).getPropertyValue('--left').trim());
        }
      });
    })();

	// Clear output
	const btnClear = document.getElementById('clear');
	if (btnClear) {
	  btnClear.addEventListener('click', () => {
		const out = document.getElementById('output');
		if (out) out.textContent = '';

		const tdiv = document.getElementById('turtlediv');
		if (tdiv) {
		  tdiv.innerHTML = '';
		}

		// Le module Turtle est réinitialisé par le runner avant son exécution.
	  });
	}

    // ===== Highlighter (overlay) =====
    function escapeHTML(s){
      return s.replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));
    }
	function highlightCode(src){
	  // échappe le HTML d'abord
	  src = src.replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));
	  let out = '', i = 0, n = src.length;

	  while (i < n){
		const ch = src[i];

		// --- """ ... """ (docstring) ---
		if (ch === '"' && src.slice(i, i+3) === '"""'){
		  let j = i + 3;
		  while (j < n && src.slice(j, j+3) !== '"""') j++;
		  if (j < n) j += 3;
		  out += `<span class="tok tstr">${src.slice(i, j)}</span>`;
		  i = j; continue;
		}

		// --- ''' ... ''' (docstring) ---
		if (ch === "'" && src.slice(i, i+3) === "'''"){
		  let j = i + 3;
		  while (j < n && src.slice(j, j+3) !== "'''") j++;
		  if (j < n) j += 3;
		  out += `<span class="tok tstr">${src.slice(i, j)}</span>`;
		  i = j; continue;
		}

		// --- " ... " (chaîne, avec échappements) ---
		if (ch === '"'){
		  let j = i + 1, esc = false;
		  while (j < n){
			const c = src[j];
			if (esc) esc = false;
			else if (c === '\\') esc = true;
			else if (c === '"'){ j++; break; }
			j++;
		  }
		  out += `<span class="tok str">${src.slice(i, j)}</span>`;
		  i = j; continue;
		}

		// --- ' ... ' (chaîne, avec échappements) ---
		if (ch === "'"){
		  let j = i + 1, esc = false;
		  while (j < n){
			const c = src[j];
			if (esc) esc = false;
			else if (c === '\\') esc = true;
			else if (c === "'"){ j++; break; }
			j++;
		  }
		  out += `<span class="tok str">${src.slice(i, j)}</span>`;
		  i = j; continue;
		}

		// --- # commentaire ---
		if (ch === '#'){
		  let j = i;
		  while (j < n && src[j] !== '\n') j++;
		  out += `<span class="tok com">${src.slice(i, j)}</span>`;
		  i = j; continue;
		}

		// --- identifiants / mots-clés ---
		if (/[A-Za-z_]/.test(ch)){
		  let j = i + 1;
		  while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
		  const word = src.slice(i, j);

		  if (word === 'print' || word === 'input'){
			out += `<span class="tok red">${word}</span>`;
		  } else if (/^(int|float|if|elif|else|for|in|and|def|return|class|while|not|or|pass|continue|with|as|lambda)$/.test(word)){
			out += `<span class="tok blue">${word}</span>`;
		  } else if (/^(from|import|try|except|break|True|False|None)$/.test(word)){
			out += `<span class="tok vio">${word}</span>`;
		  } else {
			out += word;
		  }
		  i = j; continue;
		}

		// --- nombres (entiers, décimaux, exposants) ---
		if (/\d/.test(ch)){
		  let j = i;
		  // partie entière
		  while (j < n && /[\d_]/.test(src[j])) j++;
		  // partie décimale
		  if (src[j] === '.' && /\d/.test(src[j+1])){
			j++;
			while (j < n && /[\d_]/.test(src[j])) j++;
		  }
		  // exposant
		  if ((src[j] === 'e' || src[j] === 'E') && (/\d/.test(src[j+1]) || ((src[j+1] === '+' || src[j+1] === '-') && /\d/.test(src[j+2])))){
			j++;
			if (src[j] === '+' || src[j] === '-') j++;
			while (j < n && /[\d_]/.test(src[j])) j++;
		  }
		  out += `<span class="tok num">${src.slice(i, j)}</span>`;
		  i = j; continue;
		}

		// caractère brut
		out += ch; i++;
	  }
	  return out;
	}
	function syncHighlight(){
	  const ta = document.getElementById('code');
	  const hi = document.getElementById('highlighting');
	  if(!ta || !hi) return;

	  hi.innerHTML = highlightCode(ta.value);

	  // sync scroll
	  hi.scrollTop  = ta.scrollTop;
	  hi.scrollLeft = ta.scrollLeft;
	}

    // --- Éditeur: paires (), "", auto ":" + indentation, Tab/Shift-Tab, Backspace-déindent, persistence, 1ère ligne auto, reset & download ---
    (function () {
      const ta = document.getElementById('code');
      const hi = document.getElementById('highlighting');
      if (!ta || !hi) return;

      const INDENT = '    '; // 4 espaces

      function wrapSelection(open, close) {
        const start = ta.selectionStart, end = ta.selectionEnd;
        const val = ta.value;
        const selected = val.slice(start, end);
        ta.value = val.slice(0, start) + open + selected + close + val.slice(end);
        const s = start + open.length;
        const e = s + selected.length;
        ta.setSelectionRange(s, e);
        ta.dispatchEvent(new Event('input'));
        persist(); syncHighlight();
      }

      function getLineStartIndex(text, pos) {
        return text.lastIndexOf('\n', pos - 1) + 1;
      }
      function getLineEndIndex(text, pos) {
        const idx = text.indexOf('\n', pos);
        return idx === -1 ? text.length : idx;
      }

      function autoIndentOnEnter() {
        const start = ta.selectionStart, end = ta.selectionEnd;
        const val = ta.value;

        const lineStart = getLineStartIndex(val, start);
        const lineEnd = getLineEndIndex(val, start);
        const line = val.slice(lineStart, lineEnd);

        const baseIndent = (line.match(/^[ \t]*/)||[''])[0];
        const head = line.trimStart();
        const beginsWithKeyword = /^(if|elif|else|for|while|def|class|try|except|with)\b/i.test(head);

        // Nouvelle ligne + indentation
        const caret = ta.selectionStart;
        const insert = '\n' + baseIndent + (beginsWithKeyword ? INDENT : '');
        ta.value = ta.value.slice(0, caret) + insert + ta.value.slice(ta.selectionEnd);
        const pos = caret + insert.length;
        ta.setSelectionRange(pos, pos);
        ta.dispatchEvent(new Event('input'));
        persist(); syncHighlight();
      }

      function indentSelection(shift) {
        const val = ta.value;
        const selStart = ta.selectionStart;
        const selEnd = ta.selectionEnd;

        const firstLineStart = getLineStartIndex(val, selStart);
        const lastLineEnd = getLineEndIndex(val, selEnd);

        const before = val.slice(0, firstLineStart);
        const block  = val.slice(firstLineStart, lastLineEnd);
        const after  = val.slice(lastLineEnd);

        const lines = block.split('\n');
        let added = 0, removed = 0;

        if (!shift) {
          for (let i=0;i<lines.length;i++) lines[i] = INDENT + lines[i];
          added = INDENT.length * lines.length;
        } else {
          for (let i=0;i<lines.length;i++) {
            const m = lines[i].match(/^ {1,4}/);
            if (m) { lines[i] = lines[i].slice(m[0].length); removed += m[0].length; }
          }
        }

        const newBlock = lines.join('\n');
        ta.value = before + newBlock + after;

        if (!shift) {
          ta.setSelectionRange(selStart + INDENT.length, selEnd + added);
        } else {
          const leading = (val.slice(firstLineStart).match(/^ +/)||[''])[0].length;
          const startAdjust = Math.min(4, Math.min(leading, selStart - firstLineStart));
          ta.setSelectionRange(selStart - startAdjust, Math.max(selEnd - removed, selStart - startAdjust));
        }

        ta.dispatchEvent(new Event('input'));
        persist(); syncHighlight();
      }

      function backspaceSmart(e) {
        const start = ta.selectionStart, end = ta.selectionEnd;
        if (start !== end) return false;

        const val = ta.value;
        const lineStart = getLineStartIndex(val, start);
        const before = val.slice(lineStart, start);

        if (/^[ ]*$/.test(before) && before.length > 0) {
          e.preventDefault();
          const INDENT = '    ';
          const toRemove = before.length % INDENT.length === 0 ? INDENT.length : before.length % INDENT.length;
          ta.value = val.slice(0, start - toRemove) + val.slice(end);
          ta.setSelectionRange(start - toRemove, start - toRemove);
          ta.dispatchEvent(new Event('input'));
          persist(); syncHighlight();
          return true;
        }
        return false;
      }

      // The script workspace owns code, cursor and scroll for each name.
      function persist() { window.pythonScripts?.save(); }

	function initialTemplate(){
	  return [
		'# Prénom / Thème-ObjetTPxx',
		'print("Hello world")'
	  ].join('\n');
	}

		window.addEventListener('load', ()=>{ buildDict(); });

      function restore() {
        window.pythonScripts.restore(initialTemplate(), readCodeFromURL());
      }

      function resetEditor() {
        if (window.pythonScripts.busy()) return;
        if (!window.confirm('Réinitialiser le script actif ? Son contenu sera remplacé.')) return;
        window.pythonScripts.reset();
      }

	function computeFilename() {
	  const firstLine = (ta.value.split('\n')[0] || '').trim();
	  if (/#/.test(firstLine) && /\//.test(firstLine)) {
		const m = firstLine.match(/^\s*#\s*([^/]+?)\s*\/\s*(.+?)\s*$/);
		if (m) {
		  const nameRaw = m[1].trim();
		  const subjectRaw = m[2].trim();
		  // On autorise lettres, chiffres, tirets ET underscores
		  const namePart = nameRaw.replace(/[^\p{L}\p{N}\-_. ]/gu,'').replace(/\s+/g,'');
		  const subjectPart = subjectRaw.replace(/[^\p{L}\p{N}\-_. ]/gu,'').replace(/\s+/g,'');
		  const today = formatDateYYYYMMDD(new Date());
		  if (namePart && subjectPart) return `${namePart}_${subjectPart}_${today}.py`;
		}
	  }
	  return `TP_${formatDateYYYYMMDD(new Date())}.py`;
	}

  async function downloadFile(event) {
    event?.preventDefault();
    const workspace = window.pythonScripts;
    if (!workspace.beginFileOperation()) return;
    const text = ta.value;
    const filename = computeFilename();
    try {
      const ua = navigator.userAgent;
      const isiPadOS = ua.includes('Macintosh') && 'ontouchend' in document;
      const isIOS = /iPad|iPhone|iPod/.test(ua) || isiPadOS;
      const isSafari = /^((?!chrome|android|CriOS|FxiOS|EdgiOS).)*safari/i.test(ua);
      let blob, downloadName = filename;
      if (isIOS || isSafari) {
        const zip = new JSZip();
        zip.file(filename, text);
        blob = await zip.generateAsync({type: 'blob'});
        downloadName = filename.replace(/\.py$/i, '') + '.zip';
      } else blob = new Blob([text], {type: 'text/plain;charset=utf-8'});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = downloadName;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      workspace.saved(text, filename);
    } catch (error) {
      window.alert(error.message);
    } finally {
      workspace.endFileOperation();
    }
  }

      // Init + watchers
      window.addEventListener('load', restore);
      ta.addEventListener('input', ()=>{ persist(); syncHighlight(); });
		ta.addEventListener('scroll', ()=>{ persist(); 
		  // juste synchroniser l'overlay (pas besoin de refaire highlightCode à chaque scroll)
		  const hi = document.getElementById('highlighting');
		  if (hi){
			hi.scrollTop  = ta.scrollTop;
			hi.scrollLeft = ta.scrollLeft;
		  }
		});
      window.addEventListener('beforeunload', persist);

      // Key handling
      ta.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey) return;

        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const val = ta.value;
        const next = val[start] || '';
        const noSel = (start === end);

		// --- Gestion des touches quand l'autocomplete est visible ---
		if (acVisible()){
		  if (e.key === 'ArrowDown'){
			e.preventDefault();
			acIndex = (acIndex + 1) % ac.children.length;
			[...ac.children].forEach((el,i)=> el.classList.toggle('active', i===acIndex));
			return;
		  }
		  if (e.key === 'ArrowUp'){
			e.preventDefault();
			acIndex = (acIndex - 1 + ac.children.length) % ac.children.length;
			[...ac.children].forEach((el,i)=> el.classList.toggle('active', i===acIndex));
			return;
		  }
		  if (e.key === 'Tab' || e.key === 'Enter'){
			e.preventDefault();
			acceptAC();
			return;
		  }
		  if (e.key === 'Escape'){
			e.preventDefault();
			hideAC();
			return;
		  }
		}

        if (e.key === 'Enter') {
          e.preventDefault();
          autoIndentOnEnter();
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          indentSelection(e.shiftKey);
          return;
        }
		if (e.key === '(') {
		  e.preventDefault();
		  // On regarde le caractère juste après le curseur
		  if (noSel && !/[A-Za-z0-9_"')\]]/.test(next)) {
			wrapSelection('(', ')');
		  } else {
			wrapSelection('(', '');
		  }
		  return;
		}
		if (e.key === '"') {
		  e.preventDefault();
		  const prev = val[start - 1] || '';
		  if (!noSel) {
			wrapSelection('"', '"'); // texte sélectionné → on entoure
		  } else if (next === '"') {
			ta.setSelectionRange(start + 1, start + 1); // saute par-dessus
		  } else if (prev === '(' && next === ')') {
			// Cas particulier : entre parenthèses vides → on insère ""
			wrapSelection('"', '"');
		  } else {
			wrapSelection('"', ''); // juste ouvre
		  }
		  return;
		}

		if (e.key === "'") {
		  e.preventDefault();
		  const prev = val[start - 1] || '';
		  if (!noSel) {
			wrapSelection("'", "'"); // texte sélectionné → on entoure
		  } else if (next === "'") {
			ta.setSelectionRange(start + 1, start + 1); // saute par-dessus
		  } else if (prev === '(' && next === ')') {
			// Cas particulier : entre parenthèses vides → on insère ''
			wrapSelection("'", "'");
		  } else {
			wrapSelection("'", ""); // juste ouvre
		  }
		  return;
		}

        if (e.key === ')') {
          if (noSel && next === ')') {
            e.preventDefault();
            ta.setSelectionRange(start + 1, start + 1);
            return;
          }
        }
		if (e.key === '[') {
		  e.preventDefault();
		  if (noSel && !/[A-Za-z0-9_"')\]]/.test(next)) {
			wrapSelection('[', ']');
		  } else {
			wrapSelection('[', '');
		  }
		  return;
		}
		if (e.key === ']') {
		  if (noSel && next === ']') {
			e.preventDefault();
			ta.setSelectionRange(start + 1, start + 1);
			return;
		  }
		}

        if (e.key === 'Backspace') {
          if (backspaceSmart(e)) return;
          if (noSel && start > 0) {
            const prev = val[start - 1];
            const nxt = val[start] || '';
			if ((prev === '(' && nxt === ')') || 
				(prev === '[' && nxt === ']') || 
				(prev === '"' && nxt === '"')) {
			  e.preventDefault();
			  ta.value = val.slice(0, start - 1) + val.slice(start + 1);
			  ta.setSelectionRange(start - 1, start - 1);
			  ta.dispatchEvent(new Event('input'));
			  persist(); syncHighlight();
			  return;
			}
          }
        }
      });

		// ===== Autocomplete =====
		const ac = document.getElementById('ac');
		let dict = [];
		let acIndex = -1; // index sélectionné dans la liste
		let charWidth = 8, lineHeight = 18, padLeft = 0, padTop = 0;

		const PY_KEYWORDS = [
		  'False','None','True','and','break','class','continue','def','elif','else',
		  'except','for','from','global','if','import','in','is','lambda','not','or','pass',
		  'return','try','while','with'
		];
		const PY_BUILTINS = [
		  'abs','bool','chr','dict','dir','enumerate',
		  'float','hash','int','len','list',
		  'max','min','open','ord','print','range','round','set','slice',
		  'sorted','str','sum','tuple','input'
		];

		// Mesures pour monospace
		(function measureMetrics(){
		  const cs = getComputedStyle(ta);
		  lineHeight = parseFloat(cs.lineHeight) || 18;
		  padLeft = parseFloat(cs.paddingLeft) || 0;
		  padTop = parseFloat(cs.paddingTop) || 0;
		  // largeur d'un caractère "M" (monospace)
		  const cv = document.createElement('canvas');
		  const ctx = cv.getContext('2d');
		  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
		  charWidth = ctx.measureText('M').width || 8;
		})();

		function buildDict(){
		  const set = new Set();
		  // identifiants du buffer
		  ta.value.replace(/[A-Za-z_][A-Za-z0-9_]*/g, w => { set.add(w); return w; });
		  // + mots-clés + builtins
		  PY_KEYWORDS.forEach(w => set.add(w));
		  PY_BUILTINS.forEach(w => set.add(w));
		  dict = Array.from(set).sort((a,b)=> a.localeCompare(b));
		}

		function getPrefixInfo(){
		  const pos = ta.selectionStart;
		  const v = ta.value;
		  let i = pos - 1;
		  while(i >= 0 && /[A-Za-z0-9_]/.test(v[i])) i--;
		  const start = i + 1;
		  const prefix = v.slice(start, pos);
		  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(prefix)) return null;
		  return { prefix, start, end: pos };
		}

		function indexToXY(idx){
		  const v = ta.value;
		  const lineStart = v.lastIndexOf('\n', idx - 1) + 1;
		  const col = idx - lineStart;
		  const rows = (v.slice(0, idx).match(/\n/g) || []).length;
		  const x = padLeft + col * charWidth - ta.scrollLeft;
		  const y = padTop + rows * lineHeight - ta.scrollTop;
		  return { x, y };
		}

		function showAC(items, anchorIndex){
		  if (!items.length){ hideAC(); return; }
		  ac.innerHTML = items.map((w,i)=>`<div class="item${i===0?' active':''}" data-i="${i}">${w}</div>`).join('');
		  acIndex = 0;
		  const pt = indexToXY(anchorIndex);
		  ac.style.left = pt.x + 'px';
		  ac.style.top  = (pt.y + lineHeight) + 'px';
		  ac.classList.remove('hidden');
		}

		function hideAC(){ ac.classList.add('hidden'); acIndex = -1; }
		function acVisible(){ return !ac.classList.contains('hidden'); }

		// Fermeture si clic en dehors du menu
		document.addEventListener('click', (e)=>{
		  if (!ac.contains(e.target)) {
			hideAC();
		  }
		});

		function updateAC(){
		  const info = getPrefixInfo();
		  if (!info || info.prefix.length < 1){ hideAC(); return; }
		  const pfx = info.prefix.toLowerCase();
		  const items = dict
			.filter(w => w.toLowerCase().startsWith(pfx) && w !== info.prefix)
			.slice(0, 40);
		  showAC(items, info.end);
		}

		function acceptAC(){
		  const info = getPrefixInfo();
		  if (!info) return;
		  const choice = ac.children[acIndex];
		  if (!choice) return;
		  const word = choice.textContent;
		  const rest = word.slice(info.prefix.length);
		  const v = ta.value;
		  ta.value = v.slice(0, info.end) + rest + v.slice(info.end);
		  const newPos = info.end + rest.length;
		  ta.setSelectionRange(newPos, newPos);
		  ta.dispatchEvent(new Event('input'));
		  persist(); syncHighlight();
		  hideAC();
		}

		// interactions : clic sur un item
		ac.addEventListener('mousedown', (e)=>{
		  const it = e.target.closest('.item'); if(!it) return;
		  e.preventDefault(); // évite de perdre le focus du textarea
		  acIndex = [...ac.children].indexOf(it);
		  acceptAC();
		});

		// reconstruire le dictionnaire et proposer
		ta.addEventListener('input', ()=>{ buildDict(); updateAC(); });
		// mettre à jour pendant la frappe (sauf touches de navigation qu'on gère ailleurs)
		ta.addEventListener('keyup', (e)=>{
		  if (!['ArrowUp','ArrowDown','Enter','Tab','Escape'].includes(e.key)) updateAC();
		});

    // File actions always use the active script and its own writable handle.
    (() => {
      const supportsFS = ('showOpenFilePicker' in window) && ('showSaveFilePicker' in window);

      function pickFileFallback() {
        return new Promise(resolve => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.py,.txt,.zip,text/x-python,text/plain,application/zip';
          input.hidden = true;
          document.body.append(input);
          const finish = file => { input.remove(); resolve(file); };
          input.addEventListener('change', () => finish(input.files?.[0] ?? null), {once: true});
          input.addEventListener('cancel', () => finish(null), {once: true});
          input.click();
        });
      }

      document.getElementById('openLocal').addEventListener('click', async event => {
        event.preventDefault();
        const workspace = window.pythonScripts;
        if (event.currentTarget.getAttribute('aria-disabled') === 'true' || !workspace.beginFileOperation()) return;
        try {
          let handle = null, file;
          if (supportsFS) {
            [handle] = await window.showOpenFilePicker({
              types: [{description: 'Scripts Python', accept: {'text/x-python': ['.py'], 'text/plain': ['.py', '.txt']}}],
              excludeAcceptAllOption: false, multiple: false
            });
            if (!handle) return;
            file = await handle.getFile();
          } else file = await pickFileFallback();
          if (!file) return;
          let name = file.name, text;
          if (/\.zip$/i.test(name)) {
            const zip = await JSZip.loadAsync(await file.arrayBuffer());
            name = Object.keys(zip.files).find(name => !zip.files[name].dir && /\.py$/i.test(name));
            if (!name) throw new Error('Aucun fichier .py trouvé dans ce fichier ZIP.');
            text = await zip.files[name].async('string');
          } else text = await file.text();
          const current = workspace.current();
          if (current.code !== current.savedCode && current.code !== text &&
              !window.confirm('Remplacer les modifications non enregistrées du script actif ?')) return;
          workspace.loaded(text, name, handle);
        } catch (error) {
          if (error?.name !== 'AbortError') window.alert(error.message);
        } finally {
          workspace.endFileOperation();
        }
      });

      async function saveFile(event, saveAs) {
        event.preventDefault();
        if (!supportsFS) { await downloadFile(); return; }
        const workspace = window.pythonScripts;
        if (!workspace.beginFileOperation()) return;
        const current = workspace.current();
        const text = current.code;
        const expected = computeFilename();
        const renamed = current.name && current.name !== expected;
        try {
          let handle = current.handle;
          if (saveAs || !handle || renamed) {
            handle = await window.showSaveFilePicker({suggestedName: expected,
              types: [{description: 'Python', accept: {'text/x-python': ['.py']}}]});
          }
          const writable = await handle.createWritable();
          await writable.write(text);
          await writable.close();
          workspace.saved(text, handle.name, handle);
        } catch (error) {
          if (error?.name !== 'AbortError') window.alert('Échec de l’enregistrement : ' + error.message);
        } finally {
          workspace.endFileOperation();
        }
      }
      document.getElementById('saveLocal').addEventListener('click', event => saveFile(event, false));
      document.getElementById('saveAsLocal').addEventListener('click', event => saveFile(event, true));
    })();

		// Bouton Partager
		async function handleShare(type) {
		  const ta = document.getElementById('code');
		  const url = makeShareURL(ta.value);

		  if (url.length > 1800) {
			const cont = confirm(
			  "/!\\ Votre script est assez long; le lien sera volumineux et pourrait ne pas fonctionner dans tous les navigateurs.\n\n" +
			  "Voulez-vous quand même créer le lien ?"
			);
			if (!cont) return;
		  }

		  const text = type === 'iframe'
		    ? `<iframe src="${url}&light=1" width="100%" height="600" style="border:0;"></iframe>` : url;
		  try {
		    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
		    await navigator.clipboard.writeText(text);
		    alert(type === 'iframe' ? 'Code iframe copié dans le presse-papiers !' : 'Lien copié dans le presse-papiers !');
		  } catch (_) {
		    // The school HTTP network may not expose the Clipboard API.
		    window.prompt(type === 'iframe' ? 'Copiez ce code iframe :' : 'Copiez ce lien :', text);
		  }
		}

		// Écouteur sur le bouton dropdown principal (si tu veux garder une logique globale)
		const btnShare = document.getElementById('share');
		btnShare?.addEventListener('click', async ()=>{
		  const ta = document.getElementById('code');
		  const url = makeShareURL(ta.value);

		  if (url.length > 1800) {
			const cont = confirm(
			  "/!\\ Votre script est assez long; le lien sera volumineux et pourrait ne pas fonctionner dans tous les navigateurs.\n\n" +
			  "Voulez-vous quand même créer le lien ?"
			);
			if (!cont) return;
		  }
		});

		// Bouton lien
		const btnCopyLink = document.getElementById('copyLink');
		btnCopyLink?.addEventListener('click', event => {
		  event.preventDefault();
		  handleShare("link");
		});

		const btnLightCopyLink = document.getElementById('lightCopyLink');
		btnLightCopyLink?.addEventListener('click', () => {
		  handleShare("link");
		});
		
		// Bouton iframe
		const btnCopyIframe = document.getElementById('copyIframe');
		btnCopyIframe?.addEventListener('click', event => {
		  event.preventDefault();
		  handleShare("iframe");
		});

      // Boutons
      document.getElementById('reset').addEventListener('click', resetEditor);
      document.getElementById('download').addEventListener('click', downloadFile);
    })();

		window.addEventListener('load', () => {
			console.log(">> Event: window load");
		  const ua = navigator.userAgent;

		  const isiPadOS = ua.includes("Macintosh") && "ontouchend" in document;
		  const isIOS = /iPad|iPhone|iPod/.test(ua) || isiPadOS;

		  // Safari pur (iOS + macOS), exclut Chrome/Firefox/Edge
		  const isSafari = /^((?!chrome|android|CriOS|FxiOS|EdgiOS).)*safari/i.test(ua);
		});
		(() => {
		  const PRODUCT = "python";       // adapter: "python" | "html" | "markdown" | "sql"
		  const PATH    = location.pathname;
		  const SITE    = location.hostname; // "informatic.li"

		  // 1 hit / onglet / 90 min
		  const KEY = `trk:${SITE}:${PRODUCT}:${PATH}`;
		  const last = +sessionStorage.getItem(KEY) || 0;
		  if (Date.now() - last < 90*60*1000) return;
		  sessionStorage.setItem(KEY, Date.now());

		  fetch("https://parapente.world/lab/api/track.php", {
			method: "POST",
			mode: "cors",
			headers: { "Content-Type":"application/json" },
			keepalive: true,
			body: JSON.stringify({ site: SITE, product: PRODUCT, path: PATH })
		  }).catch(()=>{});
		})();

    // Use the same commands as the File menu, including browser fallbacks.
    window.addEventListener('keydown', event => {
      if (event.isComposing || event.altKey || event.shiftKey) return;
      let command;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        command = 'saveLocal';
      } else if (!event.ctrlKey && !event.metaKey) {
        if (event.key === 'F9') command = 'run';
        else if (event.key === 'F12') command = 'saveAsLocal';
      }
      if (!command) return;
      event.preventDefault();
      if (!event.repeat) document.getElementById(command)?.click();
    }, true);
