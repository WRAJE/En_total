(function () {
  "use strict";

  const screens = {};
  let currentScreen = "home";
  let quota = { used: 0, remaining: 3, limit: 3, isPremium: false, canPlay: false };
  let appReady = false;

  function $(id) {
    return document.getElementById(id);
  }

  function showScreen(id) {
    Object.keys(screens).forEach((key) => {
      screens[key]?.classList.toggle("active", key === id);
    });
    currentScreen = id;
    if (id === "game-screen") {
      requestAnimationFrame(() => $("game-canvas")?.focus());
    }
  }

  function showLoginGate() {
    $("login-gate")?.classList.remove("hidden");
    $("bubbles-app")?.classList.add("hidden");
  }

  function hideLoginGate() {
    $("login-gate")?.classList.add("hidden");
    $("bubbles-app")?.classList.remove("hidden");
  }

  async function refreshQuota() {
    const textEl = $("quota-text");
    const actionEl = $("quota-action");
    const paywall = $("paywall-overlay");

    if (!Auth.isLoggedIn()) {
      showLoginGate();
      return;
    }

    hideLoginGate();

    try {
      quota = await Auth.api("/api/bubbles/quota");
    } catch {
      quota = { used: 0, remaining: 0, limit: 3, isPremium: false, canPlay: false };
    }

    if (quota.isPremium) {
      if (textEl) textEl.textContent = "Premium 会员 · 无限畅玩";
      paywall?.classList.add("hidden");
      if (actionEl) actionEl.textContent = "已解锁";
    } else if (quota.canPlay) {
      if (textEl) textEl.textContent = `免费体验剩余 ${quota.remaining}/${quota.limit} 次`;
      paywall?.classList.add("hidden");
      if (actionEl) actionEl.textContent = `已用 ${quota.used} 次`;
    } else {
      if (textEl) textEl.textContent = "免费体验已用完";
      paywall?.classList.remove("hidden");
      if (actionEl) actionEl.textContent = "次数已用尽";
    }

    updateNavCounts();
    if (currentScreen === "home") renderHome();
  }

  async function ensureCanPlay() {
    if (!Auth.isLoggedIn()) {
      showLoginGate();
      return false;
    }
    if (Auth.isPremium()) return true;
    try {
      quota = await Auth.api("/api/bubbles/quota");
    } catch {
      return false;
    }
    if (quota.canPlay) return true;
    $("paywall-overlay")?.classList.remove("hidden");
    return false;
  }

  function renderHome() {
    const count = Wordbook.count();
    if ($("wordbook-count")) $("wordbook-count").textContent = count;
    showScreen("home");
  }

  function renderWordbook() {
    const words = Wordbook.getAll();
    const container = $("wordbook-list");
    const empty = $("wordbook-empty");
    if (!container || !empty) return;

    if (words.length === 0) {
      container.style.display = "none";
      empty.style.display = "block";
      if ($("wordbook-start-btn")) $("wordbook-start-btn").disabled = true;
      return;
    }
    container.style.display = "grid";
    empty.style.display = "none";
    if ($("wordbook-start-btn")) $("wordbook-start-btn").disabled = false;

    container.innerHTML = words
      .map(
        (w) => `
      <div class="word-card" data-en="${w.en}">
        <div class="word-card-en">${w.en}</div>
        <div class="word-card-cn">${w.cn}</div>
        <button type="button" class="word-card-remove" data-en="${w.en}">✕</button>
      </div>`
      )
      .join("");

    container.querySelectorAll(".word-card-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        Wordbook.remove(btn.dataset.en);
        renderWordbook();
        updateNavCounts();
      });
    });
  }

  function renderWordSelect() {
    const book = Wordbook.getAll();
    const container = $("word-select-list");
    if (!container) return;

    const searchVal = ($("word-search")?.value || "").toLowerCase();
    const catFilter = $("word-category-filter")?.value || "all";

    let filtered = BUBBLES_IELTS_WORDS;
    if (catFilter !== "all") filtered = filtered.filter((w) => w.category === catFilter);
    if (searchVal) {
      filtered = filtered.filter(
        (w) => w.en.toLowerCase().includes(searchVal) || w.cn.includes(searchVal)
      );
    }

    const categories = [...new Set(BUBBLES_IELTS_WORDS.map((w) => w.category))];
    const catFilterEl = $("word-category-filter");
    if (catFilterEl) {
      const current = catFilterEl.value;
      catFilterEl.innerHTML =
        '<option value="all">All Categories</option>' +
        categories
          .map((c) => `<option value="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</option>`)
          .join("");
      catFilterEl.value = current;
    }

    container.innerHTML = filtered
      .map((w) => {
        const inBook = book.some((b) => b.en === w.en);
        return `
        <div class="word-select-item ${inBook ? "selected" : ""}" data-en="${w.en}">
          <div class="word-select-info">
            <span class="word-select-en">${w.en}</span>
            <span class="word-select-cn">${w.cn}</span>
          </div>
          <div class="word-select-cat">${w.category}</div>
          <button type="button" class="word-select-toggle ${inBook ? "remove" : "add"}">${inBook ? "✓" : "+"}</button>
        </div>`;
      })
      .join("");

    container.querySelectorAll(".word-select-toggle").forEach((btn) => {
      const item = btn.closest(".word-select-item");
      const en = item.dataset.en;
      btn.addEventListener("click", () => {
        const word = BUBBLES_IELTS_WORDS.find((w) => w.en === en);
        Wordbook.toggle(word);
        renderWordSelect();
        updateNavCounts();
      });
    });

    if ($("selected-count")) $("selected-count").textContent = Wordbook.count();
  }

  async function startGame(mode) {
    const words = Wordbook.getAll();
    if (words.length === 0) {
      alert("请先在 Add Words 中添加单词！");
      renderWordSelect();
      showScreen("wordbook-select");
      return;
    }

    if (!(await ensureCanPlay())) return;

    try {
      if (!Auth.isPremium()) {
        quota = await Auth.api("/api/bubbles/play", { method: "POST" });
        await refreshQuota();
      }
    } catch (err) {
      alert(err.message || "无法开始游戏");
      await refreshQuota();
      return;
    }

    showScreen("game-screen");
    $("question-overlay")?.classList.remove("active");
    $("gameover-overlay")?.classList.remove("active");
    $("game-start-info")?.classList.add("active");

    setTimeout(() => {
      $("game-start-info")?.classList.remove("active");
      Game.init($("game-canvas"), handleGameEvent);
      requestAnimationFrame(() => {
        Game.resize();
        Game.start(mode, words);
        $("game-canvas")?.focus();
      });
    }, 1500);
  }

  function handleGameEvent(type, data) {
    if (type === "question") showQuestion(data);
    else if (type === "gameover") showGameOver(data);
    else if (type === "answered") $("question-overlay")?.classList.remove("active");
  }

  function showQuestion(q) {
    const overlay = $("question-overlay");
    const promptEl = $("question-prompt");
    const optionsEl = $("question-options");
    const modeLabel = Game.mode === "en2cn" ? "English → 中文" : "中文 → English";

    if ($("question-mode")) $("question-mode").textContent = modeLabel;
    if (promptEl) promptEl.textContent = q.prompt;
    if (!optionsEl) return;
    optionsEl.innerHTML = "";

    q.options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "question-option";
      btn.textContent = opt;
      btn.addEventListener("click", () => {
        optionsEl.querySelectorAll(".question-option").forEach((b) => {
          b.disabled = true;
        });
        if (opt === q.answer) btn.classList.add("correct");
        else {
          btn.classList.add("wrong");
          optionsEl.querySelectorAll(".question-option").forEach((b) => {
            if (b.textContent === q.answer) b.classList.add("correct");
          });
        }
        setTimeout(() => {
          Game.answerQuestion(opt);
          overlay?.classList.remove("active");
        }, 200);
      });
      optionsEl.appendChild(btn);
    });

    overlay?.classList.add("active");
    const fill = $("question-timer-fill");
    if (fill) fill.style.width = "100%";
  }

  function updateQuestionTimer() {
    const fill = $("question-timer-fill");
    if (!fill) return;
    const q = Game.getQuestion();
    if (q && q.timeLeft !== undefined) {
      fill.style.width = `${Math.max(0, (q.timeLeft / 900) * 100)}%`;
    }
  }

  function showGameOver(data) {
    $("gameover-overlay")?.classList.add("active");
    if ($("final-score")) $("final-score").textContent = data.score;
    if ($("final-score-dup")) $("final-score-dup").textContent = data.score;
    if ($("final-distance")) $("final-distance").textContent = data.distance;
    if ($("final-learned")) $("final-learned").textContent = `${data.learned}/${data.total}`;

    const pts = data.points || { distance: 0, catch: 0, answer: 0, comboBonus: 0 };
    if ($("breakdown-distance")) $("breakdown-distance").textContent = pts.distance;
    if ($("breakdown-catch")) $("breakdown-catch").textContent = pts.catch;
    if ($("breakdown-answer")) $("breakdown-answer").textContent = pts.answer;
    if ($("breakdown-combo")) $("breakdown-combo").textContent = pts.comboBonus;

    const pct = data.total > 0 ? Math.round((data.learned / data.total) * 100) : 0;
    const msg =
      pct >= 80
        ? "SpongeBob is proud of you! 🌟"
        : pct >= 50
          ? "Good job, keep practicing! 💪"
          : "Keep trying, you'll get better! 🧽";
    if ($("final-message")) $("final-message").textContent = msg;
    Game.stop();
  }

  function updateNavCounts() {
    const count = Wordbook.count();
    if ($("nav-count")) $("nav-count").textContent = count;
    if ($("selected-count")) $("selected-count").textContent = count;
    if ($("wordbook-count")) $("wordbook-count").textContent = count;
  }

  function createHomeJellyfish() {
    const container = $("home-jellyfish");
    if (!container || container.childElementCount > 0) return;
    for (let i = 0; i < 6; i++) {
      const j = document.createElement("div");
      j.className = "deco-jellyfish";
      j.style.left = `${10 + Math.random() * 80}%`;
      j.style.top = `${10 + Math.random() * 70}%`;
      j.style.animationDelay = `${Math.random() * 3}s`;
      j.style.animationDuration = `${2.5 + Math.random() * 2}s`;
      j.style.fontSize = `${20 + Math.random() * 20}px`;
      j.textContent = "🪼";
      container.appendChild(j);
    }
  }

  function bindEvents() {
    ["home", "wordbook", "wordbook-select", "game-screen", "chat-screen"].forEach((id) => {
      screens[id] = $(id);
    });

    const origGameLoop = Game.gameLoop;
    Game.gameLoop = function patchedGameLoop() {
      origGameLoop.call(Game);
      if (Game.state === "question") updateQuestionTimer();
    };

    $("nav-home")?.addEventListener("click", renderHome);
    $("nav-wordbook")?.addEventListener("click", () => {
      renderWordbook();
      showScreen("wordbook");
    });
    $("nav-add")?.addEventListener("click", () => {
      renderWordSelect();
      showScreen("wordbook-select");
    });
    $("nav-chat")?.addEventListener("click", () => {
      if (!Auth.isLoggedIn()) {
        showLoginGate();
        return;
      }
      showScreen("chat-screen");
    });

    $("start-en2cn")?.addEventListener("click", () => startGame("en2cn"));
    $("start-cn2en")?.addEventListener("click", () => startGame("cn2en"));

    $("wordbook-start-btn")?.addEventListener("click", renderHome);
    $("wordbook-clear-btn")?.addEventListener("click", () => {
      if (confirm("Clear all words from wordbook?")) {
        Wordbook.clear();
        renderWordbook();
        updateNavCounts();
      }
    });

    $("word-search")?.addEventListener("input", renderWordSelect);
    $("word-category-filter")?.addEventListener("change", renderWordSelect);

    $("replay-btn")?.addEventListener("click", () => {
      $("gameover-overlay")?.classList.remove("active");
      startGame(Game.mode);
    });
    $("home-btn")?.addEventListener("click", () => {
      $("gameover-overlay")?.classList.remove("active");
      Game.stop();
      renderHome();
    });

    SpongeBobChat.init();
    $("chat-close-btn")?.addEventListener("click", renderHome);

    $("audio-toggle")?.addEventListener("click", () => {
      const enabled = AudioManager.toggle();
      if ($("audio-toggle")) $("audio-toggle").textContent = enabled ? "🔊" : "🔇";
    });

    document.addEventListener("keydown", (e) => {
      if (currentScreen !== "game-screen") return;
      if (Game.state === "question") {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 4) {
          const btns = $("question-options")?.querySelectorAll(".question-option");
          if (btns?.[num - 1] && !btns[num - 1].disabled) btns[num - 1].click();
        }
      }
    });

    window.addEventListener("resize", () => {
      if (typeof Game !== "undefined" && Game.canvas) Game.resize();
    });
  }

  async function boot() {
    bindEvents();
    await Auth.checkSession();
    if (!Auth.isLoggedIn()) {
      showLoginGate();
      return;
    }
    appReady = true;
    await refreshQuota();
    renderHome();
    updateNavCounts();
    createHomeJellyfish();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
