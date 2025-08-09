A1lib.identifyApp("appconfig.json");

// logger
function log(msg) {
  console.log(msg);
  const out = document.getElementById("output");
  if (!out) return;
  const d = document.createElement("div");
  d.textContent = msg;
  out.prepend(d);
  while (out.childElementCount > 50) out.removeChild(out.lastChild);
}

// Alt1 / browser
if (window.alt1) {
  alt1.identifyAppUrl("./appconfig.json");
} else {
  const url = new URL("./appconfig.json", document.location.href).href;
  document.body.innerHTML =
    `Alt1 not detected, click <a href="alt1://addapp/${url}">here</a> to add this app.`;
}

// reader
const reader = new Chatbox.default();

// turn off diff filtering (we’ll scan all boxes every tick)
reader.diffRead = false;
reader.diffReadUseTimestamps = false;
reader.minoverlap = 0;

/* -------- colors (broad) -------- */
const ALL_CHAT_COLORS = [
  [0,255,0],[0,255,255],[0,175,255],[0,0,255],[255,82,86],
  [159,255,159],[0,111,0],[255,143,143],[255,152,31],[255,111,0],
  [255,255,0],[239,0,175],[255,79,255],[175,127,255],[191,191,191],
  [127,255,255],[128,0,0],[255,255,255],[127,169,255],[255,140,56],
  [255,0,0],[69,178,71],[164,153,125],[215,195,119],[255,255,176],
].map(c => A1lib.mixColor(c[0], c[1], c[2]));

reader.readargs = { colors: ALL_CHAT_COLORS, backwards: true };

/* -------- nudges (no images) -------- */
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
// order: "[" → digits → "] " → pick body color → ":" → punctuation
const forwardnudges = [
  { match: /^$/, fn(ctx){ const c=OCR.readChar(ctx.imgdata,ctx.font,[255,255,255],ctx.rightx,ctx.baseliney,false,false); if(c?.chr==="["){ addFrag(ctx,{color:[255,255,255],index:-1,text:"[",xstart:ctx.rightx,xend:ctx.rightx+c.basechar.width}); return true; } } },
  { match: /.*/, fn(ctx){ const l=OCR.readLine(ctx.imgdata,ctx.font,ctx.colors,ctx.rightx,ctx.baseliney,true,false); if(l.text){ l.fragments.forEach(f=>addFrag(ctx,f)); return true; } } },
  { match: /\[[\w: ]+$/, fn(ctx){ const c=OCR.readChar(ctx.imgdata,ctx.font,[255,255,255],ctx.rightx,ctx.baseliney,false,false); if(c?.chr==="]"){ addFrag(ctx,{color:[255,255,255],index:-1,text:"] ",xstart:ctx.rightx,xend:ctx.rightx+c.basechar.width+ctx.font.spacewidth}); return true; } } },
  { match: /(^|\]|:)( ?)$/i, fn(ctx,m){ const addspace=!m[2]; const x=ctx.rightx+(addspace?ctx.font.spacewidth:0);
      let best=null,col=null; for(const c of ctx.colors){ const info=OCR.readChar(ctx.imgdata,ctx.font,c,x,ctx.baseliney,false,false); if(info && (!best || info.sizescore<best.sizescore)){ best=info; col=c; } }
      if(col){ const l=OCR.readLine(ctx.imgdata,ctx.font,col,x,ctx.baseliney,true,false); if(l.text){ if(addspace) addFrag(ctx,{color:[255,255,255],index:-1,text:" ",xstart:ctx.rightx,xend:x}); l.fragments.forEach(f=>addFrag(ctx,f)); return true; } } } },
  { match: /\w$/, fn(ctx){ const x=ctx.rightx; const c=OCR.readChar(ctx.imgdata,ctx.font,[255,255,255],x,ctx.baseliney,false,true); if(c?.chr === ":"){ addFrag(ctx,{color:[255,255,255],index:-1,text:": ",xstart:x,xend:x+c.basechar.width+ctx.font.spacewidth}); return true; } } },
  { match: /\S$/, fn(ctx){ const c=OCR.readChar(ctx.imgdata,ctx.font,[255,255,255],ctx.rightx,ctx.baseliney,false,false); if(!c) return;
      if([",",".","!","?"].includes(c.chr)){ addFrag(ctx,{color:[255,255,255],index:-1,text:c.chr,xstart:ctx.rightx,xend:ctx.rightx+c.basechar.width});
        const sp=OCR.readChar(ctx.imgdata,ctx.font,[255,255,255],ctx.rightx,ctx.baseliney,false,false);
        if(sp?.chr===" "){ addFrag(ctx,{color:[255,255,255],index:-1,text:" ",xstart:ctx.rightx,xend:ctx.rightx+ctx.font.spacewidth}); }
        return true; } } },
];
const backwardnudges = [
  { match: /.*/, fn(ctx){ const l=OCR.readLine(ctx.imgdata,ctx.font,ctx.colors,ctx.leftx,ctx.baseliney,false,true); if(l.text){ l.fragments.reverse().forEach(f=>addFrag(ctx,f)); return true; } } },
  { match: /^\w/, fn(ctx){ let x=ctx.leftx-ctx.font.spacewidth; const c=OCR.readChar(ctx.imgdata,ctx.font,[255,255,255],x,ctx.baseliney,false,true); if(c?.chr === ":"){ x-=c.basechar.width; addFrag(ctx,{color:[255,255,255],index:-1,text:": ",xstart:x,xend:x+c.basechar.width+ctx.font.spacewidth}); return true; } } },
  { match: /^\S/, fn(ctx){ let x=ctx.leftx-ctx.font.spacewidth; const c=OCR.readChar(ctx.imgdata,ctx.font,[255,255,255],x,ctx.baseliney,false,true); if(!c) return; if([",",".","!","?"].includes(c.chr)){ x-=c.basechar.width; addFrag(ctx,{color:[255,255,255],index:-1,text:c.chr+" ",xstart:x,xend:x+c.basechar.width+ctx.font.spacewidth}); return true; } } },
];
reader.forwardnudges = forwardnudges;
reader.backwardnudges = backwardnudges;

/* -------- UI logic -------- */
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

/* -------- robust text matching -------- */
function normalize(s) {
  return s.toLowerCase()
    .replace(/[\[\]\.\',;:_\-!?()]/g, " ")
    .replace(/[|!ijl1]/g, "l")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
let lastSig = ""; let lastAt = 0;
function triggerUpdate(key, src) {
  const now = Date.now();
  const sig = key + "|" + src.slice(-120);
  if (sig !== lastSig || (now - lastAt) > 1500) {
    lastSig = sig; lastAt = now;
    log(`✅ matched ${key}`);
    updateUI(key);
  }
}

/* -------- read helpers -------- */
// read every found chat box once per tick
function readAllBoxes() {
  if (!reader.pos) return [];
  const backup = reader.pos.mainbox;
  let all = [];
  for (const box of reader.pos.boxes) {
    try {
      reader.pos.mainbox = box;
      const segs = reader.read() || [];
      // tag with type so we can debug which box produced it
      for (const s of segs) all.push({ text: s.text, _type: box.type });
    } catch {}
  }
  reader.pos.mainbox = backup;
  return all;
}

/* -------- polling -------- */
function readChatbox() {
  let segs = [];
  try { segs = readAllBoxes(); }
  catch (e) { log("⚠️ read failed; Alt1 Pixel permission?"); return; }
  if (!segs.length) return;

  const texts = segs.map(s => (s.text || "").trim()).filter(Boolean);
  if (!texts.length) return;

  // debug last few segments
  log("segs: " + JSON.stringify(texts.slice(-8)));

  const full = texts.join(" ");
  const norm = normalize(full);

  // only react to Amascut lines to avoid false positives
  if (/amascut/.test(norm) || /amascu/.test(norm)) {
    if (/\bweak\b/.test(norm) || /\bwea?k\b/.test(norm))           return triggerUpdate("weak", norm);
    if (/\bgrovel\b/.test(norm) || /\bgravel\b/.test(norm))        return triggerUpdate("grovel", norm);
    if (/\bpathetic\b/.test(norm) || /\bpathet(ic)?\b/.test(norm)) return triggerUpdate("pathetic", norm);
  }
}

// start
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
