const STORAGE_KEY = "vocab_cards_v1";
const BOX_INTERVALS_DAYS = [1, 1, 2, 4, 8, 16]; // index = box (1-5 used), box 0 unused

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadCards() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    // Migrate cards saved before context/morphology/synonyms fields existed
    const parsed = JSON.parse(raw);
    parsed.forEach((c) => {
      if (c.context === undefined) c.context = "";
      if (c.morphology === undefined) c.morphology = "";
      if (c.synonyms === undefined) c.synonyms = "";
    });
    return parsed;
  }
  const seeded = SEED_CARDS.map((c) => ({
    id: uid(),
    word: c.word,
    definition: c.definition,
    context: c.context || "",
    morphology: c.morphology || "",
    synonyms: c.synonyms || "",
    category: c.category,
    box: 1,
    dueDate: todayStr(),
    createdAt: todayStr(),
  }));
  saveCards(seeded);
  return seeded;
}

function saveCards(cards) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

let cards = loadCards();

// ---------- Tab switching ----------
const views = {
  review: document.getElementById("view-review"),
  add: document.getElementById("view-add"),
  browse: document.getElementById("view-browse"),
};
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    Object.values(views).forEach((v) => v.classList.remove("active"));
    views[btn.dataset.view].classList.add("active");
    if (btn.dataset.view === "review") renderReview();
    if (btn.dataset.view === "add") renderAdd();
    if (btn.dataset.view === "browse") renderBrowse();
  });
});

// ---------- Review ----------
let reviewQueue = [];
let currentCard = null;
let revealed = false;
let practiceMode = false;

function buildReviewQueue() {
  const today = todayStr();
  if (practiceMode) return; // practice queue is managed manually
  reviewQueue = cards.filter((c) => c.definition && c.dueDate <= today);
}

function cardBackHtml(c) {
  let html = "";
  if (c.definition) html += `<div class="back-section"><div class="back-label">definition</div><div>${escapeHtml(c.definition)}</div></div>`;
  if (c.context) html += `<div class="back-section"><div class="back-label">context</div><div>${escapeHtml(c.context)}</div></div>`;
  if (c.morphology) html += `<div class="back-section"><div class="back-label">morphology</div><div>${escapeHtml(c.morphology)}</div></div>`;
  if (c.synonyms) html += `<div class="back-section"><div class="back-label">synonyms</div><div>${escapeHtml(c.synonyms)}</div></div>`;
  return html;
}

function renderReview() {
  buildReviewQueue();
  revealed = false;
  const empty = document.getElementById("review-empty");
  const cardEl = document.getElementById("flashcard");
  const controls = document.getElementById("review-controls");
  if (reviewQueue.length === 0) {
    practiceMode = false;
    empty.style.display = "block";
    cardEl.style.display = "none";
    controls.style.display = "none";
    return;
  }
  empty.style.display = "none";
  cardEl.style.display = "flex";
  controls.style.display = "none";
  currentCard = reviewQueue[0];
  document.getElementById("card-word").textContent = currentCard.word;
  document.getElementById("card-back").innerHTML = "";
  document.getElementById("card-category").textContent = currentCard.category;
  document.getElementById("card-hint").style.display = "block";
  document.getElementById("review-count").textContent = practiceMode
    ? `${reviewQueue.length} to practice`
    : `${reviewQueue.length} due`;
}

document.getElementById("btn-practice").addEventListener("click", () => {
  practiceMode = true;
  reviewQueue = cards
    .filter((c) => c.definition)
    .slice()
    .sort(() => Math.random() - 0.5);
  renderReview();
});

document.getElementById("flashcard").addEventListener("click", () => {
  if (!currentCard || revealed) return;
  revealed = true;
  document.getElementById("card-back").innerHTML = cardBackHtml(currentCard);
  document.getElementById("card-hint").style.display = "none";
  document.getElementById("review-controls").style.display = "flex";
});

function gradeCard(knewIt) {
  if (!currentCard) return;
  if (practiceMode) {
    // Practice doesn't advance the schedule; a miss still resets the card
    if (!knewIt) {
      currentCard.box = 1;
      currentCard.dueDate = addDays(todayStr(), BOX_INTERVALS_DAYS[1]);
      saveCards(cards);
    }
    reviewQueue.shift();
    renderReview();
    return;
  }
  if (knewIt) {
    currentCard.box = Math.min(currentCard.box + 1, BOX_INTERVALS_DAYS.length - 1);
  } else {
    currentCard.box = 1;
  }
  currentCard.dueDate = addDays(todayStr(), BOX_INTERVALS_DAYS[currentCard.box]);
  saveCards(cards);
  renderReview();
}

document.getElementById("btn-again").addEventListener("click", () => gradeCard(false));
document.getElementById("btn-good").addEventListener("click", () => gradeCard(true));

// ---------- Groups ----------
function allGroups() {
  return [...new Set(cards.map((c) => c.category).filter(Boolean))].sort();
}

function refreshGroupDatalist() {
  const dl = document.getElementById("group-datalist");
  dl.innerHTML = allGroups().map((g) => `<option value="${escapeHtml(g)}"></option>`).join("");
}

// ---------- Add ----------
function renderAdd() {
  refreshGroupDatalist();
  const list = document.getElementById("needs-details-list");
  list.innerHTML = "";
  const needsDetails = cards.filter((c) => !c.definition);
  document.getElementById("needs-details-count").textContent = needsDetails.length;
  needsDetails.forEach((c) => {
    const row = document.createElement("div");
    row.className = "needs-details-row";
    row.innerHTML = `
      <div class="ndr-header">
        <div class="ndr-word">${escapeHtml(c.word)}</div>
        <div class="ndr-header-btns">
          <button class="ndr-autofill-btn">Auto-fill</button>
          <button class="ndr-delete-btn" title="Delete">✕</button>
        </div>
      </div>
      <input type="text" placeholder="Definition" class="ndr-def-input" />
      <input type="text" placeholder="Context — sentence, or where you saw it" class="ndr-ctx-input" />
      <input type="text" placeholder="Morphology — roots, prefix, suffix" class="ndr-morph-input" />
      <input type="text" placeholder="Synonyms" class="ndr-syn-input" />
      <div class="ndr-footer">
        <input type="text" class="ndr-cat-select" list="group-datalist" placeholder="Group — by meaning/theme" />
        <button class="ndr-save-btn">Save</button>
      </div>
    `;
    row.querySelector(".ndr-cat-select").value = c.category === "general" ? "" : c.category || "";
    row.querySelector(".ndr-save-btn").addEventListener("click", () => {
      const def = row.querySelector(".ndr-def-input").value.trim();
      if (!def) return; // definition is the minimum for a reviewable card
      c.definition = def;
      c.context = row.querySelector(".ndr-ctx-input").value.trim();
      c.morphology = row.querySelector(".ndr-morph-input").value.trim();
      c.synonyms = row.querySelector(".ndr-syn-input").value.trim();
      c.category = row.querySelector(".ndr-cat-select").value.trim().toLowerCase() || "general";
      saveCards(cards);
      renderAdd();
    });
    row.querySelector(".ndr-delete-btn").addEventListener("click", () => {
      cards = cards.filter((x) => x.id !== c.id);
      saveCards(cards);
      renderAdd();
    });
    row.querySelector(".ndr-autofill-btn").addEventListener("click", async (e) => {
      const btn = e.target;
      btn.textContent = "…";
      btn.disabled = true;
      try {
        const entry = await lookupWord(c.word);
        if (entry.definition) row.querySelector(".ndr-def-input").value = entry.definition;
        if (entry.example) row.querySelector(".ndr-ctx-input").value = entry.example;
        if (entry.morphology) row.querySelector(".ndr-morph-input").value = entry.morphology;
        if (entry.synonyms) row.querySelector(".ndr-syn-input").value = entry.synonyms;
        btn.textContent = "Auto-fill";
      } catch {
        btn.textContent = "Not found";
      }
      btn.disabled = false;
    });
    list.appendChild(row);
  });
}

async function lookupWord(word) {
  const [dict, morphology] = await Promise.all([
    lookupDictionary(word).catch(() => null),
    lookupMorphology(word).catch(() => ""),
  ]);
  if (!dict && !morphology) throw new Error("lookup failed");
  return {
    definition: dict ? dict.definition : "",
    example: dict ? dict.example : "",
    synonyms: dict ? dict.synonyms : "",
    morphology,
  };
}

async function lookupDictionary(word) {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`);
  if (!res.ok) throw new Error("lookup failed");
  const data = await res.json();
  const meanings = (data[0] && data[0].meanings) || [];
  let definition = "";
  let example = "";
  const synonyms = new Set();
  for (const m of meanings) {
    for (const d of m.definitions || []) {
      if (!definition && d.definition) {
        definition = m.partOfSpeech ? `(${m.partOfSpeech}) ${d.definition}` : d.definition;
      }
      if (!example && d.example) example = d.example;
      (d.synonyms || []).forEach((s) => synonyms.add(s));
    }
    (m.synonyms || []).forEach((s) => synonyms.add(s));
  }
  return { definition, example, synonyms: [...synonyms].slice(0, 6).join(", ") };
}

// ---------- Wiktionary etymology (fills the morphology field) ----------
const WIKT_LANG_NAMES = {
  en: "English", grc: "Ancient Greek", la: "Latin", "la-new": "New Latin",
  ang: "Old English", enm: "Middle English", fro: "Old French", frm: "Middle French",
  fr: "French", de: "German", nl: "Dutch", it: "Italian", es: "Spanish", pt: "Portuguese",
  "la-lat": "Late Latin", "la-med": "Medieval Latin", "la-vul": "Vulgar Latin", "la-ecc": "Ecclesiastical Latin",
  el: "Greek", "gem-pro": "Proto-Germanic", "ine-pro": "Proto-Indo-European", sa: "Sanskrit",
  ar: "Arabic", he: "Hebrew", ja: "Japanese", zh: "Chinese", ru: "Russian", non: "Old Norse",
  gml: "Middle Low German", egy: "Egyptian", akk: "Akkadian", sq: "Albanian", hy: "Armenian",
  fa: "Persian", tr: "Turkish", ko: "Korean", sv: "Swedish", da: "Danish", no: "Norwegian",
  is: "Icelandic", ga: "Irish", cy: "Welsh", mul: "multiple languages",
};

function wiktCleanToken(token) {
  let gloss = "";
  const tGloss = token.match(/<t:([^<>]*)>/);
  if (tGloss) gloss = tGloss[1];
  // Annotations can nest (Serendip<ety:der<en:Serendib>>) — strip innermost first
  let text = token;
  for (let i = 0; i < 5 && /<[^<>]*>/.test(text); i++) {
    text = text.replace(/<[^<>]*>/g, "");
  }
  text = text.replace(/[<>]/g, "").trim();
  const langWord = text.match(/^([a-z]{2,3}(?:-[a-z]+)?):(.+)$/);
  if (langWord && WIKT_LANG_NAMES[langWord[1]]) {
    text = `${WIKT_LANG_NAMES[langWord[1]]} ${langWord[2]}`;
  }
  return { text, gloss };
}

function renderWiktTemplate(raw) {
  const parts = raw.split("|");
  const name = parts[0].trim().toLowerCase();
  const positional = [];
  const named = {};
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    const eq = p.indexOf("=");
    if (eq > -1 && /^[a-zA-Z0-9]+$/.test(p.slice(0, eq))) {
      named[p.slice(0, eq)] = p.slice(eq + 1);
    } else {
      positional.push(p);
    }
  }
  const SKIP = ["root", "wp", "chemical element box", "col", "col3", "col4", "senseid", "lb", "qualifier", "enpr", "ipa", "audio", "der2", "der3"];
  if (SKIP.includes(name)) return "";

  // {{doublet|en|terbium|ytterbium}} — words sharing this word's origin
  if (name === "doublet") {
    const words = positional.slice(1).map((p) => p.trim()).filter(Boolean);
    return words.length ? `doublet of ${words.join(", ")}` : "";
  }

  // {{w|Johan Gadolin}} / {{w|Margaret Todd (doctor)|Margaret Todd}} — Wikipedia link
  if (name === "w") {
    return (positional[1] || positional[0] || "").trim();
  }

  // {{coin|en|Margaret Todd|in=1909}} — who coined the word
  if (name === "coin") {
    const raw = positional.slice(1).find((p) => p.trim()) || named.w || "";
    // Some entries name the coiner only by Wikidata ID, which we can't resolve
    const who = /^Q\d+$/.test(raw.trim()) ? "" : raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (!who) return named.in ? `coined in ${named.in}` : "";
    return named.in ? `coined by ${who} in ${named.in}` : `coined by ${who}`;
  }

  if (["m", "l", "term", "mention", "link"].includes(name)) {
    const word = (positional[2] && positional[2].trim()) ? positional[2] : positional[1];
    const gloss = positional[3] || named.t || "";
    if (!word) return "";
    return gloss ? `${word.trim()} (${gloss.trim()})` : word.trim();
  }

  if (["bor", "bor+", "der", "der+", "uder", "inh", "inh+", "borrowed", "derived", "inherited", "cog", "cognate"].includes(name)) {
    // {{der|en|la|Holmia||Stockholm}} → [origLang, word, altDisplay, gloss]
    const rest = positional.slice(1); // drop leading lang-of-the-result code
    const langName = (WIKT_LANG_NAMES[rest[0]] || rest[0] || "").trim();
    const word = (rest[1] || "").trim();
    const gloss = (named.t || named.t1 || named.qq || rest[3] || "").trim();
    // "-" is Wiktionary's placeholder for "language only, no specific word"
    const base = word && word !== "-" ? `${langName} ${word}` : langName;
    if (!base) return "";
    return gloss ? `${base} (${gloss})` : base;
  }

  // Affix-like families: af, affix, prefix, suffix, suf, pre, confix, compound, com, ety
  let rest = positional.slice(1); // drop leading lang-of-the-result code
  rest = rest.filter((t) => !t.trim().startsWith(":"));
  if (rest.length === 0) return "";
  const isSuffix = ["suf", "suffix"].includes(name);
  const rendered = rest
    .map((t, idx) => {
      const { text, gloss } = wiktCleanToken(t);
      if (!text) return null;
      const g = gloss || named["t" + (idx + 1)] || named["gloss" + (idx + 1)] || (rest.length === 1 ? named.t || named.gloss : "");
      // {{suffix|en||ium}} means the affix "-ium"; restore the hyphen it implies
      let shown = isSuffix && idx === rest.length - 1 && !text.startsWith("-") ? `-${text}` : text;
      // {{af|en|lang1=grc|λανθάνω|...}} names each part's language in a separate param
      const langCode = named["lang" + (idx + 1)];
      if (langCode && WIKT_LANG_NAMES[langCode]) shown = `${WIKT_LANG_NAMES[langCode]} ${shown}`;
      return g ? `${shown} (${g})` : shown;
    })
    .filter(Boolean);
  return rendered.join(" + ");
}

function cleanWikitext(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/'''([^']*)'''/g, "$1")
    .replace(/''([^']*)''/g, "$1");
}

function renderEtymology(raw) {
  let text = raw;
  // {{ety|...|tree=1}} is a structured tree that usually restates the prose
  // below it. Keep it only when it is the entire etymology.
  const withoutTree = text.replace(/\{\{ety\|[^{}]*\}\}/g, "").trim();
  if (withoutTree.replace(/[\s.,;]/g, "").length > 0) text = withoutTree;

  for (let pass = 0; pass < 3; pass++) {
    text = text.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => renderWiktTemplate(inner));
  }
  text = cleanWikitext(text);
  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .replace(/\s+([,.;])/g, "$1")
    .replace(/\.(\s*\.)+/g, ".")
    .replace(/^[,.\s]+/, "")
    .replace(/([.!?]\s+)([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase())
    .replace(/^([a-z])/, (ch) => ch.toUpperCase())
    .trim();
  return text;
}

async function lookupMorphology(word) {
  const candidates = [...new Set([word, word.toLowerCase()])];
  for (const title of candidates) {
    const res = await fetch(
      `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2&origin=*`
    );
    if (!res.ok) continue;
    const data = await res.json();
    if (data.error) continue;
    const wikitext = data.parse.wikitext;
    const engMatch = wikitext.match(/==English==[\s\S]*?(?=\n==[^=]|$)/);
    if (!engMatch) continue;
    const etyMatch = engMatch[0].match(/===\s*Etymology[^=]*===\n([\s\S]*?)(?=\n===|\n==[^=]|$)/);
    if (!etyMatch) continue;
    const rendered = renderEtymology(etyMatch[1]);
    if (rendered) return rendered;
  }
  return "";
}

document.getElementById("quick-add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("quick-add-input");
  const word = input.value.trim();
  if (!word) return;
  cards.push({
    id: uid(),
    word,
    definition: "",
    context: "",
    morphology: "",
    synonyms: "",
    category: "general",
    box: 1,
    dueDate: todayStr(),
    createdAt: todayStr(),
  });
  saveCards(cards);
  input.value = "";
  input.focus();
  renderAdd();
});

// ---------- Browse ----------
function renderBrowse() {
  const filterEl = document.getElementById("browse-filter");
  const prevFilter = filterEl.value;
  filterEl.innerHTML =
    '<option value="all">all</option>' +
    allGroups().map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
  filterEl.value = [...filterEl.options].some((o) => o.value === prevFilter) ? prevFilter : "all";
  const list = document.getElementById("browse-list");
  const search = document.getElementById("browse-search").value.trim().toLowerCase();
  const filterCat = filterEl.value;
  list.innerHTML = "";
  const filtered = cards.filter((c) => {
    const haystack = [c.word, c.definition, c.context, c.morphology, c.synonyms].join(" ").toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    const matchesCat = filterCat === "all" || c.category === filterCat;
    return matchesSearch && matchesCat;
  });
  document.getElementById("browse-count").textContent = `${filtered.length} / ${cards.length} words`;
  filtered.forEach((c) => {
    const row = document.createElement("div");
    row.className = "browse-row";
    const extras = [
      c.context ? `<div class="browse-extra"><span class="browse-extra-label">ctx</span> ${escapeHtml(c.context)}</div>` : "",
      c.morphology ? `<div class="browse-extra"><span class="browse-extra-label">morph</span> ${escapeHtml(c.morphology)}</div>` : "",
      c.synonyms ? `<div class="browse-extra"><span class="browse-extra-label">syn</span> ${escapeHtml(c.synonyms)}</div>` : "",
    ].join("");
    const dueNow = c.dueDate <= todayStr();
    row.innerHTML = `
      <div class="browse-row-main">
        <div class="browse-word">${escapeHtml(c.word)} <span class="browse-cat">${escapeHtml(c.category)}</span></div>
        <div class="browse-def">${escapeHtml(c.definition || "(no definition yet)")}</div>
        ${extras}
        <div class="browse-meta">box ${c.box} · ${dueNow ? "due now" : "due " + c.dueDate}</div>
      </div>
      <div class="browse-row-btns">
        <button class="browse-due-btn" title="Review now">${dueNow ? "✓" : "↺"}</button>
        <button class="browse-edit-btn" title="Edit">✎</button>
        <button class="browse-delete-btn" title="Delete">✕</button>
      </div>
    `;
    const dueBtn = row.querySelector(".browse-due-btn");
    if (dueNow) dueBtn.disabled = true;
    dueBtn.addEventListener("click", () => {
      c.dueDate = todayStr();
      saveCards(cards);
      renderBrowse();
    });
    row.querySelector(".browse-edit-btn").addEventListener("click", () => {
      renderEditForm(row, c);
    });
    row.querySelector(".browse-delete-btn").addEventListener("click", () => {
      if (!confirm(`Delete "${c.word}"?`)) return;
      cards = cards.filter((x) => x.id !== c.id);
      saveCards(cards);
      renderBrowse();
    });
    list.appendChild(row);
  });
}

function renderEditForm(row, c) {
  refreshGroupDatalist();
  row.className = "needs-details-row";
  row.innerHTML = `
    <div class="ndr-header">
      <input type="text" class="edit-word" placeholder="Word" />
    </div>
    <input type="text" class="edit-def" placeholder="Definition" />
    <input type="text" class="edit-ctx" placeholder="Context — sentence, or where you saw it" />
    <input type="text" class="edit-morph" placeholder="Morphology — roots, prefix, suffix" />
    <input type="text" class="edit-syn" placeholder="Synonyms" />
    <div class="ndr-footer">
      <input type="text" class="edit-cat" list="group-datalist" placeholder="Group — by meaning/theme" />
      <button class="edit-cancel-btn">Cancel</button>
      <button class="ndr-save-btn edit-save-btn">Save</button>
    </div>
  `;
  row.querySelector(".edit-word").value = c.word;
  row.querySelector(".edit-def").value = c.definition;
  row.querySelector(".edit-ctx").value = c.context;
  row.querySelector(".edit-morph").value = c.morphology;
  row.querySelector(".edit-syn").value = c.synonyms;
  row.querySelector(".edit-cat").value = c.category === "general" ? "" : c.category;
  row.querySelector(".edit-save-btn").addEventListener("click", () => {
    const word = row.querySelector(".edit-word").value.trim();
    if (!word) return;
    c.word = word;
    c.definition = row.querySelector(".edit-def").value.trim();
    c.context = row.querySelector(".edit-ctx").value.trim();
    c.morphology = row.querySelector(".edit-morph").value.trim();
    c.synonyms = row.querySelector(".edit-syn").value.trim();
    c.category = row.querySelector(".edit-cat").value.trim().toLowerCase() || "general";
    saveCards(cards);
    renderBrowse();
  });
  row.querySelector(".edit-cancel-btn").addEventListener("click", renderBrowse);
}

document.getElementById("browse-search").addEventListener("input", renderBrowse);
document.getElementById("browse-filter").addEventListener("change", renderBrowse);

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Init ----------
renderReview();

// ---------- Service worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
