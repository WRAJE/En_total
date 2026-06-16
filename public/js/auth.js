/**
 * 用户认证模块 — 注册 / 登录 / 找回密码
 */
const Auth = (() => {
  let currentUser = null;
  let currentMembership = { isPremium: false, plan: "free", premiumUntil: null };
  let isGuest = false;
  const listeners = new Set();

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function notify() {
    listeners.forEach((fn) => fn({ user: currentUser, isGuest, membership: currentMembership }));
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `请求失败 (${res.status})`);
    return body;
  }

  function setStatus(el, msg, type = "") {
    if (!el) return;
    el.textContent = msg;
    el.className = "status" + (type ? ` ${type}` : "");
  }

  function showAuthOverlay() {
    document.getElementById("auth-overlay")?.classList.remove("hidden");
    document.getElementById("main-app")?.classList.add("hidden");
  }

  function hideAuthOverlay() {
    document.getElementById("auth-overlay")?.classList.add("hidden");
    document.getElementById("main-app")?.classList.remove("hidden");
    // 触发一次 reflow，避免从登录页切入后主区域仍沿用窄屏宽度
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }

  function updateUserBar() {
    const bar = document.getElementById("user-bar");
    const nameEl = document.getElementById("current-username");
    const guestEl = document.getElementById("guest-badge");
    if (!bar) return;

    if (currentUser) {
      bar.classList.remove("hidden");
      nameEl.textContent = currentUser.username;
      guestEl?.classList.add("hidden");
    } else if (isGuest) {
      bar.classList.remove("hidden");
      nameEl.textContent = "游客";
      guestEl?.classList.remove("hidden");
    } else {
      bar.classList.add("hidden");
    }
  }

  function enterAsGuest() {
    isGuest = true;
    currentUser = null;
    currentMembership = { isPremium: false, plan: "free", premiumUntil: null };
    hideAuthOverlay();
    updateUserBar();
    notify();
  }

  function showApp(user, membership) {
    currentUser = user;
    currentMembership = membership || { isPremium: false, plan: "free", premiumUntil: null };
    isGuest = false;
    hideAuthOverlay();
    updateUserBar();
    notify();
  }

  function showAuth() {
    currentUser = null;
    currentMembership = { isPremium: false, plan: "free", premiumUntil: null };
    isGuest = false;
    showAuthOverlay();
    updateUserBar();
    notify();
  }

  function switchAuthTab(tab) {
    document.querySelectorAll(".auth-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    document.querySelectorAll(".auth-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `panel-${tab}`);
    });
    if (tab !== "forgot") {
      document.getElementById("forgot-step2")?.classList.add("step-hidden");
      const st = document.getElementById("forgot-status");
      if (st) st.textContent = "";
    }
  }

  function requireLogin(message = "请先登录以使用此功能") {
    if (currentUser) return true;
    showToast(message);
    showAuthOverlay();
    return false;
  }

  function isLoggedIn() {
    return Boolean(currentUser);
  }

  function isPremium() {
    return Boolean(currentMembership?.isPremium);
  }

  function getUser() {
    return currentUser;
  }

  function getMembership() {
    return currentMembership;
  }

  async function refreshMembership() {
    if (!currentUser) return currentMembership;
    const data = await api("/api/membership");
    currentMembership = data.membership;
    notify();
    return currentMembership;
  }

  async function redeemCode(code) {
    if (!requireLogin("登录后才能兑换会员码")) return null;
    const data = await api("/api/membership/redeem", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    currentMembership = data.membership;
    notify();
    return data;
  }

  async function checkSession() {
    try {
      const data = await api("/api/me");
      showApp(data.user, data.membership);
      return data.user;
    } catch {
      if (!isGuest) showAuthOverlay();
      return null;
    }
  }

  function bindEvents() {
    document.querySelectorAll(".auth-tab").forEach((btn) => {
      btn.addEventListener("click", () => switchAuthTab(btn.dataset.tab));
    });

    document.getElementById("guest-btn")?.addEventListener("click", enterAsGuest);

    document.getElementById("login-btn")?.addEventListener("click", async () => {
      const status = document.getElementById("login-status");
      setStatus(status, "登录中…", "loading");
      try {
        const data = await api("/api/login", {
          method: "POST",
          body: JSON.stringify({
            username: document.getElementById("login-username").value,
            password: document.getElementById("login-password").value,
          }),
        });
        setStatus(status, data.message, "success");
        showApp(data.user, data.membership);
      } catch (err) {
        setStatus(status, err.message, "error");
      }
    });

    document.getElementById("register-btn")?.addEventListener("click", async () => {
      const status = document.getElementById("register-status");
      setStatus(status, "注册中…", "loading");
      try {
        const data = await api("/api/register", {
          method: "POST",
          body: JSON.stringify({
            username: document.getElementById("reg-username").value,
            password: document.getElementById("reg-password").value,
            securityQuestion: document.getElementById("reg-question").value,
            securityAnswer: document.getElementById("reg-answer").value,
          }),
        });
        setStatus(status, data.message, "success");
        showApp(data.user, data.membership);
      } catch (err) {
        setStatus(status, err.message, "error");
      }
    });

    document.getElementById("fetch-question-btn")?.addEventListener("click", async () => {
      const status = document.getElementById("forgot-status");
      const username = document.getElementById("forgot-username").value.trim();
      if (!username) return setStatus(status, "请先填写用户名", "error");
      setStatus(status, "获取中…", "loading");
      try {
        const data = await api(`/api/forgot-password/question?username=${encodeURIComponent(username)}`);
        document.getElementById("security-question-text").textContent = data.securityQuestion;
        document.getElementById("forgot-step2").classList.remove("step-hidden");
        setStatus(status, "请回答保密问题并设置新密码", "");
      } catch (err) {
        setStatus(status, err.message, "error");
        document.getElementById("forgot-step2").classList.add("step-hidden");
      }
    });

    document.getElementById("reset-password-btn")?.addEventListener("click", async () => {
      const status = document.getElementById("forgot-status");
      setStatus(status, "重置中…", "loading");
      try {
        const data = await api("/api/forgot-password/reset", {
          method: "POST",
          body: JSON.stringify({
            username: document.getElementById("forgot-username").value.trim(),
            securityAnswer: document.getElementById("forgot-answer").value,
            newPassword: document.getElementById("forgot-new-password").value,
          }),
        });
        setStatus(status, data.message, "success");
        document.getElementById("forgot-step2").classList.add("step-hidden");
        setTimeout(() => switchAuthTab("login"), 1500);
      } catch (err) {
        setStatus(status, err.message, "error");
      }
    });

    document.getElementById("logout-btn")?.addEventListener("click", async () => {
      if (typeof Vocab !== "undefined" && Vocab.persistBeforeLogout) {
        await Vocab.persistBeforeLogout();
      }
      await api("/api/logout", { method: "POST" }).catch(() => {});
      showAuth();
    });

    ["login-password", "reg-answer"].forEach((id) => {
      document.getElementById(id)?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const action = id === "login-password" ? "login-btn" : "register-btn";
          document.getElementById(action)?.click();
        }
      });
    });
  }

  return {
    onChange,
    bindEvents,
    checkSession,
    requireLogin,
    isLoggedIn,
    isPremium,
    getUser,
    getMembership,
    refreshMembership,
    redeemCode,
    api,
    showAuth,
    enterAsGuest,
  };
})();
