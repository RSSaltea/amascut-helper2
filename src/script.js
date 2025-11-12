A1lib.identifyApp("appconfig.json");

function log(msg) {
  try {
    console.log(msg);
    const out = document.getElementById("output");
    if (!out) return;
    const d = document.createElement("div");
    d.textContent = msg;
    out.prepend(d);
    while (out.childElementCount > 80) out.removeChild(out.lastChild);
  } catch {}
}

if (window.alt1) {
  alt1.identifyAppUrl("./appconfig.json");
} else {
  const url = new URL("./appconfig.json", document.location.href).href;
  document.body.innerHTML = `Alt1 not detected, click <a href="alt1://addapp/${url}">here</a> to add this app.`;
}

/* ─────────────────────────────────────────────
 * Small UI toggles
 * ────────────────────────────────────────────*/
(function injectToggles(){
  const style = document.createElement("style");
  style.textContent = `
  .ah-toggle{position:fixed;z-index:11000;font-size:12px;opacity:.9;background:#222;border:1px solid #444;border-radius:4px;cursor:pointer;padding:4px 8px;line-height:1}
  .ah-toggle:hover{opacity:1}
  #ah-logs{top:6px;right:8px}
  #ah-ticks{top:6px;left:8px}
  .logs-hidden #output{display:none!important}`;
  document.head.appendChild(style);

  const logs = document.createElement("button");
  logs.id="ah-logs"; logs.className="ah-toggle"; logs.textContent="📝 Logs: On";
  const ticks = document.createElement("button");
  ticks.id="ah-ticks"; ticks.className="ah-toggle"; ticks.textContent="Tick/ms: 600";
  document.body.appendChild(logs); document.body.appendChild(ticks);

  // logs
  const savedLogs = localStorage.getItem("amascut.logsVisible");
  const visible = savedLogs === null ? true : savedLogs === "true";
  document.body.classList.toggle("logs-hidden", !visible);
  logs.textContent = `📝 Logs: ${visible ? "On" : "Off"}`;
  logs.addEventListener("click", () => {
    const nv = document.body.classList.toggle("logs-hidden") ? "Off" : "On";
    logs.textContent = `📝 Logs: ${nv}`;
    try { localStorage.setItem("amascut.logsVisible", String(nv === "On")); } catch {}
  });

  // ticks
  let saved = Number(localStorage.getItem("amascut.tickMs"));
  window.tickMs = (saved === 100 || saved === 600) ? saved : 600;
  ticks.textContent = `Tick/ms: ${window.tickMs}`;
  ticks.addEventListener("click", () => {
    window.tickMs = window.tickMs === 600 ? 100 : 600;
    ticks.textContent = `Tick/ms: ${window.tickMs}`;
    try { localStorage.setItem("amascut.tickMs", String(window.tickMs)); } catch {}
    // live-rebuild the snuff interval if running
    if (startSnuffedTimers._iv) {
      try { clearInterval(startSnuffedTimers._iv); } catch {}
      startSnuffedTimers._iv = makeSnuffedInterval();
    }
  });
})();

/* ─────────────────────────────────────────────
 * Overlay helpers (centered in RS window)
 * ────────────────────────────────────────────*/
const GROUP = "amascut-style-overlay";
const PANEL_W = 360;
const ROW_H = 66;
const GAP = 10;
const FONT_PX = 28;
const SHOW_MS_DEFAULT = 6000;

const COLOR = {
  red:   A1lib.mixColor(220,  50,  50, 255),
  green: A1lib.mixColor( 50, 190,  70, 255),
  blue:  A1lib.mixColor( 60, 110, 230, 255),
  white: A1lib.mixColor(255, 255, 255, 255),
  grey:  A1lib.mixColor(185, 185, 185, 255),
  frame: A1lib.mixColor(90,  90,  90, 255)
};

function rsCenteredXY(panelH) {
  const x = alt1.rsX + Math.floor((alt1.rsWidth  - PANEL_W) / 2);
  const y = alt1.rsY + Math.floor((alt1.rsHeight - panelH) / 2);
  return { x, y };
}

function overlayClear() {
  try { alt1.overLayClearGroup(GROUP); } catch {}
}

function overlayRow(label, x, y, isActive, hue, ms) {
  alt1.overLaySetGroup(GROUP);
  // thin framed rect for readability
  alt1.overLayRect(COLOR.frame, x, y, PANEL_W, ROW_H, ms, 2);
  const tx = x + 16;
  const ty = y + Math.floor(ROW_H * 0.66);
  const textColor = isActive ? COLOR.white : COLOR.grey;
  // little colored “pill” at the left to match the role
  alt1.overLayRect(hue, x + 8, y + Math.floor(ROW_H/2 - 8), 12, 16, ms, 12);
  alt1.overLayText(label, textColor, FONT_PX, tx, ty, ms);
}

function showOrderOverlay(order, highlightIndex = 0, ms = SHOW_MS_DEFAULT) {
  if (!window.alt1 || !alt1.permissionOverlay || !alt1.rsLinked) return;
  overlayClear();

  const panelH = ROW_H * order.length + GAP * (order.length - 1);
  const { x, y } = rsCenteredXY(panelH);

  const hue = (role) => role === "Melee" ? COLOR.red : role === "Range" ? COLOR.green : COLOR.blue;

  order.forEach((role, i) => {
    const yy = y + i * (ROW_H + GAP);
    overlayRow(role, x, yy, i === highlightIndex, hue(role), ms);
  });
}

function showSoloOverlay(role, ms = 4000) {
  showOrderOverlay([role], 0, ms);
}

/* ─────────────────────────────────────────────
 * Minimal in-page table helpers (fallback/debug)
 * ────────────────────────────────────────────*/
function setRow(i, text) {
  const rows = document.querySelectorAll("#spec tr");
  if (!rows[i]) return;
  const cell = rows[i].querySelector("td");
  if (cell) cell.textContent = text;
  rows[i].style.display = "table-row";
  rows[i].classList.add("selected","callout","flash");
}
function clearRow(i) {
  const rows = document.querySelectorAll("#spec tr");
  if (!rows[i]) return;
  rows[i].style.display = "none";
  rows[i].classList.remove("selected","callout","flash","role-range","role-magic","role-melee");
  const cell = rows[i].querySelector("td");
  if (cell) cell.textContent = "";
}
function resetUI() {
  const rows = document.querySelectorAll(
