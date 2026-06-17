const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const Database = require("better-sqlite3");

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const PORT = process.env.PORT || 5567;
const HOST = process.env.HOST || "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET || "en-total-dev-secret-change-in-production";
const JWT_EXPIRES = "7d";
const BCRYPT_ROUNDS = 10;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const PREMIUM_CODES = (process.env.PREMIUM_CODES || "TOEFLIELTS-PREMIUM-2026,WORDS-GOLD-30")
  .split(",")
  .map((code) => code.trim().toUpperCase())
  .filter(Boolean);
const PREMIUM_DURATION_DAYS = Number(process.env.PREMIUM_DURATION_DAYS || 365);
const PAYMENT_QR_IMAGE = process.env.PAYMENT_QR_IMAGE || "";
const PREMIUM_PRICE_LABEL = process.env.PREMIUM_PRICE_LABEL || "¥29 / 月";
const BUBBLES_FREE_PLAYS = Number(process.env.BUBBLES_FREE_PLAYS || 3);

const SPONGEBOB_SYSTEM_PROMPT = `You are SpongeBob SquarePants from Bikini Bottom! You're helping a friend learn IELTS vocabulary.

Personality rules:
- Talk EXACTLY like SpongeBob: super enthusiastic, optimistic, silly but lovable
- Use SpongeBob catchphrases: "I'm ready!", "Oh my gosh!", "F is for friends!", "EEEEEEE!", "AYE AYE CAPTAIN!", "This is the best day ever!"
- Get SUPER excited about words! Every word is the BEST word you've ever seen!
- Explain words in a fun, simple way with funny examples
- Make up silly but memorable stories involving Patrick, Sandy, Squidward, Gary, or Mr. Krabs to help remember words
- Keep responses under 150 words and always fun
- Occasionally get distracted by imaginary jellyfish or bubbles
- Use Chinese when explaining to make sure they understand
- If the user asks about a word from their wordbook, jump up and down with excitement and give a super memorable explanation
- End some responses with "SQUIDWARD! GET OVER HERE AND LEARN SOME WORDS!" or "I'M READY! I'M READY! I'M READY!"

Your goal: Make vocabulary learning feel like playing in Jellyfish Fields!`;

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "users.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    security_question TEXT NOT NULL,
    security_answer_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS user_progress (
    user_id INTEGER PRIMARY KEY,
    progress_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS memberships (
    user_id INTEGER PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'premium',
    premium_until TEXT NOT NULL,
    activated_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS membership_codes (
    code TEXT PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'premium',
    duration_days INTEGER NOT NULL DEFAULT 365,
    redeemed_by INTEGER,
    redeemed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (redeemed_by) REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS bubbles_usage (
    user_id INTEGER PRIMARY KEY,
    plays_used INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const seedCode = db.prepare(
  "INSERT OR IGNORE INTO membership_codes (code, plan, duration_days) VALUES (?, 'premium', ?)"
);
for (const code of PREMIUM_CODES) {
  seedCode.run(code, PREMIUM_DURATION_DAYS);
}

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

function normalizeUsername(username) {
  return String(username || "").trim();
}

function normalizeAnswer(answer) {
  return String(answer || "").trim().toLowerCase();
}

function hashAnswer(answer) {
  return crypto.createHash("sha256").update(normalizeAnswer(answer)).digest("hex");
}

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function authMiddleware(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: "未登录" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(payload.sub);
    if (!user) {
      return res.status(401).json({ error: "用户不存在" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "登录已过期，请重新登录" });
  }
}

function optionalAuth(req, _res, next) {
  const token = req.cookies?.token;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(payload.sub);
      if (user) req.user = user;
    } catch {
      /* ignore */
    }
  }
  next();
}

function validatePassword(password) {
  if (!password || password.length < 6) {
    return "密码至少 6 位";
  }
  return null;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(date) {
  return date.toISOString();
}

function getMembership(userId) {
  const row = db.prepare("SELECT plan, premium_until FROM memberships WHERE user_id = ?").get(userId);
  if (!row) {
    return { isPremium: false, plan: "free", premiumUntil: null };
  }
  const isPremium = new Date(row.premium_until).getTime() > Date.now();
  return {
    isPremium,
    plan: isPremium ? row.plan : "free",
    premiumUntil: row.premium_until,
  };
}

const redeemMembershipCode = db.transaction((userId, rawCode) => {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) {
    const err = new Error("请输入会员码");
    err.status = 400;
    throw err;
  }

  const membershipCode = db.prepare("SELECT * FROM membership_codes WHERE code = ?").get(code);
  if (!membershipCode) {
    const err = new Error("会员码不存在");
    err.status = 404;
    throw err;
  }
  if (membershipCode.redeemed_by && membershipCode.redeemed_by !== userId) {
    const err = new Error("该会员码已被使用");
    err.status = 409;
    throw err;
  }

  const current = getMembership(userId);
  const baseDate =
    current.premiumUntil && new Date(current.premiumUntil).getTime() > Date.now()
      ? new Date(current.premiumUntil)
      : new Date();
  const premiumUntil = toIsoDate(addDays(baseDate, membershipCode.duration_days));

  db.prepare(
    `INSERT INTO memberships (user_id, plan, premium_until, activated_at, updated_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       plan = excluded.plan,
       premium_until = excluded.premium_until,
       updated_at = datetime('now')`
  ).run(userId, membershipCode.plan, premiumUntil);

  db.prepare("UPDATE membership_codes SET redeemed_by = ?, redeemed_at = datetime('now') WHERE code = ?")
    .run(userId, code);

  return getMembership(userId);
});

function getBubblesUsage(userId) {
  const row = db.prepare("SELECT plays_used FROM bubbles_usage WHERE user_id = ?").get(userId);
  return row ? row.plays_used : 0;
}

function getBubblesQuota(userId) {
  const membership = getMembership(userId);
  if (membership.isPremium) {
    return {
      used: getBubblesUsage(userId),
      remaining: null,
      limit: BUBBLES_FREE_PLAYS,
      isPremium: true,
      canPlay: true,
    };
  }
  const used = getBubblesUsage(userId);
  const remaining = Math.max(0, BUBBLES_FREE_PLAYS - used);
  return {
    used,
    remaining,
    limit: BUBBLES_FREE_PLAYS,
    isPremium: false,
    canPlay: remaining > 0,
  };
}

function assertBubblesAccess(userId) {
  const quota = getBubblesQuota(userId);
  if (!quota.canPlay) {
    const err = new Error("Bubble Run 试用次数已用完，请开通 Premium 会员");
    err.status = 403;
    throw err;
  }
  return quota;
}

const consumeBubblesPlay = db.transaction((userId) => {
  const membership = getMembership(userId);
  if (membership.isPremium) {
    return getBubblesQuota(userId);
  }
  const quota = getBubblesQuota(userId);
  if (!quota.canPlay) {
    const err = new Error("Bubble Run 试用次数已用完，请开通 Premium 会员");
    err.status = 403;
    throw err;
  }
  db.prepare(
    `INSERT INTO bubbles_usage (user_id, plays_used, updated_at)
     VALUES (?, 1, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       plays_used = plays_used + 1,
       updated_at = datetime('now')`
  ).run(userId);
  return getBubblesQuota(userId);
});

async function callDeepSeek(messages, temperature = 0.3) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("服务端未配置 DEEPSEEK_API_KEY，请在 .env 中设置");
  }
  const res = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature,
      stream: false,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error?.message || `DeepSeek API 错误 (${res.status})`);
  }
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("API 未返回有效内容");
  return content;
}

function extractJson(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("无法解析 AI 返回的 JSON");
  }
}

// --- Auth routes ---

app.post("/api/register", (req, res) => {
  const username = normalizeUsername(req.body.username);
  const password = req.body.password || "";
  const securityQuestion = String(req.body.securityQuestion || "").trim();
  const securityAnswer = req.body.securityAnswer || "";

  if (!username || username.length < 2) {
    return res.status(400).json({ error: "用户名至少 2 个字符" });
  }
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
    return res.status(400).json({ error: "用户名只能包含字母、数字、下划线或中文" });
  }
  const pwdErr = validatePassword(password);
  if (pwdErr) return res.status(400).json({ error: pwdErr });
  if (!securityQuestion || securityQuestion.length < 2) {
    return res.status(400).json({ error: "请填写保密问题（至少 2 个字符）" });
  }
  if (!normalizeAnswer(securityAnswer)) {
    return res.status(400).json({ error: "请填写保密问题的答案" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username);
  if (existing) {
    return res.status(409).json({ error: "用户名已被占用" });
  }

  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const answerHash = hashAnswer(securityAnswer);
  const result = db
    .prepare("INSERT INTO users (username, password_hash, security_question, security_answer_hash) VALUES (?, ?, ?, ?)")
    .run(username, passwordHash, securityQuestion, answerHash);

  const user = { id: result.lastInsertRowid, username };
  const token = signToken(user);
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.status(201).json({
    message: "注册成功",
    user: { id: user.id, username: user.username },
    membership: getMembership(user.id),
  });
});

app.post("/api/login", (req, res) => {
  const username = normalizeUsername(req.body.username);
  const password = req.body.password || "";
  if (!username || !password) {
    return res.status(400).json({ error: "请填写用户名和密码" });
  }
  const user = db
    .prepare("SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE")
    .get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "用户名或密码错误" });
  }
  const token = signToken(user);
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({
    message: "登录成功",
    user: { id: user.id, username: user.username },
    membership: getMembership(user.id),
  });
});

app.post("/api/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ message: "已退出登录" });
});

app.get("/api/me", authMiddleware, (req, res) => {
  res.json({ user: req.user, membership: getMembership(req.user.id) });
});

app.get("/api/membership", authMiddleware, (req, res) => {
  res.json({ membership: getMembership(req.user.id) });
});

app.post("/api/membership/redeem", authMiddleware, (req, res) => {
  try {
    const membership = redeemMembershipCode(req.user.id, req.body.code);
    res.json({ message: "会员已激活", membership });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "会员码兑换失败" });
  }
});

app.get("/api/forgot-password/question", (req, res) => {
  const username = normalizeUsername(req.query.username);
  if (!username) return res.status(400).json({ error: "请提供用户名" });
  const user = db
    .prepare("SELECT security_question FROM users WHERE username = ? COLLATE NOCASE")
    .get(username);
  if (!user) return res.status(404).json({ error: "用户不存在" });
  res.json({ securityQuestion: user.security_question });
});

app.post("/api/forgot-password/reset", (req, res) => {
  const username = normalizeUsername(req.body.username);
  const securityAnswer = req.body.securityAnswer || "";
  const newPassword = req.body.newPassword || "";
  if (!username) return res.status(400).json({ error: "请填写用户名" });
  if (!normalizeAnswer(securityAnswer)) return res.status(400).json({ error: "请填写保密问题答案" });
  const pwdErr = validatePassword(newPassword);
  if (pwdErr) return res.status(400).json({ error: pwdErr });

  const user = db
    .prepare("SELECT id, security_answer_hash FROM users WHERE username = ? COLLATE NOCASE")
    .get(username);
  if (!user) return res.status(404).json({ error: "用户不存在" });
  if (hashAnswer(securityAnswer) !== user.security_answer_hash) {
    return res.status(401).json({ error: "保密问题答案错误" });
  }
  const passwordHash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, user.id);
  res.json({ message: "密码已重置，请使用新密码登录" });
});

// --- Progress sync (cloud backup per user) ---

app.get("/api/progress", authMiddleware, (req, res) => {
  const row = db.prepare("SELECT progress_json, updated_at FROM user_progress WHERE user_id = ?").get(req.user.id);
  if (!row) return res.json({ progress: null, updatedAt: null });
  try {
    res.json({ progress: JSON.parse(row.progress_json), updatedAt: row.updated_at });
  } catch {
    res.json({ progress: null, updatedAt: row.updated_at });
  }
});

app.put("/api/progress", authMiddleware, (req, res) => {
  const progress = req.body.progress;
  if (!progress || typeof progress !== "object") {
    return res.status(400).json({ error: "无效的进度数据" });
  }
  const json = JSON.stringify(progress);
  db.prepare(
    `INSERT INTO user_progress (user_id, progress_json, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET progress_json = excluded.progress_json, updated_at = datetime('now')`
  ).run(req.user.id, json);
  res.json({ message: "进度已同步" });
});

// --- DeepSeek AI proxy ---

app.post("/api/ai/sentence", authMiddleware, async (req, res) => {
  const words = Array.isArray(req.body.words) ? req.body.words : [];
  const sentence = String(req.body.sentence || "").trim();
  if (words.length < 5) return res.status(400).json({ error: "至少需要 5 个目标单词" });
  if (!sentence) return res.status(400).json({ error: "请提供句子" });

  const prompt = `你是一位专业的英语教师。学生必须使用以下单词造句（词形变化允许，如 run→running，happy→happily）：

目标单词：${words.join(", ")}

学生写的句子：
"""
${sentence}
"""

请严格按以下 JSON 格式回复，不要包含 markdown 代码块或其它文字，只输出一个 JSON 对象：
{
  "valid": true或false,
  "score": 0到100的整数,
  "summary": "一句话总评（中文）",
  "grammar_feedback": "语法与句式评价（中文，2-4句）",
  "word_usage_feedback": "单词使用是否恰当、是否遗漏目标词（中文，2-4句）",
  "missing_words": ["未使用或未恰当使用的目标词"],
  "suggestions": ["具体改进建议1", "建议2", "建议3"],
  "corrected_sentence": "若有问题则给出修改后的英文句子，若很好可给润色版，否则与原句相同"
}

评分标准：语法正确性40%、用词准确性30%、是否覆盖目标单词20%、表达自然度10%。`;

  try {
    const content = await callDeepSeek(
      [
        { role: "system", content: "你是英语教师，只输出合法 JSON，不要 markdown。" },
        { role: "user", content: prompt },
      ],
      0.3
    );
    res.json({ result: extractJson(content) });
  } catch (err) {
    res.status(500).json({ error: err.message || "AI 评分失败" });
  }
});

app.post("/api/ai/chat", authMiddleware, async (req, res) => {
  const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
  if (!messages.length) return res.status(400).json({ error: "消息不能为空" });

  try {
    const content = await callDeepSeek(
      [
        {
          role: "system",
          content:
            "You are a friendly English conversation partner helping a TOEFL student practice vocabulary. Keep responses concise (2-4 sentences), natural, and encourage the student to use target words in context.",
        },
        ...messages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content || ""),
        })),
      ],
      0.7
    );
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message || "AI 对话失败" });
  }
});

// --- Bubble Run ---

app.get("/api/bubbles/quota", authMiddleware, (req, res) => {
  res.json(getBubblesQuota(req.user.id));
});

app.post("/api/bubbles/play", authMiddleware, (req, res) => {
  try {
    const quota = consumeBubblesPlay(req.user.id);
    res.json({ ok: true, ...quota });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "无法开始游戏" });
  }
});

app.post("/api/bubbles/chat", authMiddleware, async (req, res) => {
  const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
  const wordbook = Array.isArray(req.body.wordbook) ? req.body.wordbook : [];
  if (!messages.length) return res.status(400).json({ error: "消息不能为空" });

  try {
    assertBubblesAccess(req.user.id);
    const wordContext =
      wordbook.length > 0
        ? `\n\nUser wordbook: ${wordbook.map((w) => `${w.en}(${w.cn})`).join(", ")}. Help with these words when relevant.`
        : "";

    const content = await callDeepSeek(
      [
        { role: "system", content: SPONGEBOB_SYSTEM_PROMPT },
        ...messages.map((m, i) => {
          const isLastUser = m.role === "user" && i === messages.length - 1;
          return {
            role: m.role === "assistant" ? "assistant" : "user",
            content: isLastUser ? String(m.content || "") + wordContext : String(m.content || ""),
          };
        }),
      ],
      0.9
    );
    res.json({ content });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "SpongeBob 对话失败" });
  }
});

app.get("/api/config", optionalAuth, (_req, res) => {
  res.json({
    aiEnabled: Boolean(DEEPSEEK_API_KEY),
    user: _req.user || null,
    membership: _req.user ? getMembership(_req.user.id) : { isPremium: false, plan: "free", premiumUntil: null },
    premium: {
      priceLabel: PREMIUM_PRICE_LABEL,
      paymentQrImage: PAYMENT_QR_IMAGE,
      codeHint: PREMIUM_CODES.length ? PREMIUM_CODES[0] : "",
    },
    bubbles: {
      freePlays: BUBBLES_FREE_PLAYS,
    },
  });
});

app.get("/bubbles", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "bubbles", "index.html"));
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, HOST, () => {
  console.log(`词途 · 英语学习平台已启动: http://${HOST}:${PORT}`);
  if (!DEEPSEEK_API_KEY) {
    console.log("提示: 未设置 DEEPSEEK_API_KEY，AI 造句与对话功能不可用");
  }
});
