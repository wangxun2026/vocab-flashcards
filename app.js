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

function buildReviewQueue() {
  const today = todayStr();
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
  document.getElementById("review-count").textContent = `${reviewQueue.length} due`;
}

document.getElementById("flashcard").addEventListener("click", () => {
  if (!currentCard || revealed) return;
  revealed = true;
  document.getElementById("card-back").innerHTML = cardBackHtml(currentCard);
  document.getElementById("card-hint").style.display = "none";
  document.getElementById("review-controls").style.display = "flex";
});

function gradeCard(knewIt) {
  if (!currentCard) return;
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

// ---------- Add ----------
function renderAdd() {
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
        <button class="ndr-delete-btn" title="Delete">✕</button>
      </div>
      <input type="text" placeholder="Definition" class="ndr-def-input" />
      <input type="text" placeholder="Context — sentence, or where you saw it" class="ndr-ctx-input" />
      <input type="text" placeholder="Morphology — roots, prefix, suffix" class="ndr-morph-input" />
      <input type="text" placeholder="Synonyms" class="ndr-syn-input" />
      <div class="ndr-footer">
        <select class="ndr-cat-select">
          <option value="general">general</option>
          <option value="chemistry">chemistry</option>
          <option value="lanthanides">lanthanides</option>
        </select>
        <button class="ndr-save-btn">Save</button>
      </div>
    `;
    row.querySelector(".ndr-cat-select").value = c.category || "general";
    row.querySelector(".ndr-save-btn").addEventListener("click", () => {
      const def = row.querySelector(".ndr-def-input").value.trim();
      if (!def) return; // definition is the minimum for a reviewable card
      c.definition = def;
      c.context = row.querySelector(".ndr-ctx-input").value.trim();
      c.morphology = row.querySelector(".ndr-morph-input").value.trim();
      c.synonyms = row.querySelector(".ndr-syn-input").value.trim();
      c.category = row.querySelector(".ndr-cat-select").value;
      saveCards(cards);
      renderAdd();
    });
    row.querySelector(".ndr-delete-btn").addEventListener("click", () => {
      cards = cards.filter((x) => x.id !== c.id);
      saveCards(cards);
      renderAdd();
    });
    list.appendChild(row);
  });
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
  const list = document.getElementById("browse-list");
  const search = document.getElementById("browse-search").value.trim().toLowerCase();
  const filterCat = document.getElementById("browse-filter").value;
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
    row.innerHTML = `
      <div class="browse-row-main">
        <div class="browse-word">${escapeHtml(c.word)} <span class="browse-cat">${escapeHtml(c.category)}</span></div>
        <div class="browse-def">${escapeHtml(c.definition || "(no definition yet)")}</div>
        ${extras}
        <div class="browse-meta">box ${c.box} · due ${c.dueDate}</div>
      </div>
      <button class="browse-delete-btn" title="Delete">✕</button>
    `;
    row.querySelector(".browse-delete-btn").addEventListener("click", () => {
      cards = cards.filter((x) => x.id !== c.id);
      saveCards(cards);
      renderBrowse();
    });
    list.appendChild(row);
  });
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
