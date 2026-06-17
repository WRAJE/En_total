# 词途 · 统一英语学习平台

将三个独立项目优雅合并为一个完整的 Web 应用：

| 原项目 | 功能 | 合并位置 |
|--------|------|----------|
| `toefl-vocab-buddy` | TOEFL 词汇学习、艾宾浩斯复习、游戏化 | 主界面 + `public/js/vocab.js` |
| `Eg_ds_user-demo` | 用户注册登录、AI 造句评分 | `server.js` 认证 API + `public/js/sentence.js` |
| `self coding` | 用户数据持久化（源码已缺失） | `user_progress` 云端同步 |

## 功能一览

- **Word Toolkit**：查词、手动加词、TOEFL / IELTS 分类词库
- **Daily Routine**：每日推荐单词 + 浏览器通知提醒
- **词汇学习**：收藏、艾宾浩斯复习、周测、免费闯关
- **AI 造句**：输入 5+ 单词造句，DeepSeek 智能评分（需登录）
- **AI 对话**：用目标单词进行真实 AI 对话练习（需登录）
- **Premium 游戏化**：Speed Match、Spelling Sprint、Meaning Duel 三个高级游戏
- **Bubble Run 跑酷**：IELTS 词汇海绵宝宝跑酷（独立页面 [`/bubbles`](http://localhost:5567/bubbles)），登录后免费体验 3 次，Premium 无限
- **扫码付费 / 会员码**：扫码付款后输入会员码解锁 Premium
- **用户系统**：注册 / 登录 / 保密问题找回密码
- **云端同步**：登录后学习进度自动备份到 SQLite
- **游客模式**：无需登录即可使用词汇学习（数据仅存本地）

## 快速开始

```bash
cd En_total
npm install
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY
npm start
```

浏览器访问：

- **主站**：http://localhost:5567
- **Bubble Run 跑酷**：http://localhost:5567/bubbles（需先登录，与主站共享 Cookie）

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `HOST` | `0.0.0.0` | 监听地址（`0.0.0.0` 允许外网访问） |
| `PORT` | `5567` | 服务端口 |
| `JWT_SECRET` | 内置开发密钥 | 生产环境务必修改 |
| `DEEPSEEK_API_KEY` | — | DeepSeek API Key（AI 功能必需） |
| `DEEPSEEK_MODEL` | `deepseek-chat` | 模型名称 |
| `PREMIUM_CODES` | `TOEFLIELTS-PREMIUM-2026,WORDS-GOLD-30` | 可兑换会员码列表 |
| `PREMIUM_DURATION_DAYS` | `365` | 每个会员码解锁天数 |
| `PREMIUM_PRICE_LABEL` | `¥29 / 月` | 前端显示价格 |
| `PAYMENT_QR_IMAGE` | — | 付款二维码图片 URL |
| `BUBBLES_FREE_PLAYS` | `3` | Bubble Run 登录用户免费体验次数 |

## 项目结构

```
En_total/
├── server.js              # Express 后端（认证 + AI 代理 + 进度同步）
├── package.json
├── .env.example
├── public/
│   ├── index.html         # 统一前端入口
│   ├── styles.css
│   ├── bubbles/           # Bubble Run 独立游戏页（/bubbles）
│   │   ├── index.html
│   │   └── css/style.css
│   └── js/
│       ├── auth.js        # 用户认证
│       ├── premium.js     # 会员码 + 高级游戏
│       ├── bubbles/       # 跑酷游戏模块（app.js + game 等）
│       ├── sentence.js    # 造句练习
│       └── vocab.js       # 词汇学习核心 / 每日提醒
├── data/
│   └── users.db           # SQLite（自动创建）
├── toefl-vocab-buddy/     # 原始项目（归档）
├── Eg_ds_user-demo/       # 原始项目（归档）
└── self coding/           # 原始项目（源码缺失，仅 node_modules）
```

## API 接口

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/register` | 注册 |
| POST | `/api/login` | 登录 |
| POST | `/api/logout` | 退出 |
| GET | `/api/me` | 当前用户 |
| GET | `/api/membership` | 当前会员状态 |
| POST | `/api/membership/redeem` | 兑换会员码 |

### AI（需登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/sentence` | 造句评分 |
| POST | `/api/ai/chat` | AI 单词对话 |

### Bubble Run（需登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/bubbles/quota` | 查询剩余免费次数 |
| POST | `/api/bubbles/play` | 开始一局（消耗 1 次免费额度） |
| POST | `/api/bubbles/chat` | SpongeBob AI 对话（DeepSeek 代理） |

### 进度同步（需登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/progress` | 获取云端进度 |
| PUT | `/api/progress` | 上传进度 |

### Freemium 权限

| 功能 | Free | Premium |
|------|------|---------|
| 查词 / 手动加词 / 分类词库 | ✅ | ✅ |
| 个人词库与云端同步 | ✅（需登录） | ✅ |
| 每日单词提醒 | ✅ | ✅ |
| 免费闯关 | ✅ | ✅ |
| Bubble Run 跑酷 | 3 次（需登录） | ✅ 无限 |
| 三个高级竞技游戏 | — | ✅ |

## 设计说明

- **统一入口**：一个页面、一套视觉风格（深色主题 + DM Sans）
- **模块化前端**：`auth.js` / `sentence.js` / `premium.js` / `vocab.js` 各司其职；跑酷为独立 route `/bubbles`，共用 `js/bubbles/*` 模块
- **安全改进**：DeepSeek API Key 移至服务端，不再暴露在前端
- **渐进式体验**：游客可学词汇，登录解锁 AI 与云端同步，会员码解锁高级游戏

## License

MIT
