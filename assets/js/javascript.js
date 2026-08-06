    // ---- Persistence keys ----
    const LS_CODE   = 'js_editor_code_v1';
    const LS_CARET  = 'js_editor_caret_v1';
    const LS_SCROLL = 'js_editor_scroll_v1';
    const LS_FIRST  = 'js_editor_first_open_done_v1';

	function initialTemplate(){
	  return `<!-- Prénom / Thème-ObjetTPxx -->
<!DOCTYPE html>
<html lang="fr">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>PAGE</title>
		<script src="script_ini.js"></script>
	</head>
	<body>
		<p>Utilisez l'onglet <code>Console</code> pour voir le panneau de sortie.</p>
	</body>
	<script>
		const h1 = document.createElement('h1');
		h1.textContent = "👋";
		document.body.appendChild(h1);
	</script>
</html>`;
	}

    // ---- Line numbers + size ----
	// Gouttière wrap-aware (numéros + rangées "⋯")
	(function(){
	  const ta  = document.getElementById('code');
	  const gut = document.getElementById('gutter');
	  const hi  = document.getElementById('highlighting');
		const url = new URL(window.location.href);
		const light = url.searchParams.get("light");
		if (light == "1") {
		  document.getElementById("saveAsLocal")?.classList.add("d-none");
		  document.getElementById("reset")?.classList.add("d-none");
		  document.getElementById("lightCopyLink")?.classList.remove("d-none");
		  document.getElementById("ShareIframe")?.classList.add("d-none");
		}

	  function metrics(){
		const cs = getComputedStyle(ta);
		const c  = document.createElement('canvas').getContext('2d');
		c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
		const charWidth = c.measureText('M').width || 8;
		const padL = parseFloat(cs.paddingLeft)||0;
		const padR = parseFloat(cs.paddingRight)||0;
		return { charWidth, padL, padR };
	  }

	  function wrapsFor(line, cols){
		// tabs ≈ 4 espaces pour l’estimation
		const expanded = line.replace(/\t/g,'    ');
		return Math.max(1, Math.ceil(expanded.length / Math.max(1, cols)));
	  }

	  function updateGutter(){
		if(!ta || !gut) return;
		const { charWidth, padL, padR } = metrics();
		const inner = Math.max(1, ta.clientWidth - padL - padR);
		const cols  = Math.max(1, Math.floor(inner / Math.max(1, charWidth)));

		const lines = ta.value.split(/\r?\n/);
		let html = '', n = 1;

		for(let i=0;i<lines.length;i++){
		  const w = wrapsFor(lines[i], cols);
		  html += `<div>${n}</div>`;         // 1re rangée -> numéro
		  for(let k=1;k<w;k++) html += `<div class="cont"></div>`; // suites -> ⋯
		  n++;
		}
		gut.innerHTML = html;
		gut.scrollTop = ta.scrollTop;
	  }

	  // Sync scroll éditeur ↔ miroir ↔ gouttière
	  ta.addEventListener('scroll', ()=>{
		gut.scrollTop = ta.scrollTop;
		if(hi){
		  hi.scrollTop  = ta.scrollTop;
		  hi.scrollLeft = ta.scrollLeft;
		}
	  });

	  // Recalcule quand on tape / colle / supprime
	  ta.addEventListener('input', updateGutter);

	  // Recalcule quand la zone redimensionne (splitter, plein écran, orientation, zoom)
	  const ro = new ResizeObserver(()=>{ fitHeights(); updateGutter(); });
	  ro.observe(document.querySelector('.editor-wrap'));

	  // Ajuste les hauteurs (textarea + overlay)
	  function fitHeights(){
		const wrap = document.querySelector('.editor-wrap');
		if(!wrap) return;
		const h = wrap.getBoundingClientRect().height;
		ta.style.height = h + 'px';
		if(hi) hi.style.height = h + 'px';
	  }

	  window.addEventListener('load', ()=>{ fitHeights(); updateGutter(); });
	  window.addEventListener('resize', ()=>{ fitHeights(); updateGutter(); });
	})();

    // ---- Draggable splitter ----
    (function(){
      const root = document.documentElement;
      const divider = document.getElementById('divider');
      const split = document.querySelector('.split');
      const lsKey = 'split_left_percent_html_v1';
      const saved = localStorage.getItem(lsKey);
      if(saved){ root.style.setProperty('--left', saved); }
      let dragging = false;

      function onMove(clientX){
        const rect = split.getBoundingClientRect();
        let x = clientX - rect.left;
        const min = 200, max = rect.width - 200;
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
      divider.addEventListener('touchstart', ()=>{ dragging = true; document.body.classList.add('dragging'); }, {passive:true});
      window.addEventListener('touchmove', (e)=>{ if(dragging) onMove(e.touches[0].clientX); }, {passive:false});
      window.addEventListener('touchend', ()=>{
        if(dragging){
          dragging = false; document.body.classList.remove('dragging');
          localStorage.setItem(lsKey, getComputedStyle(root).getPropertyValue('--left').trim());
        }
      });
    })();

    // ---- Highlighter (overlay) HTML/CSS ----
    function esc(s){ return s.replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch])); }

    function colorizeTag(tagSrc){
      if(tagSrc[0] !== '<') return esc(tagSrc);
      const inner = tagSrc.slice(1, tagSrc.endsWith('>')? tagSrc.length-1 : tagSrc.length);
      const m = inner.match(/^\/?\s*([A-Za-z][\w:-]*)/);
      if(!m) return esc(tagSrc);
      const tagName = m[1];
      let html = '&lt;'+ (inner.trim().startsWith('/')? '/' : '') + `<span class="tok tag">${esc(tagName)}</span>`;
      let rest = inner.slice(m.index + m[0].length);
      const attrRe = /([A-Za-z_:][\w:.-]*)(\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
      let m2, lastIndex=0;
      while((m2 = attrRe.exec(rest))){
        html += esc(rest.slice(lastIndex, m2.index));
        const name = m2[1];
        html += `<span class="tok attr">${esc(name)}</span>`;
        if(m2[2]){
          const val = m2[2].replace(/^=\s*/, '');
          if(/^['"]/.test(val)) html += '=' + `<span class="tok str">${esc(val)}</span>`;
          else html += '=' + `<span class="tok num">${esc(val)}</span>`;
        }
        lastIndex = attrRe.lastIndex;
      }
      html += esc(rest.slice(lastIndex));
      if(tagSrc.endsWith('>')) html += '&gt;';
      return html;
    }

function highlightHTMLLike(raw){
  let out = '', i = 0, n = raw.length;
  let inCSS = false;
  let inScript = false;

  while(i < n){
    // ---- Commentaires HTML ----
    if (raw.slice(i, i+4) === '<!--'){
      const end = raw.indexOf('-->', i+4);
      const j = end === -1 ? n : end + 3;
      out += `<span class="tok com">${esc(raw.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    // ---- Balises HTML ----
    if (raw[i] === '<'){
      // chercher fin de balise en respectant les guillemets
      let j = i+1, inQ = false, q = null;
      while (j < n){
        const c = raw[j];
        if (inQ){
          if (c === q){ inQ = false; q = null; }
        } else {
          if (c === '"' || c === "'"){ inQ = true; q = c; }
          else if (c === '>'){ j++; break; }
        }
        j++;
      }
      const tagTxt = raw.slice(i, j);
      const openStyle  = /^<\s*style\b/i.test(tagTxt);
      const closeStyle = /^<\s*\/\s*style\b/i.test(tagTxt);
      const openScript  = /^<\s*script\b/i.test(tagTxt);
      const closeScript = /^<\s*\/\s*script\b/i.test(tagTxt);

      out += colorizeTag(tagTxt);
      i = j;

      // modes
      if (openStyle && !/\/>$/.test(tagTxt)) inCSS = true;
      if (closeStyle) inCSS = false;
      if (openScript && !/\/>$/.test(tagTxt)) inScript = true;
      if (closeScript) inScript = false;
      continue;
    }

    // ---- Mode CSS ----
    if (inCSS){
      // commentaire CSS
      if (raw.slice(i, i+2) === '/*'){
        const end = raw.indexOf('*/', i+2);
        const j = end === -1 ? n : end+2;
        out += `<span class="tok com">${esc(raw.slice(i, j))}</span>`;
        i = j; continue;
      }
      // string
      if (raw[i] === '"' || raw[i] === "'"){
        const q = raw[i]; let j = i+1, escp=false;
        while(j<n){
          const c=raw[j];
          if (escp) escp=false;
          else if (c==='\\') escp=true;
          else if (c===q){ j++; break; }
          j++;
        }
        out += `<span class="tok str">${esc(raw.slice(i,j))}</span>`;
        i=j; continue;
      }
      // nombres
      if (/\d/.test(raw[i])){
        let j=i+1; while (j<n && /[\d._-]/.test(raw[j])) j++;
        out += `<span class="tok num">${esc(raw.slice(i,j))}</span>`;
        i=j; continue;
      }
      out += esc(raw[i]); i++;
      continue;
    }

    // ---- Mode JavaScript ----
    if (inScript){
      // commentaire //
      if (raw.slice(i, i+2) === "//"){
        const j = raw.indexOf("\n", i+2);
        const end = j === -1 ? n : j;
        out += `<span class="tok com">${esc(raw.slice(i, end))}</span>`;
        i = end; continue;
      }
      // commentaire /* */
      if (raw.slice(i, i+2) === "/*"){
        const end = raw.indexOf("*/", i+2);
        const j = end === -1 ? n : end+2;
        out += `<span class="tok com">${esc(raw.slice(i, j))}</span>`;
        i = j; continue;
      }
      // string
      if (raw[i] === '"' || raw[i] === "'"){
        const q = raw[i]; let j=i+1, escp=false;
        while(j<n){
          const c=raw[j];
          if (escp) escp=false;
          else if (c==='\\') escp=true;
          else if (c===q){ j++; break; }
          j++;
        }
        out += `<span class="tok str">${esc(raw.slice(i,j))}</span>`;
        i=j; continue;
      }
      // nombre
      if (/\d/.test(raw[i])){
        let j=i+1; while(j<n && /[\d._]/.test(raw[j])) j++;
        out += `<span class="tok num">${esc(raw.slice(i,j))}</span>`;
        i=j; continue;
      }
      // mots clés simples
      const kwRe = /^(?:const|let|var|function|return|if|else|for|while|break|continue|switch|case|default|new|class|try|catch|finally|throw)\b/;
      const m = raw.slice(i).match(kwRe);
      if(m){
        out += `<span class="tok kw">${m[0]}</span>`;
        i += m[0].length;
        continue;
      }
      out += esc(raw[i]); i++;
      continue;
    }

    // ---- Texte HTML (par défaut) ----
    out += esc(raw[i]);
    i++;
  }

  return out;
}

    function syncHighlight(){
      const ta = document.getElementById('code');
      const hi = document.getElementById('highlighting');
      hi.innerHTML = highlightHTMLLike(ta.value);
      hi.scrollTop = ta.scrollTop;
      hi.scrollLeft = ta.scrollLeft;
    }

    // ---- Persistence + actions ----
    (function(){
      const ta = document.getElementById('code');
      const hi = document.getElementById('highlighting');
      const LS_CODE='js_editor_code_v1', LS_CARET='js_editor_caret_v1', LS_SCROLL='js_editor_scroll_v1';

      function persist(){
        try{
          localStorage.setItem(LS_CODE, ta.value);
          localStorage.setItem(LS_CARET, JSON.stringify({s: ta.selectionStart, e: ta.selectionEnd}));
          localStorage.setItem(LS_SCROLL, ta.scrollTop.toString());
        }catch(_){}
      }

      // Détecter si l’entrée ressemble à du CSS pur
      function isLikelyCSSOnly(txt){
        return !/<\s*(!doctype|html|head|body|[a-zA-Z]+\s|\/[a-zA-Z])/i.test(txt);
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

		// --- Gestion des fichiers JS virtuels ---
		let openJsFiles = {};

		function ensureJsTabbar(){
		  const tabbar = document.getElementById("fileTabsJs");
		  const hasJs = Object.keys(openJsFiles).length > 0;
		  const hasConsole = !!document.getElementById("pane-console");

		  if (hasJs || hasConsole) {
			tabbar.classList.remove("d-none");
		  } else {
			tabbar.classList.add("d-none");
		  }
		}

		function openJsFile(name){
		  if(openJsFiles[name]) return openJsFiles[name];

		  const safeId = name.replace(/\W/g,"-");
		  const tabbar = document.getElementById("fileTabsJs");
		  const content = document.getElementById("fileTabContentJs");

		  // --- Onglet
		  const li = document.createElement("li");
		  li.className = "nav-item position-relative";
		  const a = document.createElement("a");
		  a.className = "nav-link active";
		  a.dataset.bsToggle = "tab";
		  a.href = `#pane-js-${safeId}`;
		  a.textContent = name;
		  const closeBtn = document.createElement("button");
		  closeBtn.className = "btn-close";
		  closeBtn.style = "position:absolute; right:0; top:0; transform:scale(0.6)";
		  li.appendChild(a);
		  li.appendChild(closeBtn);

		  // Désactive les autres onglets
		  tabbar.querySelectorAll("a.nav-link").forEach(el=>el.classList.remove("active"));

		  // ➜ insérer juste avant Console si elle existe
		  const consoleLi = tabbar.querySelector('a[href="#pane-console"]')?.parentElement;
		  if(consoleLi){
			tabbar.insertBefore(li, consoleLi);
		  } else {
			tabbar.appendChild(li);
		  }

		  // --- Contenu
		  const pane = document.createElement("div");
		  pane.className = "tab-pane fade show active";
		  pane.id = `pane-js-${safeId}`;
		  const ta = document.createElement("textarea");
		  ta.className = "form-control";
		  ta.style.height = "200px";
		  pane.appendChild(ta);

		// Pré-remplir
		if (name === "script_ini.js") {
		  ta.value = 'console.log("Hello world");    // Par défaut dans script_ini.js\n';
		}

		  content.querySelectorAll(".tab-pane").forEach(p=>p.classList.remove("show","active"));
		  content.appendChild(pane);

		  openJsFiles[name] = ta;

		  closeBtn.addEventListener("click", ()=>{
			delete openJsFiles[name];
			li.remove();
			pane.remove();
			ensureJsTabbar();
		  });

		  ensureJsTabbar();
		  return ta;
		}

		let consoleTab = null;

		function openConsoleTab(){
		  if(consoleTab) return consoleTab;

		  const tabbar = document.getElementById("fileTabsJs");
		  const content = document.getElementById("fileTabContentJs");

		  // Supprimer Console existante
		  tabbar.querySelector('a[href="#pane-console"]')?.parentElement.remove();
		  document.getElementById("pane-console")?.remove();

		  // --- Onglet Console
		  const li = document.createElement("li");
		  li.className = "nav-item position-relative ms-auto"; // 🔑 pousse à droite
		  const a = document.createElement("a");
		  a.className = "nav-link active";
		  a.dataset.bsToggle = "tab";
		  a.href = "#pane-console";
		  a.textContent = "Console";
		  li.appendChild(a);

		  // désactiver les autres onglets
		  tabbar.querySelectorAll("a.nav-link").forEach(el=>el.classList.remove("active"));
		  tabbar.appendChild(li);

		  // --- Contenu Console
		  const pane = document.createElement("div");
		  pane.className = "tab-pane fade show active h-100";
		  pane.id = "pane-console";
		  const pre = document.createElement("pre");
		  pre.id = "consoleOutput";
		  pre.className = "p-2 h-100 m-0";
		  pre.style.background = "#fff";
		  pre.style.color = "#000";
		  pre.style.overflow = "auto";
		  pane.appendChild(pre);

		  content.querySelectorAll(".tab-pane").forEach(p=>p.classList.remove("show","active"));
		  content.appendChild(pane);

		  ensureJsTabbar();

		  tabbar.classList.remove("d-none");
		  consoleTab = pre;
		  return pre;
		}

		// ---- util : supprimer les commentaires HTML ----
		function stripHtmlComments(src) {
		  return src.replace(/<!--[\s\S]*?-->/g, "");
		}

		function patchConsole(iframe){
		  const doc = iframe.contentDocument;
		  if(!doc) return;

		  const consoleOutput = document.getElementById("consoleOutput");
		  if(consoleOutput) consoleOutput.textContent = "";

		  const script = `
			(function(){
			  const oldLog = console.log;
			  console.log = function(...args){
				oldLog.apply(console, args);
				const msg = args.map(a => 
				  typeof a==="object" ? JSON.stringify(a) : String(a)
				).join(" ");
				parent.postMessage({ type:"console", message: msg }, "*");
			  };
			})();
		  `;
		  const inject = doc.createElement("script");
		  inject.textContent = script;
		  (doc.head || doc.documentElement).appendChild(inject);
		}

		// Écoute les messages envoyés par l’iframe (console.log)
		window.addEventListener("message", (e)=>{
		  const preview = document.getElementById('preview');
		  if (!preview || e.source !== preview.contentWindow) return;
		  if(e.data?.type === "console"){
			const pre = openConsoleTab();        // crée l’onglet si besoin
			pre.textContent += e.data.message + "\n";
			pre.scrollTop = pre.scrollHeight;
		  }
		});

		// --- Adapter runPreview pour ignorer les <script src="..."> commentés et gérer les onglets JS ---
		function runPreview(){
		  const iframe = document.getElementById('preview');
		  const srcOriginal = document.getElementById('code').value;

		  // Vider la console à chaque exécution
		  const consoleOutput = document.getElementById("consoleOutput");
		  if (consoleOutput) consoleOutput.textContent = "";

		  // Supprime les commentaires HTML pour ne pas détecter des <script> désactivés
		  const srcNoComments = stripHtmlComments(srcOriginal);

		  // Vérifier s'il y a au moins un console.log
		  if(/console\.log\s*\(/.test(srcNoComments)){
			openConsoleTab();
		  } else if(consoleTab){
			consoleTab.closest(".tab-pane")?.remove();
			document.querySelector('#fileTabsJs li:has(a[href="#pane-console"])')?.remove();
			consoleTab = null;
		  }

		  // 1) Collecter les <script src="..."></script> réellement actifs
		  const scriptRe = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
		  let m, activeSrcs = new Set(), tagsToReplace = [];

		  while ((m = scriptRe.exec(srcNoComments))) {
			activeSrcs.add(m[1]);
			tagsToReplace.push({ tag: m[0], srcFile: m[1] });
		  }

		  // 2) Fermer les onglets JS qui ne sont plus actifs
		  for (const name of Object.keys(openJsFiles)) {
			if (!activeSrcs.has(name)) {
			  const ta = openJsFiles[name];
			  const pane = ta && ta.closest(".tab-pane");
			  if (pane) pane.remove();
			  const tabbar = document.getElementById("fileTabsJs");
			  tabbar?.querySelectorAll("a.nav-link").forEach(a => {
				if (a.textContent === name) a.parentElement?.remove();
			  });
			  delete openJsFiles[name];
			}
		  }
		  ensureJsTabbar();

		  // 3) Ouvrir/mettre à jour les onglets actifs
		  let src = srcOriginal;
		  for (const { tag, srcFile } of tagsToReplace) {
			const ta = openJsFile(srcFile);
			const scriptTag = `<script>\n${ta.value}\n</script>`;
			src = src.replace(tag, scriptTag);
		  }

		  // 4) Injecter le patch console
		  const patchScript = `
		  <script>(function(){
			function send(level, parts){
			  try {
				const msg = parts.map(a=>{
				  try { return (typeof a==="object") ? JSON.stringify(a) : String(a); }
				  catch(_){ return String(a); }
				}).join(" ");
				parent.postMessage({ type:"console", level, message: msg }, "*");
			  } catch(_) {}
			}
			["log","info","warn","error"].forEach(level=>{
			  const orig = console[level].bind(console);
			  console[level] = (...args)=>{ orig(...args); send(level, args); };
			});
			window.addEventListener("error", e=>{
			  send("error", [\`\${e.message} (\${e.filename}:\${e.lineno}:\${e.colno})\`]);
			});
			window.addEventListener("unhandledrejection", e=>{
			  const r = e.reason;
			  send("error", [r && (r.stack || r.message || String(r)) || "Unhandled promise rejection"]);
			});
		  })();<\/script>
		  `;

		  if (/<head>/i.test(src)) {
			src = src.replace(/<head>/i, "<head>" + patchScript);
		  } else {
			src = patchScript + src;
		  }

		  iframe.srcdoc = src;

		  // 5) Afficher/masquer la barre d’onglets
		  ensureJsTabbar();
		}

	window.computeFilename = function(){
	  const ta = document.getElementById('code');
	  const first = (ta.value.split('\n')[0] || '').trim();

	  // Regex : capture "Nom" et "Objet" (autorise underscore, tiret, etc.)
	  const m = first.match(/^<!--\s*([^/]+?)\s*\/\s*([^>]+?)\s*-->$/);

	  const today = new Date();
	  const nameDate = today.getFullYear().toString()
					   + String(today.getMonth()+1).padStart(2,'0')
					   + String(today.getDate()).padStart(2,'0');

	  const clean = s => s
		.replace(/[^\p{L}\p{N}\-_. ]/gu,'') // autorise lettres, chiffres, tirets, underscores, points et espaces
		.replace(/\s+/g,'')
		.slice(0,40);

	  if(m){
		const name = clean(m[1]); 
		const subj = clean(m[2]);
		if(name && subj) return `${name}_${subj}_${nameDate}.html`;
	  }
	  return `TP_${nameDate}.html`;
	};

	// --- Téléchargement adapté (ZIP sous iOS/Safari) ---
	async function downloadFile() {
	  const filename = (typeof window.computeFilename === 'function' ? window.computeFilename() : 'document.html');
	  const text = document.getElementById('code').value;

	  const ua = navigator.userAgent;
	  const isiPadOS = ua.includes("Macintosh") && "ontouchend" in document;
	  const isIOS = /iPad|iPhone|iPod/.test(ua) || isiPadOS;
	  const isSafari = /^((?!chrome|android|CriOS|FxiOS|EdgiOS).)*safari/i.test(ua);
	  const needZip = (isIOS || isSafari);

	  if (needZip) {
		// ➜ Crée un ZIP contenant l’HTML (et CSS si onglets ouverts)
		const zip = new JSZip();
		zip.file(filename, text);

		if (window.openCssFiles) {
		  for (const [name, taCss] of Object.entries(window.openCssFiles)) {
			zip.file(name, taCss.value);
		  }
		}

		const blob = await zip.generateAsync({ type: "blob" });
		const zipName = filename.replace(/\.html?$/i, '') + ".zip";

		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = zipName;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(a.href);
	  } else {
		// ➜ Téléchargement classique en .html
		const blob = new Blob([text], { type: "text/html;charset=utf-8" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(a.href);
	  }

	  window._htmlDirty?.markJustSaved();
	}

      // init + watchers
      window.addEventListener('load', restore);
      ta.addEventListener('input', ()=>{ persist(); syncHighlight(); });
      ta.addEventListener('scroll', ()=>{ persist(); syncHighlight(); });
      window.addEventListener('beforeunload', persist);

		// --- Partage ---
		function handleShare(type) {
		  const ta = document.getElementById('code');
		  const url = makeShareURL(ta.value);

		  if (url.length > 1800) {
			const cont = confirm(
			  "/!\\ Votre code est assez long; le lien sera volumineux et pourrait ne pas fonctionner dans tous les navigateurs.\n\n" +
			  "Voulez-vous quand même créer le lien ?"
			);
			if (!cont) return;
		  }

		  if (type === "link") {
			navigator.clipboard.writeText(url).then(() => {
			  alert("Lien copié dans le presse-papiers !");
			});
		  } else if (type === "iframe") {
			// en HTML on ajoute &light=1 pour iframe
			const iframeCode = `<iframe src="${url}&light=1" width="100%" height="600" style="border:0;"></iframe>`;
			navigator.clipboard.writeText(iframeCode).then(() => {
			  alert("Code iframe copié dans le presse-papiers !");
			});
		  }
		}

		// Écouteur global sur le bouton principal
		const btnShare = document.getElementById('share');
		btnShare?.addEventListener('click', async ()=>{
		  const ta = document.getElementById('code');
		  const url = makeShareURL(ta.value);

		  if (url.length > 1800) {
			const cont = confirm(
			  "/!\\ Votre code est assez long; le lien sera volumineux et pourrait ne pas fonctionner dans tous les navigateurs.\n\n" +
			  "Voulez-vous quand même créer le lien ?"
			);
			if (!cont) return;
		  }
		});

		// Boutons du menu dropdown
		const btnCopyLink = document.getElementById('copyLink');
		btnCopyLink?.addEventListener('click', () => {
		  handleShare("link");
		});

		const btnLightCopyLink = document.getElementById('lightCopyLink');
		btnLightCopyLink?.addEventListener('click', () => {
		  handleShare("link");
		});

		const btnCopyIframe = document.getElementById('copyIframe');
		btnCopyIframe?.addEventListener('click', () => {
		  handleShare("iframe");
		});

      // Boutons
      document.getElementById('run').addEventListener('click', runPreview);
		document.getElementById('clear').addEventListener('click', ()=>{
			const preview = document.getElementById('preview');
			if(preview) preview.srcdoc = '';
				// Ferme tous les fichiers JS ouverts
				if (typeof openJsFiles !== "undefined") {
				  for (const name of Object.keys(openJsFiles)) {
					const ta = openJsFiles[name];
					if (ta && ta.closest(".tab-pane")) {
					  ta.closest(".tab-pane").remove();
					}
				  }
				  openJsFiles = {};
				}
				const tabbarJs = document.getElementById('fileTabsJs');
				if (tabbarJs) {
				  tabbarJs.innerHTML = '';
				  tabbarJs.classList.add('d-none');
				}
		});
		
      document.getElementById('download').addEventListener('click', downloadFile);
      
		document.getElementById('reset').addEventListener('click', ()=>{
		  if (!confirm('Réinitialiser l’éditeur ?')) return;
		  try{
			localStorage.removeItem(LS_CODE);
			localStorage.removeItem(LS_CARET);
			localStorage.removeItem(LS_SCROLL);
		  }catch(_){}
		  // ➜ cache le badge et remet le titre
		  window.EditorFS?.clear();
		  ta.value = initialTemplate();
		  ta.setSelectionRange(ta.value.length, ta.value.length);
		  ta.scrollTop = 0;
		  ta.dispatchEvent(new Event('input'));
		  syncHighlight();
		  ta.focus();
		  window.setSaveEnabled(false);
		});

		function getLineEnd(text,pos){ const i=text.indexOf('\n', pos); return i===-1 ? text.length : i; }

		function getLineStart(text,pos){ return text.lastIndexOf('\n', pos-1) + 1; }

		function indentOnEnter(){
		  const start = ta.selectionStart, end = ta.selectionEnd, v = ta.value;
		  const ls = getLineStart(v, start);
		  const line = v.slice(ls, start);
		  const base = (line.match(/^[ \t]*/)||[''])[0];

		  // On indente si la ligne se termine par '>' ET que ce n'est PAS une balise fermante </...>
		  const endsWithTag   = />\s*$/.test(line);
		  const isClosingTag  = /^\s*<\//.test(line);
		  const endsWithBrace = /{\s*$/.test(line); // CSS

		  const needsIndent = (endsWithTag && !isClosingTag) || endsWithBrace;
		  const INDENT = '    '; // 4 espaces

		  const insert = '\n' + base + (needsIndent ? INDENT : '');
		  ta.value = v.slice(0, start) + insert + v.slice(end);
		  const pos = start + insert.length;
		  ta.setSelectionRange(pos, pos);
		  ta.dispatchEvent(new Event('input'));
		  persist();
		  syncHighlight();
		}


		const VOID_TAGS = new Set([
		  'area','base','br','col','embed','hr','img','input','link',
		  'meta','param','source','track','wbr'
		]);

		const AUTOCLOSE_TAGS = new Set([
		  'html','head','body','style','title','header','main','footer',
		  'section','article','nav','aside','div','p','h1','h2','h3','h4','h5','h6',
		  'ul','ol','li','table','thead','tbody','tfoot','tr','td','th','small'
		]);

		function maybeAutoClose(allowJumpOverGt = false) {
		  const pos = ta.selectionStart;
		  const v   = ta.value;

		  // Ne saute le '>' que si on vient DÉLIBÉRÉMENT de le franchir (keyup '>'/ArrowRight)
		  if (allowJumpOverGt && v[pos] === '>') {
			ta.setSelectionRange(pos + 1, pos + 1);
		  }

		  const p2   = ta.selectionStart;
		  const left = v.slice(0, p2);
		  const right= v.slice(p2);

		  // Tag COMPLET juste avant le curseur: ...<tag ...>
		  const m = left.match(/<(?!\/|!|\?|--)([A-Za-z][\w:-]*)\b[^>]*>$/);
		  if (!m) return;

		  const name = m[1].toLowerCase();
		  if (VOID_TAGS.has(name) || !AUTOCLOSE_TAGS.has(name)) return;

		  const closeTag = `</${name}>`;
		  if (right.startsWith(closeTag)) return;

		  ta.value = left + closeTag + right;
		  ta.setSelectionRange(p2, p2); // curseur entre <tag> et </tag>
		  ta.dispatchEvent(new Event('input'));
		  try { localStorage.setItem(LS_CODE, ta.value); } catch(_) {}
		  syncHighlight();
		}

		function autoCloseAtCaret(){
		  const pos = ta.selectionStart;
		  const v   = ta.value;
		  if (pos === 0) return;

		  // On ne tente l’auto-fermeture que si on est juste APRÈS un '>'
		  if (v[pos - 1] !== '>') return;

		  // Trouver la balise ouvrante juste complétée
		  const lt = v.lastIndexOf('<', pos - 1);
		  if (lt === -1) return;

		  const inside = v.slice(lt + 1, pos - 1); // entre '<' et '>'
		  // ignorer doctype, commentaires, ?xml …, balises fermantes
		  if (/^\s*(?:!|--|\?|\/)/.test(inside)) return;

		  const m = inside.match(/^\s*([A-Za-z][\w:-]*)/);
		  if (!m) return;
		  const name = m[1].toLowerCase();

		  // évite les balises auto-fermantes classiques
		  // (on se limite aux conteneurs qu’on veut fermer)
		  if (!AUTOCLOSE_TAGS.has(name)) return;

		  const closeTag = `</${name}>`;
		  const after = v.slice(pos);
		  if (after.startsWith(closeTag)) return; // déjà présent

		  // insère </tag> et place le curseur au milieu
		  ta.value = v.slice(0, pos) + closeTag + after;
		  ta.setSelectionRange(pos, pos);
		  ta.dispatchEvent(new Event('input'));
		  persist();
		  syncHighlight();
		}

		function insertPair(open, close){
		  const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
		  const sel = v.slice(s, e);
		  ta.value = v.slice(0, s) + open + sel + close + v.slice(e);
		  const ns = s + open.length, ne = ns + sel.length;
		  ta.setSelectionRange(ns, ne);
		  ta.dispatchEvent(new Event('input')); persist(); syncHighlight();
		}

		function findOpenTagBefore(pos, maxScan = 1500){
		  const v = ta.value;
		  let i = pos - 1;
		  let scanned = 0;
		  let inQuote = null; // '"' ou "'"

		  // Ignore le '>' immédiat si on est juste après la balise
		  if (i >= 0 && v[i] === '>') i--, scanned++;

		  while (i >= 0 && scanned < maxScan){
			const ch = v[i];

			if (inQuote){
			  if (ch === inQuote && v[i-1] !== '\\') inQuote = null;
			} else {
			  if (ch === '"' || ch === "'"){
				inQuote = ch;
			  } else if (ch === '<'){
				const ahead = v.slice(i + 1, pos);
				if (/^\s*[!/?]/.test(ahead)) return null;
				const m = ahead.match(/^\s*([A-Za-z][\w:-]*)/);
				if (!m) return null;
				return { lt: i, name: m[1].toLowerCase() };
			  }
			}
			i--; scanned++;
		  }
		  return null;
		}

		ta.addEventListener('keyup', (e)=>{
		  if (e.key === '>' || e.key === 'ArrowRight') {
			maybeAutoClose(true);
		  }
		});

		ta.addEventListener('keydown', (e)=>{
		  if (e.ctrlKey || e.metaKey) return;

		  const start = ta.selectionStart;
		  const end   = ta.selectionEnd;
		  const v     = ta.value;
		  const next  = v[start] || '';
		  const noSel = (start === end);

		  // ---- Entrée : insère un retour à la ligne + indentation simple ----
		  if (e.key === 'Enter'){
			e.preventDefault();
			indentOnEnter();
			return;
		  }

		// ----- Tab / Shift+Tab : (dés)indenter -----
		if (e.key === 'Tab'){
		  e.preventDefault();
		  const INDENT = '    '; // 4 espaces
		  const v = ta.value;
		  const s = ta.selectionStart;
		  const epos = ta.selectionEnd;

		  const selMulti = v.slice(s, epos).includes('\n');
		  const ls = getLineStart(v, s);
		  const le = getLineStart(v, epos); // début de la dernière ligne sélectionnée

		  if (selMulti){
			// multi-lignes : (dés)indenter chaque ligne
			const block = v.slice(ls, epos);
			const lines = block.split(/\r?\n/);

			let deltaStart = 0, deltaEnd = 0;

			const changed = lines.map(line=>{
			  if (!e.shiftKey){ // indent
				return INDENT + line;
			  } else {          // unindent (1 tab ou 1–4 espaces)
				if (line.startsWith('\t')) { deltaEnd--; if (s>ls) deltaStart--; return line.slice(1); }
				if (line.startsWith(INDENT)) { deltaEnd -= INDENT.length; if (s>ls) deltaStart -= INDENT.length; return line.slice(INDENT.length); }
				const m = line.match(/^( {1,4})/);
				if (m){ deltaEnd -= m[1].length; if (s>ls) deltaStart -= m[1].length; return line.slice(m[1].length); }
				return line;
			  }
			});

			const replaced = changed.join('\n');
			ta.value = v.slice(0, ls) + replaced + v.slice(epos);
			if (!e.shiftKey){
			  // +4 par ligne (y compris la dernière)
			  const n = lines.length;
			  ta.setSelectionRange(s + INDENT.length, epos + n*INDENT.length);
			} else {
			  ta.setSelectionRange(s + deltaStart, epos + deltaEnd);
			}
		  } else {
			// une seule ligne
			if (!e.shiftKey){
			  ta.value = v.slice(0, s) + INDENT + v.slice(epos);
			  ta.setSelectionRange(s + INDENT.length, s + INDENT.length);
			} else {
			  const ls2 = getLineStart(v, s);
			  const before = v.slice(ls2, s);
			  if (before.endsWith('\t')){
				ta.value = v.slice(0, s-1) + v.slice(epos);
				ta.setSelectionRange(s-1, s-1);
			  } else if (before.endsWith(INDENT)){
				ta.value = v.slice(0, s-INDENT.length) + v.slice(epos);
				ta.setSelectionRange(s-INDENT.length, s-INDENT.length);
			  } else {
				// rien à désindenter
			  }
			}
		  }

		  ta.dispatchEvent(new Event('input')); // renumérotation + overlay
		  persist(); 
		  syncHighlight();
		  return;
		}

		  // ----- Paires (), "", '' -----
		  if (e.key === '('){ e.preventDefault(); insertPair('(', ')'); return; }
		  if (e.key === '"'){
			e.preventDefault();
			if (noSel && next === '"'){ ta.setSelectionRange(start+1, start+1); }
			else insertPair('"','"');
			return;
		  }
		  if (e.key === "'"){
			e.preventDefault();
			if (noSel && next === "'"){ ta.setSelectionRange(start+1, start+1); }
			else insertPair("'","'");
			return;
		  }
		  if (e.key === "<"){
			e.preventDefault();
			if (noSel && next === "<"){ ta.setSelectionRange(start+1, start+1); }
			else insertPair("<",">");
			return;
		  }

		  if (e.key === '>'){
			if (noSel && next === '>'){
			  e.preventDefault();
			  if (!(noSel && next === '>')){
				ta.value = v.slice(0, start) + '>' + v.slice(end);
				ta.setSelectionRange(start + 1, start + 1);
			  } else {
				ta.setSelectionRange(start + 1, start + 1);
			  }
			  const pos = ta.selectionStart;
			  const open = findOpenTagBefore(pos);
			  if (open && AUTOCLOSE_TAGS.has(open.name)){
				const after = ta.value.slice(pos);
				const closeTag = `</${open.name}>`;
				if (!after.startsWith(closeTag)){
				  ta.value = ta.value.slice(0, pos) + closeTag + after;
				  // curseur reste entre <tag> | </tag>
				  ta.setSelectionRange(pos, pos);
				}
			  }
			  return;
			}
			return; // sinon, comportement natif
		  }

		  // Backspace intelligent
		  if (e.key === 'Backspace'){
			if (noSel && start > 0){
			  const prev = v[start-1], nxt = v[start] || '';
			  if ((prev==='(' && nxt===')') || (prev==='"' && nxt==='"') || (prev==="'" && nxt==="'") || (prev==='<' && nxt==='>')){
				e.preventDefault();
				ta.value = v.slice(0, start-1) + v.slice(start+1);
				ta.setSelectionRange(start-1, start-1);
				ta.dispatchEvent(new Event('input')); persist(); syncHighlight();
				return;
			  }
			}
		  }
		});

    })();

// ==== Local file open/save (File System Access API + fallback) ====
(function(){
  const ta = document.getElementById('code');
  const btnOpen     = document.getElementById('openLocal');
  const btnSave     = document.getElementById('saveLocal');
  const btnSaveAs   = document.getElementById('saveAsLocal');
  const btnDownload = document.getElementById('download');

  // --- Badge dans la navbar ---
  const badge      = document.getElementById('fileBadge');
  const badgeName  = document.getElementById('fileBadgeName');

  // état courant
  let fileHandle = null;     // poignée FS Access (Chromium/Edge)
  let fileName   = null;     // nom du fichier ouvert (indicatif)

  const supportsFS = ('showOpenFilePicker' in window) && ('showSaveFilePicker' in window);

  function setDocTitle(){
    const base = document.title.replace(/\s+\|.*$/, '');
    document.title = fileName ? `${base} | ${fileName}` : base;
  }

  function updateBadge(){
    if (!badge) return;
    if (fileName && fileName.trim()){
      badge.classList.remove('d-none');
      if (badgeName) badgeName.textContent = fileName;
    } else {
      badge.classList.add('d-none');
    }
  }

	// --- Mini API publique pour le reset global ---
	window.EditorFS = {
	  clear(){
		fileHandle = null;
		fileName   = null;
		setDocTitle();
		updateBadge();
	  }
	};

  // ---- Désactiver "Enregistrer" si écrasement impossible (Firefox/Safari) ----
  if (btnSave && !supportsFS){
    btnSave.disabled = true;
    btnSave.title = 'Votre navigateur ne permet pas l’enregistrement direct (écrasement). Utilisez “Enregistrer sous…” ou “Télécharger”.';
  }

	window.setSaveEnabled = function(state){
	  const btnSave = document.getElementById('saveLocal');
	  if (!btnSave) return;
	  if (state){
		btnSave.classList.remove('disabled');
	  } else {
		btnSave.classList.add('disabled');
	  }
	};

  async function openWithFSAccess(){
    try{
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'HTML / CSS / Texte', accept: {
          'text/html': ['.html', '.htm'],
          'text/css' : ['.css'],
          'text/plain': ['.txt']
        }}],
        excludeAcceptAllOption: false,
        multiple: false
      });
      const file = await handle.getFile();
      const text = await file.text();
      fileHandle = handle;
      fileName   = file.name;
      ta.value   = text;
      ta.setSelectionRange(text.length, text.length);
      ta.scrollTop = 0;
      ta.dispatchEvent(new Event('input'));
      (window.syncHighlight||(()=>{}))();
      setDocTitle();
      updateBadge();
      setSaveEnabled(true);
    }catch(e){ /* cancel */ }
  }

  async function saveToExistingHandle(){
    if(!fileHandle){ throw new Error('no-handle'); }
    const writable = await fileHandle.createWritable();
    await writable.write(ta.value);
    window._htmlDirty?.markJustSaved();
    await writable.close();
  }

	async function saveAsWithFSAccess(){
	  try {
		const ta = document.getElementById('code');

		// Utilise computeFilename si dispo, sinon fallback
		const suggested = (typeof window.computeFilename === 'function' ? window.computeFilename() : null)
						  || fileName 
						  || 'document.html';

		const handle = await window.showSaveFilePicker({
		  suggestedName: suggested,
		  types: [{ description: 'HTML', accept: { 'text/html': ['.html', '.htm'] } }],
		});

		fileHandle = handle;
		fileName   = handle.name;

		const writable = await handle.createWritable();
		await writable.write(ta.value);
		await writable.close();

		setDocTitle();
		updateBadge();
		window._htmlDirty?.markJustSaved();
		setSaveEnabled(true);
	  } catch(e) {
		if (e && e.name === 'AbortError') {
		  return; // annulation utilisateur, pas d'alerte
		}
		console.error("Erreur saveAs:", e);
		alert('Échec de "Enregistrer sous…".');
	  }
	}

// ---- Fallback (iOS / Safari) avec support ZIP ----
function pickFileFallback(){
  return new Promise((resolve,reject)=>{
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.html,.htm,.css,.txt,.zip,text/html,text/css,text/plain,application/zip';
    inp.addEventListener('change', async ()=>{
      if(!inp.files || !inp.files[0]) { reject(new Error('cancel')); return; }
      const f = inp.files[0];

      // Cas ZIP (iOS / Safari)
      if(f.name.toLowerCase().endsWith(".zip")){
        const reader = new FileReader();
        reader.onload = async ()=>{
          try {
            const zip = await JSZip.loadAsync(reader.result);

            // cherche tous les .html dans l’archive
            const htmlFiles = Object.keys(zip.files).filter(n => n.toLowerCase().endsWith(".html") || n.toLowerCase().endsWith(".htm"));

            if(htmlFiles.length === 0){
              alert("Aucun fichier HTML trouvé dans ce ZIP.");
              reject(new Error("no-html-in-zip"));
              return;
            }

            let chosen = htmlFiles[0];
            if(htmlFiles.length > 1){
              chosen = prompt("Le ZIP contient plusieurs fichiers HTML. Entrez le nom du fichier à ouvrir :", htmlFiles[0]) || htmlFiles[0];
            }

            const text = await zip.files[chosen].async("string");
            fileHandle = null;
            fileName   = chosen;
            ta.value   = text;
            ta.setSelectionRange(text.length, text.length);
            ta.scrollTop = 0;
            ta.dispatchEvent(new Event('input'));
            (window.syncHighlight||(()=>{}))();
            setDocTitle();
            updateBadge();
            setSaveEnabled(true);
            resolve();
          } catch(err){
            alert("Erreur lors de la lecture du ZIP.");
            reject(err);
          }
        };
        reader.readAsArrayBuffer(f);
      } else {
        // Cas normal (html / css / txt)
        const reader = new FileReader();
        reader.onload = ()=>{
          fileHandle = null;
          fileName   = f.name || null;
          ta.value   = reader.result || '';
          ta.setSelectionRange(ta.value.length, ta.value.length);
          ta.scrollTop = 0;
          ta.dispatchEvent(new Event('input'));
          (window.syncHighlight||(()=>{}))();
          setDocTitle();
          updateBadge();
          setSaveEnabled(true);
          resolve();
        };
        reader.onerror = ()=> reject(reader.error || new Error('read-error'));
        reader.readAsText(f);
      }
    }, { once:true });
    inp.click();
  });
}


  function saveAsFallback(){
    // Utilise votre "Télécharger" existant (ne peut pas écraser le fichier ouvert).
    btnDownload?.click();
    setSaveEnabled(true);
  }

  // ---- Wire buttons ----
  btnOpen?.addEventListener('click', async ()=>{
    if(supportsFS) await openWithFSAccess();
    else await pickFileFallback();
  });

	btnSave?.addEventListener('click', async ()=>{
	  const expected = computeFilename();   // nom basé sur la 1ère ligne
	  if (fileName && fileName !== expected){
		alert(
		  "/!\\ Le nom défini par la 1ère ligne a changé.\n" +
		  "Avant   : " + fileName + "\n" +
		  "Nouveau : " + expected + "\n\n" +
		  "Un nouvel enregistrement va être proposé."
		);
		fileHandle = null;
		fileName   = expected;
	  }
	  try {
		if (supportsFS) {
		  if (fileHandle) {
			await saveToExistingHandle();    // écrase le fichier courant si nom en cohérence
		  } else {
			await saveAsWithFSAccess();      // sinon => dialogue Enregistrer sous...
		  }
		}
	  } catch(e) {
		  if(String(e?.message) !== 'cancel'){ console.error(e); alert('Échec de "Enregistrer".'); }
	  }
	});

	  btnSaveAs?.addEventListener('click', async ()=>{
		const expected = computeFilename();   // nom basé sur la 1ère ligne
		fileName = expected;
		try{
		  if(supportsFS) await saveAsWithFSAccess();
		  else saveAsFallback();
		}catch(e){
		  if(String(e?.message) !== 'cancel'){ console.error(e); alert('Échec de "Enregistrer sous...".'); }
		}
	  });

  // Masquer le badge au chargement
  updateBadge();
})();

	// --- Détection iOS / Safari ---
	(function(){
	  const ua = navigator.userAgent;
	  const isiPadOS = ua.includes("Macintosh") && "ontouchend" in document;
	  const isIOS = /iPad|iPhone|iPod/.test(ua) || isiPadOS;
	  const isSafari = /^((?!chrome|android|CriOS|FxiOS|EdgiOS).)*safari/i.test(ua);

	  if(isIOS || isSafari){
		document.getElementById("saveLocal")?.parentElement.classList.add("d-none");
		document.getElementById("saveAsLocal")?.parentElement.classList.add("d-none");
	  }
	})();

	document.addEventListener('keydown', async function(e) {
	  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
		e.preventDefault(); // évite "Enregistrer la page" du navigateur
		try {
		  // Cas 1 : bouton Enregistrer activé
		  const btnSave = document.getElementById('saveLocal');
		  if (btnSave && !btnSave.classList.contains('disabled')) {
			btnSave.click();
		  } else {
			// Cas 2 : aucun fichier ouvert → Enregistrer sous...
			const btnSaveAs = document.getElementById('saveAsLocal');
			if (btnSaveAs) btnSaveAs.click();
		  }
		} catch (err) {
		  console.error("Erreur lors de l'enregistrement:", err);
		}
	  }
	});

	(() => {
	  const PRODUCT = "html";       // adapter: "python" | "html" | "markdown" | "sql"
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

	// Exécution avec F9
	  document.addEventListener('keydown', function (e) {
		if (e.key === "F9") {
		  e.preventDefault(); // évite d'ouvrir les outils navigateur
		  const runBtn = document.getElementById("run");
		  if (runBtn) {
			runBtn.click(); // simule le clic
		  }
		}
	  });
	  
	(() => {
	  const ta       = document.getElementById('code');
	  const dirtyDot = document.getElementById('dirtyDot');
	  const baseTitle = document.title;

	  let lastSavedValue = ta ? ta.value : '';
	  let isDirty = false;

	function updateDirtyUI(){
	  if (dirtyDot) dirtyDot.style.display = isDirty ? '' : 'none';
	  document.title = isDirty ? baseTitle + ' ●' : baseTitle;
	}

	  function recomputeDirty(){
		const now = ta ? ta.value : '';
		isDirty = (now !== lastSavedValue);
		updateDirtyUI();
	  }

	  function markJustSaved(){
		lastSavedValue = ta ? ta.value : '';
		isDirty = false;
		updateDirtyUI();
	  }

	  function setJustLoaded(){
		lastSavedValue = ta ? ta.value : '';
		isDirty = false;
		updateDirtyUI();
	  }

	  // recalcul à chaque frappe
	  if (ta) ta.addEventListener('input', recomputeDirty);

	  // exposer pour les autres blocs (ex. quand tu fais “Enregistrer”)
	  window._htmlDirty = { markJustSaved, setJustLoaded };
	})();
