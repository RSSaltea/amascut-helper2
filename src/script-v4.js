// --- imports (same libs Skillbert uses) ---
import * as a1lib from "alt1/base";
import * as OCR from "alt1/ocr";
import ChatBoxReader, { defaultcolors } from "./chatbox/index"; // << adjust path if needed

// ------- app identify -------
a1lib.identifyApp("appconfig.json");
if (window.alt1) {
  alt1.identifyAppUrl("./appconfig.json");
} else {
  const url = new URL("./appconfig.json", document.location.href).href;
  document.body.innerHTML =
    `Alt1 not detected, click <a href="alt1://addapp/${url}">here</a> to add this app.`;
}

// ------- tiny logger -------
function log(msg) {
  console.log(msg);
  const out = document.getElementById("output");
  if (!out) return;
  const d = document.createElement("div");
  d.textContent = msg;
  out.prepend(d);
  while (out.childElementCount > 50) out.removeChild(out.lastChild);
}

// ------- readers --------
// 1) Skillbert reader with his default palette & nudges
const mainReader = new ChatBoxReader();
mainReader.readargs = {
  colors: defaultcolors.map(c => a1lib.mixColor(c[0], c[1], c[2])),
};
// 2) STRICT green reader just for boss keywords (exact 153,255,153 + white)
const KEYWORD_GREEN = a1lib.mixColor(153, 255, 153);
const WHITE = a1lib.mixColor(255, 255, 255);
const greenReader = new ChatBoxReader();
greenReader.readargs = { colors: [KEYWORD_GREEN, WHITE] };

// disable diff filtering to avoid dropping lines while we’re polling
for (const r of [mainReader, greenReader]) {
  r.diffRead = false;
  r.diffReadUseTimestamps = false;
  r.minoverlap = 0;
}

// ------- UI logic -------
const RESPONSES = {
  weak:     "Range > Magic > Melee",
  grovel:   "Magic > Melee > Range",
  pathetic: "Melee > Range > Magic",
};

function updateUI(key) {
  const order = RESPONSES[key].split(" > ");
  const rows = document.querySelectorAll("#spec tr");
  rows.forEach((row, i) => {
    const cell = row.querySelector("td");
    if (cell) cell.textContent = order[i] || "";
    row.classList.toggle("selected", i === 0);
  });
  log(`🎯 UI set to: ${RESPONSES[key]}`);
}

function showBox(pos) {
  try {
    alt1.overLayRect(
      a1lib.mixColor(0,255,0),
      pos.mainbox.rect.x, pos.mainbox.rect.y,
      pos.mainbox.rect.width, pos.mainbox.rect.height,
      2000, 5
    );
  } catch {}
}

// ------- tolerant text helpers -------
function norm(s) {
  return s.toLowerCase()
    .replace(/[\[\]\.\',;:_\-!?()]/g, " ")
    .replace(/[|!ijl1]/g, "l")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

let lastSig = "", lastAt = 0;
function trigger(key, src) {
  const now = Date.now();
  const sig = key + "|" + src.slice(-120);
  if (sig !== lastSig || (now - lastAt) > 1500) {
    lastSig = sig; lastAt = now;
    log(`✅ matched ${key}`);
    updateUI(key);
  }
}

// ------- polling -------
function readGreenLine() {
  if (!mainReader.pos) return "";

  // make greenReader use same position/box geometry as mainReader
  greenReader.pos = mainReader.pos;

  let segs = [];
  try { segs = greenReader.read() || []; } catch (e) { return ""; }
  const texts = segs.map(s => (s.text || "").trim()).filter(Boolean);
  if (!texts.length) return "";

  log("green-segs: " + JSON.stringify(texts.slice(-6)));
  return norm(texts.join(" "));
}

function poll() {
  // keep mainReader warm and ensure it has a position
  if (!mainReader.pos) return;

  try { mainReader.read(); } catch {}

  const n = readGreenLine();
  if (!n) return;

  // require Amascut mention to avoid green system lines
  if (!/\bamas?cu?t\b/.test(n)) return;

  if (/\bweak\b/.test(n))            return trigger("weak", n);
  if (/\bgrovel\b/.test(n))          return trigger("grovel", n);
  if (/\bpathetic\b/.test(n))        return trigger("pathetic", n);
}

// ------- start -------
setTimeout(() => {
  const finder = setInterval(() => {
    try {
      if (!mainReader.pos) {
        log("🔍 finding chatbox...");
        const pos = mainReader.find();
        if (pos) {
          clearInterval(finder);
          log("✅ chatbox found");
          showBox(pos);
          setInterval(poll, 250);
        }
      }
    } catch (e) {
      log("⚠️ " + (e && e.message ? e.message : e));
    }
  }, 800);
}, 50);
