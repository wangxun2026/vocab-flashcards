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
