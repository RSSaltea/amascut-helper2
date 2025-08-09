// Identify app
A1lib.identifyApp("appconfig.json");

// simple logger
function log(msg) {
  console.log(msg);
  const out = document.getElementById("output");
  if (!out) return;
  const d = document.createElement("div");
  d.textContent = msg;
  out.prepend(d);
  while (out.childElementCount > 50) out.removeChild(out.lastChild);
}

// detect Alt1 / add link for browser
if (window.alt1) {
  alt1.identifyAppUrl("./appconfig.json");
} else {
  const url = new URL("./appconfig.json", document.location.href).href;
  document.body.innerHTML =
    `Alt1 not detected, click <a href="alt1://addapp/${url}">here</a> to add this app.`;
}

// chat reader
const reader = new Chatbox.default();

/* ---------- colors ---------- */
const LIME_GREENS = [
  A1lib.mixColor(145,255,145),
  A1lib.mixColor(148,255,148),
  A1lib.mixColor(150,255,150),
  A1lib.mixColor(153,255,153),
  A1lib.mixColor(156,255,156),
  A1lib.mixColor(159,255,159),
  A1lib.mixColor(162,255,162),
];

const GENERAL_CHAT = [
  A1lib.mixColor(255,255,255),  // white (timestamp / punctuation)
  A1lib.mixColor(127,169,255),  // public blue
  A1lib.mixColor(102,152,255),  // drops blue
  A1lib.mixColor(67,188,188),   // teal
  A1lib.mixColor(255,255,0),    // yellow
  A1lib.mixColor(235,47,47),    // red
];

reader.readargs = {
  colors: [...LIME_GREENS, ...GENERAL_CHAT],
  backwards: true
};

/* ---------- lightweight nudges (no images) ----------

These help the OCR “walk” the line:
- timestamp open '[' and close ']' (white)
- choose best color at start-of-body (after ']' or ': ')
- insert ": " between name and message when the colon is white
- run a generic forward/backward body read to pull the rest

They are adapted to the public OCR API available from
https://www.unpkg.com/alt1/dist/ocr/index.js
*/
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

const forwardnudges = [
  // first char could be the white '[' of the timestamp
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
  // try to read a chunk in the dominant color (best “sizescore” at cursor)
  {
    match: /.*/,
    fn(ctx) {
      let bestCol = null, bestInfo = null;
      for (const col of ctx.colors) {
        const info = OCR.readChar(ctx.imgdata, ctx.font, col, ctx.rightx, ctx.baseliney, false, false);
        if (info && (!bestInfo || info.sizescore < bestInfo.sizescore)) {
          bestInfo = info; bestCol = col;
        }
      }
      if (bestCol) {
        const line = OCR.readLine(ctx.imgdata, ctx.font, bestCol, ctx.rightx, ctx.baseliney, true, false);
        if (line.text) {
          line.fragments.forEach(f => addFrag(ctx, f));
          return true;
        }
      }
    }
  },
  // close timestamp: white ']' followed by a space
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
  // white ':' between name and message, add ": "
  {
    match: /\w$/,
    fn(ctx) {
      const startx = ctx.rightx;
      const c = OCR.readChar(ctx.imgdata, ctx.font, [255,255,255], startx, ctx.baseliney, false, true);
      if (c && c.chr === ":") {
        addFrag(ctx, { color:[255,255,255], index:-1, text:": ", xstart:startx, xend:startx + c.basechar.width + ctx.font.spacewidth });
        return true;
      }
    }
  },
];

const backwardnudges = [
  // body (right-to-left)
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
  // white ':' before the name when scanning backward
  {
    match: /^\w/,
    fn(ctx) {
      let startx = ctx.leftx - ctx.font.spacewidth;
      const c = OCR.readChar(ctx.imgdata, ctx.font, [255,255,255], startx, ctx.baseliney, false, true);
      if (c && c.chr === ":") {
        startx -= c.basechar.width;
        addFrag(ctx, { color:[255,255,255], index:-1, text:": ", xstart:startx, xend:startx + c.basechar.width + ctx.font.spacewidth });
        return true;
      }
    }
  },
];

// attach nudges (supported by the built-in reader)
reader.forwardnudges = forwardnudges;
reader.backwardnudges = backwardnudges;

/* ---------- app logic ---------- */
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

function showSelected(chat) {
  try {
    alt1.overLayRect(
      A1lib.mixColor(0,255,0),
      chat.mainbox.rect.x, chat.mainbox.rect.y,
      chat.mainbox.rect.width, chat.mainbox.rect.height,
      2000, 5
    );
  } catch {}
}

let lastSig = "";
let lastAt = 0;

function triggerUpdate(key, sigSource) {
  const now = Date.now();
  const sig = key + "|" + sigSource;
  if (sig !== lastSig || (now - lastAt) > 1500) {
    lastSig = sig;
    lastAt = now;
    log(`✅ matched ${key}`);
    updateUI(key);
  }
}

function readChatbox() {
  let segs = [];
  try { segs = reader.read() || []; }
  catch (e) { log("⚠️ reader.read() failed; check Alt1 Pixel permission."); return; }
  if (!segs.length) return;

  const texts = segs.map(s => (s.text || "").trim()).filter(Boolean);
  if (!texts.length) return;

  log("segs: " + JSON.stringify(texts.slice(-6)));

  const full = texts.join(" ").toLowerCase();
  if (full.includes("weak"))      return triggerUpdate("weak", full);
  if (full.includes("grovel"))    return triggerUpdate("grovel", full);
  if (full.includes("pathetic"))  return triggerUpdate("pathetic", full);
}

// bind & loop
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
