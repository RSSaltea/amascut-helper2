/* ------------------------------------------------
 * Amascut Helper (no imports; works with your HTML)
 * ------------------------------------------------ */

A1lib.identifyApp("appconfig.json");

// --------- tiny logger ----------
function log(msg) {
  try {
    console.log(msg);
    const out = document.getElementById("output");
    if (!out) return;
    const d = document.createElement("div");
    d.textContent = msg;
    out.prepend(d);
    while (out.childElementCount > 60) out.removeChild(out.lastChild);
  } catch {}
}

// --------- Alt1 detection ----------
if (window.alt1) {
  alt1.identifyAppUrl("./appconfig.json");
} else {
  const url = new URL("./appconfig.json", document.location.href).href;
  document.body.innerHTML = `Alt1 not detected, click <a href="alt1://addapp/${url}">here</a> to add this app.`;
}

// --------- De-dupe state ----------
const seenLineIds = new Set();
const seenLineQueue = []; // FIFO to keep memory small

// --------- Countdown management ----------
let countdownTimers = [];
let resetTimerId = null;

function cancelCountdowns() {
  if (startCountdown._interval) {
    clearInterval(startCountdown._interval);
    startCountdown._interval = null;
  }
  countdownTimers.forEach(clearTimeout);
  countdownTimers = [];
}

function showSingleRow(text) {
  const rows = document.querySelectorAll("#spec tr");

  if (rows[0]) {
    const c0 = rows[0].querySelector("td");
    if (c0) c0.textContent = text;
    rows[0].style.display = "table-row";
    rows[0].classList.remove("role-range", "role-magic", "role-melee");
    rows[0].classList.add("selected", "callout", "flash"); // <- added
  }

  for (let i = 1; i < rows.length; i++) {
    const c = rows[i].querySelector("td");
    if (c) c.textContent = "";
    rows[i].style.display = "none";
    rows[i].classList.remove("role-range", "role-magic", "role-melee", "selected", "callout", "flash"); // <- ensure cleared
  }

  log(`✅ ${text}`);
}

function startCountdown(label, seconds) {
  cancelCountdowns();
  if (resetTimerId) { clearTimeout(resetTimerId); resetTimerId = null; }

  let remaining = seconds;

  function render() {
    if (remaining > 1) {
      showSingleRow(`${label} (${remaining})`);
    } else if (remaining === 1) {
      // show ALL CAPS without "(1)"
      showSingleRow(label.toUpperCase());
    }
  }

  render();
  startCountdown._interval = setInterval(() => {
    remaining -= 1;
    if (remaining >= 1) {
      render();
    } else {
      clearInterval(startCountdown._interval);
      startCountdown._interval = null;
    }
  }, 1000);
}

// --------- Chat reader ----------
const reader = new Chatbox.default();
const NAME_RGB = [69, 131, 145];
const TEXT_RGB = [153, 255, 153];
const WHITE_RGB = [255, 255, 255];
const PUB_BLUE = [127, 169, 255];

function isColorNear(rgb, target, tol = 10) {
  return Math.abs(rgb[0] - target[0]) <= tol &&
         Math.abs(rgb[1] - target[1]) <= tol &&
         Math.abs(rgb[2] - target[2]) <= tol;
}

reader.readargs = {
  colors: [
    A1lib.mixColor(...NAME_RGB),
    A1lib.mixColor(...TEXT_RGB),
    A1lib.mixColor(...WHITE_RGB),
    A1lib.mixColor(...PUB_BLUE),
  ],
  backwards: true
};

// --------- UI helpers ----------
const RESPONSES = {
  weak:     "Range > Magic > Melee",
  grovel:   "Magic > Melee > Range",
  pathetic: "Melee > Range > Magic",
};

function updateUI(key) {
  cancelCountdowns();

  const order = RESPONSES[key].split(" > ");
  const rows = document.querySelectorAll("#spec tr");

  if (rows[0]) rows[0].style.display = "table-row";
  if (rows[1]) rows[1].style.display = "table-row";
  if (rows[2]) rows[2].style.display = "table-row";

rows.forEach((row, i) => {
  const role = order[i] || "";
  const cell = row.querySelector("td");
  if (cell) cell.textContent = role;

  // clear any callout styling
  row.classList.remove("callout", "flash");

  // color + emphasis
  row.classList.remove("role-range", "role-magic", "role-melee");
  if (role === "Range") row.classList.add("role-range");
  else if (role === "Magic") row.classList.add("role-magic");
  else if (role === "Melee") row.classList.add("role-melee");

  row.classList.toggle("selected", i === 0);
});

  log(`✅ ${RESPONSES[key]}`);

  if (resetTimerId) clearTimeout(resetTimerId);
  resetTimerId = setTimeout(() => {
    resetUI();
    log("↺ UI reset");
  }, 6000);
}

function resetUI() {
  const rows = document.querySelectorAll("#spec tr");

  if (rows[0]) {
    const c0 = rows[0].querySelector("td");
    if (c0) c0.textContent = "Waiting..";
    rows[0].style.display = "";
    rows[0].classList.remove("role-range", "role-magic", "role-melee", "callout", "flash");
    rows[0].classList.add("selected");
  }

  for (let i = 1; i < rows.length; i++) {
    const c = rows[i].querySelector("td");
    if (c) c.textContent = "";
    rows[i].style.display = "none";
    rows[i].classList.remove("role-range", "role-magic", "role-melee", "selected", "callout", "flash");
  }
}

// --------- Utilities ----------
function firstNonWhiteColor(seg) {
  if (!seg.fragments) return null;
  for (const f of seg.fragments) {
    if (!isColorNear(f.color, WHITE_RGB)) return f.color;
  }
  return null;
}

// --------- Debouncer ----------
let lastSig = "";
let lastAt = 0;

function onAmascutLine(full, lineId) {
  // de-dupe: skip if already handled
  if (lineId && seenLineIds.has(lineId)) return;
  if (lineId) {
    seenLineIds.add(lineId);
    seenLineQueue.push(lineId);
    if (seenLineQueue.length > 120) {
      const old = seenLineQueue.shift();
      seenLineIds.delete(old);
    }
  }

  const raw = full;                 // preserve case
  const low = full.toLowerCase();   // lowercase for insensitive checks

  // ---- key detection ----
  let key = null;
  if (raw.includes("Grovel")) key = "grovel";
  else if (/\bWeak\b/.test(raw)) key = "weak"; // case-sensitive match for 'Weak'
  else if (raw.includes("Pathetic")) key = "pathetic";
  else if (low.includes("tear them apart")) key = "tear";
  else if (low.includes("tumeken's heart delivered")) key = "barricadeHeart";
  else if (raw.includes("I WILL NOT BE SUBJUGATED")) key = "notSubjugated";
  if (!key) return;

  // prevent rapid re-triggers of the same line
  const now = Date.now();
  const sig = key + "|" + raw.slice(-80);
  if (sig === lastSig && now - lastAt < 1200) return;
  lastSig = sig;
  lastAt = now;

  if (key === "tear") {
    // Voke → Reflect immediately, 8→1 countdown
    startCountdown("Voke → Reflect", 8);

    // After 8s finishes + 2s, Barricade 10→1
    countdownTimers.push(setTimeout(() => {
      startCountdown("Barricade", 10);
      countdownTimers.push(setTimeout(() => {
        resetUI();
        log("↺ UI reset");
      }, 10000));
    }, 10000)); // 8s countdown + 2s pause

  } else if (key === "barricadeHeart") {
    // Start a Barricade 12s countdown, without interrupting other timers
    startCountdown("Barricade", 12);
    countdownTimers.push(setTimeout(() => {
      resetUI();
      log("↺ UI reset");
    }, 12000));

} else if (key === "notSubjugated") {
  // Show instruction message for 8s, no countdown cancel
  showSingleRow("Magic Prayer → Devo → Reflect → Melee Prayer");
  setTimeout(() => {
    resetUI();
    log("↺ UI reset");
  }, 8000);
}
  else {
    // Normal Grovel / Weak / Pathetic update (overwrite old countdowns)
    cancelCountdowns();
    updateUI(key);
  }
}

// --------- Read loop ----------
function readChatbox() {
  let segs = [];
  try { segs = reader.read() || []; }
  catch (e) { log("⚠️ reader.read() failed; enable Pixel permission in Alt1."); return; }
  if (!segs.length) return;

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (!seg.fragments || seg.fragments.length === 0) continue;

    const hasNameColor = seg.fragments.some(f => isColorNear(f.color, NAME_RGB));
    if (!hasNameColor || !/Amascut/i.test(seg.text)) continue;

    let full = seg.text;
    const colon = full.indexOf(":");
    if (colon !== -1) full = full.slice(colon + 1).trim();

    for (let j = i + 1; j < segs.length; j++) {
      const s2 = segs[j];
      if (!s2.fragments || s2.fragments.length === 0) break;
      const col = firstNonWhiteColor(s2);
      if (col && isColorNear(col, TEXT_RGB)) {
        full += " " + s2.text.trim();
      } else {
        break;
      }
    }

    if (full) {
      log(full);
      const lineId = seg.text.trim();
      onAmascutLine(full, lineId);
    }
  }
}

// --------- Boot ----------
resetUI();

setTimeout(() => {
  const finder = setInterval(() => {
    try {
      if (!reader.pos) {
        log("🔍 finding chatbox...");
        reader.find();
      } else {
        clearInterval(finder);
        log("✅ chatbox found");
        showSelected(reader.pos);
        setInterval(readChatbox, 250);
      }
    } catch (e) {
      log("⚠️ " + (e?.message || e));
    }
  }, 800);
}, 50);

function showSelected(pos) {
  try {
    const b = pos.mainbox.rect;
    alt1.overLayRect(A1lib.mixColor(0, 255, 0), b.x, b.y, b.width, b.height, 2000, 4);
  } catch {}
}
