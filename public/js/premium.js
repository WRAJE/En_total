/**
 * Premium 模块 — 会员码兑换 + 三合一竞技词汇游戏
 */
const Premium = (() => {
  const GAME_WORDS = [
    { word: "ambiguous", meaning: "模棱两可的" },
    { word: "coherent", meaning: "连贯的" },
    { word: "derive", meaning: "源自，获得" },
    { word: "empirical", meaning: "实证的" },
    { word: "facilitate", meaning: "促进，使便利" },
    { word: "inherent", meaning: "固有的" },
    { word: "justify", meaning: "证明合理" },
    { word: "notion", meaning: "概念，观念" },
    { word: "preliminary", meaning: "初步的" },
    { word: "subsequent", meaning: "随后的" },
    { word: "allocate", meaning: "分配" },
    { word: "criteria", meaning: "标准" },
  ];

  let config = {
    priceLabel: "¥29 / 月",
    paymentQrImage: "",
    codeHint: "",
  };
  let activeGame = null;
  let score = 0;
  let round = 0;
  let timer = null;
  let timeLeft = 30;

  function $(sel) {
    return document.querySelector(sel);
  }

  function sample(list, count) {
    return [...list].sort(() => Math.random() - 0.5).slice(0, count);
  }

  function setStatus(message, type = "") {
    const el = $("#membershipStatus");
    if (!el) return;
    el.textContent = message;
    el.className = "status" + (type ? ` ${type}` : "");
  }

  function renderConfig() {
    $("#premiumPriceLabel").textContent = config.priceLabel;
    const qrBox = $("#paymentQrBox");
    if (!qrBox) return;
    if (config.paymentQrImage) {
      qrBox.innerHTML = `<img src="${escapeHtml(config.paymentQrImage)}" alt="付款二维码" />`;
    } else {
      qrBox.innerHTML = `<span>QR</span><small>在 .env 设置 PAYMENT_QR_IMAGE</small>`;
    }
    const input = $("#membershipCodeInput");
    if (input && config.codeHint) {
      input.placeholder = `输入会员码，例如 ${config.codeHint}`;
    }
  }

  async function loadConfig() {
    try {
      const data = await Auth.api("/api/config");
      config = data.premium || config;
      renderConfig();
    } catch {
      renderConfig();
    }
  }

  function refresh() {
    const membership = Auth.getMembership();
    const isPremium = Auth.isPremium();
    const pill = $("#premiumStatusPill");
    const paywall = $("#premiumPaywall");
    if (pill) {
      pill.textContent = isPremium ? "Premium" : "Free";
      pill.classList.toggle("active", isPremium);
    }
    paywall?.classList.toggle("hidden", isPremium);
    document.querySelectorAll(".plan-btn").forEach((btn) => {
      const plan = btn.dataset.plan;
      if (plan === "free") {
        btn.textContent = isPremium ? "免费版" : "当前版本";
        btn.disabled = true;
        btn.className = "btn btn-ghost btn-block plan-btn";
      } else if (isPremium) {
        btn.textContent = "已开通";
        btn.disabled = true;
        btn.className = "btn btn-ghost btn-block plan-btn";
      } else {
        btn.textContent = plan === "monthly" ? "购买月卡" : "购买年卡";
        btn.disabled = false;
        btn.className = "btn btn-primary btn-block plan-btn";
      }
    });
    if (isPremium && membership.premiumUntil) {
      setStatus(`会员有效期至 ${new Date(membership.premiumUntil).toLocaleDateString()}`, "success");
    } else if (!isPremium) {
      setStatus("");
    }
  }

  function scrollToPaywall() {
    if (!Auth.requireLogin("登录后才能购买会员")) return;
    $("#premiumPaywall")?.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#membershipCodeInput")?.focus();
  }

  function toggleFAQ(btn) {
    const item = btn.closest(".faq-item");
    const open = item?.classList.toggle("open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  async function copyReferralCode() {
    const code = $("#referral-code-display")?.textContent?.trim() || "";
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setStatus("推荐码已复制", "success");
    } catch {
      setStatus("复制失败，请手动复制", "error");
    }
  }

  function requirePremium() {
    if (!Auth.requireLogin("登录后才能解锁 Premium")) return false;
    if (Auth.isPremium()) return true;
    setStatus("请先扫码付款并兑换会员码", "error");
    $("#premiumPaywall")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return false;
  }

  async function redeemMembership() {
    if (!Auth.requireLogin("登录后才能兑换会员码")) return;
    const input = $("#membershipCodeInput");
    const code = input.value.trim();
    if (!code) return setStatus("请输入会员码", "error");

    setStatus("正在兑换...", "loading");
    try {
      const data = await Auth.redeemCode(code);
      input.value = "";
      setStatus(`${data.message}，高级游戏已解锁`, "success");
      refresh();
    } catch (err) {
      setStatus(err.message, "error");
    }
  }

  function openArena(title) {
    $("#premiumGameTitle").textContent = title;
    $("#premiumGameArena").classList.remove("hidden");
    $("#premiumGameContent").innerHTML = "";
    score = 0;
    round = 0;
    clearInterval(timer);
  }

  function finishGame() {
    clearInterval(timer);
    const bonus = Math.max(8, score * 4);
    $("#premiumGameContent").innerHTML = `
      <div class="game-result">
        <p class="game-score">${score}</p>
        <p>本轮完成，获得 ${bonus} XP。</p>
        <button type="button" class="btn btn-primary" id="replayPremiumGameBtn">再玩一次</button>
      </div>
    `;
    if (typeof addXP === "function") addXP(bonus, "Premium 游戏");
    $("#replayPremiumGameBtn")?.addEventListener("click", () => startGame(activeGame));
  }

  function startCountdown(onTick) {
    timeLeft = 30;
    timer = setInterval(() => {
      timeLeft -= 1;
      onTick?.();
      if (timeLeft <= 0) finishGame();
    }, 1000);
  }

  function renderSpeedRound() {
    if (round >= 8) return finishGame();
    round += 1;
    const answer = sample(GAME_WORDS, 1)[0];
    const options = sample(GAME_WORDS.filter((w) => w.word !== answer.word), 3).concat(answer)
      .sort(() => Math.random() - 0.5);
    $("#premiumGameContent").innerHTML = `
      <div class="arena-stats"><span>第 ${round}/8 题</span><span>得分 ${score}</span><span id="premiumTimer">${timeLeft}s</span></div>
      <p class="game-prompt">${answer.word}</p>
      <div class="game-options">
        ${options.map((item) => `<button type="button" class="game-option" data-ok="${item.word === answer.word}">${item.meaning}</button>`).join("")}
      </div>
    `;
    $("#premiumGameContent").querySelectorAll(".game-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.ok === "true") score += 1;
        renderSpeedRound();
      });
    });
  }

  function startSpeedMatch() {
    openArena("Speed Match");
    renderSpeedRound();
    startCountdown(() => {
      const timerEl = $("#premiumTimer");
      if (timerEl) timerEl.textContent = `${timeLeft}s`;
    });
  }

  function renderSpellRound() {
    if (round >= 6) return finishGame();
    round += 1;
    const answer = sample(GAME_WORDS, 1)[0];
    $("#premiumGameContent").innerHTML = `
      <div class="arena-stats"><span>第 ${round}/6 题</span><span>得分 ${score}</span></div>
      <p class="game-prompt">${answer.meaning}</p>
      <input type="text" id="spellAnswerInput" class="word-input" placeholder="输入英文拼写" autocomplete="off" />
      <button type="button" id="submitSpellAnswerBtn" class="btn btn-primary btn-block">提交</button>
      <p id="spellFeedback" class="status"></p>
    `;
    const submit = () => {
      const guess = $("#spellAnswerInput").value.trim().toLowerCase();
      if (guess === answer.word) {
        score += 2;
        renderSpellRound();
      } else {
        $("#spellFeedback").textContent = `正确答案：${answer.word}`;
        setTimeout(renderSpellRound, 900);
      }
    };
    $("#submitSpellAnswerBtn").addEventListener("click", submit);
    $("#spellAnswerInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    $("#spellAnswerInput").focus();
  }

  function startSpellingSprint() {
    openArena("Spelling Sprint");
    renderSpellRound();
  }

  function renderDuelRound() {
    if (round >= 10) return finishGame();
    round += 1;
    const answer = sample(GAME_WORDS, 1)[0];
    const options = sample(GAME_WORDS.filter((w) => w.word !== answer.word), 3).concat(answer)
      .sort(() => Math.random() - 0.5);
    $("#premiumGameContent").innerHTML = `
      <div class="arena-stats"><span>第 ${round}/10 题</span><span>得分 ${score}</span></div>
      <p class="game-prompt">哪个单词表示「${answer.meaning}」？</p>
      <div class="game-options">
        ${options.map((item) => `<button type="button" class="game-option" data-ok="${item.word === answer.word}">${item.word}</button>`).join("")}
      </div>
    `;
    $("#premiumGameContent").querySelectorAll(".game-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.ok === "true") score += 1;
        renderDuelRound();
      });
    });
  }

  function startMeaningDuel() {
    openArena("Meaning Duel");
    renderDuelRound();
  }

  function startGame(game) {
    if (!requirePremium()) return;
    activeGame = game;
    const starters = {
      speed: startSpeedMatch,
      spell: startSpellingSprint,
      duel: startMeaningDuel,
    };
    starters[game]?.();
  }

  function bindEvents() {
    loadConfig();
    refresh();
    $("#redeemMembershipBtn")?.addEventListener("click", redeemMembership);
    $("#membershipCodeInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") redeemMembership();
    });
    document.querySelectorAll(".plan-btn[data-plan='monthly'], .plan-btn[data-plan='yearly']").forEach((btn) => {
      btn.addEventListener("click", scrollToPaywall);
    });
    document.querySelectorAll(".faq-question").forEach((btn) => {
      btn.addEventListener("click", () => toggleFAQ(btn));
    });
    $("#copyReferralBtn")?.addEventListener("click", copyReferralCode);
    document.querySelectorAll(".premium-game-btn").forEach((btn) => {
      btn.addEventListener("click", () => startGame(btn.dataset.game));
    });
    $("#exitPremiumGameBtn")?.addEventListener("click", () => {
      clearInterval(timer);
      $("#premiumGameArena").classList.add("hidden");
    });
  }

  function resetPanel() {
    clearInterval(timer);
    activeGame = null;
    $("#premiumGameArena")?.classList.add("hidden");
  }

  return { bindEvents, refresh, resetPanel };
})();
