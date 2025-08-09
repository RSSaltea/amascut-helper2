/* script.js — Amascut Helper */

// --- Alt1 app identify -------------------------------------------------------
if (window.A1lib) {
  A1lib.identifyApp("appconfig.json");
}
if (window.alt1) {
  alt1.identifyAppUrl("./appconfig.json");
} else {
  const url = new URL("./appconfig.json", document.location.href).href;
  document.body.innerHTML =
    `Alt1 not detected, click <a href="alt1://addapp/${url}">here</a> to add this app.`;
}

// --- tiny logger (goes into #output) -----------------------------------------
function log(msg) {
  const out = document.getElementById("output");
  if (!out) return;
  const d = document.createElement("div");
  d.textContent = msg;
  out.appendChild(d);
  // keep last 200 lines
  while (out.childElementCount > 200) out.removeChild(out.firstChild);
}

// --- Logs panel controls (requires the HTML from previous step) --------------
(function wireLogsPanel() {
  const logsPanel = document.getElementById("logsPanel");
  const toggleLogsBtn = document.getElementById("toggleLogs");
  const scrollLogsBtn = document.getElementById("scrollLogs");
  const outEl = document.getElementById("output");
  if (toggleLogsBtn && logsPanel) {
    toggleLogsBtn.addEventListener("click", () => {
      logsPanel.classList.toggle("hidden");
    });
  }
  if (scrollLogsBtn && outEl) {
    scrollLogsBtn.addEventListener("click", () => {
      outEl.scrollTop = outEl.scrollHeight;
    });
  }
})();

// --- UI helpers ---------------------------------------------------------------
const RESPONSES = {
  weak:     "Range > Magic > Melee",
  grovel:   "Magic > Melee > Range",
  pathetic: "Melee > Range > Magic",
};

// ensure table starts with 1 row only
function initTable() {
  const tbody = document.querySelector("#spec tbody");
  if (!tbody) return;
  tbody.innerHTML = `
    <tr id="style1" class="selected"><td>Waiting for mech</td></tr>
  `;
}

// create rows if not present (after we’ve got a match)
function ensureThreeRows() {
  const tbody = document.querySelector("#spec tbody");
  if (!tbody) return;
  if (!document.getElementById("style2")) {
    const tr2 = document.createElement("tr");
    tr2.id = "style2";
    tr2.innerHTML = "<td></td>";
    tbody.appendChild(tr2);
  }
  if (!document.getElementById("style3")) {
    const tr3 = document.createElement("tr");
    tr3.id = "style3";
    tr3.innerHTML = "<td></td>";
    tbody.appendChild(tr3);
  }
}

function clearRoleClasses(tr) {
  tr.classList.remove("role-range", "role-magic", "role-melee");
}

function applyRoleClass(tr, roleText) {
  const r = (roleText || "").toLowerCase();
  if (r.includes("range")) tr.classList.add("role-range");
  if (r.includes("magic")) tr.classList.add("role-magic");
  if (r.includes("melee")) tr.classList.add("role-melee");
}

function updateUI(key) {
  if (!RESPONSES[key]) return;
  ensureThreeRows();

  const order = RESPONSES[key].split(" > "); // [Top, Mid, Bot]
  const rows = [
    document.getElementById("style1"),
    document.getElementById("style2"),
    document.getElementById("style3")
  ].filter(Boolean);

  rows.forEach((row, i) => {
    const cell = row.querySelector("td");
    if (!cell) return;
    cell.textContent = order[i] || "";
    row.classList.toggle("selected", i === 0);

    // recolor background to match the text (Range/Magic/Melee)
    clearRoleClasses(row);
    applyRoleClass(row, cell.textContent);
  });

  log(`✔ ${RESPONSES[key]}`);
}

// --- Chatbox OCR wiring -------------------------------------------------------
const reader = new Chatbox.default();

// Text color set: narrow to the lime the boss speaks in + common whites
const LIME = A1lib.mixColor(153, 255, 153);       // boss speech
const WHITE = A1lib.mixColor(255, 255, 255);
const PUBBLU = A1lib.mixColor(127, 169, 255);

reader.readargs = {
  colors: [LIME, WHITE, PUBBLU],
  backwards: true
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

// simple de-dup throttle
let lastSig = "";
let lastAt = 0;

function findKeyInText(text) {
  const t = text.toLowerCase();
  if (t.includes(" grovel")) return "grovel";
  if (t.includes(" pathetic")) return "pathetic";
  if (t.includes(" weak")) return "weak";
  return null;
}

function readChatbox() {
  let segs = [];
  try { segs = reader.read() || []; } catch { return; }
  if (!segs.length) return;

  // Gather most recent ~8 lines, strip timestamps and names
  const lines = segs
    .map(s => (s.text || "").trim())
    .filter(Boolean)
    .map(t => t.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, "")) // remove [hh:mm:ss]
    .map(t => t.replace(/^amascut,\s*the\s*devourer:\s*/i, "")); // remove speaker

  const joined = (" " + lines.slice(-8).join(" ") + " ").toLowerCase();
  let key = findKeyInText(joined);
  if (!key) return;

  const now = Date.now();
  const sig = key + "|" + joined.slice(-120);
  if (sig === lastSig && (now - lastAt) < 1500) return; // skip dup spam
  lastSig = sig; lastAt = now;

  // If this is the first ever match, expand from 1 row to 3 rows
  ensureThreeRows();
  updateUI(key);
}

// --- boot ---------------------------------------------------------------------
initTable();
setTimeout(() => {
  const h = setInterval(() => {
    try {
      if (reader.pos === null) {
        log("finding chatbox...");
        reader.find();
      } else {
        clearInterval(h);
        reader.pos.mainbox = reader.pos.boxes[0];
        log("chatbox found");
        showSelected(reader.pos);
        setInterval(readChatbox, 300);
      }
    } catch (e) {
      log("⚠ " + (e && e.message ? e.message : e));
    }
  }, 700);
}, 50);
