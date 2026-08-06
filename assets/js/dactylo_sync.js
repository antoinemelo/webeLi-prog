// ======================================================================
//  Gestion avancée des fichiers DACTYLO — VERSION SIMPLE & FONCTIONNELLE
// ======================================================================

const LS_DACTYLO_DB = "dactylo_sqlite_db_v1"; // base SQLite persistée (base64)
let dactyloDB = null;                         // instance SQLite en mémoire
let dbFileHandle = null;                      // fichier courant (FS Access)
let SQLModule = null;

// Badge UI
const badge = document.getElementById("progressFileBadge");
const badgeName = document.getElementById("progressFileName");

// Vérifie support File System Access API
const supportsFS = ("showOpenFilePicker" in window) && ("showSaveFilePicker" in window);

function u8ToB64(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

function b64ToU8(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

window.addEventListener("load", initDactyloDB);

async function initDactyloDB() {
  if (!SQLModule) {
    SQLModule = await initSqlJs({
      locateFile: f => "../../assets/js/dist/sql-js@1.13.0/" + f
    });
  }

  const saved = localStorage.getItem(LS_DACTYLO_DB);
  if (saved) {
    // Restauration
    dactyloDB = new SQLModule.Database(b64ToU8(saved));
    setDBName("Session restaurée");
  } else {
    // Nouvelle base
    dactyloDB = new SQLModule.Database();
    setDBName("Session (base vide)");
    persistDactyloDB();
  }
}

function persistDactyloDB() {
  if (!dactyloDB) return;
  try {
    const bin = dactyloDB.export();
    localStorage.setItem(LS_DACTYLO_DB, u8ToB64(bin));
  } catch (e) {
    console.error("Erreur persistDactyloDB:", e);
  }
}

function setDBName(name) {
  if (!badge) return;
  if (name) {
    badge.classList.remove("d-none");
    badgeName.textContent = name;
  } else {
    badge.classList.add("d-none");
    badgeName.textContent = "—";
  }
}

function rebuildDactyloDB() {
  if (!dactyloDB) return;

  dactyloDB.exec("DROP TABLE IF EXISTS exercise_scores");

  dactyloDB.exec(`
    CREATE TABLE exercise_scores(
      exercise_id TEXT PRIMARY KEY,
      score      REAL,
      cpm        INTEGER,
      updated_at TEXT
    );
  `);

  const scores = JSON.parse(localStorage.getItem("typing_scores") || "{}");
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

	const stmt = dactyloDB.prepare(
	  "INSERT INTO exercise_scores VALUES (?, ?, ?, ?)"
	);

	for (const [id, data] of Object.entries(scores)) {
	  const rate = typeof data === "object" ? data.rate : data;
	  const cpm  = typeof data === "object" ? (data.cpm || null) : null;

	  stmt.run([id, rate, cpm, now]);
	}
	stmt.free();

	persistDactyloDB();
}

function resetAllProgress() {
    // 1. Efface les scores dans localStorage
    localStorage.setItem("typing_scores", JSON.stringify({}));

    // 2. Vidage de la base SQLite en mémoire
    if (dactyloDB) {
        dactyloDB.exec("DROP TABLE IF EXISTS exercise_scores");
        dactyloDB.exec(`
            CREATE TABLE exercise_scores(
                exercise_id TEXT PRIMARY KEY,
                score REAL,
                cpm INTEGER,
                updated_at TEXT
            );
        `);
    }

    // 3. Persistance interne (synchronisation avec localStorage)
    persistDactyloDB();

    // 4. Mise à zéro des éléments d’affichage
    try {
        document.getElementById("statErrors").textContent = "0";
        document.getElementById("statTime").textContent   = "0 s";
        document.getElementById("statCpm") &&
            (document.getElementById("statCpm").textContent = "0");
        document.getElementById("statEpm") &&
            (document.getElementById("statEpm").textContent = "0");
    } catch {}

    // 5. Si votre grille d’exercices utilise une coloration de progression
    if (typeof refreshExerciseGrid === "function") {
        refreshTypingScoresUI();
    }
    // 6. Sélection automatique du premier exercice
    selectFirstExerciseAfterReset();
}

function importDactyloProgressFromDB() {
  if (!dactyloDB) return;

  let res;
  try {
    res = dactyloDB.exec("SELECT exercise_id, score, cpm FROM exercise_scores");
  } catch (e) {
    // Table absente → on considère la base comme "vide"
    localStorage.setItem("typing_scores", JSON.stringify({}));
    refreshTypingScoresUI();
    resetAllProgress();
    return;
  }

  // Table présente mais AUCUNE ligne → progression vide
  if (!res.length || !res[0].values.length) {
    localStorage.setItem("typing_scores", JSON.stringify({}));
    refreshTypingScoresUI();
    resetAllProgress();
    return;
  }

  // Table avec des valeurs → import normal
  const newScores = {};
  for (const row of res[0].values) {
    const [id, score, cpm] = row;
    newScores[id] = { rate: score, cpm };
  }

  localStorage.setItem("typing_scores", JSON.stringify(newScores));

  // Et on rafraîchit les couleurs de la grille
  refreshTypingScoresUI();
}

function refreshTypingScoresUI() {
  try {
    if (typeof renderExerciseGrid !== "function") return;
    if (typeof currentMode === "undefined" || !currentMode) return;

    // On relance simplement le rendu de la grille
    if (currentMode === "tech" && typeof technicalExercises !== "undefined") {
      renderExerciseGrid(technicalExercises);
    } else if (currentMode === "speed" && typeof speedExercises !== "undefined") {
      renderExerciseGrid(speedExercises);
    }
  } catch (e) {
    console.warn("refreshTypingScoresUI a échoué :", e);
  }
}

async function openProgressFS() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{
        description: "SQLite Database",
        accept: { "application/octet-stream": [".sqlite", ".db"] }
      }]
    });

    const file = await handle.getFile();
    const buf  = new Uint8Array(await file.arrayBuffer());

    // Fermer l'ancienne base si nécessaire
    try { dactyloDB && dactyloDB.close && dactyloDB.close(); } catch {}

    dactyloDB = new SQLModule.Database(buf);
    dbFileHandle = handle; // fichier courant = celui ouvert

    importDactyloProgressFromDB();
    persistDactyloDB();
    setDBName(file.name);

  } catch (e) {
    console.warn("openProgressFS annulé / erreur:", e);
  }
}

async function openProgressFallback() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".sqlite,.db";

  inp.addEventListener("change", async () => {
    if (!inp.files || !inp.files[0]) return;
    const file = inp.files[0];

    const buf = new Uint8Array(await file.arrayBuffer());

    try { dactyloDB && dactyloDB.close && dactyloDB.close(); } catch {}

    dactyloDB = new SQLModule.Database(buf);
    dbFileHandle = null; // pas de handle en fallback

    importDactyloProgressFromDB();
    persistDactyloDB();
    setDBName(file.name);
  }, { once: true });

  inp.click();
}

function openProgressFile() {
  if (supportsFS) openProgressFS();
  else openProgressFallback();
}

async function saveProgressFS() {
  if (!dactyloDB) return;

  try {
    // Reconstruit la table exercise_scores
    rebuildDactyloDB();
    const bin = dactyloDB.export();

    if (!dbFileHandle) {
      // Pas de fichier courant → on bascule sur "Enregistrer sous"
      await saveProgressAsFS();
      return;
    }

    const writable = await dbFileHandle.createWritable();
    await writable.write(bin);
    await writable.close();

  } catch (e) {
    alert("Erreur lors de l'enregistrement : " + (e && e.message ? e.message : e));
  }
}

async function saveProgressAsFS() {
  if (!dactyloDB) return;

  try {
    rebuildDactyloDB();
    const bin = dactyloDB.export();

    const handle = await window.showSaveFilePicker({
      suggestedName: "ma_dactylo.db",
      types: [{
        description: "SQLite Database",
        accept: { "application/octet-stream": [".db"] }
      }]
    });

    const writable = await handle.createWritable();
    await writable.write(bin);
    await writable.close();

    dbFileHandle = handle;          // devient le fichier courant
    setDBName(handle.name);

  } catch (e) {
    console.warn("saveProgressAsFS annulé / erreur:", e);
  }
}

function saveProgressFallback() {
  if (!dactyloDB) return;

  rebuildDactyloDB();
  const bin = dactyloDB.export();

  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([bin], { type: "application/octet-stream" })
  );
  a.download = "ma_dactylo.db";
  a.click();
}

function saveProgress() {
  if (supportsFS) saveProgressFS();
  else saveProgressFallback();
}

function saveProgressAs() {
  if (supportsFS) saveProgressAsFS();
  else saveProgressFallback();
}

function downloadProgress() {
  if (!dactyloDB) return;

  rebuildDactyloDB();
  const bin = dactyloDB.export();

  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([bin], { type: "application/octet-stream" })
  );
  a.download = "ma_dactylo.db";
  a.click();
}

document.addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();

    const wrap = document.getElementById("fileMenuWrap");
    const disabled = wrap && wrap.classList.contains("disabled");

    if (!disabled) {
      saveProgress();
    }
  }
});

function selectFirstExerciseAfterReset() {
    // activer le mode Technique
    if (typeof selectMode === "function" && typeof chkTech !== "undefined") {
        chkTech.checked = true;
        selectMode("tech");
    }

    // attendre que la grille soit re-rendue
    setTimeout(() => {
        // sélectionne la **première vraie carte exercise**
        const first = document.querySelector("#exerciseGrid .exo-card:nth-child(2)");

        if (first) first.click();
        else console.warn("Aucune carte trouvée pour sélection automatique.");
    }, 80);
}

