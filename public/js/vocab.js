/**
 * 词途 - TOEFL 词汇学习伙伴 v2
 * 艾宾浩斯复习 · 游戏化 · 正向心理循环
 */

const STORAGE_KEY = "toefl_vocab_buddy_v2";
const STORAGE_KEY_V1 = "toefl_vocab_buddy_v1";

function storageKey(userId) {
  if (userId === "guest") return `${STORAGE_KEY}_guest`;
  return `${STORAGE_KEY}_u${userId}`;
}

function loadStateFromKey(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const s = { ...defaultState(), ...JSON.parse(raw) };
      if (!s.wordSRS) s.wordSRS = {};
      return s;
    }
  } catch (_) {}
  return defaultState();
}

function migrateLegacyStorage() {
  try {
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy && !localStorage.getItem(storageKey("guest"))) {
      localStorage.setItem(storageKey("guest"), legacy);
    }
  } catch (_) {}
}

/** 复习间隔（天）：对应 24h内、一周内、7天、14天巩固 */
const SRS_INTERVALS = [1, 3, 7, 14, 30];
const QUIZ_INTERVAL_DAYS = 7;
const XP_MASTER = 10;
const XP_REVIEW = 15;
const XP_CHECKIN = 5;
const XP_QUIZ = 20;
const XP_GAME = 8;
const XP_PER_LEVEL = 100;

const BADGES = {
  first_word: { icon: "🌱", name: "初识一词" },
  streak_3: { icon: "🔥", name: "连续3天" },
  streak_7: { icon: "⭐", name: "连续7天" },
  review_10: { icon: "🧠", name: "复习达人" },
  quiz_pass: { icon: "🎯", name: "周测及格" },
  xp_100: { icon: "💎", name: "百点经验" },
  game_50: { icon: "🎮", name: "闯关高手" },
};

const TOEFL_WORDS = [
  "abundant", "accumulate", "acute", "advocate", "ambiguous", "analogy",
  "anticipate", "arbitrary", "assert", "assess", "attribute", "authentic",
  "bias", "capacity", "coherent", "commence", "compensate", "component",
  "comprehensive", "concept", "conclude", "conduct", "conflict", "consent",
  "consequence", "considerable", "consistent", "constant", "constitute",
  "contrast", "contribute", "controversy", "conventional", "convince",
  "cooperate", "criteria", "crucial", "culture", "decline", "deduce",
  "define", "demonstrate", "deny", "derive", "device", "distinct",
  "distribute", "diverse", "domestic", "dominate", "duration", "dynamic",
  "economy", "element", "eliminate", "emerge", "emphasis", "empirical",
  "enable", "encounter", "enhance", "ensure", "entity", "environment",
  "equate", "equivalent", "establish", "estimate", "ethic", "evaluate",
  "eventual", "evident", "evolve", "exceed", "exclude", "exhibit",
  "expand", "expert", "explicit", "exploit", "export", "expose",
  "external", "facilitate", "factor", "feature", "finance", "flexible",
  "focus", "format", "formula", "foundation", "framework", "function",
  "fundamental", "furthermore", "generate", "generation", "globe", "grant",
  "guarantee", "guideline", "hence", "hypothesis", "identical", "identify",
  "illustrate", "impact", "implement", "implicit", "imply", "impose",
  "incentive", "incorporate", "index", "indicate", "individual", "induce",
  "inevitable", "infer", "infrastructure", "inherent", "initial", "initiate",
  "innovate", "insight", "inspect", "instance", "institute", "integrate",
  "integrity", "intelligence", "intense", "interact", "intermediate",
  "internal", "interpret", "interval", "intervene", "invest", "investigate",
  "involve", "isolate", "justify", "label", "layer", "lecture", "legal",
  "liberal", "license", "likewise", "link", "locate", "logic", "maintain",
  "manifest", "manipulate", "manual", "margin", "mature", "maximize",
  "mechanism", "mediate", "mental", "method", "migrate", "minimal", "minor",
  "mode", "modify", "monitor", "motive", "mutual", "negate", "network",
  "neutral", "nevertheless", "notion", "objective", "oblige", "obtain",
  "obvious", "occupy", "occur", "offset", "ongoing", "option", "orient",
  "outcome", "output", "overall", "overlap", "overseas", "panel", "parallel",
  "parameter", "participate", "partner", "passive", "perceive", "persist",
  "perspective", "phase", "phenomenon", "philosophy", "physical", "policy",
  "portion", "pose", "positive", "potential", "precede", "precise",
  "predict", "predominant", "preliminary", "presume", "previous", "primary",
  "principal", "principle", "prior", "priority", "proceed", "process",
  "professional", "prohibit", "project", "promote", "proportion", "prospect",
  "protocol", "psychology", "publication", "publish", "purchase", "pursue",
  "qualify", "quality", "quarter", "radical", "random", "range", "ratio",
  "rational", "react", "recover", "refine", "reflect", "reform", "regime",
  "region", "register", "regulate", "reinforce", "reject", "relevant", "rely",
  "require", "research", "resolve", "resource", "respond", "restore",
  "restrain", "restrict", "retain", "reveal", "revenue", "reverse", "revise",
  "rigid", "role", "route", "scenario", "schedule", "scheme", "scope",
  "section", "sector", "secure", "seek", "select", "sequence", "series",
  "shift", "significant", "similar", "simulate", "site", "sole", "somewhat",
  "source", "specific", "specify", "sphere", "stable", "statistic", "status",
  "straightforward", "strategy", "stress", "structure", "style", "submit",
  "subsequent", "subsidy", "substitute", "successor", "sufficient", "summary",
  "supplement", "survey", "survive", "suspend", "sustain", "symbol", "target",
  "technical", "technique", "technology", "temporary", "tense", "terminate",
  "theme", "theory", "thereby", "thesis", "topic", "trace", "tradition",
  "transfer", "transform", "transit", "transmit", "transport", "trend",
  "trigger", "ultimate", "undergo", "underlie", "undertake", "uniform",
  "unify", "unique", "utilize", "valid", "variable", "vary", "vehicle",
  "version", "via", "violate", "virtual", "visible", "vision", "visual",
  "volume", "voluntary", "welfare", "whereas", "whereby", "widespread",
  "willing", "withdraw", "witness", "workshop", "worldwide",
];

const IELTS_WORDS = [
  "accommodation", "adapt", "allocate", "alternative", "analysis", "approach",
  "approximate", "benefit", "category", "challenge", "circumstance", "community",
  "complex", "concentrate", "consider", "context", "create", "culture",
  "data", "decline", "demonstrate", "design", "dimension", "economy",
  "environment", "estimate", "evidence", "export", "factor", "feature",
  "finance", "function", "identify", "impact", "income", "interpret",
  "issue", "labour", "legal", "major", "method", "occur", "percent",
  "period", "policy", "principle", "process", "range", "research",
  "resource", "respond", "section", "significant", "similar", "source",
  "specific", "structure", "theory", "vary",
];

const WORD_BANKS = {
  toefl: { label: "TOEFL 高频", words: TOEFL_WORDS },
  ielts: { label: "IELTS 核心", words: IELTS_WORDS },
};

const MOOD_MESSAGES = {
  great: "状态很棒！今天可多学几个新词，或挑战周测～",
  ok: "平稳就好：新词 + 复习昨天到期的词，就是科学节奏。",
  tired: "累了就少学新词，优先复习到期的（24 小时内最容易忘）。",
  anxious: "别硬背。完成 1 个复习 + 打卡，就算打破「不想背」的循环。",
};

// CEFR 句子生成模板（根据不同等级生成不同难度）
const CEFR_TEMPLATES = {
  A1: [
    "I like to study English.",
    "The cat is on the table.",
    "I have a big family.",
    "The weather is nice today.",
    "I go to school by bus.",
  ],
  A2: [
    "Learning English is a great adventure.",
    "I want to express my ideas clearly.",
    "Yesterday was my birthday party.",
    "We built a big sandcastle today.",
    "I miss my best friend very much.",
  ],
  B1: [
    "Developing a study habit is crucial.",
    "Research shows that repetition is effective.",
    "The internet has changed how we talk.",
    "Music education improves cognitive abilities.",
    "It is important to respect local customs.",
  ],
  B2: [
    "Globalization has a complex impact on economies.",
    "Social media has revolutionized marketing strategies.",
    "AI offers personalized learning experiences.",
    "Habit formation follows a predictable pattern.",
    "Urban planning influences our quality of life.",
  ],
  C1: [
    "Natural language often contains inherent ambiguity.",
    "Scholars must be cognizant of subtle nuances.",
    "Neuroplasticity demonstrates the brain's capacity.",
    "Consequentialist theories evaluate actions by outcomes.",
    "Geopolitical tensions stem from resource allocation.",
  ],
};

const CHAT_TEMPLATES = [
  "That's a very interesting perspective on {word}. How do you think it relates to our current topic?",
  "I've noticed that {word} is often used in academic contexts. Can you give me another example of how you might use it?",
  "Wait, did you mean {word}? That's a great choice! It really adds a lot of depth to your argument.",
  "I completely agree. The concept of {word} is fundamental to understanding this issue. What else comes to mind?",
  "Let's try to incorporate {word} into a sentence about your daily life. How would that look?",
];

let state = defaultState();
let activeUserId = null;
let currentWord = "";
let currentAudioUrl = "";
let wordHistory = [];
let historyIndex = -1;
let activeListTab = "mastered";
let activeAiTab = "aiChat";
let selectedChatWords = [];
let chatCurrentWordIndex = 0;
let cefrCurrentText = "";
let cefrPlayCount = 0;
let studyMode = "learn"; // learn | review
let quizSession = null;
let totalReviewDone = 0;

function defaultState() {
  return {
    wordSRS: {},
    mastered: [],
    favorites: [],
    definitionsCache: {},
    dailyGoal: 3,
    todayDate: "",
    todayNewCount: 0,
    todayReviewCount: 0,
    streak: 0,
    lastStudyDate: "",
    checkedInToday: false,
    lastCheckInDate: "",
    mood: "",
    moodDate: "",
    xp: 0,
    badges: [],
    lastQuizDate: "",
    quizBestScore: 0,
    gameBestScore: 0,
    totalReviews: 0,
    listOrder: { mastered: [], favorites: [] },
    recentSearches: [],
    examBank: "toefl",
    dailyPushEnabled: false,
    lastDailyNotificationDate: "",
  };
}

function migrateFromV1() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V1);
    if (!raw) return;
    const old = JSON.parse(raw);
    const s = defaultState();
    s.mastered = old.mastered || [];
    s.favorites = old.favorites || [];
    s.dailyGoal = old.dailyGoal ?? 3;
    s.streak = old.streak ?? 0;
    s.mood = old.mood || "";
    s.moodDate = old.moodDate || "";
    s.listOrder = old.listOrder || s.listOrder;
    const today = todayStr();
    for (const w of s.mastered) {
      s.wordSRS[w] = {
        learnedAt: today,
        stage: 0,
        nextReview: addDays(today, 1),
        reviewCount: 0,
      };
    }
    localStorage.setItem(storageKey("guest"), JSON.stringify(s));
  } catch (_) {}
}

function loadState() {
  migrateFromV1();
  migrateLegacyStorage();
  if (activeUserId !== null) {
    return loadStateFromKey(storageKey(activeUserId));
  }
  return loadStateFromKey(storageKey("guest"));
}

function hasProgress(s) {
  return (
    (s.mastered?.length || 0) > 0 ||
    (s.favorites?.length || 0) > 0 ||
    (s.xp || 0) > 0 ||
    Object.keys(s.wordSRS || {}).length > 0
  );
}

function refreshAllUI() {
  resetTodayIfNeeded();
  setStudyMode("learn");
  updateProgressUI();
  updateGamificationUI();
  restoreMoodUI();
  renderWordList();
  renderRecentSearches();
  renderBankWords();
  renderDailyRoutine();
  scheduleDailyReminder();
  showIdleCard();
}

async function persistBeforeLogout() {
  if (typeof activeUserId !== "number" || !Auth.isLoggedIn()) return;
  localStorage.setItem(storageKey(activeUserId), JSON.stringify(state));
  clearTimeout(syncTimer);
  try {
    await Auth.api("/api/progress", {
      method: "PUT",
      body: JSON.stringify({ progress: state }),
    });
  } catch (_) {}
}

function resetNavToHome() {
  document.querySelectorAll(".tab-bar .nav-btn[data-view]").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".bottom-panel").forEach((p) => p.classList.add("hidden"));
  document.querySelector('.tab-bar .nav-btn[data-view="home"]')?.classList.add("active");
  const main = document.getElementById("main-content");
  if (main) main.scrollTop = 0;
}

async function onUserChange(user, isGuest) {
  clearTimeout(syncTimer);
  resetNavToHome();

  if (user) {
    activeUserId = user.id;
    state = loadStateFromKey(storageKey(user.id));
    refreshAllUI();
    await syncFromCloud();
    return;
  }

  if (isGuest) {
    activeUserId = "guest";
    state = loadStateFromKey(storageKey("guest"));
    refreshAllUI();
    return;
  }

  activeUserId = null;
  state = defaultState();
  refreshAllUI();
}

let syncTimer = null;

function saveState() {
  if (activeUserId === null) return;
  localStorage.setItem(storageKey(activeUserId), JSON.stringify(state));
  if (typeof activeUserId === "number" && Auth.isLoggedIn()) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncToCloud, 1500);
  }
}

async function syncToCloud() {
  if (!Auth.isLoggedIn()) return;
  try {
    await Auth.api("/api/progress", {
      method: "PUT",
      body: JSON.stringify({ progress: state }),
    });
  } catch (_) {}
}

async function syncFromCloud() {
  if (!Auth.isLoggedIn()) return;
  const userId = Auth.getUser().id;
  activeUserId = userId;
  try {
    const data = await Auth.api("/api/progress");
    if (data.progress) {
      state = { ...defaultState(), ...data.progress };
      if (!state.wordSRS) state.wordSRS = {};
      localStorage.setItem(storageKey(userId), JSON.stringify(state));
      refreshAllUI();
      showToast("已从云端同步学习进度");
    } else {
      const local = loadStateFromKey(storageKey(userId));
      state = hasProgress(local) ? local : defaultState();
      localStorage.setItem(storageKey(userId), JSON.stringify(state));
      refreshAllUI();
      if (hasProgress(state)) {
        await syncToCloud();
      }
    }
  } catch (_) {}
}

function getRecentMasteredWords() {
  return [...(state.mastered || [])].slice(-10).reverse();
}

function getActiveBankWords() {
  return WORD_BANKS[state.examBank]?.words || TOEFL_WORDS;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function resetTodayIfNeeded() {
  const t = todayStr();
  if (state.todayDate !== t) {
    const prev = state.todayDate;
    if (prev && state.checkedInToday) {
      const diff = daysBetween(prev, t);
      if (diff === 1) state.streak += 1;
      else if (diff > 1) state.streak = 0;
    }
    state.todayDate = t;
    state.todayNewCount = 0;
    state.todayReviewCount = 0;
    state.checkedInToday = false;
  }
}

function getLevel() {
  return Math.floor(state.xp / XP_PER_LEVEL) + 1;
}

function addXP(amount, reason) {
  const prevLevel = getLevel();
  state.xp += amount;
  const newLevel = getLevel();
  saveState();
  updateGamificationUI();
  if (newLevel > prevLevel) {
    showToast(`🎉 升级！Lv.${newLevel} — ${reason}`);
    celebrateLevelUp();
  } else if (reason) {
    showToast(`+${amount} XP · ${reason}`);
  }
  checkBadges();
}

function celebrateLevelUp() {
  const bar = document.getElementById("xpBar");
  bar.classList.add("level-up");
  setTimeout(() => bar.classList.remove("level-up"), 600);
}

function awardBadge(id) {
  if (state.badges.includes(id)) return;
  state.badges.push(id);
  saveState();
  renderBadges();
  const b = BADGES[id];
  if (b) showToast(`🏅 解锁徽章：${b.icon} ${b.name}`);
}

function checkBadges() {
  if (state.mastered.length >= 1) awardBadge("first_word");
  if (state.streak >= 3) awardBadge("streak_3");
  if (state.streak >= 7) awardBadge("streak_7");
  if (state.totalReviews >= 10) awardBadge("review_10");
  if (state.xp >= 100) awardBadge("xp_100");
  if (state.gameBestScore >= 50) awardBadge("game_50");
}

function getDueWords() {
  const today = todayStr();
  return Object.entries(state.wordSRS)
    .filter(([, r]) => r.nextReview <= today)
    .map(([w]) => w)
    .sort((a, b) => state.wordSRS[a].nextReview.localeCompare(state.wordSRS[b].nextReview));
}

function getDaysToQuiz() {
  if (!state.lastQuizDate) {
    return state.mastered.length >= 5 ? 0 : "—";
  }
  const elapsed = daysBetween(state.lastQuizDate, todayStr());
  const left = Math.max(0, QUIZ_INTERVAL_DAYS - elapsed);
  return left;
}

function normalizeWord(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z'-]/g, "")
    .replace(/^['-]+|['-]+$/g, "");
}

function addRecentSearch(word) {
  if (!word) return;
  if (!state.recentSearches) state.recentSearches = [];
  state.recentSearches = [
    word,
    ...state.recentSearches.filter((w) => w !== word),
  ].slice(0, 8);
  saveState();
  renderRecentSearches();
}

function renderRecentSearches() {
  const el = document.getElementById("recentWords");
  if (!el) return;
  const list = state.recentSearches || [];
  if (!list.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = list
    .map(
      (w) =>
        `<button type="button" class="chip" data-word="${escapeHtml(w)}">${escapeHtml(w)}</button>`
    )
    .join("");
  el.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("wordInput").value = btn.dataset.word;
      lookupFromInput();
    });
  });
}

async function lookupFromInput() {
  const input = document.getElementById("wordInput");
  const word = normalizeWord(input.value);
  if (!word) {
    showToast("请输入英文单词");
    input.focus();
    return;
  }
  input.value = word;
  setStudyMode("learn");
  addRecentSearch(word);
  await loadWord(word, true);
}

function showIdleCard() {
  const card = document.getElementById("wordCard");
  card.classList.remove("loading", "error");
  card.innerHTML =
    '<p class="idle-text">在上方输入单词，或点「随机推荐一词」</p>';
  currentWord = "";
  currentAudioUrl = "";
  ["playAudioBtn", "favoriteBtn", "masteredBtn"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
}

function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function cacheDefinition(word, entry) {
  for (const m of entry.meanings || []) {
    const def = m.definitions?.[0]?.definition;
    if (def) {
      state.definitionsCache[word] = def.slice(0, 120);
      return;
    }
  }
}

function pickRandomNewWord() {
  const learned = new Set(Object.keys(state.wordSRS));
  const words = getActiveBankWords();
  const pool = words.filter((w) => !learned.has(w));
  if (pool.length === 0) {
    return words[Math.floor(Math.random() * words.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function getDailyWord() {
  const words = getActiveBankWords();
  const seed = todayStr().replace(/-/g, "").split("").reduce((sum, n) => sum + Number(n), 0);
  return words[seed % words.length];
}

function renderBankWords() {
  const el = document.getElementById("bankWords");
  const select = document.getElementById("examBankSelect");
  if (!el) return;
  if (select) select.value = state.examBank || "toefl";
  const learned = new Set([...(state.mastered || []), ...(state.favorites || [])]);
  el.innerHTML = getActiveBankWords()
    .slice(0, 18)
    .map((word) => {
      const cls = learned.has(word) ? "bank-chip saved" : "bank-chip";
      return `<button type="button" class="${cls}" data-word="${escapeHtml(word)}">${escapeHtml(word)}</button>`;
    })
    .join("");
  el.querySelectorAll(".bank-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("wordInput").value = btn.dataset.word;
      lookupFromInput();
    });
  });
}

function renderDailyRoutine() {
  const word = getDailyWord();
  const title = document.getElementById("dailyWordTitle");
  const meta = document.getElementById("dailyWordMeta");
  if (!title || !meta) return;
  title.textContent = word;
  const bank = WORD_BANKS[state.examBank]?.label || "TOEFL 高频";
  meta.textContent = `${bank} · 今日推荐 · ${state.dailyPushEnabled ? "提醒已开启" : "提醒未开启"}`;
}

function addManualWord() {
  const input = document.getElementById("manualWordInput");
  const word = normalizeWord(input?.value || "");
  if (!word) {
    showToast("请输入要加入词库的英文单词");
    input?.focus();
    return;
  }
  if (!state.favorites.includes(word)) state.favorites.push(word);
  if (!state.listOrder) state.listOrder = { mastered: [], favorites: [] };
  if (!state.listOrder.favorites) state.listOrder.favorites = [];
  if (!state.listOrder.favorites.includes(word)) state.listOrder.favorites.push(word);
  addRecentSearch(word);
  saveState();
  renderWordList();
  renderBankWords();
  input.value = "";
  showToast(`已加入个人词库：${word}`);
}

function notifyDailyWord() {
  if (!state.dailyPushEnabled || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const today = todayStr();
  if (state.lastDailyNotificationDate === today) return;
  const word = getDailyWord();
  new Notification("词途 · 今日单词", {
    body: `${word} · 点击应用开始学习`,
    tag: `word-of-the-day-${today}`,
  });
  state.lastDailyNotificationDate = today;
  saveState();
  renderDailyRoutine();
}

function scheduleDailyReminder() {
  if (!state.dailyPushEnabled) return;
  clearInterval(window.__dailyWordTimer);
  window.__dailyWordTimer = setInterval(notifyDailyWord, 60 * 1000);
}

async function enableDailyPush() {
  if (!("Notification" in window)) {
    showToast("当前浏览器不支持通知");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    showToast("通知权限未开启");
    return;
  }
  state.dailyPushEnabled = true;
  saveState();
  renderDailyRoutine();
  scheduleDailyReminder();
  notifyDailyWord();
  showToast("每日单词提醒已开启");
}

async function fetchDictionary(word) {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
  );
  if (!res.ok) throw new Error("词典未找到该词");
  const data = await res.json();
  return data[0];
}

function setStudyMode(mode) {
  studyMode = mode;
  const tag = document.getElementById("learnModeTag");
  if (tag) {
    tag.textContent = mode === "review" ? "复习模式" : "新词学习";
  }
  document.getElementById("learnActions").classList.toggle("hidden", mode === "review");
  document.getElementById("reviewActions").classList.toggle("hidden", mode !== "review");
}

function renderWordCard(entry, word) {
  const card = document.getElementById("wordCard");
  card.classList.remove("loading", "error");

  let phonetic = "";
  currentAudioUrl = "";
  if (entry.phonetics) {
    for (const p of entry.phonetics) {
      if (p.text && !phonetic) phonetic = p.text;
      if (p.audio && !currentAudioUrl) currentAudioUrl = p.audio;
    }
  }

  const srs = state.wordSRS[word];
  const srsHint =
    srs && studyMode === "learn"
      ? `<p class="srs-hint">下次复习：${srs.nextReview}（第 ${srs.stage + 1} 轮）</p>`
      : studyMode === "review"
        ? `<p class="srs-hint">⚡ 黄金复习时刻：学后 24 小时内 / 第一周内最容易忘</p>`
        : "";

  const meanings = (entry.meanings || [])
    .slice(0, 3)
    .map((m) => {
      const def = m.definitions?.[0];
      if (!def) return "";
      const ex = def.example
        ? `<p class="example">${escapeHtml(def.example)}</p>`
        : "";
      return `
        <div class="meaning-block">
          <span class="part-of-speech">${escapeHtml(m.partOfSpeech || "")}</span>
          <span>${escapeHtml(def.definition || "")}</span>
          ${ex}
        </div>`;
    })
    .join("");

  card.innerHTML = `
    <h3 class="word-title">${escapeHtml(word)}</h3>
    ${phonetic ? `<p class="phonetic">${escapeHtml(phonetic)}</p>` : ""}
    ${srsHint}
    ${meanings || "<p>暂无释义</p>"}
  `;

  const audioBtns = ["playAudioBtn", "playAudioReviewBtn"];
  audioBtns.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !currentAudioUrl;
  });
  document.getElementById("favoriteBtn").disabled = false;
  document.getElementById("masteredBtn").disabled =
    studyMode === "review" || !!state.wordSRS[word];
  updateFavoriteButton();
}

async function loadWord(word, pushHistory = true) {
  const card = document.getElementById("wordCard");
  card.classList.add("loading");
  card.innerHTML = '<p class="loading-text">正在从词典 API 获取…</p>';
  ["playAudioBtn", "favoriteBtn", "masteredBtn"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });

  currentWord = word;
  const input = document.getElementById("wordInput");
  if (input) input.value = word;
  const due = getDueWords();
  if (due.includes(word)) setStudyMode("review");
  else if (studyMode === "review" && !due.includes(word)) setStudyMode("learn");

  try {
    const entry = await fetchDictionary(word);
    cacheDefinition(word, entry);
    saveState();
    renderWordCard(entry, word);
    if (pushHistory) {
      if (historyIndex < wordHistory.length - 1) {
        wordHistory = wordHistory.slice(0, historyIndex + 1);
      }
      wordHistory.push(word);
      historyIndex = wordHistory.length - 1;
    }
  } catch (e) {
    card.classList.add("error");
    card.innerHTML = `<p class="loading-text">加载失败：${escapeHtml(e.message)}</p>`;
  }
}

function updateFavoriteButton() {
  const btn = document.getElementById("favoriteBtn");
  if (!btn) return;
  const fav = state.favorites.includes(currentWord);
  btn.textContent = fav ? "★ 已收藏" : "☆ 收藏";
}

function updateProgressUI() {
  resetTodayIfNeeded();
  document.getElementById("streakCount").textContent = state.streak;
  document.getElementById("todayCount").textContent = state.todayNewCount;
  document.getElementById("goalDisplay").textContent = state.dailyGoal;
  document.getElementById("dailyGoal").value = state.dailyGoal;
  document.getElementById("goalOutput").textContent = state.dailyGoal;

  const pct = Math.min(100, (state.todayNewCount / state.dailyGoal) * 100);
  document.getElementById("dailyProgressBar").style.width = `${pct}%`;

  const due = getDueWords();
  document.getElementById("dueReviewCount").textContent = due.length;
  document.getElementById("todayReviewDone").textContent = state.todayReviewCount;
  const dtq = getDaysToQuiz();
  document.getElementById("daysToQuiz").textContent =
    dtq === "—" ? "—" : dtq === 0 ? "今天!" : `${dtq}天`;

  document.getElementById("startReviewBtn").disabled = due.length === 0;
  renderDueList(due);

  const enc = document.getElementById("encouragement");
  const parts = [];
  if (state.todayNewCount >= state.dailyGoal) {
    parts.push("🎉 今日新词目标已达成！");
    enc.classList.add("done");
  } else {
    enc.classList.remove("done");
    parts.push(`新词还差 ${state.dailyGoal - state.todayNewCount} 个`);
  }
  if (due.length > 0) {
    parts.push(`另有 ${due.length} 个词到期复习（艾宾浩斯关键期）`);
  } else if (state.mastered.length > 0) {
    parts.push("暂无到期复习，真棒！");
  }
  enc.textContent = parts.join(" · ");

  const badge = document.getElementById("navDueBadge");
  if (badge) {
    if (due.length > 0) {
      badge.textContent = due.length;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  updateQuizBanner();
  updateCheckInButton();
}

function updateGamificationUI() {
  document.getElementById("levelDisplay").textContent = getLevel();
  document.getElementById("xpDisplay").textContent = state.xp;
  const inLevel = state.xp % XP_PER_LEVEL;
  document.getElementById("xpBar").style.width = `${(inLevel / XP_PER_LEVEL) * 100}%`;
  document.getElementById("gameScore").innerHTML =
    `最高分：<strong>${state.gameBestScore}</strong>`;
  renderBadges();
}

function renderBadges() {
  const row = document.getElementById("badgeRow");
  if (!state.badges.length) {
    row.innerHTML = '<span class="badge-empty">完成学习解锁徽章</span>';
    return;
  }
  row.innerHTML = state.badges
    .map((id) => {
      const b = BADGES[id];
      return b
        ? `<span class="badge" title="${escapeHtml(b.name)}">${b.icon}</span>`
        : "";
    })
    .join("");
}

function renderDueList(due) {
  const ul = document.getElementById("dueReviewList");
  if (!due.length) {
    ul.innerHTML = '<li class="due-empty">暂无到期复习 — 明天再来看看</li>';
    return;
  }
  ul.innerHTML = due
    .slice(0, 8)
    .map((w) => {
      const r = state.wordSRS[w];
      return `<li><button type="button" class="due-word-btn" data-word="${escapeHtml(w)}">${escapeHtml(w)}</button><span class="due-meta">→${r.nextReview}</span></li>`;
    })
    .join("");
  ul.querySelectorAll(".due-word-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setStudyMode("review");
      loadWord(btn.dataset.word, true);
    });
  });
}

function updateCheckInButton() {
  const btn = document.getElementById("checkInBtn");
  if (state.checkedInToday) {
    btn.textContent = "✓";
    btn.disabled = true;
    btn.classList.remove("pulse");
  } else {
    btn.textContent = "打卡";
    btn.disabled = false;
    btn.classList.add("pulse");
  }
}

function doCheckIn() {
  resetTodayIfNeeded();
  if (state.checkedInToday) return;
  state.checkedInToday = true;
  state.lastCheckInDate = todayStr();
  if (state.streak === 0) state.streak = 1;
  state.lastStudyDate = todayStr();
  addXP(XP_CHECKIN, "每日打卡");
  saveState();
  updateCheckInButton();
  updateProgressUI();
}

function markMastered() {
  if (!currentWord || state.wordSRS[currentWord]) {
    showToast("已在复习计划中，请用「复习」模式巩固");
    return;
  }
  const today = todayStr();
  state.mastered.push(currentWord);
  state.wordSRS[currentWord] = {
    learnedAt: today,
    stage: 0,
    nextReview: addDays(today, SRS_INTERVALS[0]),
    reviewCount: 0,
  };
  if (!state.listOrder.mastered.includes(currentWord)) {
    state.listOrder.mastered.push(currentWord);
  }
  resetTodayIfNeeded();
  state.todayNewCount += 1;
  state.lastStudyDate = today;
  addXP(XP_MASTER, "掌握新词");
  saveState();
  updateProgressUI();
  renderWordList();
  document.getElementById("masteredBtn").disabled = true;
}

function reviewPass() {
  if (!currentWord || !state.wordSRS[currentWord]) return;
  const rec = state.wordSRS[currentWord];
  const today = todayStr();
  rec.stage = Math.min(rec.stage + 1, SRS_INTERVALS.length - 1);
  rec.nextReview = addDays(today, SRS_INTERVALS[rec.stage]);
  rec.reviewCount += 1;
  state.totalReviews += 1;
  resetTodayIfNeeded();
  state.todayReviewCount += 1;
  addXP(XP_REVIEW, "复习成功");
  saveState();
  updateProgressUI();
  renderWordList();
  const due = getDueWords();
  if (due.length > 0) {
    setStudyMode("review");
    loadWord(due[0], true);
  } else {
    setStudyMode("learn");
    showToast("全部复习完成！去学学新词吧");
  }
}

function reviewFail() {
  if (!currentWord || !state.wordSRS[currentWord]) return;
  const rec = state.wordSRS[currentWord];
  const today = todayStr();
  rec.stage = 0;
  rec.nextReview = addDays(today, 1);
  saveState();
  updateProgressUI();
  showToast("没关系，明天再复习——遗忘是正常的，复习就是对抗它");
}

function toggleFavorite() {
  if (!currentWord) return;
  const idx = state.favorites.indexOf(currentWord);
  if (idx >= 0) {
    state.favorites.splice(idx, 1);
    state.listOrder.favorites = state.listOrder.favorites.filter((w) => w !== currentWord);
    showToast("已取消收藏");
  } else {
    state.favorites.push(currentWord);
    if (!state.listOrder.favorites.includes(currentWord)) {
      state.listOrder.favorites.push(currentWord);
    }
    showToast("已加入收藏");
  }
  saveState();
  updateFavoriteButton();
  renderWordList();
}

function getOrderedList(key) {
  if (key === "srs") {
    return Object.keys(state.wordSRS).sort((a, b) =>
      state.wordSRS[a].nextReview.localeCompare(state.wordSRS[b].nextReview)
    );
  }
  const items = key === "mastered" ? state.mastered : state.favorites;
  const order = state.listOrder[key] || [];
  const sorted = [...items].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  state.listOrder[key] = sorted;
  return sorted;
}

function renderWordList() {
  const ul = document.getElementById("wordList");
  const key = activeListTab;
  const words = getOrderedList(key);

  if (words.length === 0) {
    const msgs = {
      mastered: "还没有掌握的词",
      favorites: "收藏夹是空的",
      srs: "暂无复习计划",
    };
    ul.innerHTML = `<li style="cursor:default;opacity:0.7">${msgs[key]}</li>`;
    return;
  }

  ul.innerHTML = words
    .map((w) => {
      if (key === "srs") {
        const r = state.wordSRS[w];
        const due = r.nextReview <= todayStr() ? " 🔴" : "";
        return `<li data-word="${escapeHtml(w)}"><span>${escapeHtml(w)}</span><span class="due-meta">${r.nextReview}${due}</span></li>`;
      }
      return `
    <li draggable="true" data-word="${escapeHtml(w)}">
      <span class="drag-handle">⋮⋮</span>
      <span>${escapeHtml(w)}</span>
      <button type="button" class="remove" data-word="${escapeHtml(w)}">×</button>
    </li>`;
    })
    .join("");

  if (key !== "srs") {
    ul.querySelectorAll("li[draggable]").forEach(bindDrag);
    ul.querySelectorAll("button.remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeWord(btn.dataset.word, key);
      });
    });
  }

  ul.querySelectorAll("li[data-word]").forEach((li) => {
    li.addEventListener("click", (e) => {
      if (e.target.classList?.contains("remove")) return;
      const w = li.dataset.word;
      if (getDueWords().includes(w)) setStudyMode("review");
      else setStudyMode("learn");
      loadWord(w, true);
    });
  });
}

function removeWord(w, key) {
  if (key === "mastered") {
    state.mastered = state.mastered.filter((x) => x !== w);
    state.listOrder.mastered = state.listOrder.mastered.filter((x) => x !== w);
    delete state.wordSRS[w];
  } else {
    state.favorites = state.favorites.filter((x) => x !== w);
    state.listOrder.favorites = state.listOrder.favorites.filter((x) => x !== w);
  }
  saveState();
  renderWordList();
  updateProgressUI();
  if (w === currentWord) updateFavoriteButton();
  showToast("已移除");
}

let dragSrc = null;

function bindDrag(li) {
  li.addEventListener("dragstart", () => {
    dragSrc = li;
    li.classList.add("dragging");
  });
  li.addEventListener("dragend", () => {
    li.classList.remove("dragging");
    document.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
  });
  li.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (li !== dragSrc) li.classList.add("drag-over");
  });
  li.addEventListener("dragleave", () => li.classList.remove("drag-over"));
  li.addEventListener("drop", (e) => {
    e.preventDefault();
    li.classList.remove("drag-over");
    if (!dragSrc || dragSrc === li || activeListTab === "srs") return;
    const key = activeListTab;
    const order = getOrderedList(key);
    const from = order.indexOf(dragSrc.dataset.word);
    const to = order.indexOf(li.dataset.word);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, dragSrc.dataset.word);
    state.listOrder[key] = order;
    saveState();
    renderWordList();
  });
}

function updateQuizBanner() {
  const banner = document.getElementById("quizBanner");
  if (!banner) return;
  const days = getDaysToQuiz();
  const ready =
    state.mastered.length >= 5 &&
    (days === 0 || days === "—" || !state.lastQuizDate);
  banner.classList.toggle("hidden", !ready);
}

function buildQuizQuestions(count = 5) {
  const words = state.mastered.filter((w) => state.definitionsCache[w]);
  if (words.length < 4) return null;
  const shuffled = [...words].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map((word) => {
    const correct = state.definitionsCache[word];
    const others = words
      .filter((w) => w !== word)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((w) => state.definitionsCache[w]);
    const options = [correct, ...others].sort(() => Math.random() - 0.5);
    return { word, correct, options };
  });
}

function startWeeklyQuiz() {
  const questions = buildQuizQuestions(5);
  if (!questions) {
    showToast("至少需要 4 个有释义的已学词，请先多掌握几个");
    return;
  }
  quizSession = { questions, index: 0, score: 0 };
  document.getElementById("quizBanner").classList.add("hidden");
  document.getElementById("quizPanel").classList.remove("hidden");
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const q = quizSession.questions[quizSession.index];
  document.getElementById("quizIndex").textContent = quizSession.index + 1;
  document.getElementById("quizTotal").textContent = quizSession.questions.length;
  document.getElementById("quizQuestion").textContent = `「${q.word}」的意思是？`;
  document.getElementById("quizFeedback").textContent = "";
  const opts = document.getElementById("quizOptions");
  opts.innerHTML = q.options
    .map(
      (opt, i) =>
        `<button type="button" class="quiz-opt" data-idx="${i}">${escapeHtml(opt)}</button>`
    )
    .join("");
  opts.querySelectorAll(".quiz-opt").forEach((btn) => {
    btn.addEventListener("click", () => answerQuiz(btn, q));
  });
}

function answerQuiz(btn, q) {
  const chosen = q.options[parseInt(btn.dataset.idx, 10)];
  const correct = chosen === q.correct;
  document.querySelectorAll(".quiz-opt").forEach((b) => (b.disabled = true));
  const fb = document.getElementById("quizFeedback");
  if (correct) {
    quizSession.score += 1;
    fb.textContent = "✓ 正确！+20 XP";
    fb.className = "quiz-feedback ok";
    addXP(XP_QUIZ, "周测答对");
  } else {
    fb.textContent = `✗ 正确答案：${q.correct.slice(0, 80)}…`;
    fb.className = "quiz-feedback fail";
  }
  setTimeout(() => {
    quizSession.index += 1;
    if (quizSession.index >= quizSession.questions.length) finishQuiz();
    else renderQuizQuestion();
  }, 1200);
}

function finishQuiz() {
  const score = quizSession.score;
  const total = quizSession.questions.length;
  state.lastQuizDate = todayStr();
  if (score >= Math.ceil(total * 0.6)) awardBadge("quiz_pass");
  if (score > state.quizBestScore) state.quizBestScore = score;
  saveState();
  document.getElementById("quizPanel").classList.add("hidden");
  quizSession = null;
  updateQuizBanner();
  updateProgressUI();
  showToast(`周测结束：${score}/${total}。7 天后再战！`);
}

let gameScore = 0;

function startGame() {
  const words = state.mastered.filter((w) => state.definitionsCache[w]);
  if (words.length < 4) {
    showToast("请先掌握至少 4 个词再闯关");
    return;
  }
  gameScore = 0;
  document.getElementById("gameArea").classList.remove("hidden");
  nextGameRound(words);
}

function nextGameRound(words) {
  const word = words[Math.floor(Math.random() * words.length)];
  const correct = state.definitionsCache[word];
  const others = words
    .filter((w) => w !== word)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((w) => state.definitionsCache[w]);
  const options = [correct, ...others].sort(() => Math.random() - 0.5);

  document.getElementById("gameWord").textContent = word;
  const opts = document.getElementById("gameOptions");
  opts.innerHTML = options
    .map(
      (opt, i) =>
        `<button type="button" class="quiz-opt" data-idx="${i}">${escapeHtml(opt.slice(0, 90))}${opt.length > 90 ? "…" : ""}</button>`
    )
    .join("");
  opts.querySelectorAll(".quiz-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const chosen = options[parseInt(btn.dataset.idx, 10)];
      if (chosen === correct) {
        gameScore += 1;
        addXP(XP_GAME, "闯关答对");
        if (gameScore > state.gameBestScore) {
          state.gameBestScore = gameScore;
          saveState();
          updateGamificationUI();
        }
        nextGameRound(words);
      } else {
        showToast(`闯关结束，得分 ${gameScore}`);
        document.getElementById("gameArea").classList.add("hidden");
        checkBadges();
      }
    });
  });
}

async function fetchAdvice() {
  const box = document.getElementById("adviceText");
  box.textContent = "正在获取建议…";
  try {
    const res = await fetch("https://api.adviceslip.com/advice");
    const data = await res.json();
    box.textContent =
      "【微习惯】" + (data.slip?.advice || data.advice || "先复习 1 个到期词");
  } catch {
    box.textContent = "【微习惯】今天：1 个新词 + 复习昨天到期的词。";
  }
}

async function fetchRelaxImage() {
  const wrap = document.getElementById("relaxImageWrap");
  wrap.innerHTML = '<p class="placeholder">加载中…</p>';
  try {
    const res = await fetch("https://dog.ceo/api/breeds/image/random");
    const data = await res.json();
    if (data.message) {
      wrap.innerHTML = `<img src="${data.message}" alt="治愈图" />`;
    } else throw new Error();
  } catch {
    wrap.innerHTML = '<p class="placeholder">加载失败</p>';
  }
}

function selectMood(mood) {
  state.mood = mood;
  state.moodDate = todayStr();
  saveState();
  document.querySelectorAll(".mood-btn").forEach((b) => {
    b.classList.toggle("selected", b.dataset.mood === mood);
  });
  const fb = document.getElementById("moodFeedback");
  fb.hidden = false;
  fb.textContent = MOOD_MESSAGES[mood] || "";
}

function restoreMoodUI() {
  if (state.moodDate === todayStr() && state.mood) selectMood(state.mood);
}

function clearAllData() {
  if (!confirm("确定清空所有学习记录？")) return;
  state = defaultState();
  state.todayDate = todayStr();
  saveState();
  document.querySelectorAll(".mood-btn").forEach((b) => b.classList.remove("selected"));
  document.getElementById("moodFeedback").hidden = true;
  document.getElementById("quizPanel").classList.add("hidden");
  document.getElementById("gameArea").classList.add("hidden");
  setStudyMode("learn");
  updateProgressUI();
  updateGamificationUI();
  renderWordList();
  renderRecentSearches();
  showIdleCard();
  document.getElementById("wordInput").value = "";
  showToast("已清空");
}

function playAudio() {
  if (currentAudioUrl) new Audio(currentAudioUrl).play();
}

// --- AI 练习逻辑 ---

function renderSelectedWordsChips() {
  const el = document.getElementById("selectedWordsChips");
  if (!el) return;
  
  if (!selectedChatWords.length) {
    el.innerHTML = '<p class="hint">输入单词来添加（需 5 个）</p>';
  } else {
    el.innerHTML = selectedChatWords
      .map(
        (w) =>
          `<button type="button" class="chip selected" data-word="${escapeHtml(w)}">${escapeHtml(w)} ✕</button>`
      )
      .join("");
    el.querySelectorAll(".chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedChatWords = selectedChatWords.filter((w) => w !== btn.dataset.word);
        renderSelectedWordsChips();
      });
    });
  }

  document.getElementById("startChatBtn").disabled = selectedChatWords.length !== 5;
}

function addChatWordFromInput() {
  const input = document.getElementById("chatWordInput");
  const word = normalizeWord(input.value.trim());
  if (!word) {
    showToast("请输入有效的英文单词");
    return;
  }
  if (selectedChatWords.length >= 5) {
    showToast("最多只能添加 5 个单词");
    return;
  }
  if (selectedChatWords.includes(word)) {
    showToast("这个单词已经添加了");
    return;
  }
  selectedChatWords.push(word);
  input.value = "";
  renderSelectedWordsChips();
}

const chatHistory = [];

function startAiChat() {
  if (!Auth.requireLogin("登录后可使用 AI 单词对话")) return;
  if (selectedChatWords.length !== 5) {
    showToast("请先输入 5 个单词");
    return;
  }
  chatHistory.length = 0;
  chatCurrentWordIndex = 0;
  document.getElementById("chatWordSelector").classList.add("hidden");
  document.getElementById("chatInterface").classList.remove("hidden");
  document.getElementById("chatMessages").innerHTML = "";

  const words = selectedChatWords.join(", ");
  const intro = `Let's practice these words: ${words}. I'll start — tell me, how would you use "${selectedChatWords[0]}" in your daily life?`;
  chatHistory.push({ role: "assistant", content: intro });
  appendChatMessage("ai", intro);
}

function appendChatMessage(role, text) {
  const container = document.getElementById("chatMessages");
  const msg = document.createElement("div");
  msg.className = `message ${role}`;
  msg.textContent = text;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

async function handleChatSend() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  if (!Auth.requireLogin()) return;

  appendChatMessage("user", text);
  input.value = "";
  chatHistory.push({ role: "user", content: text });

  const sendBtn = document.getElementById("sendChatBtn");
  sendBtn.disabled = true;

  try {
    const data = await Auth.api("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ messages: chatHistory }),
    });
    chatHistory.push({ role: "assistant", content: data.content });
    appendChatMessage("ai", data.content);
  } catch (err) {
    showToast(err.message || "AI 对话失败");
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

function generateCefrParagraph() {
  const level = document.getElementById("cefrLevel").value;
  const templates = CEFR_TEMPLATES[level] || CEFR_TEMPLATES.B1;
  // 随机选择一条句子
  cefrCurrentText = templates[Math.floor(Math.random() * templates.length)];
  
  // 重置 UI
  document.getElementById("cefrPracticeArea").classList.remove("hidden");
  document.getElementById("cefrDictationBox").classList.remove("hidden");
  document.getElementById("cefrResult").classList.add("hidden");
  document.getElementById("cefrInput").value = "";
  
  // 重置暂停按钮状态
  document.getElementById("pauseCefrBtn").textContent = "⏸ 暂停";
  
  // 自动播放一次
  speakCefrText();
}

function speakCefrText() {
  if (!cefrCurrentText) return;
  
  // 如果正在播放，则先取消
  window.speechSynthesis.cancel();
  
  const speed = parseFloat(document.getElementById("cefrSpeed").value) || 0.8;
  const utterance = new SpeechSynthesisUtterance(cefrCurrentText);
  utterance.lang = "en-US";
  utterance.rate = speed; 
  
  window.speechSynthesis.speak(utterance);
}

function pauseCefrText() {
  if (window.speechSynthesis.speaking) {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      document.getElementById("pauseCefrBtn").textContent = "⏸ 暂停";
    } else {
      window.speechSynthesis.pause();
      document.getElementById("pauseCefrBtn").textContent = "▶ 继续";
    }
  }
}


function startCefrDictation() {
  document.getElementById("cefrReadingBox").classList.add("hidden");
  document.getElementById("cefrDictationBox").classList.remove("hidden");
  document.getElementById("cefrInput").focus();
}

function checkCefrAccuracy() {
  const input = document.getElementById("cefrInput").value.trim();
  if (!input) {
    showToast("请输入你记住的内容");
    return;
  }
  
  // 预处理：转小写并去除标点符号
  const normalize = (text) => text.toLowerCase().replace(/[.,!?;:"]/g, "").split(/\s+/).filter(w => w.length > 0);
  
  const originalWordsRaw = cefrCurrentText.split(/\s+/);
  const originalWords = normalize(cefrCurrentText);
  const inputWords = normalize(input);
  
  let correctCount = 0;
  // 为了渲染 diff，我们遍历原始单词（带标点）
  const diffHtml = originalWordsRaw.map((word) => {
    const cleanWord = word.toLowerCase().replace(/[.,!?;:"]/g, "");
    const matchIndex = inputWords.indexOf(cleanWord);
    
    if (matchIndex !== -1) {
      correctCount++;
      // 匹配后从输入中移除，避免重复匹配
      inputWords.splice(matchIndex, 1);
      return `<span class="diff-correct">${word}</span>`;
    } else {
      return `<span class="diff-missing">${word}</span>`;
    }
  }).join(" ");
  
  const accuracy = Math.round((correctCount / originalWords.length) * 100);
  document.getElementById("cefrAccuracy").textContent = `${accuracy}%`;
  document.getElementById("cefrDiff").innerHTML = diffHtml;
  document.getElementById("cefrResult").classList.remove("hidden");
  
  if (accuracy === 100) {
    showToast("完美！一字不差！+30 XP");
    addXP(30, "CEFR 满分听写");
  } else if (accuracy > 80) {
    showToast("很棒的记忆力！继续加油");
    addXP(15, "CEFR 高分听写");
  }
}

function initEvents() {
  document.getElementById("lookupBtn").addEventListener("click", lookupFromInput);
  document.getElementById("wordInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookupFromInput();
    }
  });
  document.getElementById("manualAddBtn")?.addEventListener("click", addManualWord);
  document.getElementById("manualWordInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addManualWord();
  });
  document.getElementById("examBankSelect")?.addEventListener("change", (e) => {
    state.examBank = e.target.value;
    saveState();
    renderBankWords();
    renderDailyRoutine();
    showToast(`已切换到 ${WORD_BANKS[state.examBank]?.label || "词库"}`);
  });
  document.getElementById("learnDailyWordBtn")?.addEventListener("click", () => {
    const word = getDailyWord();
    document.getElementById("wordInput").value = word;
    addRecentSearch(word);
    loadWord(word, true);
  });
  document.getElementById("enableDailyPushBtn")?.addEventListener("click", enableDailyPush);
  document.getElementById("randomWordBtn").addEventListener("click", () => {
    setStudyMode("learn");
    const w = pickRandomNewWord();
    document.getElementById("wordInput").value = w;
    addRecentSearch(w);
    loadWord(w, true);
  });

  document.querySelectorAll(".tab-bar .nav-btn[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;

      if (view === "home") {
        resetNavToHome();
        document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const panelId = {
        review: "panelReview",
        wordbank: "panelWordbank",
        sentence: "panelSentence",
        ai: "panelAI",
        premium: "panelPremium",
        more: "panelMore",
      }[view];
      const panel = document.getElementById(panelId);
      if (!panel) return;
      const isOpen = btn.classList.contains("active") && !panel.classList.contains("hidden");
      document.querySelectorAll(".tab-bar .nav-btn[data-view]").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".bottom-panel").forEach((p) => p.classList.add("hidden"));
      if (!isOpen) {
        btn.classList.add("active");
        panel.classList.remove("hidden");
        if (view === "ai") renderSelectedWordsChips();
      } else {
        resetNavToHome();
      }
    });
  });

  // AI 练习子 Tab 切换
  document.querySelectorAll('#panelAI .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#panelAI .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      
      // 切换显示内容
      const isChat = target === 'aiChat';
      document.getElementById('chatWordSelector').classList.toggle('hidden', !isChat);
      document.getElementById('subPanelAiCefr').classList.toggle('hidden', isChat);
      
      // 如果切换到 CEFR，强制隐藏聊天界面
      if (!isChat) {
        document.getElementById('chatInterface').classList.add('hidden');
      }
    });
  });

  document.getElementById("startChatBtn").addEventListener("click", startAiChat);
  document.getElementById("chatWordInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addChatWordFromInput();
    }
  });
  document.getElementById("sendChatBtn").addEventListener("click", handleChatSend);
  document.getElementById("chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleChatSend();
  });
  document.getElementById("exitChatBtn").addEventListener("click", () => {
    document.getElementById("chatWordSelector").classList.remove("hidden");
    document.getElementById("chatInterface").classList.add("hidden");
  });

  document.getElementById("generateCefrBtn").addEventListener("click", generateCefrParagraph);
  document.getElementById("playCefrBtn").addEventListener("click", speakCefrText);
   document.getElementById("pauseCefrBtn").addEventListener("click", pauseCefrText);
   document.getElementById("submitCefrBtn").addEventListener("click", checkCefrAccuracy);
  document.getElementById("resetCefrBtn").addEventListener("click", generateCefrParagraph);

  const cefrSpeed = document.getElementById("cefrSpeed");
  if (cefrSpeed) {
    cefrSpeed.addEventListener("input", () => {
      document.getElementById("speedValue").textContent = cefrSpeed.value;
    });
  }

  document.getElementById("playAudioBtn").addEventListener("click", playAudio);
  document.getElementById("playAudioReviewBtn").addEventListener("click", playAudio);
  document.getElementById("favoriteBtn").addEventListener("click", toggleFavorite);
  document.getElementById("masteredBtn").addEventListener("click", markMastered);
  document.getElementById("reviewPassBtn").addEventListener("click", reviewPass);
  document.getElementById("reviewFailBtn").addEventListener("click", reviewFail);
  document.getElementById("checkInBtn").addEventListener("click", doCheckIn);
  document.getElementById("startReviewBtn").addEventListener("click", () => {
    const due = getDueWords();
    if (due.length) {
      setStudyMode("review");
      loadWord(due[0], true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
  document.getElementById("startQuizBtn").addEventListener("click", startWeeklyQuiz);
  document.getElementById("startGameBtn").addEventListener("click", startGame);
  document.getElementById("fetchAdviceBtn").addEventListener("click", fetchAdvice);
  document.getElementById("fetchRelaxBtn").addEventListener("click", fetchRelaxImage);
  document.getElementById("clearAllBtn").addEventListener("click", clearAllData);

  document.querySelectorAll(".mood-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectMood(btn.dataset.mood));
  });

  const goalInput = document.getElementById("dailyGoal");
  const goalOutput = document.getElementById("goalOutput");
  goalInput.addEventListener("input", () => {
    goalOutput.textContent = goalInput.value;
  });
  document.getElementById("saveGoalBtn").addEventListener("click", () => {
    state.dailyGoal = parseInt(goalInput.value, 10);
    saveState();
    updateProgressUI();
    showToast(`每日新词目标：${state.dailyGoal}（建议第2天复习前一天）`);
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeListTab = tab.dataset.tab;
      renderWordList();
    });
  });
}

function init() {
  migrateLegacyStorage();
  if (activeUserId === null && !Auth.isLoggedIn()) {
    activeUserId = "guest";
    state = loadStateFromKey(storageKey("guest"));
  }
  if (!state.recentSearches) state.recentSearches = [];
  refreshAllUI();
  initEvents();
  document.getElementById("wordInput")?.focus();
}

const Vocab = { init, syncFromCloud, onUserChange, persistBeforeLogout };
