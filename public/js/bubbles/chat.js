const SpongeBobChat = {
  history: [],
  isLoading: false,

  async sendMessage(userText) {
    if (this.isLoading) return;
    if (!Auth.isLoggedIn()) return;
    this.isLoading = true;
    this.addMessage("user", userText);

    try {
      const wordbook = Wordbook.getAll();
      const messages = [...this.history.slice(-10), { role: "user", content: userText }];
      const data = await Auth.api("/api/bubbles/chat", {
        method: "POST",
        body: JSON.stringify({ messages, wordbook }),
      });
      this.history.push({ role: "user", content: userText });
      this.history.push({ role: "assistant", content: data.content });
      this.addMessage("spongebob", data.content);
    } catch (err) {
      const msg =
        err.message.includes("试用次数") || err.message.includes("Premium")
          ? "OH NO! 你的 Bubble Run 试用次数用完了！开通 Premium 我才能继续陪你背单词！🧽"
          : `BWOOOP! ERROR: ${err.message.slice(0, 120)} 🫧`;
      this.addMessage("spongebob", msg);
    } finally {
      this.isLoading = false;
    }
  },

  addMessage(who, text) {
    const container = document.getElementById("chat-messages");
    if (!container) return;

    const div = document.createElement("div");
    div.className = `chat-msg ${who}-msg`;
    div.innerHTML = `
      <div class="chat-avatar">${who === "spongebob" ? "🧽" : "👤"}</div>
      <div class="chat-bubble">
        <div class="chat-name">${who === "spongebob" ? "SpongeBob" : "You"}</div>
        <div class="chat-text">${this.formatText(text)}</div>
      </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    const inputArea = document.getElementById("chat-input-area");
    const input = document.getElementById("chat-input");
    const sendBtn = document.getElementById("chat-send-btn");
    if (who === "spongebob") {
      inputArea?.classList.remove("loading");
      if (input) input.disabled = false;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Send";
      }
    } else {
      inputArea?.classList.add("loading");
      if (input) input.disabled = true;
      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = "🧽...";
      }
    }
  },

  formatText(text) {
    return String(text)
      .replace(/\n/g, "<br>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  },

  clearChat() {
    this.history = [];
    const container = document.getElementById("chat-messages");
    if (container) {
      container.innerHTML = `
        <div class="chat-welcome">
          <div class="chat-welcome-icon">🧽</div>
          <div class="chat-welcome-text">
            HI EVERYBODY! 🎉 I'm SpongeBob SquarePants!<br><br>
            Tell me which words you're stuck on!<br><br>
            I'M READY! I'M READY! I'M READY!
          </div>
        </div>
      `;
    }
    const input = document.getElementById("chat-input");
    if (input) input.value = "";
    document.getElementById("chat-input-area")?.classList.remove("loading");
    if (input) input.disabled = false;
    const sendBtn = document.getElementById("chat-send-btn");
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = "Send";
    }
  },

  init() {
    this.clearChat();
    document.getElementById("chat-send-btn")?.addEventListener("click", () => this.sendFromInput());
    document.getElementById("chat-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendFromInput();
      }
    });
  },

  sendFromInput() {
    const input = document.getElementById("chat-input");
    const text = input?.value.trim();
    if (!text || this.isLoading) return;
    input.value = "";
    this.sendMessage(text);
  },
};
