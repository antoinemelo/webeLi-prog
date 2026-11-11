// app.js — Client JS complet : sql.js + WebRTC + sync serveur PHP + UI type PHP
// === URLs ===
const SIGNAL_URL = "https://parapente.world/lab/blockchain/node/signal.php"; // WebRTC signalisation
const SERVER_BASE = "https://parapente.world/lab/blockchain/main";
const SERVER_API  = `${SERVER_BASE}/api.php`;

// === ÉTAT ===
let myId = null;
let peers = {};                 // { peerId: { pc, dc } }
let localAccount = null;        // { name, address }
let pending = [];               // pool local
let chain = [];                 // blockchain locale
let db = null, SQL = null;

// ============ UTILS ============
const q  = sel => document.querySelector(sel);
const qa = sel => [...document.querySelectorAll(sel)];
function flash(msg, cls="info"){
  const el = q("#flash");
  el.className = `alert alert-${cls}`; el.textContent = msg; el.classList.remove("d-none");
  setTimeout(()=>el.classList.add("d-none"), 3500);
}
async function sha256(txt){
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function updateNavbarAuth() {
  const nav = document.getElementById("nav-auth");
  if (!localAccount) {
    nav.innerHTML = `
      <button class="btn btn-sm btn-outline-light me-1" data-bs-toggle="modal" data-bs-target="#loginModal">
        <i class="bi bi-box-arrow-in-right"></i> Connexion
      </button>
      <button class="btn btn-sm btn-light text-primary" data-bs-toggle="modal" data-bs-target="#registerModal">
        <i class="bi bi-person-plus"></i> Créer compte
      </button>
    `;
  } else {
    nav.innerHTML = `
      <button class="btn btn-sm btn-outline-light" id="btnLogout">
        <i class="bi bi-box-arrow-right"></i> Déconnexion
      </button>
    `;
    document.getElementById("btnLogout").onclick = logoutLocal;
  }
}
function logoutLocal() {
  localStorage.removeItem("cg_account");
  localAccount = null;
  renderAccount();
  updateNavbarAuth();
}

// ============ DB INIT (sql.js) ============
(async function initDB(){
  SQL = await initSqlJs({ locateFile: f => "../../assets/js/dist/sql-js@1.13.0/sql-wasm.wasm" });
  const saved = localStorage.getItem("cg_db");
  db = saved ? new SQL.Database(Uint8Array.from(atob(saved), c=>c.charCodeAt(0))) : new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT, data TEXT);
    CREATE TABLE IF NOT EXISTS pending (id INTEGER PRIMARY KEY AUTOINCREMENT, sender TEXT, receiver TEXT, amount REAL, created_at TEXT, txid TEXT);
    CREATE TABLE IF NOT EXISTS peers (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT UNIQUE);
  `);
  loadFromDb();
  bindUi();
	// --- Restauration du compte sauvegardé (session persistante) ---
	const savedAcc = localStorage.getItem("cg_account");
	if (savedAcc) {
	  try {
		localAccount = JSON.parse(savedAcc);
		renderAccount();
		updateNavbarAuth();
		console.log("Compte restauré :", localAccount.name);
	  } catch (e) {
		console.warn("Impossible de restaurer le compte :", e);
	  }
	}
  updateValidityBadge();
	updateNavbarAuth()
})();

function persistDb(){ localStorage.setItem("cg_db", btoa(String.fromCharCode(...db.export()))); }
function loadFromDb(){
  chain=[]; pending=[];
  try{
    const b = db.exec("SELECT data FROM blocks ORDER BY id ASC");
    if (b.length) b[0].values.forEach(r=>chain.push(JSON.parse(r[0])));
    const p = db.exec("SELECT sender,receiver,amount,created_at,txid FROM pending");
    if (p.length) p[0].values.forEach(r=>pending.push({sender:r[0],receiver:r[1],amount:parseFloat(r[2]),created_at:r[3],id:r[4]}));
  }catch(e){ console.warn("DB read:", e); }
  renderPool(); renderChain();
}

// ============ EXPORT / IMPORT (AES-GCM) ============
function arrayBufferToBase64(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function base64ToArrayBuffer(b64){ const bin=atob(b64); const u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i); return u8.buffer; }
function bytesToHex(bytes){ return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join(''); }
function hexToBytes(hex){ const arr=new Uint8Array(hex.length/2); for(let i=0;i<hex.length;i+=2)arr[i/2]=parseInt(hex.slice(i,i+2),16); return arr; }

async function deriveKey(password, saltHex){
  const pw = new TextEncoder().encode(password);
  const baseKey = await crypto.subtle.importKey('raw', pw, 'PBKDF2', false, ['deriveKey']);
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:200000,hash:'SHA-256'},
                                            baseKey,{name:'AES-GCM',length:256},true,['encrypt','decrypt']);
  return { key, saltHex: bytesToHex(salt) };
}

async function exportEncryptedDb(password){
  const raw = db.export();
  const { key, saltHex } = await deriveKey(password);
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const ct  = await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, raw);
  const blob = new Blob([JSON.stringify({meta:{salt:saltHex,iv:bytesToHex(iv)}, data: arrayBufferToBase64(ct)})],
                        {type:'application/json'});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `blockchain_cryptomonnaie_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.cgdb`;
  document.body.appendChild(a); a.click(); a.remove();
}

async function importEncryptedDb(file, password){
  const txt = await file.text(); const payload = JSON.parse(txt);
  const { key } = await deriveKey(password, payload.meta.salt);
  const iv = hexToBytes(payload.meta.iv);
  const raw = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, base64ToArrayBuffer(payload.data));
  db = new SQL.Database(new Uint8Array(raw)); persistDb(); loadFromDb();
  flash("Base importée", "success");
}

// ============ AUTH LOCALE (simple) ============
async function createLocalUser(u,p){
  const salt = crypto.getRandomValues(new Uint8Array(12));
  const hash = await sha256(p + bytesToHex(salt));
  localStorage.setItem(`cg_local_user_${u}`, JSON.stringify({salt:bytesToHex(salt), hash}));
  flash("Compte local créé", "success");
}
async function checkLocalUser(u,p){
  const raw = localStorage.getItem(`cg_local_user_${u}`); if(!raw) return false;
  const o = JSON.parse(raw); const h = await sha256(p + o.salt); return h === o.hash;
}
// --- Génération de paires RSA identiques à PHP ---
async function generateRsaKeys() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-PSS",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );

  // Export PEM public
  const pubBuf = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const pubPem = "-----BEGIN PUBLIC KEY-----\n" +
    btoa(String.fromCharCode(...new Uint8Array(pubBuf))).match(/.{1,64}/g).join("\n") +
    "\n-----END PUBLIC KEY-----";

  // Export PEM private
  const privBuf = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const privPem = "-----BEGIN PRIVATE KEY-----\n" +
    btoa(String.fromCharCode(...new Uint8Array(privBuf))).match(/.{1,64}/g).join("\n") +
    "\n-----END PRIVATE KEY-----";

  const address = (await sha256(pubPem)).slice(0, 40);
  return { pubPem, privPem, address };
}

function renderAccount(){
  const el = q("#accountBox");
  if(!localAccount){
    el.innerHTML = `<p class="text-muted mb-2">Veuillez vous connecter ou créer un compte via les boutons en haut de page.</p>`;
    q("#txHint").classList.remove("d-none");
    return;
  }
	updateNavbarAuth();
  el.innerHTML = `
    <p><span class="badge bg-success">Connecté</span> <strong>${localAccount.name}</strong></p>
    <p class="mb-1">Adresse :<br><code class="small">${localAccount.address}</code></p>
    <details class="mb-2">
      <summary class="text-muted" style="cursor:pointer">Voir la clé publique</summary>
      <code class="small" style="white-space:normal; word-break:break-all;">
${localAccount.pubkey.replace(/\n/g, '').replace(/\r/g, '')}
</code>
    </details>
  `;
  q("#txHint").classList.add("d-none");
}

// ============ WEBRTC SIGNALING ============
async function registerPeer(){
  const r = await fetch(SIGNAL_URL + "?action=register"); const j = await r.json();
  if (j.ok){ myId = j.id; q("#myId").textContent = "Mon ID : " + myId; flash("Signalisation prête","success"); }
}
async function listSignalPeers(){
  const r = await fetch(SIGNAL_URL + "?action=list"); const j = await r.json();
  if(!j.ok) return;
  const sel = q("#peerSelect"); sel.innerHTML=''; j.peers.filter(p=>p!==myId).forEach(id=>{
    const o=document.createElement("option"); o.value=o.textContent=id; sel.appendChild(o);
  });
}
async function sendSignal(to, type, payload){
  await fetch(`${SIGNAL_URL}?action=post&from=${myId}&to=${to}&type=${type}`,{
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
  });
}
async function pollSignals(){
  if(!myId) return;
  try{
    const r = await fetch(`${SIGNAL_URL}?action=poll&id=${myId}`); const j = await r.json(); if(!j.ok) return;
    for(const o of j.messages.offers)  handleSignal({type:'offer', from:o.from, payload:o.payload});
    for(const a of j.messages.answers) handleSignal({type:'answer',from:a.from, payload:a.payload});
    for(const c of j.messages.ice)    handleSignal({type:'ice',   from:c.from, payload:c.payload});
  }catch(e){ /* silence */ }
}
setInterval(pollSignals, 1800);

async function createPeerConnection(thatId, initiator=false){
  const pc = new RTCPeerConnection({ iceServers:[{urls:"stun:stun.l.google.com:19302"}] });
  let dc;
  if(initiator){ dc = pc.createDataChannel('cg'); setupDataChannel(thatId, dc); }
  else{ pc.ondatachannel = e => setupDataChannel(thatId, e.channel); }
  pc.onicecandidate = e => { if(e.candidate) sendSignal(thatId, 'ice', e.candidate); };
  peers[thatId] = { pc, dc };
  return pc;
}
function setupDataChannel(id, dc){
  dc.onopen = ()=>console.log("DataChannel open", id);
  dc.onmessage = ev => { try{ handleData(JSON.parse(ev.data)); } catch(e){ console.warn(e); } };
  peers[id].dc = dc;
}
async function handleSignal(msg){
  const { type, from, payload } = msg;
  if(type==='offer'){
    const pc = await createPeerConnection(from,false);
    await pc.setRemoteDescription(payload);
    const ans = await pc.createAnswer();
    await pc.setLocalDescription(ans);
    await sendSignal(from,'answer',pc.localDescription);
  }else if(type==='answer'){
    const p=peers[from]; if(p) await p.pc.setRemoteDescription(payload);
  }else if(type==='ice'){
    const p=peers[from]; if(p) await p.pc.addIceCandidate(payload);
  }
}
function broadcast(obj){
  Object.values(peers).forEach(p=>{
    if(p.dc && p.dc.readyState==='open') p.dc.send(JSON.stringify(obj));
  });
}

// ============ RENDER ============
function renderPool(){
  const ul = q("#poolList"); ul.innerHTML = '';
  pending.forEach((t,i)=>{
    const li = document.createElement("li"); li.className="list-group-item";
    li.innerHTML = `&gt; <strong>${t.receiver.slice(0,8)}</strong>
                    <span class="ms-2">${t.amount} Ƀ</span>
                    <div><code class="small">id:${t.id}</code></div>`;
    ul.appendChild(li);
  });
}

function txLine(t, meAddr){
  const isSender = meAddr && t.sender===meAddr;
  const isRecv   = meAddr && t.receiver===meAddr;
  if(isSender){
    return `<i class="bi bi-arrow-up-right tx-sent"></i> <span class="tx-sent fw-semibold">Envoyé à</span> ${escapeHtml(t.receiver)} :
            <strong class="tx-sent">${t.amount} Ƀ</strong>`;
  }else if(isRecv){
    return `<i class="bi bi-arrow-down-left tx-rcv"></i> <span class="tx-rcv fw-semibold">Reçu de</span> ${escapeHtml(t.sender)} :
            <strong class="tx-rcv">${t.amount} Ƀ</strong>`;
  }
  return `<i class="bi bi-arrow-left-right tx-ext"></i> <span class="tx-ext">Transaction externe</span> →
          ${escapeHtml(t.receiver)} : <strong>${t.amount} Ƀ</strong>`;
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

function renderChain(){
  const el = q("#chainView"); el.innerHTML='';
  const meAddr = localAccount?.address || null;
  [...chain].reverse().forEach((b,idx)=>{
    const div = document.createElement('div'); div.className='block p-3 mb-3';
    const txs = (b.transactions||[]).map((t,i)=>`${i>0?'<br>':''}${txLine(t,meAddr)}`).join('');
    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-baseline flex-wrap">
        <div><span class="badge bg-dark">#${chain.length-idx}</span>
             <span class="text-muted">${escapeHtml(b.timestamp)}</span></div>
        ${b.miner ? `<span class="badge badge-soft mt-1">miner: ${escapeHtml(b.miner)}</span>` : ''}
      </div>
      <p class="small mt-2 mb-2">${txs||'<span class="text-muted">—</span>'}</p>
      <div class="small">
        <div><code class="small">prev: ${escapeHtml((b.prev_hash||'').slice(0,42))}…</code></div>
        <div><code class="small">hash: ${escapeHtml((b.hash||'').slice(0,42))}…</code></div>
      </div>`;
    el.appendChild(div);
  });
  q("#blockCount").textContent = chain.length;
  updateValidityBadge();
}

// ============ BLOCKCHAIN (TX / MINE / VALIDATE) ============
async function addTransaction(to, amount){
  if(!localAccount) return flash("Créez/ouvrez un compte d'abord", "warning");
  const receiver = (to||'').trim();
  const amt = parseFloat(amount);
  if(!receiver) return flash("Adresse destinataire manquante", "warning");
  if(receiver === localAccount.address) return flash("Impossible d'envoyer à soi-même", "warning");
  if(!(amt>0)) return flash("Montant invalide", "warning");

  const tx = {
    sender: localAccount.address,
    receiver, amount: amt,
    created_at: new Date().toISOString(),
    id: (await sha256(Math.random()+'|'+Date.now())).slice(0,12)
  };
  pending.push(tx);
  const st = db.prepare("INSERT INTO pending (sender,receiver,amount,created_at,txid) VALUES (?,?,?,?,?)");
  st.run([tx.sender, tx.receiver, tx.amount, tx.created_at, tx.id]); st.free();
  persistDb(); renderPool();
  broadcast({ type:'tx_new', tx });
}

async function mineBlock(){
  if(!pending.length) return flash("Rien à miner", "warning");
  const txs = [...pending];
  const prev = chain.length ? chain.at(-1).hash : 'GENESIS';
  const ts = new Date().toISOString(); let nonce=0; const diff=2;
  while(true){
    const h = await sha256(ts + JSON.stringify(txs) + prev + nonce);
    if(h.startsWith("0".repeat(diff))){
      const block = { timestamp:ts, transactions:txs, prev_hash:prev, hash:h, nonce, difficulty:diff, miner: localAccount.address };
      chain.push(block);
      const st = db.prepare("INSERT INTO blocks (hash,data) VALUES (?,?)");
      st.run([block.hash, JSON.stringify(block)]); st.free();
      db.run("DELETE FROM pending"); pending=[];
      persistDb(); renderPool(); renderChain();
      broadcast({ type:'block_new', block });
      flash("Bloc miné ⛏", "success");
      break;
    }
    nonce++; if(nonce%1000===0) await new Promise(r=>setTimeout(r,0));
  }
}

function validateChain(){
  if(!chain.length) return true;
  for(let i=0;i<chain.length;i++){
    const b = chain[i];
    if(i>0 && b.prev_hash !== chain[i-1].hash) return false;
    if((b.difficulty|0) > 0 && !(b.hash||'').startsWith('0'.repeat(b.difficulty))) return false;
  }
  return true;
}
function updateValidityBadge(){
  const ok = validateChain();
  const badge = q("#badgeValid");
  badge.textContent = ok ? "blockchaîne valide" : "blockchaîne corrompue";
  badge.className = `badge ${ok?'bg-light text-dark':'bg-danger'}`;
}

// ============ P2P DATA HANDLERS ============
function handleData(msg){
  if(msg.type === 'tx_new'){
    if(!pending.find(t=>t.id===msg.tx.id)){
      pending.push(msg.tx);
      const st = db.prepare("INSERT INTO pending (sender,receiver,amount,created_at,txid) VALUES (?,?,?,?,?)");
      st.run([msg.tx.sender, msg.tx.receiver, msg.tx.amount, msg.tx.created_at, msg.tx.id]); st.free();
      persistDb(); renderPool();
    }
  } else if(msg.type === 'block_new'){
    const b = msg.block;
    if(!chain.find(x=>x.hash===b.hash)){
      chain.push(b);
      const st = db.prepare("INSERT INTO blocks (hash,data) VALUES (?,?)");
      st.run([b.hash, JSON.stringify(b)]); st.free();
      db.run("DELETE FROM pending"); pending=[];
      persistDb(); renderPool(); renderChain();
    }
  } else if(msg.type === 'pool'){
    // merge pool (optionnel)
    (msg.pool||[]).forEach(t=>{
      if(!pending.find(x=>x.id===t.id)){
        pending.push(t);
        const st = db.prepare("INSERT INTO pending (sender,receiver,amount,created_at,txid) VALUES (?,?,?,?,?)");
        st.run([t.sender,t.receiver,t.amount,t.created_at,t.id]); st.free();
      }
    });
    persistDb(); renderPool();
  }
}

// ============ SYNC SERVEUR PHP (comme la version PHP) ============
async function serverGet(route){
  const r = await fetch(`${SERVER_API}?route=${route}`, {headers:{'Accept':'application/json'}});
  return r.json();
}
async function serverPost(route, body){
  const r = await fetch(`${SERVER_API}?route=${route}`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
  return r.json();
}

// Remonte le pool local au serveur (équivalent "Diffuser" HTTP)
async function pushPoolToServer(){
  try{
    const res = await serverPost('pool', pending); // côté PHP: accepte POST pool
    if(res && res.ok) flash("Pool diffusé au serveur","success");
    else flash("Échec diffusion serveur","warning");
  }catch(e){ flash("Erreur réseau (pool): "+e.message, "danger"); }
}

// Consensus : si chaîne du serveur > chaîne locale → adopter
async function resolveConsensusWithServer(){
  try{
    const srv = await serverGet('chain');          // chaîne côté serveur
    if(Array.isArray(srv) && srv.length > chain.length){
      // remplacer local
      db.run("DELETE FROM blocks");
      srv.forEach(b=>{
        const st = db.prepare("INSERT INTO blocks (hash,data) VALUES (?,?)");
        st.run([b.hash, JSON.stringify(b)]); st.free();
      });
      chain = srv; persistDb(); renderChain();
      flash(`Chaîne remplacée par celle du serveur (${srv.length} blocs)`, "success");
    }else{
      flash("Déjà la meilleure chaîne locale","info");
    }
  }catch(e){ flash("Erreur sync serveur: "+e.message, "danger"); }
}

// API listage (liens)
function openApi(route){ window.open(`${SERVER_API}?route=${route}`, "_blank"); }

// ============ UI BINDINGS ============
function bindUi(){
  // Pairs locaux (liste visuelle simple)
  refreshPeersUI();

  // Pairs: ajout URL (sauvé en DB locale pour mémoire)
  q("#btnPeerAdd").onclick = ()=>{
    const url = q("#peerInput").value.trim(); if(!url) return;
    try{
      const st = db.prepare("INSERT OR IGNORE INTO peers(url) VALUES (?)"); st.run([url]); st.free();
      persistDb(); refreshPeersUI(); q("#peerInput").value='';
      flash("Pair ajouté","success");
    }catch(e){ flash("Pair invalide","warning"); }
  };
  q("#btnSyncConsensus").onclick = resolveConsensusWithServer;
  q("#btnShowApis").onclick   = ()=>openApi('pool');
  q("#btnShowChain").onclick  = ()=>openApi('chain');
  q("#btnShowPeers").onclick  = ()=>openApi('peers');

  // Signalisation WebRTC
  q("#btnRegister").onclick = registerPeer;
  q("#btnList").onclick     = listSignalPeers;
  q("#btnConnect").onclick  = async ()=>{
    const id = q("#peerSelect").value; if(!id) return flash("Choisir un pair (signal)","warning");
    const pc = await createPeerConnection(id,true);
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    await sendSignal(id,'offer',pc.localDescription);
  };

  // Auth locale (modales)
  q("#btnRegisterLocal").onclick = async ()=>{
    const u=q("#regUser").value.trim(), p=q("#regPass").value;
    if(!u||!p) return flash("Utilisateur et mot de passe requis","warning");
    await createLocalUser(u,p);
  };
  q("#btnLoginLocal").onclick = async ()=>{
    const u=q("#loginUser").value.trim(), p=q("#loginPass").value;
    if(!u||!p) return flash("Utilisateur et mot de passe requis","warning");
    const ok = await checkLocalUser(u,p);
	if (ok) {
	  const keys = await generateRsaKeys();
	  localAccount = { 
		name: u, 
		address: keys.address, 
		pubkey: keys.pubPem, 
		privkey: keys.privPem 
	  };
	  renderAccount();
		localStorage.setItem("cg_account", JSON.stringify(localAccount));
		updateNavbarAuth();
	  const modal = bootstrap.Modal.getInstance(q("#loginModal")); 
	  modal?.hide();
	  flash("Connecté","success");
    } else flash("Identifiants invalides","danger");
  };

  // Export / import
  q("#btnExportDb").onclick = async ()=>{
    if(!q("#exportPwd").value) return flash("Mot de passe export requis","warning");
    await exportEncryptedDb(q("#exportPwd").value);
  };
  q("#btnImportDb").onclick = async ()=>{
    const f=q("#importFile").files[0], pw=q("#importPwd").value;
    if(!f||!pw) return flash("Fichier + mot de passe requis","warning");
    try{ await importEncryptedDb(f,pw); }catch(e){ flash("Import impossible: "+e.message,"danger"); }
  };

  // Transactions
  q("#btnAddTx").onclick = ()=> addTransaction(q("#txTo").value, q("#txAmount").value);
  q("#btnMine").onclick  = mineBlock;

  // Diffuser = 1) broadcast P2P + 2) push au serveur (comme PHP)
  q("#btnBroadcast").onclick = ()=>{
    broadcast({ type:'pool', pool: pending });   // P2P
    pushPoolToServer();                           // serveur central
  };
}

function refreshPeersUI(){
  const r = db.exec("SELECT url FROM peers");
  const list = q("#peerListUI"); list.innerHTML='';
  if(r.length){
    r[0].values.forEach(v=>{
      const li=document.createElement("li"); li.className="list-group-item"; li.textContent=v[0];
      list.appendChild(li);
    });
  }else{
    const li=document.createElement("li"); li.className="list-group-item text-muted"; li.textContent="Pas de pair disponible";
    list.appendChild(li);
  }
}
