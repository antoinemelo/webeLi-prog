	function initialTemplate(){
		return `<!-- Prénom / Thème-ObjetTPxx -->
<!DOCTYPE html>
<html>
	<head>
		<meta charset="UTF-8">
		<meta name="viewport"
			  content="width=device-width, initial-scale=1.0">
		<title>PAGE</title>
		<link rel="stylesheet" href="style_ini.css">
		<style></style>
	</head>
	<body>
		<h1>Hello world</h1>
	</body>
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
		if (light !== "1") {
		  document.getElementById("btnHelp")?.classList.add("d-none");
		}
		if (light == "1") {
		  document.getElementById("reset")?.classList.add("d-none");
		  document.getElementById("saveAsLocal")?.classList.add("d-none");
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
		  let inCSS = false; // entre <style> ... </style>

		  while(i < n){
			// Commentaires HTML
			if (raw.slice(i, i+4) === '<!--'){
			  const end = raw.indexOf('-->', i+4);
			  const j = end === -1 ? n : end + 3;
			  out += `<span class="tok com">${esc(raw.slice(i, j))}</span>`;
			  i = j; 
			  continue;
			}

			// Balises HTML
			if (raw[i] === '<'){
			  // trouver la fin de la balise (respecte guillemets)
			  let j = i+1, inQ = false, q = null;
			  while (j < n){
				const c = raw[j];
				if (inQ){
				  if (c === q) { inQ = false; q = null; }
				} else {
				  if (c === '"' || c === "'"){ inQ = true; q = c; }
				  else if (c === '>'){ j++; break; }
				}
				j++;
			  }
			  const tagTxt = raw.slice(i, j);
			  const openStyle  = /^<\s*style\b/i.test(tagTxt);
			  const closeStyle = /^<\s*\/\s*style\b/i.test(tagTxt);

			  out += colorizeTag(tagTxt);
			  i = j;

			  // bascule mode CSS
			  if (openStyle && !/\/>$/.test(tagTxt)) inCSS = true;
			  if (closeStyle) inCSS = false;
			  continue;
			}

			// Zone CSS (entre <style> … </style>) : on autorise strings, nombres, commentaires CSS
			if (inCSS){
			  // Commentaire CSS
			  if (raw.slice(i, i+2) === '/*'){
				const end = raw.indexOf('*/', i+2);
				const j = end === -1 ? n : end + 2;
				out += `<span class="tok com">${esc(raw.slice(i, j))}</span>`;
				i = j; 
				continue;
			  }
			  // Chaînes CSS
			  if (raw[i] === '"' || raw[i] === "'"){
				const q = raw[i]; let j = i+1, escp = false;
				while (j < n){
				  const c = raw[j];
				  if (escp) escp = false;
				  else if (c === '\\') escp = true;
				  else if (c === q){ j++; break; }
				  j++;
				}
				out += `<span class="tok str">${esc(raw.slice(i, j))}</span>`;
				i = j; 
				continue;
			  }
			  // Nombres CSS
			  if (/\d/.test(raw[i])){
				let j = i+1; while (j < n && /[\d._-]/.test(raw[j])) j++;
				out += `<span class="tok num">${esc(raw.slice(i, j))}</span>`;
				i = j; 
				continue;
			  }
			  // Autres caractères CSS
			  out += esc(raw[i]); 
			  i++;
			  continue;
			}

			// Texte HTML (hors balises & hors CSS) : NE PAS traiter ' " comme des chaînes
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

      function persist(){ window.workshopDocuments?.save(); }

      function restore() {
        createWorkshopDocuments({
          prefix: 'html_editor', title: 'HTML/CSS', extension: 'html', template: initialTemplate(),
          linked: readCodeFromURL(), filename: () => window.computeFilename(), saveAsId: 'saveAsLocal',
          mime: 'text/html;charset=utf-8', accept: '.html,.htm,.txt,.zip',
          types: [{description: 'HTML', accept: {'text/html': ['.html', '.htm']}}],
          openTypes: [{description: 'HTML / ZIP', accept: {'text/html': ['.html', '.htm'], 'application/zip': ['.zip']}}],
          empty: () => ({preview: ''}),
          validate: state => htmlCssFiles.validate(state),
          prepare: (documents, active) => htmlCssFiles.initialize(documents, active),
          snapshotExtras: () => htmlCssFiles.snapshot(),
          sharedDirty: () => htmlCssFiles.dirty(), savedExtras: state => htmlCssFiles.markSaved(state),
          projectName: 'html', projectButton: 'exportHtmlProject',
          projectFiles: () => htmlCssFiles.snapshot().files.map(file => ({name: file.name, data: file.value})),
          capture(doc) {
            doc.extras = {preview: document.getElementById('preview').srcdoc};
            Object.assign(doc.runtime, {dataUrlCache, projectDirectoryHandle, fallbackImageFiles});
          },
          show(doc) {
            dataUrlCache = doc.runtime.dataUrlCache || Object.create(null);
            projectDirectoryHandle = doc.runtime.projectDirectoryHandle || null;
            fallbackImageFiles = doc.runtime.fallbackImageFiles || new Map();
            document.getElementById('preview').srcdoc = doc.extras.preview || '';
          },
          async download(snapshot, name) {
            if (!snapshot.extras.files.length) { workshopDownload(name, snapshot.code, 'text/html;charset=utf-8'); return; }
            const zip = new JSZip();
            zip.file(name, snapshot.code);
            for (const file of snapshot.extras.files) zip.file(file.name, file.value);
            workshopDownload(name.replace(/\.html?$/i, '') + '.zip', await zip.generateAsync({type: 'blob'}));
          },
          async saveExtras(extras, doc, saveAs) {
            const handles = htmlCssFiles.handles;
            for (const file of extras.files) {
              const handle = (!saveAs && handles[file.name]) || await window.showSaveFilePicker({
                suggestedName: file.name.split('/').pop(), types: [{description: 'CSS', accept: {'text/css': ['.css']}}]
              });
              const writable = await handle.createWritable();
              await writable.write(file.value); await writable.close();
              handles[file.name] = handle;
            }
          },
          async importFile(file, handle, loaded) {
            if (!/\.zip$/i.test(file.name)) { loaded(await file.text(), file.name, handle); return; }
            const zip = await JSZip.loadAsync(await file.arrayBuffer());
            const names = Object.keys(zip.files).filter(name => !zip.files[name].dir && /\.html?$/i.test(name));
            if (!names.length) throw new Error('Aucun fichier HTML dans ce ZIP.');
            const name = names.length === 1 ? names[0] : prompt('Fichier HTML à ouvrir :', names[0]);
            if (name === null) return;
            if (!names.includes(name)) throw new Error('Fichier HTML introuvable.');
            const folder = name.slice(0, name.lastIndexOf('/') + 1);
            const cssNames = Object.keys(zip.files).filter(path => !zip.files[path].dir && path.startsWith(folder) && /\.css$/i.test(path));
            const files = await Promise.all(cssNames.map(async path => ({name: path.slice(folder.length), value: await zip.files[path].async('string'), closed: false})));
            htmlCssFiles.merge({files});
            loaded(await zip.files[name].async('string'), name.split('/').pop(), null);
          }
        });
      }

    // The preview uses every CSS file in this document, including closed tabs.
		function runPreview(){
		  const iframe = document.getElementById('preview');
      const srcOriginal = document.getElementById('code').value;
      let src = htmlCssFiles.inline(srcOriginal, replaceCachedImageReferences);

		  // Une image plus large que le panneau doit être réduite, pas rognée.
		  // La règle reste volontairement minimale afin de respecter le CSS élève.
		  const imageFitStyle = `
		<style id="lab-html-image-fit">
		  img { max-width: 100%; height: auto; object-fit: contain; }
		</style>`;
		  if (/<\/head\s*>/i.test(src)) {
			src = src.replace(/<\/head\s*>/i, imageFitStyle + "\n</head>");
		  } else {
			src = imageFitStyle + src;
		  }
		  src = replaceCachedImageReferences(src);

		  // 4) Script injecté dans l'iframe :
		  //    - intercepte les clics sur <a>
		  //    - scanne les <img src="..."> locaux et demande l’image au parent
		  const injected = `
		<script>
		document.addEventListener("click", function(e) {
		  const a = e.target.closest("a[href]");
		  if (!a) return;

		  const href = a.getAttribute("href") || "";
		  if (!href) return;

		  // ---- 1) Ancres internes (#top)
		  if (href.startsWith("#")) {
			e.preventDefault();
			const target = document.querySelector(href);
			if (target) {
			  target.scrollIntoView({behavior:"smooth"});
			} else {
			  document.documentElement.scrollTop = 0;
			  document.body.scrollTop = 0;
			}
			return;
		  }

		  // ---- 2) Fichiers locaux (html, txt, images…)
		  if (!href.startsWith("http://") && !href.startsWith("https://") && !href.startsWith("data:")) {
			e.preventDefault();
			window.parent.postMessage({type:"local-file", href: href}, "*");
			return;
		  }

		  // ---- 3) Liens externes
		  e.preventDefault();
		  window.parent.postMessage({type:"external-link", href: href}, "*");
		});

		// --- Scan des <img> locaux + réception des DataURL depuis le parent ---
		(function(){
		  function scanImages(){
			const imgs = document.querySelectorAll("img[src]");
			imgs.forEach(function(img){
			  const orig = img.getAttribute("src") || "";

			  // on ignore http, https, data:
			  if (orig.startsWith("http://") || orig.startsWith("https://") || orig.startsWith("data:")) {
				return;
			  }

			  // marquer comme "image locale"
			  img.dataset.localSrc = orig;

			  // petit placeholder transparent
			  img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

			  // demande au parent d'ouvrir un fichier correspondant
			  window.parent.postMessage({
				type: "request-image",
				src: orig
			  }, "*");
			});
		  }

		  // Quand le parent renvoie l'image encodée en DataURL
		  window.addEventListener("message", function(ev){
			if (!ev.data || typeof ev.data !== "object") return;
			if (ev.data.type !== "image-loaded") return;

			var src = ev.data.src;
			var dataUrl = ev.data.dataUrl;
			if (!src || !dataUrl) return;

			document.querySelectorAll('img[data-local-src="' + src + '"]').forEach(function(img){
			  img.src = dataUrl;
			});
		  });

		  if (document.readyState === "complete" || document.readyState === "interactive") {
			scanImages();
		  } else {
			document.addEventListener("DOMContentLoaded", scanImages);
		  }
		})();
		<\/script>
		`;

		  // Injection dans la page
		  if (src.includes("</body>")) {
			src = src.replace("</body>", injected + "</body>");
		  } else {
			src += injected;
		  }

		  iframe.srcdoc = src;

		  // 5) Afficher/masquer la barre d’onglets
		  window.workshopDocuments?.save();
		}

		// ---- Messages iframe → parent : liens + fichiers locaux + images locales (DataURL) ----
		let dataUrlCache = Object.create(null);
		let projectDirectoryHandle = null;
		let fallbackImageFiles = new Map();

		function isLocalImageSource(src) {
		  const value = String(src || "").trim();
		  return Boolean(value)
			&& !/^(?:https?:|data:|blob:|\/\/|#)/i.test(value);
		}

		function cleanLocalPath(src) {
		  let value = String(src || "").trim().split(/[?#]/, 1)[0];
		  try { value = decodeURIComponent(value); } catch (_) {}
		  value = value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
		  const parts = value.split("/").filter(part => part && part !== ".");
		  if (!parts.length || parts.includes("..")) return null;
		  return parts;
		}

		function replaceCachedImageReferences(text) {
		  let result = String(text || "");
		  result = result.replace(
			/(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi,
			(match, prefix, quote, src) => dataUrlCache[src] || dataUrlCache[src.trim()]
			  ? `${prefix}${quote}${dataUrlCache[src] || dataUrlCache[src.trim()]}${quote}`
			  : match
		  );
		  result = result.replace(
			/url\(\s*(["']?)([^"')]+)\1\s*\)/gi,
			(match, quote, src) => dataUrlCache[src] || dataUrlCache[src.trim()]
			  ? `url("${dataUrlCache[src] || dataUrlCache[src.trim()]}")`
			  : match
		  );
		  return result;
		}

		function collectLocalImageSources(html) {
		  const sources = new Set();
		  const documentPreview = new DOMParser().parseFromString(html, "text/html");
		  documentPreview.querySelectorAll("img[src]").forEach(image => {
			const src = image.getAttribute("src");
			if (isLocalImageSource(src)) sources.add(src.trim());
		  });

		  // Les images utilisées dans un style inline ou une feuille CSS ouverte
		  // bénéficient du même chargement groupé.
		  let css = [...documentPreview.querySelectorAll("style")]
			.map(style => style.textContent || "").join("\n");
		  css += "\n" + [...documentPreview.querySelectorAll("[style]")]
			.map(element => element.getAttribute("style") || "").join("\n");
		  if (window.openCssFiles) {
			css += "\n" + Object.values(window.openCssFiles)
			  .map(textarea => textarea?.value || "").join("\n");
		  }
		  const urlPattern = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;
		  let match;
		  while ((match = urlPattern.exec(css))) {
			if (isLocalImageSource(match[2])) sources.add(match[2].trim());
		  }
		  return [...sources];
		}

		function fileToDataUrl(file) {
		  return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = () => reject(reader.error || new Error("read-error"));
			reader.readAsDataURL(file);
		  });
		}

		async function fileFromDirectory(src) {
		  if (!projectDirectoryHandle) return null;
		  const parts = cleanLocalPath(src);
		  if (!parts) return null;
		  let directory = projectDirectoryHandle;
		  for (const part of parts.slice(0, -1)) {
			directory = await directory.getDirectoryHandle(part);
		  }
		  const handle = await directory.getFileHandle(parts.at(-1));
		  return handle.getFile();
		}

		async function loadLocalImage(src) {
          const cache = dataUrlCache, imageFiles = fallbackImageFiles;
		  if (cache[src]) return cache[src];
		  let file = null;
		  try { file = await fileFromDirectory(src); } catch (_) {}
		  if (!file) {
			const parts = cleanLocalPath(src);
			const path = parts?.join("/");
			file = (path && imageFiles.get(path))
			  || (parts?.length && imageFiles.get(parts.at(-1)))
			  || null;
		  }
		  if (!file || (file.type && !file.type.startsWith("image/"))) return null;
		  const dataUrl = await fileToDataUrl(file);
		  cache[src] = dataUrl;
		  return dataUrl;
		}

		function chooseFallbackImages() {
		  return new Promise(resolve => {
			const input = document.createElement("input");
			input.type = "file";
			input.accept = "image/*";
			input.multiple = true;
			input.addEventListener("change", () => {
			  fallbackImageFiles = new Map();
			  [...(input.files || [])].forEach(file => {
				const relative = (file.webkitRelativePath || file.name).replace(/\\/g, "/");
				fallbackImageFiles.set(relative, file);
				const relativeParts = relative.split("/");
				if (relativeParts.length > 1) fallbackImageFiles.set(relativeParts.slice(1).join("/"), file);
				fallbackImageFiles.set(file.name, file);
			  });
			  resolve();
			}, {once: true});
			input.addEventListener("cancel", resolve, {once: true});
			input.click();
		  });
		}

		async function chooseProjectImages(force = false) {
		  const sources = collectLocalImageSources(document.getElementById("code")?.value || "");
		  if (!sources.length && !force) return;

		  if (force) {
			projectDirectoryHandle = null;
			fallbackImageFiles = new Map();
			Object.keys(dataUrlCache).forEach(key => delete dataUrlCache[key]);
		  }

		  if (!projectDirectoryHandle && typeof window.showDirectoryPicker === "function") {
			projectDirectoryHandle = await window.showDirectoryPicker({mode: "read"});
		  } else if (!projectDirectoryHandle && fallbackImageFiles.size === 0) {
			await chooseFallbackImages();
		  }

		  await Promise.all(sources.map(async src => {
			try { await loadLocalImage(src); }
			catch (error) { console.warn("Image locale introuvable :", src, error); }
		  }));
		}

		window.HtmlPreviewAssets = {
		  choose: () => chooseProjectImages(true),
		  reset() {
			projectDirectoryHandle = null;
			fallbackImageFiles = new Map();
			Object.keys(dataUrlCache).forEach(key => delete dataUrlCache[key]);
		  }
		};

		window.addEventListener("message", async (ev) => {
		  if (!ev.data || typeof ev.data !== "object") return;

		  const iframe = document.getElementById("preview");
		  if (!iframe || !iframe.contentWindow) return;
		  if (ev.source !== iframe.contentWindow) return;

		  const { type } = ev.data;

		  // ============================================================
		  // 1) LIENS EXTERNES : <a href="https://...">
		  // ============================================================
		  if (type === "external-link") {
			const { href } = ev.data;
			if (href) window.open(href, "_blank", "noopener,noreferrer");
			return;
		  }

		  // ============================================================
		  // 2) FICHIER LOCAL depuis <a href="local.html"> ou local.txt 
		  // ============================================================
      if (type === 'local-file') {
        await workshopDocuments.operation(async () => {
          let file;
          if (typeof window.showOpenFilePicker === 'function') {
            const [handle] = await window.showOpenFilePicker({multiple: false});
            file = await handle.getFile();
          } else [file] = await workshopPickFiles('.html,.htm,.txt,image/*');
          if (!file) return;
          iframe.srcdoc = file.type.startsWith('image/')
            ? `<img src="${await fileToDataUrl(file)}" style="max-width:100%;height:auto;">` : await file.text();
        });
        return;
      }

		  // ============================================================
		  // 3) DEMANDE D’IMAGE locale : <img src="photo.png">
		  // ============================================================
		  if (type === "request-image") {
			const src = ev.data.src;
			if (!src) return;

			// Déjà convertie en DataURL ? → on renvoie immédiatement
			if (dataUrlCache[src]) {
			  iframe.contentWindow.postMessage({
				type: "image-loaded",
				src,
				dataUrl: dataUrlCache[src]
			  }, "*");
			  return;
			}

			try {
          const cache = dataUrlCache;
			  const dataUrl = await loadLocalImage(src);
			  if (!dataUrl || cache !== dataUrlCache) return;
			  iframe.contentWindow.postMessage({type: "image-loaded", src, dataUrl}, "*");
			} catch (err) {
			  console.warn("Image locale introuvable :", src, err);
			}

			return;
		  }
		});

	window.computeFilename = function(){
	  const ta = document.getElementById('code');
	  const firstLines = ta.value.split('\n').slice(0, 10).join('\n'); // on regarde les 10 premières lignes

	  // Cas 1 : recherche explicite d’un nom de fichier dans un commentaire HTML
	  const fileMatch = firstLines.match(/<!--\s*([\w.-]+\.html)\s*-->/i);
	  if (fileMatch && fileMatch[1]) {
		return fileMatch[1].trim(); // retourne directement ce nom (ex: index.html)
	  }

	  // Cas 2 : ancien comportement (commentaire Prénom / Thème)
	  const m = firstLines.split('\n')[0].match(/^<!--\s*([^/]+?)\s*\/\s*([^>]+?)\s*-->$/);
	  const today = new Date();
	  const nameDate = today.getFullYear().toString()
					   + String(today.getMonth()+1).padStart(2,'0')
					   + String(today.getDate()).padStart(2,'0');
	  const clean = s => s
		.replace(/[^\p{L}\p{N}\-_. ]/gu,'')
		.replace(/\s+/g,'')
		.slice(0,40);

	  if (m){
		const name = clean(m[1]); 
		const subj = clean(m[2]);
		if(name && subj) return `${name}_${subj}_${nameDate}.html`;
	  }

	  // Cas 3 : fallback
	  return `TP_${nameDate}.html`;
	};

      // init + watchers
      window.addEventListener('load', restore);
      ta.addEventListener('input', ()=>{ persist(); syncHighlight(); });
      ta.addEventListener('scroll', ()=>{ persist(); syncHighlight(); });
      window.addEventListener('beforeunload', persist);

		// --- Partage ---
		function handleShare(type) {
		  const ta = document.getElementById('code');
		  const url = makeShareURL(htmlCssFiles.inline(ta.value));

		  if (url.length > 1800) {
			const cont = confirm(
			  "/!\\ Votre code est assez long; le lien sera volumineux et pourrait ne pas fonctionner dans tous les navigateurs.\n\n" +
			  "Voulez-vous quand même créer le lien ?"
			);
			if (!cont) return;
		  }

      const value = type === 'link' ? url : `<iframe src="${url}&light=1" width="100%" height="600" style="border:0;"></iframe>`;
      Promise.resolve().then(() => navigator.clipboard.writeText(value))
        .then(() => alert('Copié !')).catch(() => prompt('Copier :', value));
    }

		// Écouteur global sur le bouton principal
		const btnShare = document.getElementById('share');
		btnShare?.addEventListener('click', async ()=>{
		  const ta = document.getElementById('code');
		  const url = makeShareURL(htmlCssFiles.inline(ta.value));

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

      // Lock document selection while an image picker or preview update is pending.
      document.getElementById('run').addEventListener('click', () => workshopDocuments.operation(async () => {
        try { await chooseProjectImages(false); }
        catch (error) { if (error?.name !== 'AbortError') console.warn(error); }
        runPreview();
      }));
      document.getElementById('openAssets').addEventListener('click', event => {
        event.preventDefault();
        workshopDocuments.operation(async () => { await chooseProjectImages(true); runPreview(); });
      });
      document.getElementById('clear').addEventListener('click', () => {
        document.getElementById('preview').srcdoc = '';
        workshopDocuments.save();
      });
      document.getElementById('download').addEventListener('click', event => {
        event.preventDefault(); workshopDocuments.download();
      });


		function getLineEnd(text,pos){ const i=text.indexOf('\n', pos); return i===-1 ? text.length : i; }

		function getLineStart(text,pos){ return text.lastIndexOf('\n', pos-1) + 1; }

		const VOID_TAGS = new Set([
		  'area','base','br','col','embed','hr','img','input','link',
		  'meta','param','source','track','wbr'
		]);

		const AUTOCLOSE_TAGS = new Set([
		  'html','head','body','style','title','header','main','footer',
		  'section','article','nav','aside','div','p','h1','h2','h3','h4','h5','h6',
		  'ul','ol','li','table','thead','tbody','tfoot','tr','td','th','small'
		]);

		const INDENT_TAGS = new Set(AUTOCLOSE_TAGS);

		// --- Fonction principale d’indentation ---
		function indentOnEnter(){
		  const start = ta.selectionStart, end = ta.selectionEnd, v = ta.value;
		  const ls = getLineStart(v, start);
		  const line = v.slice(ls, start);
		  const base = (line.match(/^[ \t]*/)||[''])[0];
		  const INDENT = '    '; // 4 espaces

		  // --- Cas particulier : retour à la ligne entre <tag>|</tag>
		  const before = v.slice(0, start);
		  const after  = v.slice(start);
		  const innerMatch = before.match(/<([A-Za-z][\w:-]*)[^>]*>\s*$/);
		  if (innerMatch) {
			const tag = innerMatch[1].toLowerCase();
			const closeRe = new RegExp(`^\\s*<\/${tag}>`);
			if (closeRe.test(after)) {
			  const insert = `\n${base}${INDENT}\n${base}`;
			  ta.value = before + insert + after;
			  const newPos = start + 1 + base.length + INDENT.length;
			  ta.setSelectionRange(newPos, newPos);
			  ta.dispatchEvent(new Event('input'));
			  persist();
			  syncHighlight();
			  return;
			}
		  }

		  // --- Cas normal ---
		  const matchOpen = line.match(/<([A-Za-z][\w:-]*)[^>]*>\s*$/);
		  const matchClose = line.match(/<\/([A-Za-z][\w:-]*)>\s*$/);
		  const endsWithBrace = /{\s*$/.test(line); // cas CSS

		  let needsIndent = false;
		  if (matchOpen && !matchClose) {
			const tag = matchOpen[1].toLowerCase();
			needsIndent = INDENT_TAGS.has(tag);
		  } else if (endsWithBrace) {
			needsIndent = true;
		  }

		  const insert = '\n' + base + (needsIndent ? INDENT : '');
		  ta.value = v.slice(0, start) + insert + v.slice(end);
		  const pos = start + insert.length;
		  ta.setSelectionRange(pos, pos);
		  ta.dispatchEvent(new Event('input'));
		  persist();
		  syncHighlight();
		}

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
		  persist();
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
