    // ========================= Constantes & éléments =========================
    const LS_CODE   = 'sql_editor_code_v3';
    const LS_CARET  = 'sql_editor_caret_v3';
    const LS_SCROLL = 'sql_editor_scroll_v3';
    const LS_DB     = 'sql_editor_db_bin_v3'; // base persistée (Uint8Array -> base64)

    const codeEl = document.getElementById('code');
    const hiEl   = document.getElementById('highlighting');
    const outEl  = document.getElementById('output');

    const supportsFS = ('showOpenFilePicker' in window) && ('showSaveFilePicker' in window);

	const saveDBItem    = document.getElementById('saveDB');
	const saveDBAsItem  = document.getElementById('saveDBAs');
	const saveSQLItem   = document.getElementById('saveSQL');
	const openSQLItem   = document.getElementById('openDB');

	if (!supportsFS) {
	  [saveDBItem, saveDBAsItem, saveSQLItem, openSQLItem].filter(Boolean).forEach(el => {
		el.classList.add('disabled');
		el.setAttribute('aria-disabled', 'true');
		el.title = "Non supporté par ce navigateur — utilisez « Exporter .sqlite » / « Télécharger .sql »";
	  });
	}

// ========================= Gutter virtualisé + scroll sync =========================
(function(){
  const gutter = document.getElementById('gutter');
  if (!gutter) return;

  // petits réglages mode light (vous aviez ça ici)
  const url = new URL(window.location.href);
  const light = url.searchParams.get("light");
  if (light !== "1") document.getElementById("btnHelp")?.classList.add("d-none");
  if (light == "1")  document.getElementById("reset")?.classList.add("d-none");

  let lineHeight = 18;
  let padTop = 0;
  let lastKey = "";

  function measure(){
    const cs = getComputedStyle(codeEl);
    lineHeight = parseFloat(cs.lineHeight) || 18;
    padTop = parseFloat(cs.paddingTop) || 0;
  }

  function countLines(){
    // plus rapide que split() sur gros fichiers
    const m = codeEl.value.match(/\n/g);
    return (m ? m.length : 0) + 1;
  }

  function renderGutter(){
    // Virtualisation : on calcule la plage visible
    const total = countLines();
    const scrollTop = codeEl.scrollTop;

    const viewH = codeEl.clientHeight;
    const first = Math.max(1, Math.floor((scrollTop - padTop) / lineHeight) + 1);
    const visibleCount = Math.ceil(viewH / lineHeight) + 6; // marge
    const last = Math.min(total, first + visibleCount);

    const key = `${total}:${first}:${last}`;
    if (key === lastKey) return;
    lastKey = key;

    // Offset vertical pour que les numéros collent aux lignes
    const offsetY = (first - 1) * lineHeight + padTop;
    gutter.style.transform = `translateY(${-scrollTop + offsetY}px)`;

    // Génère uniquement les lignes visibles
    let s = "";
    for (let i = first; i <= last; i++) s += i + "\n";
    gutter.textContent = s;
  }

  // throttle via rAF
  let raf = 0;
  function schedule(){
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      renderGutter();
    });
  }

  // events
  codeEl.addEventListener('scroll', () => {
    schedule();
    // scroll overlay
    hiEl.scrollTop  = codeEl.scrollTop;
    hiEl.scrollLeft = codeEl.scrollLeft;
  });

  codeEl.addEventListener('input', () => {
    schedule();
  });

  window.addEventListener('resize', () => {
    measure();
    schedule();
  });

  window.addEventListener('load', () => {
    measure();
    schedule();
  });
})();

    // Splitter
    (function(){
      const root=document.documentElement, divider=document.getElementById('divider'), split=document.querySelector('.split');
      const lsKey='split_left_percent_sql_v3'; const saved=localStorage.getItem(lsKey); if(saved){ root.style.setProperty('--left', saved); }
      let dragging=false;
      function onMove(clientX){ const rect=split.getBoundingClientRect(); let x=clientX-rect.left; const min=240, max=rect.width-240; x=Math.max(min,Math.min(max,x)); const val=(x/rect.width*100).toFixed(1)+'%'; root.style.setProperty('--left', val); }
      divider.addEventListener('mousedown', e=>{ dragging=true; document.body.classList.add('dragging'); e.preventDefault(); });
      window.addEventListener('mousemove', e=>{ if(dragging) onMove(e.clientX); });
      window.addEventListener('mouseup', ()=>{ if(dragging){ dragging=false; document.body.classList.remove('dragging'); localStorage.setItem(lsKey, getComputedStyle(root).getPropertyValue('--left').trim()); } });
      divider.addEventListener('touchstart', ()=>{ dragging=true; document.body.classList.add('dragging'); }, {passive:true});
      window.addEventListener('touchmove', e=>{ if(dragging) onMove(e.touches[0].clientX); }, {passive:false});
      window.addEventListener('touchend', ()=>{ if(dragging){ dragging=false; document.body.classList.remove('dragging'); localStorage.setItem(lsKey, getComputedStyle(root).getPropertyValue('--left').trim()); } });
    })();

    // Effacer sortie
    document.getElementById('clear').addEventListener('click', ()=> outEl.innerHTML = '');

    // ========================= Coloration SQL (simple) =========================
    const KW = [ 'SELECT','FROM','WHERE','GROUP','BY','ORDER','LIMIT','OFFSET','HAVING','AS','DISTINCT', 'INSERT','INTO','VALUES','UPDATE','SET','DELETE', 'JOIN','LEFT','RIGHT','FULL','INNER','OUTER','ON','USING', 'CREATE','TABLE','VIEW','INDEX','UNIQUE','PRIMARY','KEY','FOREIGN','REFERENCES', 'DROP','ALTER','ADD','RENAME', 'BEGIN','COMMIT','ROLLBACK','TRANSACTION', 'AND','OR','NOT','NULL','IS','IN','LIKE','BETWEEN','EXISTS','CASE','WHEN','THEN','ELSE','END' ];
    const FUN = [ 'COUNT','SUM','AVG','MIN','MAX','ABS','ROUND','UPPER','LOWER','LENGTH','SUBSTR','COALESCE','IFNULL','RANDOM','DATE','TIME','DATETIME' ];
    const kwRe  = new RegExp('\\b(' + KW.join('|') + ')\\b','gi');
    const fnRe  = new RegExp('\\b(' + FUN.join('|') + ')\\b','gi');

	function highlightSQL(src){
	  // Échapper HTML
	  const esc = s => s.replace(/[&<>]/g, ch => (
		{'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]
	  ));
	  src = esc(src);

	  // Chaînes '...' ou "..." → vert
	  src = src.replace(/'([^'\\]|\\.)*'|"([^"\\]|\\.)*"/g,
		m => `<span class="str">${m}</span>`);

	  // 4) Noms de tables (avant les mots-clés)
	  src = src.replace(
		/\bCREATE\s+TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\b/gi,
		(_, name) => `CREATE TABLE <span class="tbl">${name}</span>`
	  );
	  src = src.replace(
		/\bALTER\s+TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\b/gi,
		(_, name) => `ALTER TABLE <span class="tbl">${name}</span>`
	  );
	  src = src.replace(
		/\bDROP\s+TABLE\s+IF\s+EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)\b/gi,
		(_, name) => `DROP TABLE IF EXISTS <span class="tbl">${name}</span>`
	  );
	  src = src.replace(
		/\bINSERT\s+INTO\s+([A-Za-z_][A-Za-z0-9_]*)\b/gi,
		(_, name) => `INSERT INTO <span class="tbl">${name}</span>`
	  );
	  src = src.replace(
		/\bUPDATE\s+([A-Za-z_][A-Za-z0-9_]*)\b/gi,
		(_, name) => `UPDATE <span class="tbl">${name}</span>`
	  );
	  src = src.replace(
		/\bDELETE\s+FROM\s+([A-Za-z_][A-Za-z0-9_]*)\b/gi,
		(_, name) => `DELETE FROM <span class="tbl">${name}</span>`
	  );
	  src = src.replace(
		/\b(FROM|JOIN|REFERENCES)\s+([A-Za-z_][A-Za-z0-9_]*)\b/gi,
		(_, op, name) => `${op} <span class="tbl">${name}</span>`
	  );

	  // Fonctions et mots-clés
	  src = src.replace(fnRe, m => `<span class="fn">${m}</span>`);
	  src = src.replace(kwRe, m => `<span class="kw">${m}</span>`);

	  // Nombres
	  src = src.replace(/\b\d+(\.\d+)?\b/g,
		m => `<span class="num">${m}</span>`);

	  // Commentaires -- ... → gris
	  src = src.replace(/--[^\n]*/g,
		m => `<span class="com">${m}</span>`);

	  return src;
	}

function syncHighlight(){
  hiEl.innerHTML = highlightSQL(codeEl.value);
  hiEl.scrollTop  = codeEl.scrollTop;
  hiEl.scrollLeft = codeEl.scrollLeft;
}

	/* --- État global : ligne d'erreur à surligner dans l'overlay --- */
	let SQL_ERROR_LINE = null;   // 1-based

	/* Surcouche : surligne la ligne en erreur dans l'overlay déjà coloré */
	const _origHighlightSQL = highlightSQL;
	window.highlightSQL = function(src){
	  let html = _origHighlightSQL(src);
	  if (SQL_ERROR_LINE && SQL_ERROR_LINE > 0){
		// on coupe par lignes APRÈS coloration pour wrapper la bonne ligne
		const lines = html.split('\n');
		const i = Math.min(SQL_ERROR_LINE-1, lines.length-1);
		lines[i] = `<span class="errline">${lines[i]}</span>`;
		html = lines.join('\n');
	  }
	  return html;
	};

	/* Split SQL en statements (respecte '...' , "..." , -- ... , /* ... *\/ ) + map ligne */
	function splitSQLWithMap(text){
	  const parts = [];
	  let buf = '', line = 1, startLine = 1;
	  let mode = 'code'; // 'code' | 'sq' | 'dq' | 'dash' | 'block'
	  for (let i=0;i<text.length;i++){
		const c = text[i], n = text[i+1];
		if (mode==='code'){
		  if (c==="'" ){ mode='sq'; buf+=c; }
		  else if (c===`"`){ mode='dq'; buf+=c; }
		  else if (c==='-' && n==='-'){ mode='dash'; buf+=c; i++; buf+='-'; }
		  else if (c==='/' && n==='*'){ mode='block'; buf+=c; i++; buf+='*'; }
		  else if (c===';'){ parts.push({sql:buf.trim(), startLine}); buf=''; startLine=line; }
		  else { buf+=c; if (c==='\n') line++; }
		} else if (mode==='sq'){
		  buf+=c; if (c==='\n') line++;
		  if (c==="'" && text[i-1]!=='\\') mode='code';
		} else if (mode==='dq'){
		  buf+=c; if (c==='\n') line++;
		  if (c===`"` && text[i-1]!=='\\') mode='code';
		} else if (mode==='dash'){
		  buf+=c; if (c==='\n'){ line++; mode='code'; }
		} else if (mode==='block'){
		  buf+=c; if (c==='\n') line++;
		  if (c==='*' && n=== '/') { buf+='/' ; i++; mode='code'; }
		}
	  }
	  if (buf.trim()) parts.push({sql:buf.trim(), startLine});
	  return parts;
	}

	/* Nettoyage du message pour enlever "Error:", "SQLITE_ERROR:" etc. */
	function cleanSqlMessage(msg){
	  return String(msg || '')
		.replace(/^\s*Error:\s*/i,'')
		.replace(/^\s*SQLITE_ERROR:\s*/i,'')
		.replace(/\s*at\s+line\s+\d+\s*$/i,'')
		.trim();
	}

	/* Trouve colonne & ligne locale à partir de near "TOKEN" si dispo */
	function probePosition(sql, msg){
	  const m = /near\s+"([^"]+)"/i.exec(msg);
	  if (!m) {
		const k = sql.search(/[^\s]/); // 1er char non blanc
		const localIndex = k < 0 ? 0 : k;
		const before = sql.slice(0, localIndex);
		const localLine = (before.match(/\n/g)||[]).length + 1;
		const col = localIndex - (before.lastIndexOf('\n')+1) + 1;
		return { localLine, col, token: null };
	  }
	  const token = m[1];
	  const hay = sql.toLowerCase(), ned = token.toLowerCase();
	  const idx = hay.indexOf(ned);
	  if (idx < 0){
		return { localLine: 1, col: 1, token };
	  }
	  const before = sql.slice(0, idx);
	  const localLine = (before.match(/\n/g)||[]).length + 1;
	  const col = idx - (before.lastIndexOf('\n')+1) + 1;
	  return { localLine, col, token };
	}

	/* Formate un extrait + flèche ^ et scrolle/surligne dans l’éditeur */
	function showSqlError(part, rawMsg){
	  const msg = cleanSqlMessage(rawMsg);
	  const pos = probePosition(part.sql, msg);
	  const absoluteLine = part.startLine + pos.localLine - 1;

	  // surlignage + scroll
	  SQL_ERROR_LINE = absoluteLine;
	  syncHighlight();
	  try{
		const lh = parseFloat(getComputedStyle(codeEl).lineHeight) || 18;
		codeEl.scrollTop = Math.max(0, (absoluteLine-2)*lh);
	  }catch(_){}

	  // extrait: ligne fautive du statement uniquement
	  const stmtLines = part.sql.split('\n');
	  const lineText  = stmtLines[pos.localLine-1] ?? '';
	  const pad = ' '.repeat(Math.max(0, pos.col-1));
	  const pointer = pad + '^';

	  outEl.innerHTML = `
		<div class="sql-error alert">
		  <div class="mb-1">
			<pre>Erreur :: Probablement à la ligne ${absoluteLine}</pre>
		  </div>
		  <pre class="mb-2">${lineText.replace(/[&<>]/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;' }[m]))}
	${pointer}</pre>
		  <pre>${msg.replace(/[&<>]/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;' }[m]))}</pre>
		</div>`;
	}

    // ========================= Persistance éditeur =========================
    function sqlformatDateYYYYMMDD(d){ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0'); return `${y}${m}${da}`; }
    function initialTemplate(){
      return [
        "-- Prénom / Thème-ObjetTPxx",
        "",
        "DROP TABLE IF EXISTS PROFS;",
        "",
        "CREATE TABLE PROFS (",
        "    id INTEGER PRIMARY KEY AUTOINCREMENT,",
        "    prenom TEXT NOT NULL,",
        "    nom TEXT",
        ");",
        "",
        "INSERT INTO PROFS (prenom, nom) VALUES",
        "  ('Antoine','Velo'),",
        "  ('Florian',''),",
        "  ('Nicolas','Mivier');",
        "",
        "SELECT * FROM PROFS",
        "ORDER BY nom;"
      ].join('\n');
    }
    function computeFilename(){ const first=(codeEl.value.split('\n')[0]||'').trim(); const m=first.match(/^\s*--\s*([^/]+?)\s*\/\s*(.+?)\s*$/); if(m){ const name=m[1].replace(/[^\p{L}\p{N}\-_. ]/gu,'').replace(/\s+/g,''); const subj=m[2].replace(/[^\p{L}\p{N}\-_. ]/gu,'').replace(/\s+/g,''); if(name&&subj) return `${name}_${subj}_${sqlformatDateYYYYMMDD(new Date())}.sql`; } return `TP_${sqlformatDateYYYYMMDD(new Date())}.sql`; }
    function persist(){ try{ localStorage.setItem(LS_CODE, codeEl.value); localStorage.setItem(LS_CARET, JSON.stringify({s: codeEl.selectionStart, e: codeEl.selectionEnd})); localStorage.setItem(LS_SCROLL, codeEl.scrollTop.toString()); }catch(_){} }
    function restore(){ const saved=localStorage.getItem(LS_CODE); codeEl.value = saved ?? initialTemplate(); try{ const ce=JSON.parse(localStorage.getItem(LS_CARET)||'{}'); if(Number.isInteger(ce.s)&&Number.isInteger(ce.e)) codeEl.setSelectionRange(ce.s, ce.e); }catch(_){} const st=parseInt(localStorage.getItem(LS_SCROLL)||'0',10); if(!Number.isNaN(st)) codeEl.scrollTop=st; syncHighlight(); }

    // ========================= Autocomplete =========================
    const ac=document.getElementById('ac'); let dict=[]; let acIndex=-1, charWidth=8, lineHeight=18, padLeft=0, padTop=0;
    (function measure(){ const cs=getComputedStyle(codeEl); lineHeight=parseFloat(cs.lineHeight)||18; padLeft=parseFloat(cs.paddingLeft)||0; padTop=parseFloat(cs.paddingTop)||0; const cv=document.createElement('canvas'); const ctx=cv.getContext('2d'); ctx.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; charWidth=ctx.measureText('M').width||8; })();
    const SQL_WORDS = Array.from(new Set([...KW, ...FUN, 'INTEGER','REAL','TEXT','BLOB','BOOLEAN','DEFAULT','AUTOINCREMENT','CHECK','WITHOUT','ROWID','VIEW','VIRTUAL','USING','TRIGGER','BEFORE','AFTER'])).sort();
    function buildDict(){ const set=new Set(SQL_WORDS); codeEl.value.replace(/[A-Za-z_][A-Za-z0-9_]*/g, w=>set.add(w)); dict=Array.from(set).sort((a,b)=>a.localeCompare(b)); }
    function getPrefixInfo(){ const pos=codeEl.selectionStart, v=codeEl.value; let i=pos-1; while(i>=0 && /[A-Za-z0-9_]/.test(v[i])) i--; const start=i+1, prefix=v.slice(start,pos); if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(prefix)) return null; return { prefix, start, end: pos }; }
    function indexToXY(idx){ const v=codeEl.value, lineStart=v.lastIndexOf('\n', idx-1)+1; const col=idx-lineStart, rows=(v.slice(0,idx).match(/\n/g)||[]).length; return { x: padLeft + col*charWidth - codeEl.scrollLeft, y: padTop + rows*lineHeight - codeEl.scrollTop }; }
    function showAC(items, anchor){ if(!items.length){ hideAC(); return; } ac.innerHTML=items.map((w,i)=>`<div class="item${i===0?' active':''}" data-i="${i}">${w}</div>`).join(''); acIndex=0; const pt=indexToXY(anchor); ac.style.left=pt.x+'px'; ac.style.top=(pt.y+lineHeight)+'px'; ac.classList.remove('hidden'); }
    function hideAC(){ ac.classList.add('hidden'); acIndex=-1; }
    function acVisible(){ return !ac.classList.contains('hidden'); }
    function updateAC(){ const info=getPrefixInfo(); if(!info || info.prefix.length<1){ hideAC(); return; } const pfx=info.prefix.toLowerCase(); const items=dict.filter(w=>w.toLowerCase().startsWith(pfx) && w!==info.prefix).slice(0,40); showAC(items, info.end); }
    function acceptAC(){ const info=getPrefixInfo(); if(!info) return; const choice=ac.children[acIndex]; if(!choice) return; const word=choice.textContent; const rest=word.slice(info.prefix.length); const v=codeEl.value; codeEl.value=v.slice(0, info.end)+rest+v.slice(info.end); const newPos=info.end+rest.length; codeEl.setSelectionRange(newPos, newPos); codeEl.dispatchEvent(new Event('input')); persist(); syncHighlight(); hideAC(); }
    ac.addEventListener('mousedown', e=>{ const it=e.target.closest('.item'); if(!it) return; e.preventDefault(); acIndex=[...ac.children].indexOf(it); acceptAC(); });

    function getLineStart(v,pos){ return v.lastIndexOf('\n', pos-1)+1; }
    function getLineEnd(v,pos){ const i=v.indexOf('\n',pos); return i===-1? v.length : i; }
    function indentSelection(shift){ const v=codeEl.value, s=codeEl.selectionStart, e=codeEl.selectionEnd; const first=getLineStart(v,s), last=getLineEnd(v,e); const before=v.slice(0, first), block=v.slice(first,last), after=v.slice(last); const lines=block.split('\n'); let added=0, removed=0, INDENT='    '; if(!shift){ for(let i=0;i<lines.length;i++) lines[i]=INDENT+lines[i]; added=INDENT.length*lines.length; } else { for(let i=0;i<lines.length;i++){ const m=lines[i].match(/^ {1,4}/); if(m){ lines[i]=lines[i].slice(m[0].length); removed+=m[0].length; } } } codeEl.value=before+lines.join('\n')+after; if(!shift){ codeEl.setSelectionRange(s+INDENT.length, e+added); } else { const leading=(v.slice(first).match(/^ +/)||[''])[0].length; const adjust=Math.min(4, Math.min(leading, s-first)); codeEl.setSelectionRange(s-adjust, Math.max(e-removed, s-adjust)); } codeEl.dispatchEvent(new Event('input')); persist(); syncHighlight(); }
    function backspaceSmart(e){ const s=codeEl.selectionStart, epos=codeEl.selectionEnd; if(s!==epos) return false; const v=codeEl.value; const lineStart=getLineStart(v,s); const before=v.slice(lineStart,s); if(/^[ ]*$/.test(before) && before.length>0){ e.preventDefault(); const INDENT='    '; const rm=before.length%INDENT.length===0?INDENT.length:before.length%INDENT.length; codeEl.value=v.slice(0,s-rm)+v.slice(epos); codeEl.setSelectionRange(s-rm,s-rm); codeEl.dispatchEvent(new Event('input')); persist(); syncHighlight(); return true; } return false; }

    codeEl.addEventListener('keydown', (e)=>{
      if(e.ctrlKey||e.metaKey) return;
      if(acVisible()){
        if(e.key==='ArrowDown'){ e.preventDefault(); acIndex=(acIndex+1)%ac.children.length; [...ac.children].forEach((el,i)=>el.classList.toggle('active',i===acIndex)); return; }
        if(e.key==='ArrowUp'){ e.preventDefault(); acIndex=(acIndex-1+ac.children.length)%ac.children.length; [...ac.children].forEach((el,i)=>el.classList.toggle('active',i===acIndex)); return; }
        if(e.key==='Tab' || e.key==='Enter'){ e.preventDefault(); acceptAC(); return; }
        if(e.key==='Escape'){ e.preventDefault(); hideAC(); return; }
      }
      if(e.key==='Enter'){ return; }
      if(e.key==='Tab'){ e.preventDefault(); indentSelection(e.shiftKey); return; }
      if(e.key==='Backspace'){ if(backspaceSmart(e)) return; }
      if(e.key==="'" || e.key==='"'){
        e.preventDefault(); const start=codeEl.selectionStart, end=codeEl.selectionEnd, v=codeEl.value, ch=e.key, sel=v.slice(start,end);
        codeEl.value=v.slice(0,start)+ch+sel+ch+v.slice(end); codeEl.setSelectionRange(start+1, start+1+sel.length);
        codeEl.dispatchEvent(new Event('input')); persist(); syncHighlight(); return;
      }
    });
    codeEl.addEventListener('input', ()=>{ persist(); syncHighlight(); buildDict(); updateAC(); });
    codeEl.addEventListener('keyup', (e)=>{ if(!['ArrowUp','ArrowDown','Enter','Tab','Escape'].includes(e.key)) updateAC(); });

    // ========================= Fichiers SQL (ouvrir / enregistrer / télécharger) =========================
    let sqlFileHandle = null;
    let sqlFileName   = null;

    function getCurrentSQLFilename(){
      return (sqlFileName || sqlFileHandle?.name || '').trim();
    }

    function setSQLFileState(handle, name){
      sqlFileHandle = handle || null;
      sqlFileName   = name || handle?.name || null;
    }

    function sqlSaveTypes(){
      return [{ description:'Script SQL', accept:{ 'text/sql':['.sql'], 'text/plain':['.sql'] } }];
    }

    async function ensureSQLWritable(handle){
      if(!handle || typeof handle.queryPermission !== 'function') return;
      const opts = { mode:'readwrite' };
      const q = await handle.queryPermission(opts);
      if(q === 'granted') return;
      if(typeof handle.requestPermission === 'function'){
        const r = await handle.requestPermission(opts);
        if(r === 'granted') return;
      }
      throw new Error('write-permission-denied');
    }

    async function writeSQLToHandle(handle){
      await ensureSQLWritable(handle);
      const writable = await handle.createWritable();
      await writable.write(codeEl.value);
      await writable.close();
    }

    async function fsOpenSQL(){
      try{
        const [handle]=await window.showOpenFilePicker({
          types:[{ description:'Script SQL', accept:{ 'text/sql':['.sql'], 'text/plain':['.sql','.txt'] } }],
          excludeAcceptAllOption:false,
          multiple:false
        });
        const file=await handle.getFile();
        const text=await file.text();
        setSQLFileState(handle, file.name);
        codeEl.value=text;
        codeEl.setSelectionRange(text.length, text.length);
        codeEl.scrollTop=0;
        codeEl.dispatchEvent(new Event('input'));
      }catch{}
    }

    async function fsSaveSQLAs(suggestedName){
      const handle=await window.showSaveFilePicker({
        suggestedName: suggestedName || computeFilename(),
        types: sqlSaveTypes()
      });
      await writeSQLToHandle(handle);
      setSQLFileState(handle, handle.name);
    }

    async function fsSaveSQL(){
      try{
        const expected = computeFilename(); // nom basé sur la 1ère ligne SQL
        const current  = getCurrentSQLFilename();

        // Si l'en-tête SQL a changé, on ne doit surtout pas écraser l'ancien fichier.
        // On déclenche directement un « Enregistrer sous… » avec le nouveau nom.
        if(current && current !== expected){
          await fsSaveSQLAs(expected);
          return;
        }

        if(sqlFileHandle){
          await writeSQLToHandle(sqlFileHandle);
        }else{
          await fsSaveSQLAs(expected);
        }
      }catch(err){
        if(String(err?.name||'')!=='AbortError'){
          console.error('Échec de l’enregistrement SQL:', err);
          alert("Échec de l'enregistrement .sql");
        }
      }
    }

    function downloadSQL(){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([codeEl.value], {type:'text/sql;charset=utf-8'})); a.download=computeFilename(); document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove(); }
    document.getElementById('openSQL').addEventListener('click', ()=> supportsFS ? fsOpenSQL() : (function(){ const inp=document.createElement('input'); inp.type='file'; inp.accept='.sql,text/sql,text/plain'; inp.addEventListener('change', async ()=>{ if(!inp.files||!inp.files[0]) return; const text=await inp.files[0].text(); setSQLFileState(null, inp.files[0].name || null); codeEl.value=text; codeEl.setSelectionRange(text.length,text.length); codeEl.scrollTop=0; codeEl.dispatchEvent(new Event('input')); }, {once:true}); inp.click(); })());
    document.getElementById('saveSQL').addEventListener('click', ()=> supportsFS ? fsSaveSQL() : downloadSQL());
    document.getElementById('downloadSQL').addEventListener('click', downloadSQL);

    // Ctrl+S / Cmd+S : sauvegarder le script SQL, pas la page HTML du navigateur.
    document.addEventListener('keydown', function(e){
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'){
        e.preventDefault();
        document.getElementById('saveSQL')?.click();
      }
    });

    // ========================= Base SQLite: seed Th_Ex, import/export, exécution =========================
    let SQL, db; let dbFileHandle=null; const dbBadge=document.getElementById('dbBadge'); const dbNameEl=document.getElementById('dbName');
    function setDBName(name){ if(name){ dbBadge.classList.remove('d-none'); dbNameEl.textContent=name; } else { dbBadge.classList.add('d-none'); dbNameEl.textContent='—'; } }

    function u8ToB64(u8){ let s=''; for(let i=0;i<u8.length;i++) s+=String.fromCharCode(u8[i]); return btoa(s); }
    function b64ToU8(b64){ const bin=atob(b64); const u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i); return u8; }

    const SCHOOL_SEED_SQL = `
PRAGMA foreign_keys = ON;
DROP TABLE IF EXISTS NOTES; DROP TABLE IF EXISTS EVALUATIONS; DROP TABLE IF EXISTS COURS;
DROP TABLE IF EXISTS ELEVES; DROP TABLE IF EXISTS CLASSES; DROP TABLE IF EXISTS PROFS;
DROP TABLE IF EXISTS MATIERES; DROP TABLE IF EXISTS ABSENCES;
CREATE TABLE CLASSES( id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, section TEXT, annee INTEGER );
CREATE TABLE ELEVES( id INTEGER PRIMARY KEY, prenom TEXT NOT NULL, nom TEXT NOT NULL, sexe TEXT CHECK(sexe IN ('F','M')), naissance DATE, classe_id INTEGER REFERENCES CLASSES(id) ON DELETE SET NULL );
CREATE TABLE PROFS( id INTEGER PRIMARY KEY AUTOINCREMENT, prenom TEXT NOT NULL, nom TEXT );
CREATE TABLE MATIERES( id INTEGER PRIMARY KEY, nom TEXT UNIQUE NOT NULL );
CREATE TABLE COURS( id INTEGER PRIMARY KEY, matiere_id INTEGER NOT NULL REFERENCES MATIERES(id), prof_id INTEGER NOT NULL REFERENCES PROFS(id), classe_id INTEGER NOT NULL REFERENCES CLASSES(id), semestre INTEGER NOT NULL CHECK(semestre IN (1,2)) );
CREATE TABLE EVALUATIONS( id INTEGER PRIMARY KEY, cours_id INTEGER NOT NULL REFERENCES COURS(id) ON DELETE CASCADE, date_eval DATE NOT NULL, type TEXT CHECK(type IN ('test','tp','oral','projet','exam')), coefficient REAL NOT NULL DEFAULT 1.0 CHECK(coefficient > 0) );
CREATE TABLE NOTES( id INTEGER PRIMARY KEY, evaluation_id INTEGER NOT NULL REFERENCES EVALUATIONS(id) ON DELETE CASCADE, eleve_id INTEGER NOT NULL REFERENCES ELEVES(id) ON DELETE CASCADE, note REAL CHECK(note BETWEEN 1 AND 6) );
CREATE TABLE ABSENCES( id INTEGER PRIMARY KEY, eleve_id INTEGER NOT NULL REFERENCES ELEVES(id) ON DELETE CASCADE, date DATE NOT NULL, motif TEXT );
INSERT INTO CLASSES(code, section, annee) VALUES ('1G1','ECG',2024), ('1G2','ECG',2024);
INSERT INTO MATIERES(nom) VALUES ('Mathématiques'),('Informatique'),('Français');
INSERT INTO PROFS(prenom,nom) VALUES ('Anne','Dupont'),('Marc','Favre'),('Sonia','Martin');
INSERT INTO ELEVES(prenom,nom,sexe,naissance,classe_id) VALUES ('Alice','Rossi','F','2008-05-11',1), ('Benoît','Nguyen','M','2007-12-03',1), ('Chloé','Durand','F','2008-01-20',1), ('Diego','Morel','M','2008-03-05',2), ('Emma','Keller','F','2007-11-14',2);
INSERT INTO COURS(matiere_id,prof_id,classe_id,semestre) VALUES (1,1,1,1),(2,2,1,1),(3,3,1,1),(1,1,2,1),(2,2,2,1);
INSERT INTO EVALUATIONS(cours_id,date_eval,type,coefficient) VALUES (1,'2024-09-20','test',1.0),(2,'2024-09-27','tp',1.0),(3,'2024-10-05','oral',1.0),(4,'2024-09-22','test',1.0),(5,'2024-09-29','tp',1.0);
INSERT INTO NOTES(evaluation_id,eleve_id,note) VALUES (1,1,5.5),(1,2,4.0),(1,3,5.0),(2,1,6.0),(2,2,4.5),(2,3,5.0),(3,1,5.0),(3,2,4.0),(3,3,5.5),(4,4,4.5),(4,5,5.0),(5,4,5.5),(5,5,5.0);
INSERT INTO ABSENCES(eleve_id,date,motif) VALUES (2,'2024-09-18','Maladie'),(4,'2024-09-19','Retard');`;

	function loadSchoolDB(){ try{ db.run(SCHOOL_SEED_SQL); setDBName('Base scolaire (Th_Ex)'); persistDB(); outEl.innerHTML = `<div class="text-success">> La base scolaire Th_Ex est maintenant chargée.</div>`; }catch(e){ outEl.innerHTML = `<div class="text-danger">Erreur lors du chargement de la base scolaire : ${e.message||e}</div>`; } }

	async function initDB(){
	  SQL = await initSqlJs({ locateFile: file => `../../assets/js/dist/sql-js@1.13.0/${file}` });
	  const saved = localStorage.getItem(LS_DB);
	  if(saved){
		db = new SQL.Database(b64ToU8(saved));
		setDBName('Session (restaurée)');
	  }else{
		db = new SQL.Database();
		setDBName(' Simple session (base vide)');
		persistDB();
		outEl.innerHTML = `<div class="text-secondary">>&nbsp;Base de données vide (pour le moment).</div>`;
	  }
	  try{ db.run('PRAGMA foreign_keys = ON;'); }catch(_){}
	}

    function persistDB(){ try{ const bin=db.export(); localStorage.setItem(LS_DB, u8ToB64(bin)); }catch(_){} }

    // Import .sqlite (fallback universel)
    document.getElementById('importDB').addEventListener('click', ()=>{ const inp=document.createElement('input'); inp.type='file'; inp.accept='.sqlite,.db,application/octet-stream'; inp.addEventListener('change', async ()=>{ if(!inp.files||!inp.files[0]) return; const buf=new Uint8Array(await inp.files[0].arrayBuffer()); try{ db && db.close?.(); }catch(_){ } db=new SQL.Database(buf); dbFileHandle=null; setDBName(inp.files[0].name); try{ db.run('PRAGMA foreign_keys = ON;'); }catch(_){ } persistDB(); outEl.innerHTML = `<div class="text-success">Base importée : <strong>${inp.files[0].name}</strong></div>`; }, {once:true}); inp.click(); });

    // Ouvrir .sqlite (FS Access)
    document.getElementById('openDB').addEventListener('click', async ()=>{ if(!supportsFS){ alert("Votre navigateur ne permet pas l'ouverture directe. Utilisez ‘Importer .sqlite’. "); return; } try{ const [handle]=await window.showOpenFilePicker({ types:[{ description:'SQLite database', accept:{ 'application/octet-stream':['.sqlite','.db'] } }], excludeAcceptAllOption:false, multiple:false }); const file=await handle.getFile(); const buf=new Uint8Array(await file.arrayBuffer()); try{ db && db.close?.(); }catch(_){ } db=new SQL.Database(buf); dbFileHandle=handle; setDBName(file.name); try{ db.run('PRAGMA foreign_keys = ON;'); }catch(_){ } persistDB(); outEl.innerHTML = `<div class="text-success">Base ouverte : <strong>${file.name}</strong></div>`; }catch{} });

    // Enregistrer .sqlite / Enregistrer sous...
    function defaultDBFilename(){
      const current = (dbFileHandle?.name || dbNameEl?.textContent || '').trim();
      if (/\.(sqlite|db)$/i.test(current)) return current;
      return `lab_sql_${sqlformatDateYYYYMMDD(new Date())}.sqlite`;
    }

    async function chooseDBHandle(suggestedName){
      return await window.showSaveFilePicker({
        suggestedName: suggestedName || defaultDBFilename(),
        types:[{description:'SQLite database', accept:{ 'application/octet-stream':['.sqlite','.db'] }}],
        excludeAcceptAllOption:false
      });
    }

    async function writeDBToHandle(handle){
      const bin=db.export();
      const writable=await handle.createWritable();
      await writable.write(bin);
      await writable.close();
      dbFileHandle=handle;
      setDBName(handle.name || defaultDBFilename());
      outEl.innerHTML = `<div class="text-success">Base enregistrée : <strong>${handle.name||defaultDBFilename()}</strong></div>`;
    }

    async function saveDB(){
      try{
        if(supportsFS && dbFileHandle){
          await writeDBToHandle(dbFileHandle);
        } else if(supportsFS){
          await saveDBAs();
        } else {
          exportDB();
        }
      }catch(err){
        if(String(err?.name||'')!=='AbortError') alert("Échec de l'enregistrement .sqlite");
      }
    }

    async function saveDBAs(){
      try{
        if(!supportsFS){ exportDB(); return; }
        const handle=await chooseDBHandle(defaultDBFilename());
        await writeDBToHandle(handle);
      }catch(err){
        if(String(err?.name||'')!=='AbortError') alert("Échec de l'enregistrement sous .sqlite");
      }
    }

    document.getElementById('saveDB').addEventListener('click', saveDB);
    document.getElementById('saveDBAs')?.addEventListener('click', saveDBAs);

    // Export .sqlite (téléchargement)
    function exportDB(){ const bin=db.export(); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([bin], {type:'application/octet-stream'})); a.download=defaultDBFilename(); document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove(); }
    document.getElementById('exportDB').addEventListener('click', exportDB);

    // Bouton Charger base scolaire (remplace la base courante)
	document.getElementById('seedSchool').addEventListener('click', ()=>{
	  if(!confirm('Remplacer la base actuelle par la base scolaire Th_Ex ? (les données non enregistrées seront perdues)'))
		return;

	  try{ db && db.close?.(); }catch(_){}
	  db = new SQL.Database();
	  loadSchoolDB();

		// Injecter le commentaire dans l’éditeur
		codeEl.value = [
			"-- Prénom / Thème-ObjetTPxx",
			""
		].join("\n");
		codeEl.setSelectionRange(codeEl.value.length, codeEl.value.length);
		codeEl.scrollTop = 0;
		codeEl.dispatchEvent(new Event('input')); // met à jour coloration & persistance
	});

	function escapeHtml(str){
	  return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
	}

    // Exécuter
	document.getElementById('run').addEventListener('click', ()=>{
	  outEl.innerHTML = '';
	  SQL_ERROR_LINE = null;
	  syncHighlight();

	  const sql = codeEl.value;
	  const parts = splitSQLWithMap(sql);

	  let anyOutput = false;
	  let resultCount = 0;

	  function renderResults(results){
		if(!Array.isArray(results) || results.length===0) return;
		results.forEach((res)=>{
		  const table = document.createElement('table');
		  table.className = 'table table-sm table-bordered table-striped table-hover align-middle mb-3';
		  const thead = document.createElement('thead');
		  thead.innerHTML = `<tr>${res.columns.map(c=>`<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
		  table.appendChild(thead);
		  const tbody = document.createElement('tbody');
			res.values.forEach(row=>{
			  const tr = document.createElement('tr');
			  tr.innerHTML = row.map(v=>{
				const val = v===null ? 'NULL' : escapeHtml(v);
				return `<td>${val}</td>`;
			  }).join('');
			  tbody.appendChild(tr);
			});
		  table.appendChild(tbody);
		  const title = document.createElement('div');
		  title.className = 'mb-1';
		  title.innerHTML = `<span class="badge text-bg-secondary">Résultat ${++resultCount}</span>`;
		  outEl.appendChild(title);
		  outEl.appendChild(table);
		  anyOutput = true;
		});
	  }

	  try{
		for (const part of parts){
		  if (!part.sql) continue;
		  try{
			const res = db.exec(part.sql);
			renderResults(res);
		  }catch(err){
			// Erreur : nettoie le message, calcule ligne/colonne, surligne & stoppe
			showSqlError(part, String(err?.message||err));
			return;
		  }
		}
		persistDB();
		if (!anyOutput){
		  outEl.innerHTML = `<div class="text-info">OK (aucun résultat à afficher).</div>`;
		}
	  }catch(e){
		outEl.innerHTML = `<div class="alert alert-danger">Échec d'exécution : ${cleanSqlMessage(String(e?.message||e))}</div>`;
	  }
	});

	// Reset (éditeur + base vide) + rafraîchissement
	document.getElementById('reset').addEventListener('click', ()=>{
	  if(!confirm('Réinitialiser l’éditeur et repartir d’une base vide ?')) return;

	  // Nettoyage éditeur / stockage
	  localStorage.removeItem(LS_CODE);
	  localStorage.removeItem(LS_CARET);
	  localStorage.removeItem(LS_SCROLL);
	  localStorage.removeItem(LS_DB);

	  // Repose le template et persiste
	  codeEl.value = initialTemplate();
	  codeEl.setSelectionRange(codeEl.value.length, codeEl.value.length);
	  codeEl.scrollTop = 0;
	  syncHighlight();
	  persist();

	  // Nouvelle base vide + PRAGMA + badge + persistance
	  try{ db && db.close?.(); }catch(_){}
	  db = new SQL.Database();
	  try{ db.run('PRAGMA foreign_keys = ON;'); }catch(_){}
	  setDBName(' Simple session (base vide)');
	  try{
		const bin = db.export();
		localStorage.setItem(LS_DB, (function(u8){ let s=''; for(let i=0;i<u8.length;i++) s+=String.fromCharCode(u8[i]); return btoa(s); })(bin));
	  }catch(_){}

	  // --- Rafraîchissement de la page ---
	  // on laisse le thread UI finir avant de recharger
	  requestAnimationFrame(()=> location.reload());
	});

    // Drag & Drop (.sql sur éditeur, .sqlite sur résultats)
    function isSQLiteFile(f){ return /\.(sqlite|db)$/i.test(f.name) || f.type==='application/octet-stream'; }
    function isSQLScript(f){ return /\.(sql|txt)$/i.test(f.name) || /^text\//.test(f.type); }
    function setupDropZone(el, onFiles){ ['dragenter','dragover'].forEach(evt=>el.addEventListener(evt, e=>{ e.preventDefault(); e.stopPropagation(); el.classList.add('drop-target'); })); ['dragleave','drop'].forEach(evt=>el.addEventListener(evt, e=>{ e.preventDefault(); e.stopPropagation(); el.classList.remove('drop-target'); })); el.addEventListener('drop', e=>{ const files=[...(e.dataTransfer?.files||[])]; if(files.length) onFiles(files); }); }
    setupDropZone(document.getElementById('editorWrap'), async (files)=>{ const f=files.find(isSQLScript); if(!f) return; const text=await f.text(); sqlFileHandle=null; codeEl.value=text; codeEl.setSelectionRange(text.length, text.length); codeEl.scrollTop=0; codeEl.dispatchEvent(new Event('input')); });
    setupDropZone(outEl, async (files)=>{ const f=files.find(isSQLiteFile); if(!f) return; const buf=new Uint8Array(await f.arrayBuffer()); try{ db && db.close?.(); }catch(_){ } db=new SQL.Database(buf); dbFileHandle=null; setDBName(f.name); try{ db.run('PRAGMA foreign_keys = ON;'); }catch(_){ } persistDB(); outEl.innerHTML = `<div class="text-success">Base importée (drag & drop) : <strong>${f.name}</strong></div>`; });

	// ========================= Schéma / Introspection =========================
	function rows(result) {
	  if (!result || !result[0]) return [];
	  const cols = result[0].columns;
	  return result[0].values.map(r => Object.fromEntries(r.map((v,i)=>[cols[i], v])));
	}
	function esc(s){ return String(s).replace(/[&<>]/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;' }[ch])); }
	function qname(name){ return "'" + String(name).replace(/'/g,"''") + "'"; }

	function listUserObjects() {
	  return rows(db.exec(`
		SELECT name, type
		FROM sqlite_master
		WHERE type IN ('table','view')
		  AND name NOT LIKE 'sqlite_%'
		ORDER BY type, name;
	  `));
	}

	function tableInfo(table){
	  return rows(db.exec(`PRAGMA table_info(${qname(table)});`)); // cid,name,type,notnull,dflt_value,pk
	}
	function tableFKs(table){
	  return rows(db.exec(`PRAGMA foreign_key_list(${qname(table)});`)); // id,seq,table,from,to,on_update,on_delete,match
	}
	function tableIndexes(table){
	  const idx = rows(db.exec(`PRAGMA index_list(${qname(table)});`)); // name, unique, origin
	  idx.forEach(i=>{
		i.columns = rows(db.exec(`PRAGMA index_info(${qname(i.name)});`)).map(r=>r.name);
	  });
	  return idx;
	}

	function renderTablesAndCols(){
	  const objs = listUserObjects();
	  let html = '<span class="badge text-bg-primary me-1">TABLE</span>';
	  objs.filter(o=>o.type==='table').forEach(o=>{
		const cols = tableInfo(o.name);
		const idxs = tableIndexes(o.name);
		html += `<div class="mb-3">
		  <div class="h6 mb-2"><br><i class="bi bi-table me-1"></i> <code class="tbl-name"><b><big>${esc(String(o.name).toUpperCase())}</big></b></code></div>
		  <table class="table table-sm table-bordered align-middle">
			<thead><tr><th>Champs</th><th>Type</th><th>Val. nulle</th><th>Par défaut</th><th>CP / PK</th></tr></thead>
			<tbody>
			  ${cols.map(c=>`<tr>
				<td><code>${esc(c.name)}</code></td>
				<td>${esc(c.type||'')}</td>
				<td>${c.notnull ? 'NON' : 'OUI'}</td>
				<td>${c.dflt_value===null?'<span class="text-muted">—</span>':esc(c.dflt_value)}</td>
				<td>${c.pk? '<i class="bi bi-check"></i>' : ''}</td>
			  </tr>`).join('')}
			</tbody>
		  </table>
		  ${idxs.length? `<div class="small text-info mb-2"><i class="bi bi-hash me-1"></i>Index :
			${idxs.map(i=>`${i.unique?'<span class="badge text-bg-success me-1">UNIQUE</span>':''}<code>${esc(i.name)}</code>(${i.columns.map(esc).join(', ')})`).join(' · ')}</div>`:''}
		</div>`;
	  });
	  const views = objs.filter(o=>o.type==='view');
	  if (views.length){
		html += `<div class="mb-3"><div class="h6 mb-2"><span class="badge text-bg-secondary me-1">VUES</span></div>
		  <ul class="mb-0">${views.map(v=>`<li><code>${esc(v.name)}</code></li>`).join('')}</ul></div>`;
	  }
	  outEl.innerHTML = html || '<div class="text-secondary">>&nbsp;Aucune table ni vue.</div>';
	}

	function renderFKs(){
	  const objs = listUserObjects().filter(o=>o.type==='table');
	  let html = '<span class="badge text-bg-primary me-1">CLÉS ÉTRANGÈRES</span>';
	  objs.forEach(o=>{
		const fks = tableFKs(o.name);
		if(!fks.length) return;
		html += `<div class="mb-3">
		  <div class="h6 mb-2"><br><i class="bi bi-table me-1"></i> <code class="tbl-name"><b><big>${esc(String(o.name).toUpperCase())}</big></b></code></div>
		  <table class="table table-sm table-bordered align-middle">
			<thead><tr><th>Champs</th><th>Table liée</th><th>Réf.</th><th>ON UPDATE</th><th>ON DELETE</th></tr></thead>
			<tbody>
			  ${fks.map(f=>`<tr>
				<td><code>${esc(f.from)}</code></td>
				<td><code>${esc(f.table)}</code></td>
				<td><code>${esc(f.to)}</code></td>
				<td>${esc(f.on_update||'')}</td>
				<td>${esc(f.on_delete||'')}</td>
			  </tr>`).join('')}
			</tbody>
		  </table>
		</div>`;
	  });
	  outEl.innerHTML = html || '<div class="text-secondary">>&nbsp;Aucune clé étrangère déclarée.</div>';
	}

	function renderMeta(){
	  const pageSize = rows(db.exec(`PRAGMA page_size;`))[0]?.page_size ?? 0;
	  const pageCount = rows(db.exec(`PRAGMA page_count;`))[0]?.page_count ?? 0;
	  const encoding = rows(db.exec(`PRAGMA encoding;`))[0]?.encoding ?? '';
	  const userVersion = rows(db.exec(`PRAGMA user_version;`))[0]?.user_version ?? 0;
	  const fkOn = rows(db.exec(`PRAGMA foreign_keys;`))[0]?.foreign_keys === 1 ? 'ON' : 'OFF';
	  const approxBytes = pageSize * pageCount;
	  const fmtSize = (n)=> n>1e6 ? (n/1e6).toFixed(2)+' MB' : (n/1e3).toFixed(1)+' KB';

	  outEl.innerHTML = `
		<span class="badge text-bg-primary me-1">MÉTADONNÉES</span><p></p>
		<table class="table table-sm table-bordered w-auto">
		  <tbody>
			<tr><th class="text-nowrap">Pages</th><td>${pageCount}</td></tr>
			<tr><th>Taille de la base</th><td>${fmtSize(approxBytes)} (${approxBytes} o)</td></tr>
			<tr><th>ENCODING</th><td>${esc(encoding)}</td></tr>
			<tr><th>PRAGMA foreign_keys</th><td>${fkOn}</td></tr>
			<tr><th>user_version</th><td>${userVersion}</td></tr>
		  </tbody>
		</table>`;
	}

	let mermaidReady = false;
	function ensureMermaid(){
	  return new Promise((resolve, reject)=>{
		if (mermaidReady) return resolve();
		const s = document.createElement('script');
		s.src = '../../assets/js/dist/mermaid@11.11.0/mermaid_min.js';
		s.onload = ()=>{ window.mermaid.initialize({ startOnLoad:false, theme:'dark' }); mermaidReady=true; resolve(); };
		s.onerror = reject;
		document.head.appendChild(s);
	  });
	}
	function renderER(){
	  // Collecte schéma
	  const tables = listUserObjects().filter(o=>o.type==='table').map(o=>o.name);
	  const colsByTable = Object.fromEntries(tables.map(t=>[t, tableInfo(t)]));
	  const fksByTable  = Object.fromEntries(tables.map(t=>[t, tableFKs(t)]));

	  // Mermaid ER
	  let m = 'erDiagram\n';
	  tables.forEach(t=>{
		m += `  ${t} {\n`;
		colsByTable[t].forEach(c=>{
		  const isPK = c.pk ? ' PK' : '';
		  const typ = (c.type||'TEXT').toUpperCase();
		  m += `    ${typ} ${c.name}${isPK}\n`;
		});
		m += `  }\n`;
	  });
	  tables.forEach(t=>{
		fksByTable[t].forEach(f=>{
		  // Parent ||--o{ Child : "FK"
		  m += `  ${f.table} ||--o{ ${t} : "${f.from}->${f.to}"\n`;
		});
	  });

	  const pre = document.createElement('pre');
	  pre.className = 'mermaid';
	  pre.textContent = m;

	  outEl.innerHTML = '<span class="badge text-bg-primary me-1">DIAGRAMME ER</span><p></p>';
	  outEl.appendChild(pre);
	  ensureMermaid().then(()=> window.mermaid.init(undefined, outEl.querySelectorAll('.mermaid')));
	}

	// Liens du menu
	document.getElementById('showSchema').addEventListener('click', e=>{ e.preventDefault(); renderTablesAndCols(); });
	document.getElementById('showFks').addEventListener('click',    e=>{ e.preventDefault(); renderFKs(); });
	document.getElementById('showMeta').addEventListener('click',   e=>{ e.preventDefault(); renderMeta(); });
	document.getElementById('showDiagram').addEventListener('click',async e=>{ e.preventDefault(); renderER(); });

function loadDB(dbKey, dbLabel, exampleSQL){
  if(!confirm(`Remplacer la base actuelle par un snapshot de la base ${dbLabel} ? (les données non enregistrées seront perdues)`))
    return;

  outEl.innerHTML = `<div class="text-secondary">>&nbsp;Téléchargement de ${dbLabel} en cours...</div>`;

  (async ()=>{
    try{
      const url = `https://parapente.world/lab/api/dump.php?db=${encodeURIComponent(dbKey)}`;
      const res = await fetch(url, { mode: 'cors' });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());

      // Fermer l'ancienne base
      try{ db && db.close?.(); }catch(_){}
      db = new SQL.Database(buf);
      try{ db.run('PRAGMA foreign_keys = ON;'); }catch(_){}

      // UI + persistance
      setDBName(dbLabel);
      persistDB();

      // Exemple SQL injecté
      codeEl.value = exampleSQL;
      codeEl.setSelectionRange(codeEl.value.length, codeEl.value.length);
      codeEl.scrollTop = 0;
      codeEl.dispatchEvent(new Event('input'));

      outEl.innerHTML = `<div class="text-success">
        >&nbsp;La base <strong>${dbLabel}</strong> est chargée (snapshot).
        <br><span class="text-secondary">>&nbsp;Copie en local uniquement, la base originale n’est pas modifiée.</span>
      </div>`;
    }catch(err){
      outEl.innerHTML = `<div class="text-danger">Échec du chargement : ${err?.message||err}</div>`;
    }
  })();
}

// --- Bind sur les boutons du menu ---
document.getElementById('loadGlossary').addEventListener('click', e=>{
  e.preventDefault();
  loadDB(
    "glossary",
    "Glossaire",
    [
		  "-- Prénom / Glossaire-TP",
		  "",
			"SELECT",
			"    c.titre   AS CHAPITRE,",
			"    sc.titre  AS SOUS_CHAPITRE",
			"FROM SOUS_CHAPITRES sc",
			"JOIN CHAPITRES c  ON sc.id_chapitre = c.id",
			"JOIN THEMES    th ON c.id_theme = th.id",
			"WHERE th.nom = 'sql'",
			"ORDER BY c.rang, sc.rang;"
    ].join("\n")
  );
});

document.getElementById('loadVisits').addEventListener('click', e=>{
  e.preventDefault();
  loadDB(
    "visitors",
    "Visites",
    [
		  "-- Prénom / Visites-TP",
		  "",
		  "SELECT * FROM VISITS"
    ].join("\n")
  );
});


    // Sauvegarde caret/scroll
    codeEl.addEventListener('scroll', persist);
    window.addEventListener('beforeunload', persist);

    // Init
    window.addEventListener('load', async ()=>{ restore(); buildDict(); await initDB(); });

	(() => {
	  const PRODUCT = "sql";       // adapter: "python" | "html" | "markdown" | "sql"
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

		  // init + mise à jour
		  updateCursorPos();
		  ["click","keyup","input","scroll"].forEach(evt =>
			ta.addEventListener(evt, updateCursorPos)
		  );
		})();
