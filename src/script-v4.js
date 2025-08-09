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

// Amascut name color
const AMASCUT_COLOR = A1lib.mixColor(69, 131, 145);

// Amascut text color (green)
const AMASCUT_TEXT_COLOR = A1lib.mixColor(153, 255, 153);

// White for punctuation/timestamps
const WHITE = A1lib.mixColor(255, 255, 255);

reader.readargs = {
  colors: [AMASCUT_COLOR, AMASCUT_TEXT_COLOR, WHITE],
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

let lastMsg = "";
let lastAt = 0;

function readChatbox() {
  let segs;
  try {
    segs = reader.read() || [];
  } catch (e) {
    log("⚠️ reader.read() failed; check Alt1 Pixel permission.");
    return;
  }
  if (!segs.length) return;

  // Find any line starting with Amascut's name color
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (!s.fragments || s.fragments.length === 0) continue;

    const firstColor = A1lib.mixColor(
      s.fragments[0].color[0],
      s.fragments[0].color[1],
      s.fragments[0].color[2]
    );

    if (firstColor === AMASCUT_COLOR && s.text.includes("Amascut")) {
      let fullMsg = s.text;

      // Merge following green lines
      for (let j = i + 1; j < segs.length; j++) {
        if (!segs[j].fragments || segs[j].fragments.length === 0) break;
        const fragColor = A1lib.mixColor(
          segs[j].fragments[0].color[0],
          segs[j].fragments[0].color[1],
          segs[j].fragments[0].color[2]
        );
        if (fragColor === AMASCUT_TEXT_COLOR) {
          fullMsg += " " + segs[j].text;
        } else {
          break;
        }
      }

      const now = Date.now();
      if (fullMsg !== lastMsg || now - lastAt > 1500) {
        lastMsg = fullMsg;
        lastAt = now;
        log(`💬 Amascut says: ${fullMsg}`);
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
