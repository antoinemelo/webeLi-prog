	// --- Lien pour "aperçu seul"
	function makeShareURLPreview(code){
	  const b64 = encodeUTF8ToB64(code);
	  const base = location.origin + location.pathname;
	  return `${base}?c=${b64}&view=preview`;
	}

	// Détecte view=preview
	function isViewOnlyFromURL(){
	  try {
		const url = new URL(location.href);
		return (url.searchParams.get('view') || '').toLowerCase() === 'preview';
	  } catch(_) { return false; }
	}

	if (isViewOnlyFromURL()) {
	  document.body.classList.add('view-only');
	  try { renderPreview(); } catch(_) {}

	  // Le thème de coloration embarqué reste identique en aperçu seul.
	}

	// --- Petit utilitaire de partage/copie (UX propre) ---
	async function copyOrShareURL(url, title='LAB Markdown'){
	  if (url.length > 1800) {
		const cont = confirm(
		  "/!\\ Votre script est assez long; le lien sera volumineux et pourrait ne pas fonctionner dans tous les navigateurs.\n\n" +
		  "Voulez-vous quand même créer le lien ?"
		);
		if (!cont) return;
	  }
	  if (navigator.share) {
		try { await navigator.share({ title, text: 'Ouvre ce lien :', url }); return; }
		catch(_) { /* annulé par l’utilisateur */ }
	  }
	  try {
		await navigator.clipboard.writeText(url);
		(window.toast || alert)('Lien copié dans le presse-papiers');
	  } catch(_) {
		window.prompt('Copiez le lien :', url);
	  }
	}

    // ---------- Helpers ----------
    const $ = sel => document.querySelector(sel);
    const LS_CODE   = 'md_editor_code_v1';
    const LS_CARET  = 'md_editor_caret_v1';
    const LS_SCROLL = 'md_editor_scroll_v1';
    const LS_FIRST  = 'md_editor_first_open_v1';
    const SPLIT_KEY = 'md_split_left_percent_v1';

    function mkformatDateYYYYMMDD(d){
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const day = String(d.getDate()).padStart(2,'0');
      return `${y}${m}${day}`;
    }

	// ---------- Gutter ----------
	(function(){
	  const codeEl = $('#code');
	  const gutter = $('#gutter');

	  // Estime combien de "rangées visuelles" une ligne logique occupe
	  function computeVisibleWrapsForLine(line, cols){
		const expanded = line.replace(/\t/g, '    ');     // tabs ~ 4 espaces
		return Math.max(1, Math.ceil(expanded.length / Math.max(1, cols)));
	  }

	  function updateGutter(){
		if (!codeEl || !gutter) return;

		// largeur utile (padding exclus) pour estimer le nb de colonnes visibles
		const cs = getComputedStyle(codeEl);
		const padL = parseFloat(cs.paddingLeft)  || 0;
		const padR = parseFloat(cs.paddingRight) || 0;
		const innerWidthPx = codeEl.clientWidth - padL - padR;

		// charWidth est déjà mesuré plus haut dans votre script (measureMetrics) ; fallback 8px
		const cw   = (typeof charWidth === 'number' && charWidth > 0) ? charWidth : 8;
		const cols = Math.max(1, Math.floor(innerWidthPx / cw));

		const lines = codeEl.value.split(/\r?\n/);
		let html = '';
		let n = 1;

		for (let i = 0; i < lines.length; i++) {
		  const wraps = computeVisibleWrapsForLine(lines[i], cols);

		  // 1re "rangée" de la ligne -> numéro
		  html += `<div data-line="${n}">${n}</div>`;
		  // rangées suivantes (continuations visuelles) -> emplacements vides
		  for (let w = 1; w < wraps; w++) {
			html += `<div class="cont" data-line="${n}"></div>`;
			// Variante: montrer un marqueur → `<div class="cont">⋯</div>`
		  }
		  n++;
		}

		gutter.innerHTML = html;
		gutter.scrollTop = codeEl.scrollTop; // suit le scroll
	  }

		window.updateGutter = updateGutter;
		
		const ro = new ResizeObserver(() => updateGutter());
		ro.observe(codeEl);

	  codeEl.addEventListener('input', updateGutter);

	  // Scroll synchronisé (inchangé)
	  codeEl.addEventListener('scroll', ()=>{
		gutter.scrollTop = codeEl.scrollTop;
		const hi = document.getElementById('highlighting');
		hi.scrollTop  = codeEl.scrollTop;
		hi.scrollLeft = codeEl.scrollLeft;
	  });

	  window.addEventListener('load', updateGutter);

	  // La hauteur est pilotée par CSS; le ResizeObserver recalcule uniquement
	  // les retours visuels et évite les hauteurs figées sur mobile.
	})();

    // ---------- Splitter ----------
    (function(){
      const root = document.documentElement;
      const divider = $('#divider');
      const split = $('.split');
      const saved = localStorage.getItem(SPLIT_KEY);
      if(saved){ root.style.setProperty('--left', saved); }
      let dragging = false;

      function onMove(clientX){
        const rect = split.getBoundingClientRect();
        let x = clientX - rect.left;
        const min = 200;
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
          localStorage.setItem(SPLIT_KEY, getComputedStyle(root).getPropertyValue('--left').trim());
        }
      });
      // Touch
      divider.addEventListener('touchstart', ()=>{ dragging = true; document.body.classList.add('dragging'); }, {passive:true});
      window.addEventListener('touchmove', (e)=>{ if(dragging) onMove(e.touches[0].clientX); }, {passive:false});
      window.addEventListener('touchend', ()=>{
        if(dragging){
          dragging = false; document.body.classList.remove('dragging');
          localStorage.setItem(SPLIT_KEY, getComputedStyle(root).getPropertyValue('--left').trim());
        }
      });
    })();

    // ---------- Highlighter (very fast, regex-based) ----------
    function escapeHTML(s){ return s.replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch])); }
    function highlightMarkdown(src){
      src = escapeHTML(src);

      // code fences ``` ```
      src = src.replace(/```([\s\S]*?)```/g, (m, p1) => `<span class="code">\`\`\`${p1}\`\`\`</span>`);

      // hr --- or ***
      src = src.replace(/^(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '<span class="hr">$&</span>');

		// headings
		src = src.replace(/^# (.*)$/gm,   '<span class="md-h1"># $1</span>');
		src = src.replace(/^## (.*)$/gm,  '<span class="md-h2">## $1</span>');
		src = src.replace(/^### (.*)$/gm, '<span class="md-h3">### $1</span>');

      // blockquote
      src = src.replace(/^> .+$/gm, '<span class="blockquote">$&</span>');

      // lists
      src = src.replace(/^(\s*)([-*+])\s+/gm, (m, s, b) => `${s}<span class="ulbul">${b}</span> `);
      src = src.replace(/^(\s*)(\d+)\.\s+/gm, (m, s, n)=> `${s}<span class="olnum">${n}.</span> `);

      // inline code `code`
      src = src.replace(/`([^`]+)`/g, '<span class="code">`$1`</span>');

		// bold **...**
		src = src.replace(
		  /\*\*([^\s][\s\S]*?[^\s])\*\*/g,
		  '<span class="md-puncGras">**</span><span class="bold">$1</span><span class="md-puncGras">**</span>'
		);

		// italic *...*
		src = src.replace(
		  /(^|[^*])\*([^*\s][^*]*?[^*\s])\*(?!\*)/g,
		  '$1<span class="md-puncItal">*</span><span class="italic">$2</span><span class="md-puncItal">*</span>'
		);

		// underlign _..._
		src = src.replace(
		  /(^|[^_])_([^_\s][^_]*?[^_\s])_(?!_)/g,
		  '$1<span class="md-puncUnder">_</span><span class="underline">$2</span><span class="md-puncUnder">_</span>'
		);

      // links [text](url)
      src = src.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="link">[$1]($2)</span>');

      // images ![alt](src)
      src = src.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<span class="img">![$1]($2)</span>');

      return src;
    }
    function syncHighlight(){
      const ta = $('#code');
      const hi = $('#highlighting');
      hi.innerHTML = highlightMarkdown(ta.value);
      hi.scrollTop = ta.scrollTop;
      hi.scrollLeft = ta.scrollLeft;
    }

    // ---------- marked configuration ----------
    const codeTheme = document.getElementById('hljs-theme');
    const darkCodeTheme = codeTheme.href;
    const lightCodeTheme = new URL('github_min.css', darkCodeTheme).href;
    function syncCodeTheme() {
      const light = document.documentElement.dataset.theme === 'light'
        || document.body.classList.contains('view-only');
      const href = light ? lightCodeTheme : darkCodeTheme;
      if (codeTheme.href !== href) codeTheme.href = href;
    }
    new MutationObserver(syncCodeTheme).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme']
    });
    syncCodeTheme();

    marked.use({
      breaks: true,
      gfm: true,
      renderer: {
        code({text, lang}) {
          const language = (lang || '').trim().split(/\s+/)[0];
          // Keep Marked's escaped plain-code rendering for unsupported languages.
          if (!window.hljs || (language && !hljs.getLanguage(language))) return false;
          try {
            const result = language
              ? hljs.highlight(text, {language, ignoreIllegals: true})
              : hljs.highlightAuto(text);
            return `<pre><code class="hljs">${result.value}\n</code></pre>\n`;
          } catch (_) {
            return false;
          }
        }
      }
    });

	const underlineExt = {
	  name: 'underline',
	  level: 'inline',
	  start(src) {
		// accélère: on ne tente rien tant qu'il n'y a pas de "_"
		return src.indexOf('_');
	  },
	  tokenizer(src) {
		// Un seul underscore, pas d'espace collé dedans, pas "__" (qui reste <strong>)
		const rule = /^_([^_\s][^_]*?[^_\s])_(?!_)/;
		const m = rule.exec(src);
		if (m) {
		  return { type: 'underline', raw: m[0], text: m[1] };
		}
	  },
	  renderer(token) {
		return `<u>${token.text}</u>`;
	  }
	};

	marked.use({ extensions: [underlineExt] });

	function sanitizeRenderedHtml(rawHtml) {
	  const template = document.createElement('template');
	  template.innerHTML = rawHtml;
	  const forbidden = new Set([
		'SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE',
		'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'OPTION',
		'STYLE', 'SVG', 'MATH'
	  ]);
	  const urlAttributes = new Set(['href', 'src', 'xlink:href']);

	  for (const element of [...template.content.querySelectorAll('*')]) {
		if (forbidden.has(element.tagName)) {
		  element.remove();
		  continue;
		}
		for (const attribute of [...element.attributes]) {
		  const name = attribute.name.toLowerCase();
		  const value = attribute.value.trim();
		  if (name.startsWith('on') || name === 'srcdoc' || name === 'style') {
			element.removeAttribute(attribute.name);
			continue;
		  }
		  if (urlAttributes.has(name) && value) {
			let allowed = value.startsWith('#');
			try {
			  const parsed = new URL(value, location.href);
			  allowed ||= ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
			  allowed ||= name === 'src' && parsed.protocol === 'data:'
				&& /^data:image\/(?:png|gif|jpe?g|webp);/i.test(value);
			} catch (_) {
			  allowed = false;
			}
			if (!allowed) element.removeAttribute(attribute.name);
		  }
		}
		if (element.tagName === 'A' && element.target === '_blank') {
		  element.rel = 'noopener noreferrer';
		}
	  }
	  return template.innerHTML;
	}

	function getCursorLine(ta){
	  const upto = ta.value.slice(0, ta.selectionStart);
	  return upto.split(/\r?\n/).length - 1; // 0-index
	}
	function getTotalLines(ta){
	  return (ta.value.match(/\r?\n/g) || []).length + 1;
	}
	function scrollPreviewToCaret(){
	  const ta = document.getElementById('code');
	  const pv = document.getElementById('preview');
	  const total = getTotalLines(ta);
	  if (total <= 1){
		pv.scrollTop = 0;
		return;
	  }
	  const line = getCursorLine(ta);                 // ligne 0-index
	  const ratio = Math.min(1, Math.max(0, line / (total - 1)));
	  const target = ratio * (pv.scrollHeight - pv.clientHeight);
	  pv.scrollTo({ top: target, behavior: 'auto' }); // 'auto' = pas d'animation gênante en frappe
	}


	function renderPreview(){
	  const pv = document.getElementById('preview');
	  // mémoriser le ratio de scroll actuel de la preview
	  const maxScroll = Math.max(1, pv.scrollHeight - pv.clientHeight);
	  const prevRatio = pv.scrollTop / maxScroll;

	  const md = document.getElementById('code').value;
	  const html = sanitizeRenderedHtml(marked.parse(md));
	  pv.innerHTML = html;

	  // restaurer un scroll cohérent après rerendu,
	  // puis recaler exactement sur la ligne du caret
	  const maxAfter = Math.max(1, pv.scrollHeight - pv.clientHeight);
	  pv.scrollTop = prevRatio * maxAfter;
	  // priorité à la position du caret (plus précis que le simple ratio)
	  scrollPreviewToCaret();
	}

    // ---------- Editor behaviors ----------
    (function(){
      const ta = $('#code');
      const hi = $('#highlighting');
      const INDENT = '    ';
	  let previewTimer = 0;

	  function schedulePreview(){
		window.clearTimeout(previewTimer);
		previewTimer = window.setTimeout(renderPreview, 100);
	  }

      function getLineStartIndex(text, pos){ return text.lastIndexOf('\n', pos - 1) + 1; }
      function getLineEndIndex(text, pos){ const idx = text.indexOf('\n', pos); return idx === -1 ? text.length : idx; }

      function persist(){
        try {
          localStorage.setItem(LS_CODE, ta.value);
          localStorage.setItem(LS_CARET, JSON.stringify({s: ta.selectionStart, e: ta.selectionEnd}));
          localStorage.setItem(LS_SCROLL, ta.scrollTop.toString());
        } catch(_) {}
      }

		function initialTemplate() {
return `#### Prénom / Thème-ObjetTPxx
---

# Hello world

[Bienvenue]::`;
}

		  function restore() {
			  // 1) Priorité au lien partagé
			  const linked = readCodeFromURL?.();
			  if (linked !== null) {
				ta.value = linked;
				ta.setSelectionRange(ta.value.length, ta.value.length);
				ta.scrollTop = 0;
				ta.dispatchEvent(new Event('input'));
				syncHighlight();
				// On persiste pour les rafraîchissements suivants
				try {
				  localStorage.setItem(LS_CODE, ta.value);
				  localStorage.setItem(LS_FIRST, '1');
				} catch(_) {}
				return;
			  }

			const saved = localStorage.getItem(LS_CODE);
			if (saved !== null) {
			  ta.value = saved;
			  const c = localStorage.getItem(LS_CARET);
			  if (c) {
				try {
				  const {s, e} = JSON.parse(c);
				  ta.setSelectionRange(s, e);
				} catch(_) {}
			  }
			  const st = localStorage.getItem(LS_SCROLL);
			  if (st) ta.scrollTop = parseInt(st, 10) || 0;
			} else {
			  if (!localStorage.getItem(LS_FIRST)) {
				ta.value = initialTemplate();
				localStorage.setItem(LS_FIRST, '1');
			  } else {
				ta.value = initialTemplate();
			  }
			  ta.setSelectionRange(ta.value.length, ta.value.length);
			}
			ta.dispatchEvent(new Event('input')); // renumérotation
			syncHighlight();
		  }


      function resetEditor(){
        const ok = window.confirm('Réinitialiser l’éditeur ? (Le contenu local sera effacé)');
        if (!ok) return;
        try {
          localStorage.removeItem(LS_CODE);
          localStorage.removeItem(LS_CARET);
          localStorage.removeItem(LS_SCROLL);
          localStorage.removeItem(LS_FIRST);
        } catch(_) {}
        ta.value = initialTemplate();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        ta.scrollTop = 0;
        ta.dispatchEvent(new Event('input'));
        try { localStorage.setItem(LS_FIRST,'1'); } catch(_) {}
        ta.focus();
        syncHighlight(); renderPreview();
      }

      function download(filename, mime, content){
        const blob = new Blob([content], {type: mime});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(a.href);
        a.remove();
      }

      function computeFilename(ext){
        const firstLine = (ta.value.split('\n')[0] || '').trim();
        // attend: "# Prénom / ObjetTPxx"
        const m = firstLine.match(/^#\s*([^/]+?)\s*\/\s*(.+?)\s*$/);
        const today = mkformatDateYYYYMMDD(new Date());
        if (m){
          const namePart = m[1].trim().replace(/[^\p{L}\p{N}\-_. ]/gu,'').replace(/\s+/g,'');
          const subjectPart = m[2].trim().replace(/[^\p{L}\p{N}\-_. ]/gu,'').replace(/\s+/g,'');
          if (namePart && subjectPart) return `${namePart}_${subjectPart}_${today}.${ext}`;
        }
        return `TP_${today}.${ext}`;
      }

      // Key behaviors
      function indentSelection(shift){
        const val = ta.value;
        const selStart = ta.selectionStart, selEnd = ta.selectionEnd;
        const firstLineStart = getLineStartIndex(val, selStart);
        const lastLineEnd     = getLineEndIndex(val, selEnd);
        const before = val.slice(0, firstLineStart);
        const block  = val.slice(firstLineStart, lastLineEnd);
        const after  = val.slice(lastLineEnd);

        const lines = block.split('\n');
        let added = 0, removed = 0;

        if (!shift){ lines.forEach((_,i)=> lines[i] = INDENT + lines[i]); added = INDENT.length * lines.length; }
        else {
          for (let i=0;i<lines.length;i++){
            const m = lines[i].match(/^ {1,4}/);
            if (m){ lines[i] = lines[i].slice(m[0].length); removed += m[0].length; }
          }
        }

        const newBlock = lines.join('\n');
        ta.value = before + newBlock + after;

        if (!shift) ta.setSelectionRange(selStart + INDENT.length, selEnd + added);
        else {
          const leading = (val.slice(firstLineStart).match(/^ +/)||[''])[0].length;
          const startAdjust = Math.min(4, Math.min(leading, selStart - firstLineStart));
          ta.setSelectionRange(selStart - startAdjust, Math.max(selEnd - removed, selStart - startAdjust));
        }

        ta.dispatchEvent(new Event('input')); persist(); syncHighlight(); renderPreview();
      }

      function backspaceSmart(e){
        const start = ta.selectionStart, end = ta.selectionEnd;
        if (start !== end) return false;
        const val = ta.value;
        const lineStart = getLineStartIndex(val, start);
        const before = val.slice(lineStart, start);
        if (/^[ ]*$/.test(before) && before.length > 0){
          e.preventDefault();
          const toRemove = before.length % INDENT.length === 0 ? INDENT.length : before.length % INDENT.length;
          ta.value = val.slice(0, start - toRemove) + val.slice(end);
          ta.setSelectionRange(start - toRemove, start - toRemove);
          ta.dispatchEvent(new Event('input'));
          persist(); syncHighlight(); renderPreview();
          return true;
        }
        return false;
      }

      // Simple pairs: **, (), [], {}, "", '', ``
      function wrapSelection(open, close){
        const start = ta.selectionStart, end = ta.selectionEnd;
        const val = ta.value, selected = val.slice(start, end);
        ta.value = val.slice(0, start) + open + selected + close + val.slice(end);
        const s = start + open.length;
        const e = s + selected.length;
        ta.setSelectionRange(s, e);
        ta.dispatchEvent(new Event('input'));
        persist(); syncHighlight(); renderPreview();
      }

	// quand on se déplace au clavier / on clique / on relâche la souris
	['keyup','click','mouseup'].forEach(ev=>{
	  ta.addEventListener(ev, scrollPreviewToCaret);
	});

      // Init + watch
		window.addEventListener('load', ()=>{
		  restore();                 // existant
		  if (isViewOnlyFromURL()) { // active le mode "aperçu seul"
			document.body.classList.add('view-only');
			// S'assure que la preview a bien le contenu à jour :
			try { renderPreview(); } catch(_) {}
		  }
		});
      ta.addEventListener('input', ()=>{
		persist();
		syncHighlight();
		schedulePreview();
		updateAC();
	  });
		ta.addEventListener('scroll', ()=>{
			try { localStorage.setItem(LS_SCROLL, ta.scrollTop.toString()); } catch(_){}
			const hi = document.getElementById('highlighting');
			hi.scrollTop  = ta.scrollTop;
			hi.scrollLeft = ta.scrollLeft;

			const pv = document.getElementById('preview');
			const maxTa = Math.max(1, ta.scrollHeight - ta.clientHeight);
			const ratio = ta.scrollTop / maxTa;
			pv.scrollTop = ratio * (pv.scrollHeight - pv.clientHeight);
	  
			// si vous avez la gouttière ici aussi :
			document.getElementById('gutter').scrollTop = ta.scrollTop;
		});

      ta.addEventListener('keydown', (e)=>{
        if (e.ctrlKey || e.metaKey) return;

        // Autocomplete navigation if visible
        if (acVisible()){
          if (e.key === 'ArrowDown'){ e.preventDefault(); acMove(1); return; }
          if (e.key === 'ArrowUp'){ e.preventDefault(); acMove(-1); return; }
          if (e.key === 'Enter' || e.key === 'Tab'){ e.preventDefault(); acAccept(); return; }
          if (e.key === 'Escape'){ e.preventDefault(); hideAC(); return; }
        }

        if (e.key === 'Enter'){
          // Auto-list continuation
          const pos = ta.selectionStart;
          const val = ta.value;
          const ls = getLineStartIndex(val, pos);
          const line = val.slice(ls, getLineEndIndex(val, pos));
          const mUL = line.match(/^(\s*)([-*+])\s+/);
          const mOL = line.match(/^(\s*)(\d+)\.\s+/);

          let insert = '\n';
          if (mUL) insert += mUL[1] + mUL[2] + ' ';
          else if (mOL) insert += mOL[1] + (parseInt(mOL[2],10)+1) + '. ';

          e.preventDefault();
          ta.value = val.slice(0, pos) + insert + val.slice(ta.selectionEnd);
          const newPos = pos + insert.length;
          ta.setSelectionRange(newPos, newPos);
          ta.dispatchEvent(new Event('input'));
          persist(); syncHighlight(); renderPreview();
          return;
        }

        if (e.key === 'Tab'){ e.preventDefault(); indentSelection(e.shiftKey); return; }
        if (e.key === '(') { e.preventDefault(); wrapSelection('(', ')'); return; }
        if (e.key === '[') { e.preventDefault(); wrapSelection('[', ']'); return; }
        if (e.key === '{') { e.preventDefault(); wrapSelection('{', '}'); return; }
        if (e.key === '"'){ e.preventDefault(); wrapSelection('"', '"'); return; }
        if (e.key === "'"){ e.preventDefault(); wrapSelection("'", "'"); return; }
        if (e.key === '`'){ e.preventDefault(); wrapSelection('`', '`'); return; }
        if (e.key === 'Backspace'){
          if (backspaceSmart(e)) return;
        }
      });

		document.getElementById('share-both')?.addEventListener('click', (e)=>{
		  e.preventDefault();
		  const ta  = document.getElementById('code');
		  const url = makeShareURL(ta.value);
		  copyOrShareURL(url, 'LAB Markdown — Code et aperçu');
		});

		document.getElementById('share-preview')?.addEventListener('click', (e)=>{
		  e.preventDefault();
		  const ta  = document.getElementById('code');
		  const url = makeShareURLPreview(ta.value);
		  copyOrShareURL(url, 'LAB Markdown — Aperçu seul');
		});

      // Buttons
      $('#reset').addEventListener('click', resetEditor);

		document.getElementById('exportHtml').addEventListener('click', () => {
		  const md = ta.value;

		  // Titre = 1er H1 trouvé, sinon valeur par défaut
		  const h1 = (md.match(/^#\s+(.+)\s*$/m) || [null, 'Document Markdown'])[1];
		  const title = (typeof escapeHTML === 'function') ? escapeHTML(h1) : h1;

		  // Conversion Markdown -> HTML (marked est déjà configuré plus haut)
		  const body = sanitizeRenderedHtml(marked.parse(md));

		  // Petit CSS autonome et lisible (pas de dépendances externes)
		  const css = `
		  :root{--maxw:900px}
		  body{margin:2rem auto;max-width:var(--maxw);padding:0 1rem;background:#fff;color:#111;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
		  h1,h2,h3,h4,h5{line-height:1.25;margin:1.25rem 0 .75rem}
		  p{margin:.75rem 0}
		  pre code{display:block;padding:.75rem;border:1px solid #ddd;border-radius:.25rem;background:#f7f7f7;overflow:auto}
		  code{background:#f7f7f7;padding:.1rem .25rem;border-radius:.2rem}
		  blockquote{border-left:3px solid #3b82f6;padding-left:.75rem;color:#333;margin:.75rem 0}
		  table{border-collapse:collapse;width:100%;margin:.75rem 0}
		  th,td{border:1px solid #ccc;padding:.4rem .5rem;text-align:left;vertical-align:top}
		  a{color:#0d6efd;text-decoration:none} a:hover{text-decoration:underline}
		  hr{border:none;border-top:1px solid #ddd;margin:1.25rem 0}
		  img{max-width:100%;height:auto}
		  `;

		  const htmlDoc = `<!DOCTYPE html>
		<html lang="fr">
		<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>${title}</title>
		<style>${css}</style>
		</head>
		<body>
		${body}
		</body>
		</html>`;

		  download(computeFilename('html'), 'text/html;charset=utf-8', htmlDoc);
		  (window.toast||(()=>{}))('Export HTML réussi ✅');
		});

		document.getElementById('exportPdf').addEventListener('click', () => {
		  const md = document.getElementById('code').value;
		  const body = sanitizeRenderedHtml(marked.parse(md));

		  // Conteneur dédié à l’export
		  const container = document.createElement('div');
		  container.id = "pdf-export-root";   // applique le CSS noir/blanc
		  container.innerHTML = body;

		  const opt = {
			margin:       10,
			filename:     computeFilename('pdf'),
			image:        { type: 'jpeg', quality: 0.98 },
			html2canvas:  { scale: 2, backgroundColor: "#ffffff" }, // force fond blanc
			jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
		  };

		  html2pdf().set(opt).from(container).save();
		  (window.toast||(()=>{}))('Export PDF réussi ✅');
		});

		$('#print').addEventListener('click', ()=>{
		  const w = window.open('', '_blank');
		  const body = sanitizeRenderedHtml(marked.parse(ta.value));
		  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
		<link id="hljs-theme" rel="stylesheet" href="../../assets/css/dist/highlight@11.11.1/github-dark_min.css">
		<style>
		/* Réservations de marges pour le pied de page numéroté */
		@page { size: A4; margin: 15mm 15mm 15mm 15mm; } /* ↑ marge basse 20mm */

		/* Styles écran (aperçu dans la popup) */
		body{margin:2rem auto;max-width:900px;padding:0 1rem;background:white;color:#111;
			font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}
		pre code {
		  display: block;
		  padding: .75rem;
		  border: 1px solid #ccc;
		  border-radius: 4px;
		  background: #f7f7f7;
		  overflow-x: auto;
		}

		code {
		  font: 14px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
		  background: #f7f7f7;
		  padding: 0.1rem 0.3rem;
		  border: 1px solid #ddd;
		  border-radius: 3px;
		}
		table{border-collapse:collapse;width:100%;margin:.75rem 0;}
		td,th{border:1px solid #ccc;padding:.4rem .5rem;}
		blockquote{border-left:3px solid #3b82f6;padding-left:.75rem;color:#333;}
		a{color:#0d6efd}
		@media print {
		  /* Couleurs fidèles à l'impression */
		  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

		  /* Cachez les éléments d'en-tête éventuels si vous en ajoutez plus tard */
		  header, nav { display: none !important; }

		  /* Pied de page numéroté */
		  .page-footer{
			position: fixed; /* réapparaît à chaque page */
			left: 0; right: 0; bottom: 0;
			text-align: center;
			font: 8px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
			color: #555;
		  }
		  /* Chrome/Edge/Firefox supportent counter(page) | counter(pages) en mode print */
		  .page-footer::after { content: counter(page) " | " counter(pages); }

		  /* Optionnel : masquer l'URL après les liens */
		  a[href]:after{ content:""; }
		}
		/* Ne montrer le footer qu'à l'impression */
		@media screen { .page-footer{ display:none; } }
		</style>
		</head><body>
		${body}
		<footer class="page-footer" aria-hidden="true"></footer>
		</body></html>`);
		  w.document.close();
		  w.focus();
		  w.print();
		});

      // --------- Snippets / Autocomplete ----------
      const ac = $('#ac');
      let acIndex = -1, charWidth = 8, lineHeight = 18, padLeft = 0, padTop = 0;

      const SNIPPETS = [
        {label:'# Titre H1', text:'# '},
        {label:'## Titre H2', text:'## '},
        {label:'### Titre H3', text:'### '},
        {label:'Gras', text:'**texte**'},
        {label:'Italique', text:'*texte*'},
        {label:'Lien', text:'[texte](https://)'},
        {label:'Image', text:'![alt](url)'},
        {label:'Liste à puces', text:'- élément'},
        {label:'Liste numérotée', text:'1. élément'},
        {label:'Citation', text:'> citation'},
        {label:'Code inline', text:'`code`'},
        {label:'Bloc code', text:'```\nlang\ncode\n```'},
        {label:'Tableau 2x2', text:'| A | B |\n|---|---|\n| a | b |'}
      ];

      (function measureMetrics(){
        const cs = getComputedStyle(ta);
        lineHeight = parseFloat(cs.lineHeight) || 18;
        padLeft = parseFloat(cs.paddingLeft) || 0;
        padTop  = parseFloat(cs.paddingTop)  || 0;
        const cv = document.createElement('canvas');
        const ctx = cv.getContext('2d');
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        charWidth = ctx.measureText('M').width || 8;
      })();

      function getPrefixInfo(){
        const pos = ta.selectionStart;
        const v = ta.value;
        let i = pos - 1;
        while(i >= 0 && /[A-Za-z0-9_#>*\-\[\]`!]/.test(v[i])) i--;
        const start = i + 1;
        const prefix = v.slice(start, pos);
        if (prefix.length === 0) return null;
        return { prefix, start, end: pos };
      }

		function computeVisibleWrapsForLine(line, cols){
		  // (approximation) remplace les tabs par 4 espaces pour l’estimation
		  const expanded = line.replace(/\t/g, '    ');
		  return Math.max(1, Math.ceil(expanded.length / Math.max(1, cols)));
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

      function acVisible(){ return !ac.classList.contains('hidden'); }
      function hideAC(){ ac.classList.add('hidden'); acIndex = -1; }
      function showAC(items, anchorIndex){
        if (!items.length){ hideAC(); return; }
        ac.innerHTML = items.map((s,i)=>`<div class="item${i===0?' active':''}" data-i="${i}">${s.label}</div>`).join('');
        acIndex = 0;
        const pt = indexToXY(anchorIndex);
        ac.style.left = pt.x + 'px';
        ac.style.top  = (pt.y + lineHeight) + 'px';
        ac.classList.remove('hidden');
      }
      function acMove(d){
        const L = ac.children.length; if (!L) return;
        acIndex = (acIndex + d + L) % L;
        [...ac.children].forEach((el,i)=> el.classList.toggle('active', i===acIndex));
      }
      function acAccept(){
        const info = getPrefixInfo(); if (!info) return;
        const choice = ac.children[acIndex]; if (!choice) return;
        const idx = parseInt(choice.getAttribute('data-i'),10);
        const snippet = SNIPPETS[idx];
        const v = ta.value;
        ta.value = v.slice(0, info.start) + snippet.text + v.slice(info.end);
        const newPos = info.start + snippet.text.length;
        ta.setSelectionRange(newPos, newPos);
        ta.dispatchEvent(new Event('input'));
        hideAC();
      }
      function updateAC(){
        const info = getPrefixInfo();
        if (!info || info.prefix.length < 1){ hideAC(); return; }
        const p = info.prefix.toLowerCase();
        const items = SNIPPETS.filter(s => s.label.toLowerCase().includes(p)).slice(0, 30);
        showAC(items, info.end);
      }
      ac.addEventListener('mousedown', (e)=>{
        const it = e.target.closest('.item'); if(!it) return;
        e.preventDefault();
        acIndex = [...ac.children].indexOf(it); acAccept();
      });

      // petite notif
      function toast(msg){
        const el = document.createElement('div');
        el.textContent = msg;
        el.style.position='fixed'; el.style.bottom='16px'; el.style.left='50%'; el.style.transform='translateX(-50%)';
        el.style.background='rgba(0,0,0,.7)'; el.style.color='#fff'; el.style.padding='.5rem .75rem'; el.style.borderRadius='.5rem';
        el.style.zIndex='1000';
        document.body.appendChild(el);
        setTimeout(()=>{ el.remove(); }, 1800);
      }
      window.toast = toast;
    })();

	(() => {
	  const btnOpen = document.getElementById('openLocal');   // <a id="openLocal"> dans ton menu Fichier
	  const codeEl  = document.getElementById('code');         // textarea de l'éditeur
	  if (!btnOpen || !codeEl) return;

	  const supportsFS = ('showOpenFilePicker' in window);

	  // Charger le contenu dans l'éditeur + rafraîchir l'UI (gutter, preview, localStorage…)
	  function loadText(text) {
		codeEl.value = text || '';
		// Curseur à la fin, remonte le scroll
		codeEl.setSelectionRange(codeEl.value.length, codeEl.value.length);
		codeEl.scrollTop = 0;
		// Déclenche les écouteurs existants (rendu preview, numéros de lignes, persistance…)
		codeEl.dispatchEvent(new Event('input'));
	  }

	  async function openWithFS() {
		try {
		  const [handle] = await window.showOpenFilePicker({
			types: [{
			  description: 'Markdown',
			  accept: {
				'text/markdown': ['.md', '.markdown'],
				'text/plain':    ['.txt']
			  }
			}],
			excludeAcceptAllOption: false,
			multiple: false
		  });
		  const file = await handle.getFile();
		  const text = await file.text();
		  loadText(text);
		} catch (_) {
		  /* annulé par l’utilisateur */
		}
	  }

	  function openWithInput() {
		const inp = document.createElement('input');
		inp.type = 'file';
		inp.accept = '.md,.markdown,.txt,text/markdown,text/plain';
		inp.addEventListener('change', () => {
		  const f = inp.files && inp.files[0];
		  if (!f) return;
		  const reader = new FileReader();
		  reader.onload = () => loadText(reader.result || '');
		  reader.readAsText(f);
		}, { once: true });
		inp.click();
	  }

	  btnOpen.addEventListener('click', (e) => {
		e.preventDefault();
		supportsFS ? openWithFS() : openWithInput();
	  });
	})();

	(() => {
	  const codeEl   = document.getElementById('code');
	  const btnOpen  = document.getElementById('openLocal');
	  const btnSave  = document.getElementById('saveLocal');
	  const btnSaveAs= document.getElementById('saveAs');
	  const supportsFS = ('showOpenFilePicker' in window) && ('showSaveFilePicker' in window);

	  // Poignée du fichier ouvert via File System Access
	  let currentHandle = null;

	  // Utilitaire UI : active/désactive "Enregistrer"
	  function updateSaveUI() {
		const canSave = !!currentHandle;
		if (!btnSave) return;
		btnSave.classList.toggle('disabled', !canSave);
		btnSave.setAttribute('aria-disabled', String(!canSave));
	  }
	  updateSaveUI();

	  // Intercepte Ctrl/Cmd+S
	  window.addEventListener('keydown', (e) => {
		const isMac = navigator.platform.toUpperCase().includes('MAC');
		if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 's') {
		  e.preventDefault();
		  saveOrSaveAs();
		}
	  });

	(() => {
	  const codeEl   = document.getElementById('code');
	  const dirtyDot = document.getElementById('dirtyDot');
	  const baseTitle = document.title;

	  let lastSavedValue = codeEl ? codeEl.value : '';
	  let isDirty = false;

		function updateDirtyUI(){
		  if (dirtyDot) dirtyDot.style.display = isDirty ? '' : 'none';
		  document.title = isDirty ? baseTitle + ' ●' : baseTitle;
		}

	  function recomputeDirty(){
		const now = codeEl ? codeEl.value : '';
		isDirty = (now !== lastSavedValue);
		updateDirtyUI();
	  }
	  function setJustLoaded(){
		lastSavedValue = codeEl ? codeEl.value : '';
		isDirty = false;
		updateDirtyUI();
	  }
	  function markJustSaved(){
		lastSavedValue = codeEl ? codeEl.value : '';
		isDirty = false;
		updateDirtyUI();
	  }
	  function resetDirty(){
		lastSavedValue = codeEl ? codeEl.value : '';
		isDirty = false;
		updateDirtyUI();
	  }

	  // Alerte si on quitte avec des modifs non enregistrées
	  window.addEventListener('beforeunload', (e) => {
		if (!isDirty) return;
		e.preventDefault();
		e.returnValue = '';
	  });

	  // Recalcule sur frappe
	  if (codeEl) codeEl.addEventListener('input', recomputeDirty);

	  // Expose pour que les autres blocs puissent signaler les événements clés
	  window._mdDirty = { setJustLoaded, markJustSaved, resetDirty };

	  // Première init
	  recomputeDirty();
	})();

	  // Enregistrer : écrit directement dans le fichier ouvert (si possible),
	  // sinon bascule sur "Enregistrer sous..."
	  async function saveOrSaveAs() {
		if (currentHandle && supportsFS) {
		  try {
			const writable = await currentHandle.createWritable();
			await writable.write(codeEl.value);
			await writable.close();
			+ window._mdDirty?.markJustSaved();   // Contenu désormais synchronisé avec le disque
			(window.toast || alert)('Enregistré ✅');
			return;
		  } catch (err) {
			console.warn('Écriture directe impossible, fallback Save As', err);
			// on retombe sur "Enregistrer sous"
		  }
		}
		await saveAs(); // fallback
	  }

	  // Enregistrer sous…
	  async function saveAs() {
		if (supportsFS) {
		  try {
			const suggestedName = (function computeFilename(){
			  // On réutilise votre logique: H1 "# Prénom / ObjetTPxx", sinon fallback
			  const firstLine = (codeEl.value.split('\n')[0] || '').trim();
			  const m = firstLine.match(/^#\s*([^/]+?)\s*\/\s*(.+?)\s*$/);
			  const d = new Date();
			  const ymd = d.getFullYear().toString()
						+ String(d.getMonth()+1).padStart(2,'0')
						+ String(d.getDate()).padStart(2,'0');
			  if (m) {
				const safe = s => s.trim().replace(/[^\p{L}\p{N}\-_. ]/gu,'').replace(/\s+/g,'');
				return `${safe(m[1])}_${safe(m[2])}_${ymd}.md`;
			  }
			  return `TP_${ymd}.md`;
			})();

			const handle = await window.showSaveFilePicker({
			  suggestedName,
			  types: [{
				description: 'Markdown',
				accept: { 'text/markdown': ['.md', '.markdown'], 'text/plain': ['.txt'] }
			  }]
			});
			const writable = await handle.createWritable();
			await writable.write(codeEl.value);
			await writable.close();
			+ window._mdDirty?.markJustSaved();

			currentHandle = handle;      // on devient "fichier courant"
			updateSaveUI();              // active "Enregistrer"
			(window.toast || alert)('Fichier enregistré ✅');
			return;
		  } catch (_) {
			// annulé par l’utilisateur
			return;
		  }
		}

		// Fallback (navigateurs sans File System Access) : téléchargement
		// -> on réutilise votre fonction de download si vous préférez
		const blob = new Blob([codeEl.value], {type:'text/markdown;charset=utf-8'});
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'document.md';
		document.body.appendChild(a);
		a.click();
		URL.revokeObjectURL(a.href);
		a.remove();
		(window.toast || alert)('Fichier téléchargé ✅');
	  }

	  // Brancher les boutons
	  btnSave  && btnSave .addEventListener('click', (e)=>{ e.preventDefault(); saveOrSaveAs(); });
	  btnSaveAs&& btnSaveAs.addEventListener('click', (e)=>{ e.preventDefault(); saveAs(); });

	  // Raccorder votre logique d’ouverture pour mémoriser la poignée
	  // Si vous utilisez showOpenFilePicker (déjà présent plus haut), stockez le handle :
	  const originalOpenWithFS = window.openWithFS; // si vous l’avez exposée
	  async function openAndRemember() {
		try {
		  const [handle] = await window.showOpenFilePicker({
			types: [{
			  description: 'Markdown',
			  accept: {'text/markdown': ['.md', '.markdown'], 'text/plain': ['.txt']}
			}],
			excludeAcceptAllOption: false, multiple: false
		  });
		  const file = await handle.getFile();
		  const text = await file.text();

		  // charge dans l’éditeur
		  document.getElementById('code').value = text || '';
		  document.getElementById('code').dispatchEvent(new Event('input'));
		  + window._mdDirty?.setJustLoaded();   // ← le fichier chargé est "propre"

		  // mémorise le handle puis active "Enregistrer"
		  currentHandle = handle;
		  updateSaveUI();
		  (window.toast || (()=>{}))(`Ouvert: ${file.name}`);
		} catch(_) { /* annulé */ }
	  }

	  // Remplace en douceur l’action du bouton "Ouvrir…"
	  if (btnOpen) {
		btnOpen.replaceWith(btnOpen.cloneNode(true)); // enlève les anciens listeners
		const freshOpen = document.getElementById('openLocal');
		freshOpen.addEventListener('click', (e)=>{
		  e.preventDefault();
		  if (supportsFS) openAndRemember(); else {
			// fallback input file — pas de handle => Enregistrer reste grisé
			const inp = document.createElement('input');
			inp.type = 'file';
			inp.accept = '.md,.markdown,.txt,text/markdown,text/plain';
			inp.addEventListener('change', () => {
			  const f = inp.files?.[0]; if (!f) return;
			  const r = new FileReader();
			  r.onload = () => {
				document.getElementById('code').value = r.result || '';
				document.getElementById('code').dispatchEvent(new Event('input'));
				currentHandle = null; // pas de handle -> garder "Enregistrer" grisé
				updateSaveUI();
				(window.toast || (()=>{}))(`Ouvert: ${f.name}`);
			  };
			  r.readAsText(f);
			}, { once:true });
			inp.click();
		  }
		});
	  }
	})();

	(() => {
	  const PRODUCT = "markdown";       // adapter: "python" | "html" | "markdown" | "sql"
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

		// --- Affichage ligne/colonne dans #cursorPos ---
		(function() {
		  const ta = document.getElementById('code');
		  const posEl = document.getElementById('cursorPos');
		  if (!ta || !posEl) return;

		  function updateCursorPos() {
			const pos = ta.selectionStart;
			const textUptoPos = ta.value.substring(0, pos);
			const lines = textUptoPos.split("\n");
			const line = lines.length;                           // ligne courante (1-based)
			const col = (lines[lines.length - 1] || "").length + 1; // colonne courante (1-based)
			posEl.textContent = `[${line},${col}]`;
		  }

		ta.addEventListener('dragover', e => {
			e.preventDefault();
			ta.classList.add('dragover');
		  });

		  ta.addEventListener('dragleave', () => {
			ta.classList.remove('dragover');
		  });

		  ta.addEventListener('drop', e => {
			e.preventDefault();
			ta.classList.remove('dragover');

			const file = e.dataTransfer.files[0];
			if (!file) return;

			const reader = new FileReader();
			reader.onload = () => {
			  ta.value = reader.result;
			  ta.dispatchEvent(new Event('input'));   // rafraîchit preview + highlight + gutter
			  if (window.syncHighlight) window.syncHighlight();
			  if (typeof renderPreview === "function") renderPreview();

			  try { localStorage.setItem('md_editor_code_v1', ta.value); } catch(_) {}
			  window._mdDirty?.setJustLoaded();
			};
			reader.readAsText(file);
		  });
  
		  // init + mise à jour
		  updateCursorPos();
		  ["click","keyup","input","scroll"].forEach(evt =>
			ta.addEventListener(evt, updateCursorPos)
		  );
		})();
