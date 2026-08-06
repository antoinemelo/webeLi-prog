// --- Base64 URL-safe, robuste UTF-8 ---
function b64urlEncode(bytes) {
  // bytes: Uint8Array
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/,"");
}
function b64urlDecode(s) {
  if (!s) return "";

  try {
    s = decodeURIComponent(s);
  } catch (_) {
    // ignore si déjà décodé
  }

  s = s.replace(/-/g, "+").replace(/_/g, "/");

  while (s.length % 4) {
    s += "=";
  }

  if (!/^[A-Za-z0-9+/=]+$/.test(s)) {
    throw new Error("Chaîne invalide pour atob: " + s);
  }

  return atob(s);
}


function encodeUTF8ToB64(str){
  const bytes = new TextEncoder().encode(str);
  return b64urlEncode(bytes);
}

function decodeB64ToUTF8(b64){
  try {
    const bin = b64urlDecode(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch (e) {
    // 🔁 compat legacy (liens anciens encodés différemment)
    try { return decodeURIComponent(escape(atob(b64))); }
    catch(_) { throw e; }
  }
}

// --- Lecture / écriture du code via l’URL ---
function readCodeFromURL(){
  const url = new URL(location.href);
  let c = url.searchParams.get("c");
  if (!c && location.hash.startsWith("#c=")) c = location.hash.slice(3);
  if (!c) return null;

  try {
    const txt = decodeB64ToUTF8(c);
    return txt && txt.length ? txt : null;
  } catch (err) {
    console.warn("Lien invalide", err, c);
    return null;
  }
}

// Crée une URL partageable (on encode l’argument au cas où)
function makeShareURL(code){
  const b64 = encodeUTF8ToB64(code);
  const base = location.origin + location.pathname;
  return `${base}?c=${encodeURIComponent(b64)}`;
}

// --- Format date YYYYMMDD ---
function formatDateYYYYMMDD(d){
  return d.getFullYear() +
    String(d.getMonth()+1).padStart(2,'0') +
    String(d.getDate()).padStart(2,'0');
}

document.addEventListener("DOMContentLoaded", () => {
  const maxHistory = 1000;

  // Détection robuste OS
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
                (ua.includes("Mac") && "ontouchend" in document);
  const isMac = navigator.platform.toUpperCase().includes("MAC");

  document.querySelectorAll("textarea.codearea").forEach(textarea => {
    const history = [textarea.value];
    let index = 0;
    let isApplying = false;

    function snapshot() {
      if (isApplying) return;
      const current = textarea.value;
      if (history[index] === current) return;
      history.splice(index+1);
      history.push(current);
      if (history.length > maxHistory) history.shift();
      else index++;
    }

    function applyValue(newIndex) {
      if (newIndex < 0 || newIndex >= history.length) return;
      index = newIndex;
      isApplying = true;
      textarea.value = history[index];
      textarea.dispatchEvent(new Event("input", {bubbles:true}));
      isApplying = false;
    }

    function undo() { if (index > 0) applyValue(index-1); }
    function redo() { if (index < history.length-1) applyValue(index+1); }

    // Snapshots automatiques
    textarea.addEventListener("input", snapshot);

    // Gestion clavier
    textarea.addEventListener("keydown", e => {
      const key = e.key.toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      // Undo
      if (ctrlOrMeta && !e.shiftKey && key === "z") {
        e.preventDefault();
        undo();
      }

      // Redo
      // Mac : Cmd+Shift+Z
      // Win/Linux : Ctrl+Y
      if ((isMac && ctrlOrMeta && e.shiftKey && key === "z") ||
          (!isMac && ctrlOrMeta && key === "y")) {
        e.preventDefault();
        e.stopPropagation(); // évite l’action navigateur
        redo();
      }
    });

    // Ajout boutons iOS
    if (isIOS) {
      const toolbar = textarea.closest(".pane.left")?.querySelector(".toolbar");
      if (toolbar) {
        const btnUndo = document.createElement("button");
        btnUndo.type = "button";
        btnUndo.className = "btn btn-sm btn-outline-light";
        btnUndo.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i>';
        btnUndo.title = "Annuler";

        const btnRedo = document.createElement("button");
        btnRedo.type = "button";
        btnRedo.className = "btn btn-sm btn-outline-light ms-1";
        btnRedo.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
        btnRedo.title = "Refaire";

        btnUndo.addEventListener("click", undo);
        btnRedo.addEventListener("click", redo);

        const spacer = toolbar.querySelector(".spacer");
        if (spacer) {
          toolbar.insertBefore(btnRedo, spacer);
          toolbar.insertBefore(btnUndo, spacer);
        } else {
          toolbar.insertBefore(btnUndo, toolbar.firstChild);
          toolbar.insertBefore(btnRedo, toolbar.firstChild);
        }
      }
    }

    // Navigation précise dans les documents longs : un clic sur un numéro
    // place le caret au début de la ligne, un double-clic sélectionne la ligne.
    const gutter = textarea.closest(".editor-wrap")?.querySelector(".gutter");
    if (gutter) {
      gutter.title = "Cliquer pour atteindre la ligne; double-cliquer pour la sélectionner";
      gutter.setAttribute("aria-label", "Numéros de ligne cliquables");
      gutter.addEventListener("mousedown", event => {
        if (event.button !== 0) return;
        const marker = event.target.closest("[data-line]");
        if (!marker || !gutter.contains(marker)) return;

        const requestedLine = Number.parseInt(marker.dataset.line || "", 10);
        if (!Number.isInteger(requestedLine) || requestedLine < 1) return;

        event.preventDefault();
        const lines = textarea.value.split("\n");
        const line = Math.min(requestedLine, lines.length);
        let start = 0;
        for (let index = 1; index < line; index++) start += lines[index - 1].length + 1;
        const end = start + lines[line - 1].replace(/\r$/, "").length;

        textarea.focus({preventScroll: true});
        textarea.setSelectionRange(start, event.detail >= 2 ? end : start);
        textarea.dispatchEvent(new Event("select", {bubbles: true}));
      });
    }
  });
});
