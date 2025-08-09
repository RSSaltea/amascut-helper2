// script.js
A1lib.identifyApp("appconfig.json");

// ---------- tiny logger ----------
function log(msg) {
  console.log(msg);
  const out = document.getElementById("output");
  if (!out) return;
  const d = document.createElement("div");
  d.textContent = msg;
  out.prepend(d);
  while (out.childElementCount > 60) out.removeChild(out.lastChild);
}

// alt1 install fallback
if (window.alt1) {
  alt1.identifyAppUrl("./appconfig.json");
} else {
  const url = new URL("./appconfig.json", document.location.href).href;
  document.body.innerHTML =
    `Alt1 not detected, click <a href="alt1://addapp/${url}">here</a> to add this app.`;
}

// ---------- chat reader ----------
const reader = new Chatbox.default();

// bright lime NPC greens + a few general colors that stabilise OCR
const LIME_GREENS = [
  A1lib.mixColor(153,255,153), // <- the one we really care about
  A1lib.mixColor(150,255,150),
  A1lib.mixColor(156,255,156),
  A1lib.mixColor(162,255,162)
];
const GENERAL_CHAT = [
  A1lib.mixColor(255,255,255),
  A1lib.mixColor(127,169,255),
  A1lib.mixColor(67,188,188),
  A1lib.mixColor(0,111,0),
  A1lib.mixColor(0,255,0),
  A1lib.mixColor(235,47,47)
];

reader.readargs = {
  colors: [...LIME_GREENS, ...GENERAL_CHAT],
  backwards: true
};

// ---------- UI helpers ----------
const RESPONSES = {
  weak:     "Range > Magic > Melee",
  grovel:   "Magic > Melee > Range",
  pathetic: "Melee > Range > Magic",
};

function roleToClass(role) {
  const r = role.toLowerCase();
  if (r.startsWith("range")) return "role-range";
  if (r.startsWith("magic")) return "role-magic";
  if (r.startsWith("melee")) return "role-melee";
  return "";
}

// start with single row
let fullShown = false;

// render only first row (used before we know the call)
function renderSingleRow(text, cssClass = "") {
  const tbody = document.querySelector("#spec tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const tr = document.createElement("tr");
  tr.className = `selected ${cssClass}`.trim();
  tr.innerHTML = `<td>${text}</td>`;
  tbody.appendChild(tr);
}

// render full 3-row table in correct order & colors
function renderFull(order) {
  const tbody = document.querySelector("#spec tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  order.forEach((role, i) => {
    const tr = document.createElement("tr");
    tr.classList.add(roleToClass(role));
    if (i === 0) tr.classList.add("selected");
    tr.innerHTML = `<td>${role}</td>`;
    tbody.appendChild(tr);
  });
}

// called whenever we know the key (weak/grovel/pathetic)
function updateUI(key) {
  const order = RESPONSES[key].split(" > ");
  if (!fullShown) {
    fullShown = true;
    renderFull(order);
  } else {
    renderFull(order);
  }
  log(`✅ ${RESPONSES[key]}`);
}

// initial table state
renderSingleRow("Waiting for mech");

// optional box outline to confirm selection
function showSelected(chat) {
  try {
    alt1.overLayRect(
      A1lib.mixColor(0, 255, 0),
      chat.mainbox.rect.x, chat.mainbox.rect.y,
      chat.mainbox.rect.width, chat.mainbox.rect.height,
      2000, 5
    );
  } catch {}
}

// ---------- chat polling ----------
let lastSig = "";
let lastAt = 0;

// removes the “Amascut says → ” style prefix from log lines if it appears
function stripSaysPrefix(s) {
  return s.replace(/^\s*\d{2}:\d{2}:\d{2}\]\s*/,'')    // drop leading [hh:mm:ss] if present
          .replace(/^Amascut\s*says\s*→\s*/i, '')      // “Amascut says → ”
          .replace(/^Amascut,\s*the\s*Devourer:\s*/i,''); // normal speaker label
}

function readChatbox() {
  let segs = [];
  try { segs = reader.read() || []; } catch (e) {
    log("⚠️ reader.read() failed; ensure Pixel permission.");
    return;
  }
  if (!segs.length) return;

  // Join as a single lowercased string for matching, but also keep a cleaned printable snippet
  const texts = segs.map(s => (s.text || "").trim()).filter(Boolean);
  if (!texts.length) return;

  const printable = stripSaysPrefix(texts[texts.length - 1]);
  // only log short tail to avoid spam
  log(printable);

  const full = texts.join(" ").toLowerCase();

  let key = null;
  if (/\bgrovel\b/i.test(full)) key = "grovel";
  else if (/\bpathetic\b/i.test(full)) key = "pathetic";
  else if (/\bweak\b/i.test(full)) key = "weak";

  if (key) {
    const now = Date.now();
    const sig = key + "|" + full.slice(-80);
    // dedupe bursts
    if (sig !== lastSig || (now - lastAt) > 1500) {
      lastSig = sig;
      lastAt = now;
      updateUI(key);
    }
  }
}

// find chatbox then start polling
setTimeout(() => {
  const finder = setInterval(() => {
    try {
      if (reader.pos === null) {
        log("🔍 finding chatbox...");
        reader.find();
      } else {
        clearInterval(finder);
        // prefer the first found chat as the main one
        reader.pos.mainbox = reader.pos.boxes[0];
        log("✅ chatbox found");
        showSelected(reader.pos);
        setInterval(readChatbox, 300);
      }
    } catch (e) {
      log("⚠️ " + (e && e.message ? e.message : e));
    }
  }, 800);
}, 50);
