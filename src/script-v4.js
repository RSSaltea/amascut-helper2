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

const LIME_GREENS = [
  A1lib.mixColor(0,255,0),     // bright green
  A1lib.mixColor(145,255,145),
  A1lib.mixColor(148,255,148),
  A1lib.mixColor(150,255,150),
  A1lib.mixColor(153,255,153),
  A1lib.mixColor(156,255,156),
  A1lib.mixColor(159,255,159),
  A1lib.mixColor(162,255,162),
  A1lib.mixColor(0,111,0)      // dark green
];

const GENERAL_CHAT = [
  A1lib.mixColor(255,255,255),  // white
  A1lib.mixColor(127,169,255),  // public chat blue
  A1lib.mixColor(102,152,255),  // drops blue
  A1lib.mixColor(67,188,188),   // teal
  A1lib.mixColor(255,255,0),    // yellow
  A1lib.mixColor(235,47,47)     // red
];

reader.readargs = {
  colors: [...LIME_GREENS, ...GENERAL_CHAT],
  backwards: true
};

// --- helper used by nudges ---
function addFrag(ctx, frag) {
  if (ctx.forward) {
    ctx.fragments.push(frag);
    ctx.text += frag.text;
    ctx.rightx = frag.xend;
  } else {
    ctx.fragments.unshift(frag);
    ctx.text = frag.text + ctx.text;
    ctx.leftx = frag.xstart;
  }
}

/* ---------- nudges (ported & trimmed to match your script) ---------- */
const forwardnudges = [
  // 1) "[" at start of timestamp (white)
  {
    match: /^$/,
    fn(ctx) {
      const c = OCR.readChar(ctx.imgdata, ctx.font, [255,255,255], ctx.rightx, ctx.baseliney, false, false);
      if (c && c.chr === "[") {
        addFrag(ctx, { color:[255,255,255], index:-1, text:"[", xstart:ctx.rightx, xend:ctx.rightx + c.basechar.width });
        return true;
      }
    }
  },

  // 2) generic forward body read (multi-color) — this pulls the timestamp digits
  {
    match: /.*/,
    fn(ctx) {
      const line = OCR.readLine(ctx.imgdata, ctx.font, ctx.colors, ctx.rightx, ctx.baseliney, true, false);
      if (line.text) {
        line.fragments.forEach(f => addFrag(ctx, f));
        return true;
      }
    }
  },

  // 3) "] " at end of timestamp (white)
  {
    match: /\[[\w: ]+$/,
    fn(ctx) {
      const c = OCR.readChar(ctx.imgdata, ctx.font, [255,255,255], ctx.rightx, ctx.baseliney, false, false);
      if (c && c.chr === "]") {
        addFrag(ctx, { color:[255,255,255], index:-1, text:"] ", xstart:ctx.rightx, xend:ctx.rightx + c.basechar.width + ctx.font.spacewidth });
        return true;
      }
    }
  },

  // 4) choose best body color after "]" or ":" (so we lock onto green text)
  {
    match: /(^|\]|:)( ?)$/i,
    fn(ctx, m) {
      const addspace = !m[2];
      const x = ctx.rightx + (addspace ? ctx.font.spacewidth : 0);

      let bestInfo = null, bestCol = null;
      for (const col of ctx.colors) {
        const info = OCR.readChar(ctx.imgdata, ctx.font, col, x, ctx.baseliney, false, false);
        if (info && (!bestInfo || info.sizescore < bestInfo.sizescore)) {
          bestInfo = info; bestCol = col;
        }
      }
      if (bestCol) {
        const line = OCR.readLine(ctx.imgdata, ctx.font, bestCol, x, ctx.baseliney, true, false);
        if (line.text) {
          if (addspace) addFrag(ctx, { color:[255,255,255], index:-1, text:" ", xstart:ctx.rightx, xend:x });
          line.fragments.forEach(f => addFrag(ctx, f));
          return true;
        }
      }
    }
  },

  // 5) white ":" between name and body
  {
    match: /\w$/,
    fn(ctx) {
      const x = ctx.rightx;
      const c = OCR.readChar(ctx.imgdata, ctx.font, [255,255,255], x, ctx.baseliney, false, true);
      if (c && c.chr === ":") {
        addFrag(ctx, { color:[255,255,255], index:-1, text:": ", xstart:x, xend:x + c.basechar.width + ctx.font.spacewidth });
        return true;
      }
    }
  },

  // 6) bridge white punctuation (comma/period/etc) inside names/text
  {
    match: /\S$/,
    fn(ctx) {
      const c = OCR.readChar(ctx.imgdata, ctx.font, [255,255,255], ctx.rightx, ctx.baseliney, false, false);
      if (!c) return;
      const ch = c.chr;
      if (ch === "," || ch === "." || ch === "!" || ch === "?") {
        addFrag(ctx, { color:[255,255,255], index:-1, text: ch, xstart:ctx.rightx, xend:ctx.rightx + c.basechar.width });
        const sp = OCR.readChar(ctx.imgdata, ctx.font, [255,255,255], ctx.rightx, ctx.baseliney, false, false);
        if (sp && sp.chr === " ") {
          addFrag(ctx, { color:[255,255,255], index:-1, text:" ", xstart:ctx.rightx, xend:ctx.rightx + ctx.font.spacewidth });
        }
        return true;
      }
    }
  },
];

const backwardnudges = [
  // 1) generic backward body read
  {
    match: /.*/,
    fn(ctx) {
      const line = OCR.readLine(ctx.imgdata, ctx.font, ctx.colors, ctx.leftx, ctx.baseliney, false, true);
      if (line.text) {
        line.fragments.reverse().forEach(f => addFrag(ctx, f));
        return true;
      }
    }
  },
  // 2) white ":" before the name (backward scan)
  {
    match: /^\w/,
    fn(ctx) {
      let x = ctx.leftx - ctx.font.spacewidth;
      const c = OCR.readChar(ctx.imgdata, ctx.font, [255,255,255], x, ctx.baseliney, false, true);
      if (c && c.chr === ":") {
        x -= c.basechar.width;
        addFrag(ctx, { color:[255,255,255], index:-1, text:": ", xstart:x, xend:x + c.basechar.width + ctx.font.spacewidth });
        return true;
      }
    }
  },
  // 3) bridge white punctuation when going backward
  {
    match: /^\S/,
    fn(ctx) {
      let x = ctx.leftx - ctx.font.spacewidth;
      const c = OCR.readChar(ctx.imgdata, ctx.font, [255,255,255], x, ctx.baseliney, false, true);
      if (!c) return;
      const ch = c.chr;
      if (ch === "," || ch === "." || ch === "!" || ch === "?") {
        x -= c.basechar.width;
        addFrag(ctx, { color:[255,255,255], index:-1, text: ch + " ", xstart:x, xend:x + c.basechar.width + ctx.font.spacewidth });
        return true;
      }
    }
  },
];

// attach to reader
reader.forwardnudges = forwardnudges;
reader.backwardnudges = backwardnudges;

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

let lastSig = "";
let lastAt = 0;

function readChatbox() {
  let segs = [];
  try { segs = reader.read() || []; } catch (e) {
    log("⚠️ reader.read() failed; check Alt1 Pixel permission.");
    return;
  }
  if (!segs.length) return;

  const texts = segs.map(s => (s.text || "").trim()).filter(Boolean);
  if (!texts.length) return;

  log("segs: " + JSON.stringify(texts.slice(-6)));

  const full = texts.join(" ").toLowerCase();

  let key = null;
  if (full.includes("weak")) key = "weak";
  else if (full.includes("grovel")) key = "grovel";
  else if (full.includes("pathetic")) key = "pathetic";

  if (key) {
    const now = Date.now();
    const sig = key + "|" + full;
    if (sig !== lastSig || (now - lastAt) > 1500) {
      lastSig = sig;
      lastAt = now;
      log(`✅ matched ${key}`);
      updateUI(key);
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
        log("✅ chatbox found");
        showSelected(reader.pos);
        setInterval(readChatbox, 300);
      }
    } catch (e) {
      log("⚠️ " + (e && e.message ? e.message : e));
    }
  }, 800);
}, 50);
