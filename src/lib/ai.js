// AI 集成层
// ------------------------------------------------------------------
// 设计目标：所有「文字解释/对话」类需求统一走本模块。
// 默认 VITE_AI_PROVIDER=mock，使用本地模板 + 规则引擎生成带温度的文字，
// 完全离线可运行。若配置了 DeepSeek / WorkBuddy 内置 AI，则走真实接口。
//
// ⚠️ 免责声明：所有 AI 建议仅供参考，不替代医生/专业教练诊断。
// ------------------------------------------------------------------
import { fmtPace, fmtTime, fmtGap, TRAIN_TYPES } from './format.js'
import { buildPaceZones, predictFinish } from './rules.js'

const PROVIDER = import.meta.env.VITE_AI_PROVIDER || 'mock'

// 真实接口占位（配置后启用）。当前默认不调用，避免无密钥报错。
async function callDeepSeek(messages) {
  const key = import.meta.env.VITE_DEEPSEEK_API_KEY
  const url = import.meta.env.VITE_DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions'
  if (!key) return null
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.7 }),
    })
    const data = await res.json()
    return data?.choices?.[0]?.message?.content || null
  } catch (e) {
    return null
  }
}

// 统一的「AI 入口」：优先真实接口，失败/未配置则回退本地模板。
async function aiText(system, user, fallback) {
  if (PROVIDER === 'deepseek') {
    const out = await callDeepSeek([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ])
    if (out) return out
  }
  return fallback()
}

export const DISCLAIMER = '以上为 AI 基于数据的参考建议，不替代医生或专业教练诊断，伤痛请及时就医。'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 1) 训练效果翻译器
export async function translateTrainingEffect(workout, user) {
  const z = buildPaceZones(user)
  const pace = workout.pace
  let level, text
  // 依据 RPE / 心率粗略给出训练效果分 1.0~5.0
  const teScore = Math.min(5, Math.max(1, (workout.rpe || 3) * 0.7 + (workout.avgHr > 160 ? 1.5 : 0.5)))
  if (teScore >= 4) level = '高强度刺激'
  else if (teScore >= 3) level = '有效刺激'
  else if (teScore >= 2) level = '维持性'
  else level = '恢复性'

  await sleep(150)
  return await aiText(
    '你是半马教练，用一句人话翻译手表数据。',
    `配速${fmtPace(pace)}，心率${workout.avgHr}，RPE${workout.rpe}，距离${workout.distance}km`,
    () => {
      const recover = teScore >= 4 ? '强度偏高，明天建议轻松跑或休息。' : '负荷适中，按计划继续。'
      text = `${level}（训练效果 ${teScore.toFixed(1)}）。本次 ${fmtPace(pace)}/km、心率 ${workout.avgHr}，`
      if (teScore >= 4) text += '对心肺刺激明显，'
      text += recover
      return text + ' ' + DISCLAIMER
    }
  )
}

// 2) 每周教练信
export async function generateCoachLetter(user, weekStat) {
  await sleep(200)
  return await aiText(
    '你是真人教练，写一封有温度的周信。',
    `第${weekStat.weekNumber}周，计划${weekStat.planned}km，完成${weekStat.done}km`,
    () => {
      const doneRate = weekStat.planned ? weekStat.done / weekStat.planned : 0
      let body = `第 ${weekStat.weekNumber} 周小结\n`
      body += doneRate >= 0.9
        ? '这周你基本把计划都跑下来了，执行力很到位，继续保持这种节奏。\n'
        : doneRate >= 0.6
        ? '这周完成度不错，但还有几堂课没跑，下周尽量把强度课补上。\n'
        : '这周跑量偏少，别急，我们下周把节奏找回来，先保证能出门。\n'
      body += `\n亮点：本周最长一次 ${weekStat.longest || '-'}km，说明耐力底盘在打牢。\n`
      body += `不足：若 RPE 偏高，注意睡眠质量，恢复和训练一样重要。\n`
      body += `\n本周重点：${weekStat.weekNumber % 4 === 0 ? '减量恢复周，把强度降下来让身体超量恢复。' : '稳住轻松跑底盘，周二/周四的强度课别偷懒。'}\n`
      body += `必须休息日：周日务必安排完全休息，给关节和韧带放假。\n`
      body += `\n—— 你的 AI 教练`
      return body
    }
  )
}

// 3) 动态调整原因
export async function generateAdjustment(feedback, user) {
  await sleep(150)
  return await aiText(
    '根据反馈解释为何调整下周计划。',
    `RPE${feedback.rpe}，疼痛${feedback.pain}，睡眠${feedback.sleep}`,
    () => {
      if (feedback.pain >= 3) return '你反馈了明显疼痛，下周我把强度课改为轻松跑/交叉训练，并增加 1 个休息日，先恢复再上量。'
      if (feedback.sleep <= 2) return '睡眠不足会影响恢复，下周整体跑量下调 10%，把节奏跑换成轻松跑，优先补睡眠。'
      if (feedback.rpe >= 4) return '主观疲劳偏高，说明当前负荷接近上限，下周安排减量周，让身体超量恢复。'
      return '反馈整体良好，下周按计划渐进加量 5~10%，重点加强长距离耐力。'
    }
  )
}

// 4) 比赛日模拟评估
export async function generateRaceStrategy(sim) {
  await sleep(200)
  return await aiText(
    '评估比赛日模拟跑并给策略。',
    `模拟配速${fmtPace(sim.pace)}，目标配速${fmtPace(sim.targetPace)}，状态${sim.feeling}`,
    () => {
      const ok = Math.abs(sim.pace - sim.targetPace) <= 15
      let s = ok
        ? '本次模拟配速与目标非常接近，说明你的目标时间设定合理。\n'
        : sim.pace > sim.targetPace
        ? '模拟配速比目标慢一点，比赛日可尝试前慢后快，后程再提速。\n'
        : '模拟配速快于目标，注意比赛日别冲太猛，前半程压住配速。\n'
      s += '补给：每 5km 补水，10km 后补能量胶；热身 15 分钟动态拉伸；心态：前 10K 当长距离轻松跑，最后 3K 再拼。'
      return s
    }
  )
}

// 5) 完赛预测解释
export async function predictExplanation(user, pred) {
  await sleep(120)
  return await aiText(
    '解释完赛预测与差距。',
    `预测${fmtTime(pred.predictedSec)}，目标${fmtTime(pred.targetSec)}，差距${fmtGap(pred.gapSec)}`,
    () => pred.advice
  )
}

// 6) 通用 AI 问答
const QUICK_LIB = [
  { k: '半马前一周怎么练', a: '赛前 1 周进入 taper：跑量降到峰值 50%，保留 2 次短轻松跑 + 1 次赛前 3 天 3~5K 节奏激活，别尝试新训练。' },
  { k: '跑步膝盖疼怎么办', a: '先看疼痛决策树分级。常见是髌股压力，可加强臀部/大腿后侧力量、缩短步幅提高步频到 170+，疼痛≥3 级停强度。' },
  { k: '配速上不去什么原因', a: '多为有氧底盘不足 + 间歇量不够。先把每周轻松跑跑稳，再加 1 次间歇（目标配速-30~60s/km），4~6 周可见提升。' },
  { k: '怎么吃碳水加载', a: '赛前 3 天：总热量不变，碳水提到 70~80%，减少高纤油腻；比赛日早餐赛前 3 小时，易吸收碳水 200~300kcal。' },
  { k: '晨跑还是夜跑好', a: '看个人节律。晨跑利于坚持、体温低配速略慢；夜跑体温高表现好但易受作息影响。固定一个时段比纠结时段更重要。' },
  { k: '心率一直很高正常吗', a: '新手或恢复不足时常高。先看是否睡眠不足/脱水/感冒。持续异常偏高且伴随胸闷，建议就医排查。' },
]

export async function chatReply(question, user) {
  await sleep(400 + Math.random() * 500) // 模拟「AI 思考中」
  const hit = QUICK_LIB.find((q) => question.includes(q.k.slice(0, 4)) || q.k.includes(question.slice(0, 4)))
  if (hit) return hit.a + '\n\n' + DISCLAIMER
  return await aiText(
    '你是半马 AI 教练，专业、安全、简洁。',
    question,
    () => {
      const z = buildPaceZones(user)
      let ans = '结合你的目标配速 ' + fmtPace(z.marathon[0]) + '/km 来看，'
      if (question.includes('休息') || question.includes('恢复'))
        ans += '恢复和训练同样重要：强度课后至少安排 1 天轻松跑或完全休息，睡眠优先。'
      else if (question.includes('伤') || question.includes('疼'))
        ans += '任何 3 级以上疼痛都先降强度，必要时走疼痛决策树，严重者就医。'
      else ans += '建议从轻松跑底盘打起，循序渐进每周加量 ≤10%，每 4 周安排减量周。'
      return ans + '\n\n' + DISCLAIMER
    }
  )
}
