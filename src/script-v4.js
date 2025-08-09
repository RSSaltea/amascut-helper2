/* -----------------------------
 * Amascut Helper — script.js
 * ----------------------------- */

A1lib.identifyApp("appconfig.json");

// simple logger (optional)
function log(msg) {
  console.log(msg);
  const out = document.getElementById("output");
  if (!out) return;
  const d = document.createElement("div");
  d.textContent = msg;
  out.prepend(d);
  while (out.childElementCount > 60) out.removeChild(out.lastChild);
}

// Alt1 detection
if (window.alt1) {
  alt1.identifyAppUrl("./appconfig.json");
} else {
  const url = new URL("./appconfig.json", document.location.href).href;
  document.body.innerHTML =
    `Alt1 not detected, click <a href="alt1://addapp/${url}">here</a> to add this app.`;
}

// -------- chat reader --------
const reader = new Chatbox.default();

// colors (RGB)
const NAME_RGB = [69, 131, 145];      // "Amascut, the Devourer" name color
const TEXT_RGB = [153, 255, 153];     // her green speech color
const WHITE_RGB = [255, 255, 255];
const PUB_BLUE = [127, 169, 255];     // timestamp/public

// allow slight AA drift
function isColorNear(rgb, target, tol = 10) {
  return Math.abs(rgb[0] - target[0]) <= tol &&
         Math.abs(rgb[1] - target[1]) <= tol &&
         Math.abs(rgb[2] - target[2]) <= tol;
}

// tell OCR which colors to consider
reader.readargs = {
  colors: [
    A1lib.mixColor(...NAME_RGB),
    A1lib.mixColor(...TEXT_RGB),
    A1lib.mixColor(...WHITE_RGB),
    A1lib.mixColor(...PUB_BLUE),
  ],
  backwards: true
};

// -------- UI mapping & updates --------
const RESPONSES = {
  weak:     "Range > Magic > Melee",
  grovel:   "Magic > Melee > Range",
  pathetic: "Melee > Range > Magic",
};

function showSelected(chat) {
  try {
    const r = chat.mainbox.rect;
    alt1.overLayRect(A1lib.mixColor(0, 255, 0), r.x, r.y, r.width, r.height, 2000, 5);
  } catch {}
}

function updateUI(key) {
  const order = RESPONSES[key].split(" > ");
  const rows = document.querySelectorAll("#spec tr");
  rows.forEach((row, i) => {
    const cell = row.querySelector("td");
    if (cell) cell.textContent = order[i] || "";
    row.classList.toggle("selected", i === 0);
  });
  log(`✅ set: ${RESPONSES[key]}`);
}

// -------- helpers --------
function firstNonWhiteColor(seg) {
  if (!seg.fragments) return null;
  for (const f of seg.fragments) {
    if (!isColorNear(f.color, WHITE_RGB)) return f.color;
  }
  return null;
}

// debounce
let lastSig = "";
let lastAt = 0;

function onAmascutLine(full) {
  const norm = full.toLowerCase();
  let key = null;
  if (norm.includes("grovel")) key = "grovel";
  else if (norm.includes("weak")) key = "weak";
  else if (norm.includes("pathetic")) key = "pathetic";
  if (!key) return;

  const now = Date.now();
  const sig = key + "|" + norm;
  if (sig === lastSig && now - lastAt < 1200) return;
  lastSig = sig;
  lastAt = now;

  updateUI(key);
}

// -------- main read loop --------
function readChatbox() {
  let segs = [];
  try { segs = reader.read() || []; }
  catch (e) { log("⚠️ reader.read() failed; enable Pixel permission?"); return; }
  if (!segs.length) return;

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (!seg.fragments || seg.fragments.length === 0) continue;

    // does this line contain Amascut's name color anywhere AND mention "Amascut"?
    const hasNameCol = seg.fragments.some(f => isColorNear(f.color, NAME_RGB));
    if (!hasNameCol || !/Amascut/i.test(seg.text)) continue;

    // capture same-line speech (text after the first colon)
    let full = seg.text;
    const colon = full.indexOf(":");
    if (colon !== -1) full = full.slice(colon + 1).trim();

    // append wrapped lines that start as green speech
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
      log(full);        // debug only
      onAmascutLine(full);
    }
  }
}

// -------- bootstrap --------
setTimeout(() => {
  const finder = setInterval(() => {
    try {
      if (reader.pos === null) {
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
