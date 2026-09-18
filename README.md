# 半马 AI 教练 · Half Marathon AI Coach

移动端优先的半马训练 AI 应用。定位：**不替代手表，做手表的「AI 大脑与翻译层」**——佳明/高驰/华为给数据，我们给「今天该不该休、为什么、怎么调整」的人话解释。

技术栈：**React 18 + Vite + React Router + Tailwind CSS + lucide-react**。深色运动风，主色 `#FF6B35`。

---

## 快速开始

```bash
npm install
npm run dev      # 本地开发 http://localhost:5173
npm run build    # 生产构建到 dist/
npm run preview  # 预览构建产物
```

桌面浏览器打开后会自动居中为手机宽度（max-width 460px），也可直接用手机访问。

---

## 页面结构（底部 6 个 Tab）

| Tab | 页面 | 关键功能 |
|-----|------|----------|
| 首页 | `pages/Home.jsx` | 每日红绿灯(1)、完赛预测(2)、今日任务卡、每周教练信(6)、AI陪跑入口(10) |
| 计划 | `pages/Plan.jsx` | 12周总览、周视图、赛前14天清单(7)、比赛日模拟(3)、调整记录 |
| 记录 | `pages/Records.jsx` | 跑步记录、训练效果翻译(5)、周复盘柱状图、手动添加 |
| 教练 | `pages/Coach.jsx` | AI 问答、快捷问题、疼痛决策树(4) |
| 跑团 | `pages/Team.jsx` | 周跑量排行、每周挑战、好友PK、完赛预测榜(9) |
| 我的 | `pages/Profile.jsx` | 目标设置、设备连接、跑鞋追踪(8)、订阅、隐私/免责 |

引导页 `pages/Onboarding.jsx`：目标类型 / 完赛时间 / 配速 / 比赛日 / 当前能力 / 周跑量 / 伤病史，必填校验后一键生成 12 周计划。

---

## 10 大增强功能落点

1. **每日红绿灯** — `Home.jsx` + `lib/rules.js#evaluateLight`（🟢🟡🔴⚫）
2. **完赛预测+差距** — `Home.jsx` + `lib/rules.js#predictFinish`（环形图+差距条）
3. **比赛日模拟** — `components/features/RaceSim.jsx`（赛前2-3周出现）
4. **疼痛决策树** — `components/features/PainTree.jsx`（部位+1-5级分级）
5. **训练效果翻译器** — `pages/Records.jsx` 调用 `lib/ai.js#translateTrainingEffect`
6. **每周教练信** — `Home.jsx` 调用 `lib/ai.js#generateCoachLetter`
7. **赛前14天清单** — `pages/Plan.jsx` 的 `RaceChecklist`（D-14…D-Day）
8. **跑鞋追踪** — `pages/Profile.jsx`（累计里程、500-800K 提醒、比赛推荐）
9. **跑团/好友挑战** — `pages/Team.jsx`
10. **比赛日 AI 陪跑** — `components/features/RacePace.jsx`（逐公里语音流模拟）

> 演示提示：首页底部有「（演示）体验比赛日 AI 陪跑」、计划页有「（演示）查看赛前14天清单」按钮，可一键预览这两个「时间点触发」的功能。

---

## 核心算法（规则引擎）`lib/rules.js`

- 周跑量增幅 ≤ 10%（封顶 2.2×），每 4 周减量周（75%），赛前 11 周 80% / 12 周 50% taper
- 配速区间：**轻松跑** 目标+60~90s、**马拉松配速** +15~30s、**节奏跑** -10~20s、**间歇跑** -30~60s；填了 5K/10K 优先用当前能力
- 红绿灯：基于睡眠/HRV/疼痛/近期负荷比
- 疼痛分级：1-2 减量、3 停强度、4-5 建议就医

---

## AI 集成 `lib/ai.js`

默认 `VITE_AI_PROVIDER=mock`：**本地规则引擎 + 模板**生成所有「人话」文字，完全离线可运行。

接入真实大模型（预留）：复制 `.env.example` 为 `.env`，设置：

```
VITE_AI_PROVIDER=deepseek
VITE_DEEPSEEK_API_KEY=你的key
```

`ai.js` 中的 `aiText()` 会优先调用 DeepSeek，失败/未配置时回退本地模板。所有 AI 输出均带**免责声明**。

---

## 数据模型

见 `data/mockData.js` 与 `store/AppContext.jsx`，集合对应：
`User / Workout / TrainingPlan / Feedback / ChatMessage / Shoe / Team / DailyCheck / Prediction / CoachLetter / RaceChecklist`。
当前用 `localStorage` 持久化（key `hm_coach_v1`），结构即 WorkBuddy 云数据库集合结构，迁移到云库时只需替换 `AppContext` 的读写层。

---

## 说明

- 本环境无 WorkBuddy 云运行时，故数据库层用 localStorage、AI 层用本地模拟，已按需求「无法实现的功能用模拟数据代替并说明」。
- 心率/HRV/负荷等为模拟数据，所有建议仅供参考，伤痛请及时就医。

---

## Apple 健康自动同步（Health Auto Export）

网页无法直接读取 Apple HealthKit（仅原生 iOS App 可访问）。本应用通过**轻量后端**接收「Health Auto Export」等第三方 App 从 iPhone 健康推送的跑步数据，前端自动拉取展示。

- 后端：`server/index.js`（**零依赖，仅用 Node 内置模块**），接收 `POST /api/health-export`、查询 `GET /api/workouts`、`GET /api/health`，并托管前端静态资源。
- 前端同步层：`src/lib/sync.js` + `store/AppContext.jsx`（启动自动拉取、可手动「立即同步」）。
- 「我的」页新增 **Apple 健康 · 自动同步** 卡片：显示连接状态、接收地址、一键复制与同步。

### 配置步骤
1. App Store 安装「Health Auto Export」。
2. 导出内容选「跑步 Workouts」，目标选「Webhook / URL」。
3. 填入接收地址（`我的`页可复制，形如 `https://<你的域名>/api/health-export`）。可在 `.env` 设置 `HEALTH_TOKEN`，推送时带 `?token=xxx` 或 Header `x-health-token` 校验。
4. 设置每天自动推送；回 App 点「立即同步」即可看到记录。

本地联调：先 `npm run server`（后端 8080），再 `npm run dev`（前端 5173，`/api` 已代理到 8080）。

---

## 部署（Render · 免费固定域名）

后端零依赖、容器化，用现有 `Dockerfile` + `render.yaml` 即可在 Render 免费档跑（前端 + `/api` 同一域名，休眠后冷启动约 30s）。

```bash
# 1) 推到 GitHub
git remote add origin https://github.com/<你的用户名>/half-marathon-coach.git
git push -u origin main

# 2) 在 https://dashboard.render.com 点 New+ → Blueprint，连接该仓库，Apply 即可。
#    固定域名形如：https://half-marathon-coach.onrender.com
```

平台入口：`https://half-marathon-coach.onrender.com/`。接口与页面同源，前端相对路径 `/api/*` 自动可用。
Health Auto Export 接收地址：`https://half-marathon-coach.onrender.com/api/health-export`

> 注意：Render 免费版文件系统为临时盘，重新部署后 `server/data/workouts.json` 会重置（演示数据会从前端 localStorage 兜底）；如需持久化推送数据，建议升级套餐并挂载 Render Disk。

---

## AI 模型

当前默认 `mock`（本地规则引擎 + 模板），**未接入真实大模型**。如需接 DeepSeek 实测：复制 `.env.example` 为 `.env`，设置 `VITE_AI_PROVIDER=deepseek` 与 `VITE_DEEPSEEK_API_KEY`，`lib/ai.js#aiText()` 会优先调用 `deepseek-chat` 并失败回退。
