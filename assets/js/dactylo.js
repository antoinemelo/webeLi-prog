// Application dactylo pour informatic.li (atelier "typing")

// --- Données d'exemple ---
const technicalExercises = [
  { id: "ex00a", name: "00a",  file: "ex_00a.txt",  text: null },
  { id: "ex00b", name: "00b",  file: "ex_00b.txt",  text: null },
  { id: "ex00c", name: "00c",  file: "ex_00c.txt",  text: null },
  { id: "ex00d", name: "00d",  file: "ex_00d.txt",  text: null },
  { id: "ex01a", name: "01a",  file: "ex_01a.txt",  text: null },
  { id: "ex01b", name: "01b",  file: "ex_01b.txt",  text: null },
  { id: "ex01c", name: "01c",  file: "ex_01c.txt",  text: null },
  { id: "ex01d", name: "01d",  file: "ex_01d.txt",  text: null },
  { id: "ex02a", name: "02a",  file: "ex_02a.txt",  text: null },
  { id: "ex02b", name: "02b",  file: "ex_02b.txt",  text: null },
  { id: "ex02c", name: "02c",  file: "ex_02c.txt",  text: null },
  { id: "ex02d", name: "02d",  file: "ex_02d.txt",  text: null },
  { id: "ex03a", name: "03a",  file: "ex_03a.txt",  text: null },
  { id: "ex03b", name: "03b",  file: "ex_03b.txt",  text: null },
  { id: "ex03c", name: "03c",  file: "ex_03c.txt",  text: null },
  { id: "ex03d", name: "03d",  file: "ex_03d.txt",  text: null },
  { id: "ex04a", name: "04a",  file: "ex_04a.txt",  text: null },
  { id: "ex04b", name: "04b",  file: "ex_04b.txt",  text: null },
  { id: "ex04c", name: "04c",  file: "ex_04c.txt",  text: null },
  { id: "ex04d", name: "04d",  file: "ex_04d.txt",  text: null },
  { id: "ex05a", name: "05a",  file: "ex_05a.txt",  text: null },
  { id: "ex05b", name: "05b",  file: "ex_05b.txt",  text: null },
  { id: "ex05c", name: "05c",  file: "ex_05c.txt",  text: null },
  { id: "ex05d", name: "05d",  file: "ex_05d.txt",  text: null },
  { id: "ex06a", name: "06a",  file: "ex_06a.txt",  text: null },
  { id: "ex06b", name: "06b",  file: "ex_06b.txt",  text: null },
  { id: "ex07a", name: "07a",  file: "ex_07a.txt",  text: null },
  { id: "ex07b", name: "07b",  file: "ex_07b.txt",  text: null },
  { id: "ex08a", name: "08a",  file: "ex_08a.txt",  text: null },
  { id: "ex08b", name: "08b",  file: "ex_08b.txt",  text: null },
  { id: "ex09a", name: "09a",  file: "ex_09a.txt",  text: null },
  { id: "ex09b", name: "09b",  file: "ex_09b.txt",  text: null },
  { id: "ex09c", name: "09c",  file: "ex_09c.txt",  text: null },
  { id: "ex10a", name: "10a",  file: "ex_10a.txt",  text: null },
  { id: "ex10b", name: "10b",  file: "ex_10b.txt",  text: null },
  { id: "ex10c", name: "10c",  file: "ex_10c.txt",  text: null },
  { id: "ex11a", name: "11a",  file: "ex_11a.txt",  text: null },
  { id: "ex11b", name: "11b",  file: "ex_11b.txt",  text: null },
  { id: "ex12a", name: "12a",  file: "ex_12a.txt",  text: null },
  { id: "ex12b", name: "12b",  file: "ex_12b.txt",  text: null },
  { id: "ex13a", name: "13a",  file: "ex_13a.txt",  text: null },
  { id: "ex13b", name: "13b",  file: "ex_13b.txt",  text: null },
  { id: "ex14a", name: "14a",  file: "ex_14a.txt",  text: null },
  { id: "ex14b", name: "14b",  file: "ex_14b.txt",  text: null },
  { id: "ex15a", name: "15a",  file: "ex_15a.txt",  text: null },
  { id: "ex15b", name: "15b",  file: "ex_15b.txt",  text: null },
  { id: "ex15c", name: "15c",  file: "ex_15c.txt",  text: null },
  { id: "ex16a", name: "16a",  file: "ex_16a.txt",  text: null },
  { id: "ex16b", name: "16b",  file: "ex_16b.txt",  text: null },
  { id: "ex17a", name: "17a",  file: "ex_17a.txt",  text: null },
  { id: "ex17b", name: "17b",  file: "ex_17b.txt",  text: null },
  { id: "ex18a", name: "18a",  file: "ex_18a.txt",  text: null },
  { id: "ex18b", name: "18b",  file: "ex_18b.txt",  text: null },
  { id: "ex19a", name: "19a",  file: "ex_19a.txt",  text: null },
  { id: "ex19b", name: "19b",  file: "ex_19b.txt",  text: null },
  { id: "ex20a", name: "20a",  file: "ex_20a.txt",  text: null },
  { id: "ex20b", name: "20b",  file: "ex_20b.txt",  text: null }
];

const speedExercises = [
  { id: "v0033", name: "0033",  file: "vi_0033.txt", text: null },
  { id: "v0623", name: "0623",  file: "vi_0623.txt", text: null },
  { id: "v0711", name: "0711",  file: "vi_0711.txt", text: null },
  { id: "v0744", name: "0744",  file: "vi_0737.txt", text: null },
  { id: "v0809", name: "0809",  file: "vi_0809.txt", text: null },
  { id: "v0932", name: "0932",  file: "vi_0932.txt", text: null },
  { id: "v0963", name: "0963",  file: "vi_0963.txt", text: null },
  { id: "v0965", name: "0965",  file: "vi_0965.txt", text: null },
  { id: "v0966", name: "0966",  file: "vi_0966.txt", text: null },
  { id: "v0982", name: "0982",  file: "vi_0982.txt", text: null },
  { id: "v1005", name: "1005",  file: "vi_1005.txt", text: null },
  { id: "v1028", name: "1028",  file: "vi_1028.txt", text: null },
  { id: "v1063", name: "1063",  file: "vi_1063.txt", text: null },
  { id: "v1136", name: "1136",  file: "vi_1136.txt", text: null },
  { id: "v1150", name: "1150",  file: "vi_1150.txt", text: null },
  { id: "v1210", name: "1210",  file: "vi_1210.txt", text: null },
  { id: "v1222", name: "1222",  file: "vi_1222.txt", text: null },
  { id: "v1234", name: "1234",  file: "vi_1234.txt", text: null },
  { id: "v1254", name: "1254",  file: "vi_1254.txt", text: null },
  { id: "v1260", name: "1260",  file: "vi_1260.txt", text: null },
  { id: "v1269", name: "1269",  file: "vi_1269.txt", text: null },
  { id: "v1270", name: "1270",  file: "vi_1270.txt", text: null },
  { id: "v1295", name: "1295",  file: "vi_1295.txt", text: null },
  { id: "v1311", name: "1311",  file: "vi_1311.txt", text: null },
  { id: "v1396", name: "1396",  file: "vi_1396.txt", text: null },
  { id: "v1398", name: "1398",  file: "vi_1398.txt", text: null },
  { id: "v1403", name: "1403",  file: "vi_1403.txt", text: null },
  { id: "v1406", name: "1406",  file: "vi_1406.txt", text: null },
  { id: "v1412", name: "1412",  file: "vi_1412.txt", text: null },
  { id: "v1442", name: "1442",  file: "vi_1442.txt", text: null },
  { id: "v1444", name: "1444",  file: "vi_1444.txt", text: null },
  { id: "v1450", name: "1450",  file: "vi_1450.txt", text: null },
  { id: "v1467", name: "1467",  file: "vi_1467.txt", text: null },
  { id: "v1468", name: "1468",  file: "vi_1468.txt", text: null },
  { id: "v1484", name: "1484",  file: "vi_1484.txt", text: null },
  { id: "v1507", name: "1507",  file: "vi_1507.txt", text: null },
  { id: "v1525", name: "1525",  file: "vi_1525.txt", text: null },
  { id: "v1539", name: "1539",  file: "vi_1539.txt", text: null },
  { id: "v1559", name: "1559",  file: "vi_1559.txt", text: null },
  { id: "v1593", name: "1593",  file: "vi_1593.txt", text: null },
  { id: "v1609", name: "1609",  file: "vi_1609.txt", text: null },
  { id: "v1610", name: "1610",  file: "vi_1610.txt", text: null },
  { id: "v1635", name: "1635",  file: "vi_1635.txt", text: null },
  { id: "v1704", name: "1704",  file: "vi_1704.txt", text: null },
  { id: "v1736", name: "1736",  file: "vi_1736.txt", text: null },
  { id: "v1743", name: "1743",  file: "vi_1743.txt", text: null },
  { id: "v1764", name: "1764",  file: "vi_1764.txt", text: null },
  { id: "v1838", name: "1838",  file: "vi_1838.txt", text: null },
  { id: "v1910", name: "1910",  file: "vi_1910.txt", text: null },
  { id: "v2017", name: "2017",  file: "vi_2017.txt", text: null },
  { id: "v2279", name: "2279",  file: "vi_2279.txt", text: null },
  { id: "v2281", name: "2281",  file: "vi_2281.txt", text: null },
  { id: "v3007", name: "3007",  file: "vi_3007.txt", text: null },
  { id: "v4320", name: "4320", file: "vi_4320.txt", text: null }
];

// --- Références DOM ---
let chkTech, chkSpeed, btnStart, btnReset;
let typingArea, exerciseDisplay, exerciseGrid, typingPanel;
let statErrors, statTime, statCpm, statCpmWrapper, statEpm, statEpmWrapper;

// --- État ---
let currentMode = null;       // "tech" ou "speed"
let currentExercise = null;
let referenceText = "";
let displayMode = "text"; // "text" ou "cards"

let wordFromChar = [];
let words = [];

let isRunning = false;
let startTime = null;
let lastLength = 0;
let errorCount = 0;
let typedStrokes = 0;
let timerInterval = null;
let referenceFontSize = 14;

const STORAGE_DONE = "typing_done_exercises";

// --- Initialisation ---
document.addEventListener("DOMContentLoaded", () => {
  chkTech = document.getElementById("chkTech");
  chkSpeed = document.getElementById("chkSpeed");

  btnStart = document.getElementById("btnStart");
  btnReset = document.getElementById("btnReset");

  typingArea = document.getElementById("typingArea");
  exerciseDisplay = document.getElementById("exerciseDisplay");
  exerciseGrid = document.getElementById("exerciseGrid");
  typingPanel = document.getElementById("typingPanel");

  statErrors = document.getElementById("statErrors");
  statTime = document.getElementById("statTime");
  statCpm = document.getElementById("statCpm");
  statCpmWrapper = document.getElementById("statCpmWrapper");
  statEpm = document.getElementById("statEpm");
  statEpmWrapper = document.getElementById("statEpmWrapper");

  chkTech.addEventListener("change", () => selectMode("tech"));
  chkSpeed.addEventListener("change", () => selectMode("speed"));

	btnStart.addEventListener("click", startExercise);
	btnReset.addEventListener("click", () => {
		resetAll();
		setTimeout(() => {
		  chkTech.checked = true;
		  selectMode("tech");
		  const firstTech = document.querySelector("#exerciseGrid .exo-card:nth-child(2)");
		  if (firstTech) firstTech.click();
		}, 50);
	});

	document.getElementById("btnContinue").addEventListener("click", selectNextExercise);

	typingArea.addEventListener("input", onTypingInput);

	// Interdire toute forme de copier-coller / drag-drop dans la zone de saisie
	["paste", "copy", "cut", "drop", "dragstart"].forEach(evt => {
	  typingArea.addEventListener(evt, e => e.preventDefault());
	});

	// Bloquer Ctrl+V / Cmd+V, Ctrl+X, Ctrl+C
	typingArea.addEventListener("keydown", e => {
	  if ((e.ctrlKey || e.metaKey) && ["v", "c", "x"].includes(e.key.toLowerCase())) {
		e.preventDefault();
	  }
	});

	const zoomLabel = document.getElementById("zoomLevel");

	document.getElementById("zoomIn").addEventListener("click", () => {
	  referenceFontSize = Math.min(referenceFontSize + 3, 23);
	  applyZoom();
	});

	document.getElementById("zoomOut").addEventListener("click", () => {
	  referenceFontSize = Math.max(referenceFontSize - 3, 11);
	  applyZoom();
	});

	function applyZoom() {
	  exerciseDisplay.style.fontSize = referenceFontSize + "px";
	  typingArea.style.fontSize = referenceFontSize + "px";

	  const pct = Math.round((referenceFontSize / 14) * 10)*10;
	  zoomLabel.textContent = pct + "%";
	}

	document.getElementById("dispText").addEventListener("change", () => {
		displayMode = "text";
		renderExerciseText();
		const counter = document.getElementById("lineCounter");
		if (counter) {
			counter.style.display = "none";
			counter.textContent = "";
		}
	});

	document.getElementById("dispCards").addEventListener("change", () => {
	  displayMode = "cards";
	  renderExerciseText();
	});

	document.addEventListener("keydown", (e) => {
		// F9 = démarrer
		if (e.key === "F9") {
			e.preventDefault();
			if (!btnStart.disabled) startExercise();
		}
		// --- Réinitialiser avec ESC ---
		if (e.key === "Escape") {
			e.preventDefault();
			resetAll();
		}
	});

	setTimeout(() => {
	  // 1) activer "Technique"
	  chkTech.checked = true;
	  selectMode("tech");

	  const firstTech = document.querySelector("#exerciseGrid .exo-card:nth-child(2)");
	  if (firstTech) firstTech.click();
	}, 50);

  resetAll();
});

// --- Sélection du mode (technique / vitesse) ---
function selectMode(mode) {
  if (mode === "tech") {
    if (chkTech.checked) {
      chkSpeed.checked = false;
      currentMode = "tech";
      renderExerciseGrid(technicalExercises);
    } else {
      currentMode = null;
      clearExerciseGrid();
    }
  } else if (mode === "speed") {
    if (chkSpeed.checked) {
      chkTech.checked = false;
      currentMode = "speed";
      renderExerciseGrid(speedExercises);
    } else {
      currentMode = null;
      clearExerciseGrid();
    }
  }

  // Stats spécifiques vitesse
  if (currentMode === "speed") {
    statCpmWrapper.style.display = "inline-block";
    statEpmWrapper.style.display = "inline-block";
  } else {
    statCpmWrapper.style.display = "none";
    statEpmWrapper.style.display = "none";
  }

  // Reset partiel
  currentExercise = null;
  referenceText = "";
  exerciseDisplay.innerHTML = "";
  typingArea.value = "";
  typingArea.disabled = true;
  btnStart.disabled = true;
  resetStats();

  const header = document.getElementById("currentExerciseName");
  if (header) header.textContent = "";

  if (typingPanel) typingPanel.style.display = "none";

document.getElementById("keyboardWrapper").style.display =
  (mode === "tech" && chkTech.checked) ? "block" : "none";

if (mode === "tech" && chkTech.checked) renderKeyboard();
}

// --- Gestion grille d'exercices ---
function clearExerciseGrid() {
  exerciseGrid.innerHTML = "";
  // le CSS #exerciseGrid:empty {display:none;} fera le reste
}

function renderExerciseGrid(list) {
  exerciseGrid.innerHTML = "";
  exerciseGrid.style.display = "grid";

  // --- carte pour charger un fichier ---
  const customCard = document.createElement("div");
  customCard.className = "exo-card";
  customCard.style.border = "2px dashed var(--border)";
  customCard.innerHTML = "<b><small>Charger votre texte *</small></b>";
  customCard.onclick = () => triggerUserFileSelect();
  customCard.ondragover = (e) => { e.preventDefault(); customCard.style.background = "var(--surface-2)" };
  customCard.ondragleave = () => { customCard.style.background = "var(--surface-3)" };
  customCard.ondrop = (e) => {
    e.preventDefault();
    customCard.style.background = "var(--surface-3)";
    const file = e.dataTransfer.files[0];
    readUserFile(file);
  };
  exerciseGrid.appendChild(customCard);

	// --- cartes exercices ---
	list.forEach(ex => {
		const card = document.createElement("div");
		card.className = "exo-card";

		const stored = getExerciseScore(ex.id);
		const score  = stored?.rate ?? null;
		const cpm    = stored?.cpm ?? null;

		// --- construction du contenu : nom + icône droite ---
	  let iconHTML = "";
	  let color = "";
	  
	  if (score !== null) {
		if (score < 0.05) {
		  // --- Vert si < 5 % ---
		  color = "#71b230";
		  iconHTML = `<i class="bi bi-check2-circle"></i>`;
		  card.classList.add("done-perfect");
		} else {
		  // --- Orange si score ≥ 5 % ---
		  color = "#d18145";
		  iconHTML = `<i class="bi bi-plus-slash-minus"></i>`;
		  card.classList.add("done-exercise");
		}

		if (currentMode === "speed") {
			if (score < 0.05 && cpm >= 120) {
				// --- Vert si < 5 % ---
				color = "#71b230";
				iconHTML = `<i class="bi bi-check2-circle"></i>`;
				card.classList.add("done-perfect");
			} else {
			// --- Orange si score ≥ 5 % ---
			color = "#d18145";
			iconHTML = `<i class="bi bi-plus-slash-minus"></i>`;
			card.classList.add("done-exercise");
			}
		}

		card.style.background = "var(--surface-2)";
		card.style.borderColor = color;
		card.style.color = color;
	  }

		// Contenu interne centré + icône à droite
		card.innerHTML = `
		<span class="exo-label">${ex.name}</span>
		<span class="exo-icon">${iconHTML}</span>
	  `;

		card.onclick = () => onExerciseCardClick(ex);
		card.ondblclick = () => {
			onExerciseCardClick(ex);   // charge l’exercice
			setTimeout(() => {
				if (!btnStart.disabled) {
					startExercise();   // démarre si prêt
				}
			}, 50);
		};

		exerciseGrid.appendChild(card);
	});
}

// --- Clic sur un exercice ---
async function onExerciseCardClick(ex) {
	currentExercise = ex;

	// Marquer la carte active
	document.querySelectorAll(".exo-card").forEach(c => c.classList.remove("active-exo"));

	const activeCard = Array.from(document.querySelectorAll(".exo-card"))
	  .find(c => c.querySelector(".exo-label")?.textContent.trim() === ex.name);

	if (activeCard) activeCard.classList.add("active-exo");

  // Charger texte
  if (!currentExercise.text) {
    const res = await fetch("../../assets/js/exercices/" + currentExercise.file);
    currentExercise.text = await res.text();
  }

  referenceText = removeTrailingEmptyLine(normalizeLineEndings(currentExercise.text));
  prepareWordMap(referenceText);
  renderExerciseText();

  typingArea.value = "";
  typingArea.disabled = true;
  btnStart.disabled = false;
  resetStats();

  // Afficher le nom de l'exercice dans l'entête
  const header = document.getElementById("currentExerciseName");
  if (header) header.textContent = "• " + ex.name;
}

function selectNextExercise() {
  if (!currentExercise || !currentMode) return;

  const mode = currentMode;
  const list = mode === "tech" ? technicalExercises : speedExercises;

  // Score du dernier exercice
  const score = getExerciseScore(currentExercise.id);

  // Index exercice actuel
  const idx = list.findIndex(ex => ex.id === currentExercise.id);
  if (idx === -1) return;

  // Choix exercice cible
  let targetExercise;
  if (score >= 0.05) {
    targetExercise = currentExercise;        // refaire le même
  } else {
    targetExercise = list[idx + 1] || null;  // exercice suivant
  }

  if (!targetExercise) return;

  // Réactiver les éléments désactivés
  document.getElementById("dispText").disabled = false;
  document.getElementById("dispCards").disabled = false;
  chkTech.disabled = false;
  chkSpeed.disabled = false;
  enableFileMenu();
  
  // Recharger la grille correcte
  if (mode === "tech") {
    chkTech.checked = true;
    chkSpeed.checked = false;
    renderExerciseGrid(technicalExercises);
  } else {
    chkSpeed.checked = true;
    chkTech.checked = false;
    renderExerciseGrid(speedExercises);
  }

  exerciseGrid.style.display = "grid";

  // Trouver la carte correspondant à l'exercice cible
  const nextCard = Array.from(document.querySelectorAll(".exo-card"))
    .find(card => {
      const lbl = card.querySelector(".exo-label");
      return lbl && lbl.textContent.trim() === targetExercise.name;
    });

  if (!nextCard) return;

  // Simuler le clic sur la carte pour charger l'exercice
  nextCard.click();

  // --- IMPORTANT ---
  // Appliquer visuellement l'état actif
  document.querySelectorAll(".exo-card").forEach(c => c.classList.remove("active-exo"));
  nextCard.classList.add("active-exo");
}

// --- Normalisation des retours ligne ---
function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, "\n");
}

// --- Supprime la dernière ligne si elle est vide ---
function removeTrailingEmptyLine(text) {
  const lines = text.split("\n");

  // Tant que la dernière ligne est vide ou composée d'espaces, on la retire
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  return lines.join("\n");
}

// --- Préparation de la carte des mots ---
function prepareWordMap(text) {
  words = [];
  wordFromChar = new Array(text.length).fill(null);

  let inWord = false, wordStart = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isWhite = /\s/.test(ch);

    if (!isWhite && !inWord) {
      inWord = true;
      wordStart = i;
    }

    if ((isWhite || i === text.length - 1) && inWord) {
      const wordEnd = isWhite ? i - 1 : i;
      const wordIndex = words.length;
      words.push({ start: wordStart, end: wordEnd });

      for (let j = wordStart; j <= wordEnd; j++) {
        wordFromChar[j] = wordIndex;
      }
      inWord = false;
    }
  }
}

// --- Affichage du texte ---
function renderExerciseText() {
  exerciseDisplay.innerHTML = "";

  if (displayMode === "cards") {
    renderCardsDisplay();
  } else {
    renderSpanDisplay();
  }

  small_updateHighlight(0);
}

function renderSpanDisplay() {
  exerciseDisplay.innerHTML = "";

  let wordWrapper = null;

  for (let i = 0; i < referenceText.length; i++) {
    const ch = referenceText[i];

    // Retour à la ligne
    if (ch === "\n") {
      wordWrapper = null;
      exerciseDisplay.appendChild(document.createElement("br"));
      continue;
    }

    // ESPACE → span normal, avec index et classe .char
    if (ch === " ") {

      // l’espace ne doit pas être dans un wrapper
      wordWrapper = null;

      const span = document.createElement("span");
      span.textContent = " ";
      span.dataset.index = String(i);
      span.classList.add("char");    // ⬅ important
      // pas de nowrap ici !
      exerciseDisplay.appendChild(span);

      continue;
    }

    // Nouveau mot → créer un wrapper
    if (!wordWrapper) {
      wordWrapper = document.createElement("span");
      wordWrapper.className = "word";
      wordWrapper.style.whiteSpace = "nowrap"; 
      exerciseDisplay.appendChild(wordWrapper);
    }

    // Lettre individuelle (avec index)
    const span = document.createElement("span");
    span.textContent = ch;
    span.dataset.index = String(i);
    span.classList.add("char");

    if (isSpecialChar(ch)) {
      span.classList.add("special-char");
    }

    wordWrapper.appendChild(span);
  }
}

function renderCardsDisplay(position = 0) {
  exerciseDisplay.innerHTML = "";

  // Trouver la ligne courante
  const before = referenceText.slice(0, position);
  const currentLineIndex = before.split("\n").length - 1;

  const lines = referenceText.split("\n");
  const line = lines[currentLineIndex] || "";

  const lineDiv = document.createElement("div");
  lineDiv.className = "char-line";

  // Index global = début de la ligne
  let lineStartIndex = before.lastIndexOf("\n") + 1;
  if (lineStartIndex < 0) lineStartIndex = 0;

  // Affichage des caractères classiques
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const card = document.createElement("div");
    card.className = "char-card";
    card.dataset.index = lineStartIndex + i;

    if (ch === " ") {
      card.classList.add("space");
      card.textContent = "␣";
    } else {
      card.textContent = ch;
    }
    lineDiv.appendChild(card);
  }

	const globalNextIndex = lineStartIndex + line.length;
	if (referenceText[globalNextIndex] === "\n") {
		const enterCard = document.createElement("div");
		enterCard.className = "char-card enter";
		enterCard.dataset.index = globalNextIndex;

		enterCard.innerHTML = '<i class="bi bi-arrow-return-left"></i>';

		lineDiv.appendChild(enterCard);
	}

	updateLineCounter(position);
	exerciseDisplay.appendChild(lineDiv);
}

function isSpecialChar(ch) {
  const normalLetters = /^[a-z0-9 éèà',-.]$/; 
  return !normalLetters.test(ch);
}

// --- Démarrer exercice ---
function startExercise() {
  if (!currentExercise || !referenceText) return;

  isRunning = true;
  startTime = null;
  lastLength = 0;
  errorCount = 0;
  typedStrokes = 0;
  resetStats();

  typingArea.value = "";
  typingArea.disabled = false;
  typingArea.focus();

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimeStat, 100);

  // Masquer les cartes
  clearExerciseGrid();
  exerciseGrid.style.display = "none";
  if (typingPanel) typingPanel.style.display = "flex";

	// Désactiver le choix d'affichage Bloc / Cartes pendant l'exercice
	document.getElementById("dispText").disabled = true;
	document.getElementById("dispCards").disabled = true;
	document.getElementById("chkTech").disabled = true;
	document.getElementById("chkSpeed").disabled = true;
	document.getElementById("btnStart").disabled = true;
	disableFileMenu();

	updateHighlight(0);
}

// --- Reset complet ---
function resetAll() {
	// Réactiver le choix Bloc / Cartes
	document.getElementById("dispText").disabled = false;
	document.getElementById("dispCards").disabled = false;
	document.getElementById("chkTech").disabled = false;
	document.getElementById("chkSpeed").disabled = false;
	enableFileMenu();

	setTimeout(() => {
	  // 1) activer "Technique"
	  chkTech.checked = true;
	  selectMode("tech");

	  const firstTech = document.querySelector("#exerciseGrid .exo-card:nth-child(2)");
	  if (firstTech) firstTech.click();
	}, 50);

  const counter = document.getElementById("lineCounter");
  if (counter) {
    counter.style.display = "none";
    counter.textContent = "";
  }

  isRunning = false;
  currentMode = null;
  currentExercise = null;
  referenceText = "";
  words = [];
  wordFromChar = [];

  clearExerciseGrid();

  typingArea.value = "";
  typingArea.disabled = true;
  exerciseDisplay.innerHTML = "";

  btnStart.disabled = true;

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  resetStats();

  if (typingPanel) typingPanel.style.display = "none";

  const header = document.getElementById("currentExerciseName");
  if (header) header.textContent = "";

	document.getElementById("keyboardWrapper").style.display = "none";
	clearKeyboardHighlight();
}

// --- Reset stats ---
function resetStats() {
  startTime = null;
  lastLength = 0;
  errorCount = 0;
  typedStrokes = 0;

  statErrors.textContent = "0";
  statTime.textContent = "0 s";
  statCpm.textContent = "0";
  statEpm.textContent = "0";
}

// Détermine si une frappe est une touche morte acceptable
function isDeadKey(typedChar, refChar) {
  const circumflex = "âêîôûÂÊÎÔÛ";
  const diaeresis = "äëïöüÄËÏÖÜ";

  if (typedChar === "^" && circumflex.includes(refChar)) return true;
  if (typedChar === "¨" && diaeresis.includes(refChar)) return true;

  return false;
}

// --- Saisie utilisateur ---
function onTypingInput() {
  if (!isRunning || !referenceText) return;

  const raw = typingArea.value;
  const val = raw.normalize("NFC"); // toujours normaliser
  if (val !== raw) typingArea.value = val;

  const len = val.length;
  const ref = referenceText.normalize("NFC");

  // démarrage chrono
  if (len > 0 && !startTime) {
    startTime = performance.now();
  }

  // nouvelle frappe
  if (len > lastLength) {
    const typedChar = val[len - 1];
    const refChar   = ref[len - 1];
    typedStrokes++;

    // mauvaise frappe ?
    if (typedChar !== refChar) {
      // --- 1 : Touche morte valide (ne pas compter d’erreur, ne pas avancer)
      if (isDeadKey(typedChar, refChar)) {
        return; // on attend la lettre finale (par ex e → ê)
      }
      // --- 2 : vraie erreur → annuler
      errorCount++;
      typingArea.value = val.slice(0, -1);
      markErrorChar(len - 1);
      updateStats();
      return;
    }
  }

  // frappe correcte → avancer
  lastLength = typingArea.value.length;

  updateHighlight(lastLength);
  updateStats();

  const finishedByLength = lastLength >= ref.length;
  const finishedByCards  = (displayMode === "cards") && isLastCardCompleted(lastLength);

  if (finishedByLength || finishedByCards) {
    finishExercise();
    return;
  }
}

function isLastCardCompleted(position) {
    const before = referenceText.slice(0, position);
    const currentLineIndex = before.split("\n").length - 1;
    const lines = referenceText.split("\n");
    const totalLines = lines.length;

    if (currentLineIndex !== totalLines - 1) {
        return false;
    }

    const lastLine = lines[totalLines - 1];
    const localIndex = position - before.lastIndexOf("\n") - 1;

    return localIndex + 1 >= lastLine.length;
}

// Marque une erreur
function markErrorChar(index) {
  const span = exerciseDisplay.querySelector(`span[data-index="${index}"]`);
  if (span) span.classList.add("char-error");
}

// --- Highlight ---
function updateHighlight(position) {
	if (displayMode === "cards") {
		renderCardsDisplay(position);
		highlightCard(position);
		updateLineCounter(position);
		return;
	}

  if (!referenceText.length) return;

  const spans = exerciseDisplay.querySelectorAll(".char");
  spans.forEach(s => s.classList.remove("current-char", "current-word", "tech"));

  const maxPos = Math.min(position, referenceText.length - 1);
  const refChar = referenceText[maxPos];

  if (refChar === "\n") {
    highlightKey("Enter");
    return; // pas d'affichage texte car c'est un <br>
  }

  // (comportement normal pour les autres caractères)
  const spanCurrent = exerciseDisplay.querySelector(`span[data-index="${maxPos}"]`);
  if (!spanCurrent) return;

  spanCurrent.classList.add("current-char");

  if (currentMode === "tech") {
    spanCurrent.classList.add("tech");
    highlightKey(refChar);
  }

  const wordIndex = wordFromChar[maxPos];
  if (wordIndex != null && wordIndex >= 0 && wordIndex < words.length) {
    const w = words[wordIndex];
    for (let i = w.start; i <= w.end; i++) {
      const s = exerciseDisplay.querySelector(`span[data-index="${i}"]`);
      if (s) s.classList.add("current-word");
    }
  }
}

function small_updateHighlight(position) {
	if (displayMode === "cards") {
		renderCardsDisplay(position);
		highlightCard(position);
		updateLineCounter(position);
		return;
	}

  if (!referenceText.length) return;

  const spans = exerciseDisplay.querySelectorAll(".char");
  spans.forEach(s => s.classList.remove("current-char", "current-word", "tech"));

  const maxPos = Math.min(position, referenceText.length - 1);
  const spanCurrent = exerciseDisplay.querySelector(`span[data-index="${maxPos}"]`);
  if (!spanCurrent) return;

	spanCurrent.classList.add("current-char");
	if (currentMode === "tech") {
		spanCurrent.classList.add("tech");
	}

  const wordIndex = wordFromChar[maxPos];
  if (wordIndex != null && wordIndex >= 0 && wordIndex < words.length) {
    const w = words[wordIndex];
    for (let i = w.start; i <= w.end; i++) {
      const s = exerciseDisplay.querySelector(`span[data-index="${i}"]`);
      if (s) s.classList.add("current-word");
    }
  }
}

function highlightCard(position) {
  document.querySelectorAll(".char-card").forEach(card => {
    card.classList.remove("current");
  });

  const card = exerciseDisplay.querySelector(`.char-card[data-index="${position}"]`);
  if (card) card.classList.add("current");

  const ch = referenceText[position];
  highlightKey(ch);
}

// --- Stats & fin ---
function updateTimeStat() {
  if (!startTime || !isRunning) return;

  const now = performance.now();
  const seconds = (now - startTime) / 1000;
  statTime.textContent = seconds.toFixed(0) + " s";

  if (currentMode === "speed" && seconds > 0) {
    const minutes = seconds / 60;
    const cpm = Math.round(typedStrokes / minutes);
    const epm = Math.round(errorCount / minutes);
    statCpm.textContent = isFinite(cpm) ? cpm : 0;
    statEpm.textContent = isFinite(epm) ? epm : 0;
  }
}

function updateStats() {
  statErrors.textContent = errorCount;
  updateTimeStat();
}

function finishExercise() {
  isRunning = false;
  typingArea.disabled = true;

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // --- Calcul du temps & CPM ---
  let cpm = 0;
  if (startTime) {
    const now = performance.now();
    const seconds = (now - startTime) / 1000;
    const minutes = seconds / 60;

    if (currentMode === "speed" && minutes > 0) {
      cpm = Math.round(typedStrokes / minutes);
      const epm = Math.round(errorCount / minutes);
      statCpm.textContent = isFinite(cpm) ? cpm : 0;
      statEpm.textContent = isFinite(epm) ? epm : 0;
    }

    statTime.textContent = seconds.toFixed(0) + " s";
  }

  // --- Taux d’erreur ---
  let errorRate = referenceText.length > 0
    ? errorCount / referenceText.length
    : 1;

  // --- LOGIQUE DE VALIDATION ---
  let success = false;
  let message = "";

  if (currentMode === "tech") {
    if (errorRate < 0.05) {
      success = true;
      message = `Exercice réussi avec moins de <b>5&nbsp;%</b> d’erreurs !`;
    } else {
      message = `Exercice cependant terminé avec plusieurs erreurs...`;
    }

  } else if (currentMode === "speed") {
    if (errorRate >= 0.05) {
      message = `L'exercice contient malheureusement encore trop d'erreurs pour être pleinement satisfaisant...`;
    } else if (cpm < 120) {
      message = `Exercice terminé avec peu d’erreurs, mais à une vitesse toutefois inférieure à 120&nbsp;caractères/minute...`;
    } else {
      success = true;
      message = `Exercice réussi avec moins de <b>5&nbsp;%</b> d’erreurs et plus de <b>120&nbsp;caractères/minute</b>&nbsp;!`;
    }
  }

  // --- Sauvegarde score ---
  const scoreToSave = success ? errorRate : 0.1;
  if (currentExercise && currentExercise.id) {
    saveExerciseScore(currentExercise.id, scoreToSave, cpm);
  }

  // --- Modal ---
  const modalEl = document.getElementById("modalBravo");
  if (!modalEl) return;

  const msg = document.getElementById("modalBravoMessage");
  const content = modalEl.querySelector(".modal-content");

  if (success) {
    content.style.background = "#add1b4";
    content.style.color = "#6e9976";
  } else {
    content.style.background = "#e2ae83";
    content.style.color = "#bf8352";
  }

  msg.innerHTML = success
    ? message
    : `${message}<br><i>Nous conseillons de recommencer l'exercice ou d'entraîner encore un peu plus la technique de frappes ;)</i>`;

	// --- Affichage détaillé des statistiques ---
	const statsDiv = document.getElementById("modalBravoStats");

	let errorPct = (errorRate * 100).toFixed(0) + " %";
	let timeSec = statTime.textContent;
	let speedStr = "";

	if (currentMode === "speed") {
		let epm = statEpm.textContent;
		speedStr = `
			<i><small>[vitesse : ${cpm} caractères/min., 
		`;
	} else {
		// mode technique → pas de CPM
		speedStr = "<i><samll>[";
	}

	statsDiv.innerHTML = `
		${speedStr}réalisé ${currentExercise?.name} en ${timeSec} avec ${errorPct} d’erreurs d'écriture]</small></i>
	`;
  new bootstrap.Modal(modalEl).show();
}

function saveExerciseScore(id, rate, cpm = null) {
  const scores = JSON.parse(localStorage.getItem("typing_scores") || "{}");
  scores[id] = { rate, cpm };
  localStorage.setItem("typing_scores", JSON.stringify(scores));
}

// === CLAVIER VISUEL QWERTZ CH ===
const keyboardLayout = [
  ["§","1","2","3","4","5","6","7","8","9","0","'","^",{key:"Backspace", wide:true}],
  [{key:"Tab",wide:true},"Q","W","E","R","T","Z","U","I","O","P","è","¨",{key:"Enter",smallwide:true}],
  [{key:"CapsLock",midwide:true},"A","S","D","F","G","H","J","K","L","é","à","$"],
  [{key:"ShiftD",wide:true},"<","Y","X","C","V","B","N","M",",",".","-",{key:"ShiftG",midwide:true}],
  [{key:"CtrlG",wide:true},{key:"Cmd",smallwide:true},{key:"Alt",smallwide:true},{key:" ",space:true},{key:"AltGr",smallwide:true},{key:"Cmd",smallwide:true},{key:"☰",smallwide:true},{key:"CtrlD",smallwide:true}]
];

function renderKeyboard() {
  const container = document.getElementById("keyboard");
  container.innerHTML = "";

  keyboardLayout.forEach(row => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "key-row";

    row.forEach(k => {
		let label = k.key || k;
		const keyDiv = document.createElement("div");

		keyDiv.className = "key";
		if (k.wide) keyDiv.classList.add("wide");
		if (k.midwide) keyDiv.classList.add("midwide");
		if (k.space) keyDiv.classList.add("space");
		if (k.smallwide) keyDiv.classList.add("smallwide");

      keyDiv.textContent = label === " " ? "Espace" : label;
      keyDiv.dataset.key = label;

	const roseKeys = ["6", "T", "G", "B", "5", "R", "F", "V"];
	const blueKeys = ["7", "Z", "H", "N", "8", "U", "J", "M"];

	if (roseKeys.includes(label)) keyDiv.classList.add("rose");
	if (blueKeys.includes(label)) keyDiv.classList.add("bleu");

      rowDiv.appendChild(keyDiv);
    });

    container.appendChild(rowDiv);
  });
}

function clearKeyboardHighlight() {
  document.querySelectorAll(".key").forEach(k =>
    k.classList.remove("active-correct","active-special","active-error")
  );
}

function highlightKey(ch) {
  clearKeyboardHighlight();

  const isLetter = /^[A-Za-zÀ-ÿ]$/.test(ch);
  const isUpper = ch === ch.toUpperCase() && ch !== ch.toLowerCase();

  let norm = ch;
  if ("éèêëàâäùûüôöîïç".includes(ch.toLowerCase())) {
    norm = ch.toLowerCase(); // toujours minuscule car le clavier n'affiche pas les majuscules
  } else {
    norm = ch.length === 1 ? ch.toUpperCase() : ch;
  }

  if (ch === " ") {
    const spaceKey = document.querySelector(".key.space");
    if (spaceKey) spaceKey.classList.add("active-correct");
    return;
  }

  if (isLetter && isUpper) {
    document.querySelectorAll('.key[data-key="ShiftD"], .key[data-key="ShiftG"]')
      .forEach(s => s.classList.add("active-special"));
  }

  const key = document.querySelector(`.key[data-key="${norm}"]`);
  if (!key) return;

  const mustBeSpecial = isSpecialChar(ch) && !isLetter;
  key.classList.add(mustBeSpecial ? "active-special" : "active-correct");
}

function triggerUserFileSelect() {
  document.getElementById("userFileInput").click();
}

document.getElementById("userFileInput").addEventListener("change", function() {
  const file = this.files[0];
  readUserFile(file);
});

function readUserFile(file) {
  if (!file || file.type !== "text/plain") {
    alert("Veuillez sélectionner un fichier .txt");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    loadCustomText(e.target.result);
  };
  reader.readAsText(file, "UTF-8");
}

function loadCustomText(text) {
  currentExercise = { id: "custom", name: "Texte personnalisé" };
  referenceText = removeTrailingEmptyLine(normalizeLineEndings(text));

  prepareWordMap(referenceText);
  renderExerciseText();

  typingArea.value = "";
  typingArea.disabled = true;
  btnStart.disabled = false;
  resetStats();

  const header = document.getElementById("currentExerciseName");
  header.textContent = "• Texte personnalisé";
}

function updateLineCounter(position) {
  const counter = document.getElementById("lineCounter");
  if (!counter) return;

  // Masquer si mode bloc ou pas de texte
  if (displayMode !== "cards" || !referenceText.length) {
    counter.style.display = "none";
    counter.textContent = "";
    return;
  }

  // Toutes les lignes, mais sans compter les vides
  const allLines = referenceText.split("\n");
  const nonEmptyLines = allLines
    .map(l => l.trim())     // retire espaces
    .filter(l => l !== ""); // garde seulement les lignes non vides

  const totalLines = nonEmptyLines.length;

  // Trouver la ligne ACTIVE en tenant compte des lignes vides
  let before = referenceText.slice(0, position);
  let currentRawIndex = before.split("\n").length - 1; // index réel, incluant lignes vides

  // Convertir l’index réel → index filtré
  let currentLineNumber = 0;
  let count = 0;

  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].trim() !== "") {
      count++;
    }

    if (i === currentRawIndex) {
      currentLineNumber = count;
      break;
    }
  }

  // Si la ligne courante est vide → assigner à la dernière ligne non vide rencontrée
  if (currentLineNumber === 0) currentLineNumber = 1;

  // Texte final
  const suffix = (currentLineNumber === 1) ? "ère ligne" : "ème ligne";

  counter.textContent = `${currentLineNumber}${suffix} / ${totalLines}`;
  counter.style.display = "block";
}

function getExerciseScore(id) {
  const scores = JSON.parse(localStorage.getItem("typing_scores") || "{}");
  return scores[id] ?? null;
}

function enableFileMenu() {
    const menu = document.getElementById("fileMenuWrap");
    const btn  = document.getElementById("fileMenuBtn");
    menu.classList.remove("disabled");
    btn.classList.remove("disabled");
}

function disableFileMenu() {
    const menu = document.getElementById("fileMenuWrap");
    const btn  = document.getElementById("fileMenuBtn");
    menu.classList.add("disabled");
    btn.classList.add("disabled");
}

	(() => {
	  const PRODUCT = "typing";          // adapter: "python" | "html" | "markdown" | "sql"
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
