A1lib.identifyApp("appconfig.json");

function log(msg) {
  console.log(msg);
  const out = document.getElementById("output");
  if (!out) return;
  const d = document.createElement("div");
  d.textContent = msg;
  out.prepend(d);
  while (out.childElementCount > 50) out.removeChild(out.lastChild);
}

if (window.alt1) {
  alt1.identifyAppUrl("./appconfig.json");
} else {
  const url = new URL("./appconfig.json", document.location.href).href;
  document.body.innerHTML =
    `Alt1 not detected, click <a href="alt1://addapp/${url}">here</a> to add this app.`;
}

const reader = new Chatbox.default();

// --- colors ---
const AMASCUT_NAME = A1lib.mixColor(69, 131, 145);    // Name color
const AMASCUT_TEXT = A1lib.mixColor(153, 255, 153);   // Speech color
const WHITE = A1lib.mixColor(255, 255, 255);

const GENERAL_CHAT = [
  WHITE,
  A1lib.mixColor(127,169,255),
  A1lib.mixColor(102,152,255),
  A1lib.mixColor(67,188,188),
  A1lib.mixColor(255,255,0),
  A1lib.mixColor(235,47,47),
  A1lib.mixColor(0,111,0),
  A1lib.mixColor(0,255,0),
];

// Only need these colors for OCR
reader.readargs = {
  colors: [AMASCUT_NAME, AMASCUT_TEXT, WHITE, ...GENERAL_CHAT],
  backwards: true
};

// --- responses ---
const RESPONSES = {
  weak:     "Range > Magic > Melee",
  grovel:   "Magic > Melee > Range",
  pathetic: "Melee > Range > Magic",
};

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

// --- merge lines from Amascut ---
function mergeAmascutLines(segs) {
  let merged = [];
  let buffer = "";

  for (let seg of segs) {
    if (!seg.fragments || seg.fragments.length === 0) continue;
    const firstColor = seg.fragments[0].color;
    const text = seg.text.trim();

    if (firstColor === A1lib.unmixColor(AMASCUT_NAME) && /Amascut/i.test(text)) {
      // flush old buffer
      if (buffer) {
        merged.push(buffer);
        buffer = "";
      }
      // remove "Amascut, the Devourer: " from start
      buffer = text.replace(/^Amascut.*?:\s*/, "");
    } else if (buffer && firstColor === A1lib.unmixColor(AMASCUT_TEXT)) {
      // continuation of her speech
      buffer += " " + text;
    } else {
      // not Amascut, flush buffer if any
      if (buffer) {
        merged.push(buffer);
        buffer = "";
      }
    }
  }

  if (buffer) merged.push(buffer);

  return merged;
}

let lastSig = "";
let lastAt = 0;

function readChatbox() {
  let segs = [];
  try {
    segs = reader.read() || [];
  } catch (e) {
    log("⚠️ reader.read() failed; check Alt1 Pixel permission.");
    return;
  }
  if (!segs.length) return;

  const mergedMsgs = mergeAmascutLines(segs);

  for (let msg of mergedMsgs) {
    const lower = msg.toLowerCase();
    let key = null;
    if (lower.includes("weak")) key = "weak";
    else if (lower.includes("grovel")) key = "grovel";
    else if (lower.includes("pathetic")) key = "pathetic";

    if (key) {
      const now = Date.now();
      const sig = key + "|" + msg;
      if (sig !== lastSig || (now - lastAt) > 1500) {
        lastSig = sig;
        lastAt = now;
        log(`✅ matched ${key} in: ${msg}`);
        updateUI(key);
      }
    }
  }
}

setTimeout(() => {
  const h = setInterval(() => {
    try {
      if (reader.pos === null) {
        log("🔍 finding chatbox...");
        reader.find();
      } else {
        clearInterval(h);

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
