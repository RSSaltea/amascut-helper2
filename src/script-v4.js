A1lib.identifyApp("appconfig.json");

// ----- logger -----
function log(msg) {
  console.log(msg);
  const out = document.getElementById("output");
  if (!out) return;
  const d = document.createElement("div");
  d.textContent = msg;
  out.prepend(d);
  while (out.childElementCount > 60) out.removeChild(out.lastChild);
}

// ----- Alt1 detection -----
if (window.alt1) {
  alt1.identifyAppUrl("./appconfig.json");
} else {
  const url = new URL("./appconfig.json", document.location.href).href;
  document.body.innerHTML = `Alt1 not detected, click <a href="alt1://addapp/${url}">here</a> to add this app.`;
}

// ----- chat reader -----
const reader = new Chatbox.default();

// colors (RGB)
const NAME_RGB = [69, 131, 145];      // "Amascut, the Devourer"
const TEXT_RGB = [153, 255, 153];     // her green speech
const WHITE_RGB = [255, 255, 255];

// allow slight antialiasing drift
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
    A1lib.mixColor(127,169,255) // timestamp/public blue
  ],
  backwards: true
};

// overlay helper (visual sanity check)
function outlineChat() {
  try {
    const b = reader.pos.mainbox.rect;
    alt1.overLayRect(A1lib.mixColor(0, 255, 0), b.x, b.y, b.width, b.height, 2000, 3);
  } catch {}
}

let lastMsg = "";
let lastAt = 0;

function grabFirstNonWhiteColor(seg) {
  if (!seg.fragments) return null;
  for (const f of seg.fragments) {
    const c = f.color;
    if (!isColorNear(c, WHITE_RGB)) return c;
  }
  return null;
}

function readChatbox() {
  let lines = [];
  try { lines = reader.read() || []; }
  catch (e) { log("⚠️ reader.read() failed; enable Pixel permission?"); return; }
  if (!lines.length) return;

  // walk through lines; when we see the name color anywhere in the line,
  // treat it as the start of Amascut's message
  for (let i = 0; i < lines.length; i++) {
    const seg = lines[i];
    if (!seg.fragments || seg.fragments.length === 0) continue;

    // does this line contain a fragment near NAME_RGB AND the text mentions "Amascut"?
    const hasNameColor = seg.fragments.some(f => isColorNear(f.color, NAME_RGB));
    if (!hasNameColor || !/Amascut/i.test(seg.text)) continue;

    // start building the full message:
    // include the part after the first ":" on THIS SAME LINE (covers single-line calls)
    let full = seg.text;
    const colonIdx = full.indexOf(":");
    if (colonIdx !== -1) full = full.slice(colonIdx + 1).trim();

    // now append any following lines whose first non-white fragment is near TEXT_RGB
    for (let j = i + 1; j < lines.length; j++) {
      const s2 = lines[j];
      if (!s2.fragments || s2.fragments.length === 0) break;
      const firstNonWhite = grabFirstNonWhiteColor(s2);
      if (firstNonWhite && isColorNear(firstNonWhite, TEXT_RGB)) {
        full += " " + s2.text.trim();
      } else {
        break;
      }
    }

    const now = Date.now();
    if (full && (full !== lastMsg || now - lastAt > 1500)) {
      lastMsg = full;
      lastAt = now;
      log("💬 Amascut says → " + full);
    }
  }
}

// ----- start -----
setTimeout(() => {
  const finder = setInterval(() => {
    try {
      if (reader.pos === null) {
        log("🔍 finding chatbox...");
        reader.find();
      } else {
        clearInterval(finder);
        log("✅ chatbox found");
        outlineChat();
        setInterval(readChatbox, 250);
      }
    } catch (e) {
      log("⚠️ " + (e?.message || e));
    }
  }, 800);
}, 50);
