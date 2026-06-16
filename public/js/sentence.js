/**
 * 造句练习模块 — DeepSeek 智能评分（经后端代理）
 */
const Sentence = (() => {
  let targetWords = [];

  function $(sel) {
    return document.querySelector(sel);
  }

  function setStatus(el, msg, type = "") {
    if (!el) return;
    el.textContent = msg;
    el.className = "status" + (type ? ` ${type}` : "");
  }

  function parseWords(raw) {
    return raw
      .split(/[\s,，;；\n]+/)
      .map((w) => w.trim().toLowerCase().replace(/[^a-z'-]/gi, ""))
      .filter(Boolean);
  }

  function wordUsedInSentence(word, sentence) {
    const lower = sentence.toLowerCase();
    const base = word.replace(/(ing|ed|es|s)$/i, "");
    return lower.includes(word) || (base.length >= 3 && lower.includes(base));
  }

  function renderWordTags(sentence = "") {
    const el = $("#word-tags");
    if (!el) return;
    el.innerHTML = targetWords
      .map((w) => {
        const used = sentence && wordUsedInSentence(w, sentence);
        const cls = sentence ? (used ? "used" : "missing") : "";
        return `<span class="word-tag ${cls}">${escapeHtml(w)}</span>`;
      })
      .join("");
  }

  function scoreClass(score) {
    if (score >= 80) return "high";
    if (score >= 60) return "mid";
    return "low";
  }

  function renderResult(data, sentence) {
    const score = Math.min(100, Math.max(0, Number(data.score) || 0));
    const valid = Boolean(data.valid);
    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
    const missing = Array.isArray(data.missing_words) ? data.missing_words : [];

    $("#result-content").innerHTML = `
      <div class="score-ring">
        <div class="score-circle ${scoreClass(score)}">${score}</div>
        <div>
          <p class="verdict ${valid ? "valid" : "invalid"}">${valid ? "句子成立" : "句子需要改进"}</p>
          <p>${escapeHtml(data.summary || "")}</p>
        </div>
      </div>
      <div class="feedback-block">
        <h3>语法与句式</h3>
        <p>${escapeHtml(data.grammar_feedback || "—")}</p>
      </div>
      <div class="feedback-block">
        <h3>单词使用</h3>
        <p>${escapeHtml(data.word_usage_feedback || "—")}</p>
        ${missing.length ? `<p class="missing-hint">待加强：${missing.map(escapeHtml).join(", ")}</p>` : ""}
      </div>
      ${suggestions.length ? `
      <div class="feedback-block">
        <h3>改进建议</h3>
        <ul class="suggestions">${suggestions.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
      </div>` : ""}
      ${data.corrected_sentence ? `
      <div class="feedback-block">
        <h3>参考修改 / 润色</h3>
        <p class="corrected">${escapeHtml(data.corrected_sentence)}</p>
      </div>` : ""}
      <div class="feedback-block">
        <h3>你的原句</h3>
        <p>${escapeHtml(sentence)}</p>
      </div>
    `;
    $("#result-card").classList.remove("hidden");
  }

  function importFromVocab(words) {
    if (!words?.length) return;
    const input = $("#words-input");
    if (input) {
      input.value = words.slice(0, 10).join(", ");
      setStatus($("#words-status"), `已从词库导入 ${Math.min(words.length, 10)} 个单词`, "success");
    }
  }

  function confirmWords() {
    if (!Auth.requireLogin("登录后可使用 AI 造句评分")) return;

    const list = [...new Set(parseWords($("#words-input").value))];
    if (list.length < 5) {
      setStatus($("#words-status"), `请至少输入 5 个不同的英文单词（当前 ${list.length} 个）。`, "error");
      return;
    }
    targetWords = list;
    $("#words-input").value = list.join(", ");
    setStatus($("#words-status"), `已选定 ${list.length} 个单词，请在下方造句。`, "success");
    $("#step-sentence").classList.remove("hidden");
    $("#result-card").classList.add("hidden");
    $("#sentence-input").value = "";
    $("#sentence-input").focus();
    renderWordTags();
  }

  async function evaluateSentence() {
    if (!Auth.requireLogin()) return;

    const sentence = $("#sentence-input").value.trim();
    if (!sentence) return setStatus($("#sentence-status"), "请先写下你的句子。", "error");
    if (sentence.length < 10) return setStatus($("#sentence-status"), "句子太短，请写完整一些的英文句子。", "error");

    renderWordTags(sentence);
    const btn = $("#evaluate-btn");
    const label = $("#evaluate-label");
    btn.disabled = true;
    label.innerHTML = '<span class="spinner"></span> AI 评分中…';
    setStatus($("#sentence-status"), "正在调用 DeepSeek 分析句子，请稍候…", "loading");

    try {
      const data = await Auth.api("/api/ai/sentence", {
        method: "POST",
        body: JSON.stringify({ words: targetWords, sentence }),
      });
      renderResult(data.result, sentence);
      setStatus($("#sentence-status"), "评分完成。", "success");
      if (typeof addXP === "function") addXP(10, "造句练习");
    } catch (err) {
      setStatus($("#sentence-status"), err.message, "error");
    } finally {
      btn.disabled = false;
      label.textContent = "提交评分";
    }
  }

  function bindEvents() {
    $("#confirm-words-btn")?.addEventListener("click", confirmWords);
    $("#evaluate-btn")?.addEventListener("click", evaluateSentence);
    $("#import-vocab-btn")?.addEventListener("click", () => {
      if (typeof getRecentMasteredWords === "function") {
        importFromVocab(getRecentMasteredWords());
      } else {
        showToast("暂无已掌握单词可导入");
      }
    });
    $("#back-words-btn")?.addEventListener("click", () => {
      $("#step-sentence").classList.add("hidden");
      $("#result-card").classList.add("hidden");
      setStatus($("#words-status"), "", "");
    });
    $("#retry-btn")?.addEventListener("click", () => {
      $("#result-card").classList.add("hidden");
      $("#sentence-input").value = "";
      $("#sentence-input").focus();
      renderWordTags();
      setStatus($("#sentence-status"), "", "");
    });
    $("#new-words-btn")?.addEventListener("click", () => {
      $("#step-sentence").classList.add("hidden");
      $("#result-card").classList.add("hidden");
      targetWords = [];
      $("#words-input").value = "";
      $("#words-input").focus();
      setStatus($("#words-status"), "", "");
      setStatus($("#sentence-status"), "", "");
    });
    $("#sentence-input")?.addEventListener("input", () => {
      if (targetWords.length) renderWordTags($("#sentence-input").value);
    });
    $("#words-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmWords();
    });
  }

  return { bindEvents, importFromVocab };
})();
