/* -------------------------------------------
 * Amascut Helper — Single File w/ Skillbert-Style Nudges
 * -------------------------------------------
 */

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

/* ---------- Colors ---------- */
const COLORS = [
  [0,255,0],[0,255,255],[0,175,255],[0,0,255],[255,82,86],
  [159,255,159],[0,111,0],[255,143,143],[255,152,31],[255,111,0],
  [255,255,0],[239,0,175],[255,79,255],[175,127,255],[191,191,191],
  [127,255,255],[128,0,0],[255,255,255],[127,169,255],[255,140,56],
  [255,0,0],[69,178,71],[164,153,125],[215,195,119],[255,255,176]
].map(c => A1lib.mixColor(c[0], c[1], c[2]));

const KEYWORD_GREEN = A1lib.mixColor(153,255,153);
if (!COLORS.includes(KEYWORD_GREEN)) COLORS.unshift(KEYWORD_GREEN);

reader.readargs = { colors: COLORS, backwards: true };

/* ---------- Nudges (Skillbert style) ---------- */
function addFragShim(ctx, frag) {
  if (typeof ctx.addfrag === "function") {
    ctx.addfrag(frag);
    return;
  }
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

function checkchatbadge() { return false; }

const forwardnudges = [
  {
    match: /^$/,
    name: "timestampopen",
    fn(ctx) {
      const c = OCR.readChar(ctx.imgdata, ctx.font, [255,255,255], ctx.rightx, ctx.baseliney, false, false);
      if (c && c.chr === "[") {
        addFragShim(ctx, { color:[255,255,255], index:-1, text:"[", xstart:ctx.rightx, xend:ctx.rightx + c.basechar.width });
        return true;
      }
    }
  },
  { match: /(\] ?|news: ?|^)$/i, name: "badge", fn: checkchatbadge },
  {
    match: /.*/,
    name: "body",
    fn(ctx) {
      const data = OCR.readLine(ctx.imgdata, ctx.font, ctx.colors, ctx.rightx, ctx.baseliney, true, false);
      if (data.text) {
        data.fragments.forEach(f => addFragShim(ctx, f));
        return true;
      }
    }
  },
  {
    match: /\[[\w: ]+$/,
    name: "timestampclose",
    fn(ctx) {
      const c = OCR.readChar(ctx.imgdata, ctx.font, [255,255,255], ctx.rightx, ctx.baseliney, false, false);
      if (c && c.chr === "]") {
        addFragShim(ctx, { color:[255,255,255], index:-1, text:"] ", xstart:ctx.rightx, xend:ctx.rightx + c.basechar.width + ctx.font.spacewidth });
        return true;
      }
    }
  },
  {
    match: /(^|\]|:)( ?)$/i,
    name: "startline",
    fn(ctx, m) {
      const addspace = !m[2];
      const x = ctx.rightx + (addspace ? ctx.font.spacewidth : 0);
      let bestInfo = null, bestColor = null;
      for (const col of ctx.colors) {
        const info = OCR.readChar(ctx.imgdata, ctx.font, col, x, ctx.baseliney, false, false);
        if (info && (!bestInfo || info.sizescore < bestInfo.sizescore)) {
          bestInfo = info; bestColor = col;
        }
      }
      if (bestColor) {
        const line = OCR.readLine(ctx.imgdata, ctx.font, bestColor, x, ctx.baseliney, true, false);
        if (line.text) {
          if (addspace) addFragShim(ctx, { color:[255,255,255], index:-1, text:" ", xstart:ctx.rightx, xend:x });
          line.fragments.forEach(f => addFragShim(ctx, f));
          return true;
        }
      }
    }
  },
  {
    match: /\w$/,
    name: "whitecolon",
    fn(ctx) {
      const x = ctx.rightx;
      const c = OCR.readChar(ctx.imgdata, ctx.font, [255,255,255], x, ctx.baseliney, false, true);
      if (c && c.chr === ":") {
        addFragShim(ctx, { color:[255,255,255], index:-1, text:": ", xstart:x, xend:x + c.basechar.width + ctx.font.spacewidth });
        return true;
      }
    }
  }
];

const backwardnudges = [
  { match: /^(news: |[\w\-_]{1,12}: )/i, name: "badge", fn: checkchatbadge },
  {
    match: /.*/,
    name: "body",
    fn(ctx) {
      const data = OCR.readLine(ctx.imgdata, ctx.font, ctx.colors, ctx.leftx, ctx.baseliney, false, true);
      if (data.text) {
        data.fragments.reverse().forEach(f => addFragShim(ctx, f));
        return true;
      }
    }
  },
  {
    match: /^\w/,
    name: "whitecolon",
    fn(ctx) {
      let x = ctx.leftx - ctx.font.spacewidth;
      const c = OCR.readChar(ctx.imgdata, ctx.font, [255,255,255], x, ctx.baseliney, false, true);
      if (c && c.chr === ":") {
        x -= c.basechar.width;
        addFragShim(ctx, { color:[255,255,255], index:-1, text:": ", xstart:x, xend:x + c.basechar.width + ctx.font.spacewidth });
        return true;
      }
    }
  }
];

reader.forwardnudges = forwardnudges;
reader.backwardnudges = backwardnudges;

/* ---------- Game Logic ---------- */
const RESPONSES = {
  weak: "Range > Magic > Melee",
  grovel: "Magic > Melee > Range",
  pathetic: "Melee > Range > Magic"
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

function normalize(s) {
  return s.toLowerCase()
    .replace(/[\[\]\.\',;:_\-!?()]/g, " ")
    .replace(/[|!ijl1]/g, "l")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

let lastSig = "", lastAt = 0;
function triggerUpdate(key, src) {
  const now = Date.now();
  const sig = key + "|" + src.slice(-120);
  if (sig !== lastSig || (now - lastAt) > 1500) {
    lastSig = sig; lastAt = now;
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
  const norm = normalize(texts.join(" "));

  if (!/\bamas?cu?t\b/.test(norm)) return;

  if (/\bweak\b/.test(norm)) return triggerUpdate("weak", norm);
  if (/\bgrovel\b/.test(norm)) return triggerUpdate("grovel", norm);
  if (/\bpathetic\b/.test(norm)) return triggerUpdate("pathetic", norm);
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
        setInterval(readChatbox, 250);
      }
    } catch (e) {
      log("⚠️ " + (e && e.message ? e.message : e));
    }
  }, 800);
}, 50);
