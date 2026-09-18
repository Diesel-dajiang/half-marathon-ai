// 规则引擎：配速计算、12周计划生成、红绿灯判定、完赛预测
// 全部基于确定性规则，方便离线运行；AI 仅负责「文字解释」部分。
import { parseTime, parsePace, fmtPace, TRAIN_TYPES } from './format.js'

export const RACE_DISTANCE = 21.0975 // 半马公里数

/** 由目标完赛时间计算目标配速(秒/km) */
export function goalPaceFromTime(targetTimeSec) {
  return targetTimeSec / RACE_DISTANCE
}

/**
 * 计算训练配速区间（秒/km）。
 * 若用户提供 5K/10K 成绩，则用「当前能力」优先反推一个更贴近实际的区间；
 * 否则直接用目标配速推导。
 */
export function buildPaceZones(user) {
  const targetSec = goalPaceFromTime(parseTime(user.targetTime) || 7200)
  // 当前能力配速：取 10K 或 5K 或平均配速，pace 以秒/km 计
  const cur5k = parseTime(user.current5K)
  const cur10k = parseTime(user.current10K)
  let abilityPace = null
  if (cur10k) abilityPace = cur10k / 10
  else if (cur5k) abilityPace = cur5k / 5
  else if (user.avgPace) abilityPace = parsePace(user.avgPace)

  const t = targetSec
  const zones = {
    easy: [t + 60, t + 90],
    marathon: [t + 15, t + 30],
    tempo: [t - 10, t - 20],
    interval: [t - 30, t - 60],
  }

  // 若当前能力明显慢于目标，长距/轻松跑用能力区间更友好（避免太空洞）
  if (abilityPace && abilityPace > t) {
    zones.easy = [Math.min(t + 60, abilityPace - 5), abilityPace + 25]
  }
  return zones
}

function zoneStr(z) {
  return `${fmtPace(z[0])}–${fmtPace(z[1])}`
}

/** 心率区间（基于储备心率简化估算，模拟数据） */
export function buildHrZones(user) {
  // 默认假设最大心率 190，静息 55
  const maxHr = user.maxHr || 190
  const restHr = user.restHr || 55
  const reserve = maxHr - restHr
  return {
    easy: [Math.round(restHr + reserve * 0.6), Math.round(restHr + reserve * 0.7)],
    tempo: [Math.round(restHr + reserve * 0.8), Math.round(restHr + reserve * 0.88)],
    interval: [Math.round(restHr + reserve * 0.9), maxHr],
    long: [Math.round(restHr + reserve * 0.65), Math.round(restHr + reserve * 0.75)],
  }
}

/**
 * 生成 12 周训练计划（规则引擎）。
 * 规则：
 *  - 周跑量增幅 ≤ 10%（按周递进，封顶）
 *  - 每 4 周减量周（约 75%）
 *  - 赛前 2 周 taper（11 周 80%，12 周 50%）
 *  - 强度训练后至少 1 天休息/轻松
 *  - 周末安排长距离
 */
export function generatePlan(user) {
  const weeks = 12
  const runDays = Math.min(7, Math.max(3, user.runDays || 4))
  const base = Math.max(12, user.weeklyMileage || 20)
  const zones = buildPaceZones(user)
  const hr = buildHrZones(user)

  // 周跑量曲线
  const mileageCurve = []
  for (let w = 1; w <= weeks; w++) {
    let factor
    if (w % 4 === 0) factor = 0.75
    else if (w === 11) factor = 0.8
    else if (w === 12) factor = 0.5
    else factor = Math.min(Math.pow(1.1, w - 1), 2.2) // 封顶 2.2 倍
    mileageCurve.push(Math.round(base * factor))
  }

  // 把可跑天数均匀铺到一周 7 天（周一=1 … 周日=7）
  const pickDays = (n) => {
    if (n >= 7) return [1, 2, 3, 4, 5, 6, 7]
    const step = 7 / n
    const res = []
    for (let i = 0; i < n; i++) res.push(Math.min(7, Math.max(1, Math.round(1 + i * step))))
    return [...new Set(res)].sort((a, b) => a - b)
  }
  const trainDays = pickDays(runDays)

  const NOTES = {
    easy: '轻松对话配速，鼻吸鼻呼不喘；落地轻柔，步频 170+。',
    tempo: ' comfortably hard，能说短句但不能聊天；最后 2 分钟顶住。',
    interval: '每组尽力但可控，组间慢跑恢复；充分热身 10 分钟。',
    long: '匀速巡航，后半程不崩；每 5K 补水，注意补给演练。',
    strength: '核心+臀部+小腿力量，或骑行/游泳交叉训练，保护关节。',
    rest: '完全休息或散步，给韧带和关节恢复时间。',
  }
  const REST_ADVICE = {
    easy: '跑后拉伸小腿与髋屈肌，今晚早睡。',
    tempo: '明日安排轻松跑或休息，补充碳水与蛋白质。',
    interval: '24 小时内避免强度课，注意心率回落。',
    long: '次日必须轻松跑或休息，补充糖原与睡眠。',
    strength: '训练后滚泡沫轴放松。',
    rest: '好好睡觉，明天再战。',
  }

  const plan = []
  for (let w = 1; w <= weeks; w++) {
    const weekTotal = mileageCurve[w - 1]
    const longDist = Math.round(weekTotal * 0.28)
    const remain = weekTotal - longDist
    const perOther = Math.max(3, Math.round(remain / Math.max(1, trainDays.length - 1)))

    // 为这一周的训练日分配类型
    const typesForWeek = trainDays.map((_, idx) => {
      if (idx === trainDays.length - 1) return 'long'
      if (idx === 1) return 'interval'
      if (idx === 2) return 'tempo'
      return 'easy'
    })
    // 减量周把首课换成力量/交叉训练
    if (w % 4 === 0) typesForWeek[0] = 'strength'

    for (let dow = 1; dow <= 7; dow++) {
      const tIdx = trainDays.indexOf(dow)
      const isRest = tIdx === -1
      const type = isRest ? 'rest' : typesForWeek[tIdx]
      let distance = isRest ? 0 : type === 'long' ? longDist : perOther
      if (!isRest && (w % 4 === 0 || w >= 11)) distance = Math.round(distance * 0.85)

      let paceRange = '', hrRange = ''
      if (type === 'easy') { paceRange = zoneStr(zones.easy); hrRange = `${hr.easy[0]}–${hr.easy[1]}` }
      else if (type === 'tempo') { paceRange = zoneStr(zones.tempo); hrRange = `${hr.tempo[0]}–${hr.tempo[1]}` }
      else if (type === 'interval') { paceRange = zoneStr(zones.interval); hrRange = `${hr.interval[0]}–${hr.interval[1]}` }
      else if (type === 'long') { paceRange = zoneStr(zones.marathon); hrRange = `${hr.long[0]}–${hr.long[1]}` }
      else if (type === 'strength') { paceRange = '交叉训练'; hrRange = `${hr.easy[0]}–${hr.easy[1]}` }

      plan.push({
        id: `w${w}d${dow}`,
        userId: user.id,
        weekNumber: w,
        dayOfWeek: dow,
        type,
        distance,
        paceRange,
        hrRange,
        notes: NOTES[type],
        restAdvice: REST_ADVICE[type],
        status: 'pending', // pending | done | skipped
      })
    }
  }
  return plan
}

/**
 * 每日红绿灯判定。
 * 输入：睡眠评分、HRV（模拟）、疼痛等级、近期负荷（7天跑量 vs 计划）。
 * 输出四态之一：green / yellow / red / black
 */
export function evaluateLight({ sleep, hrv, pain, loadRatio }) {
  // pain 4-5 直接建议就医
  if (pain >= 5) return { status: 'black', reason: '疼痛等级达到 5 级，建议尽快就医检查，避免带伤训练。' }
  if (pain >= 4) return { status: 'black', reason: '明显疼痛（4 级），建议就医评估，暂停跑步。' }
  if (pain === 3) return { status: 'red', reason: '局部疼痛 3 级，停止强度训练，改为低强度活动或完全休息。' }

  let score = 0
  if (sleep <= 2) score += 2
  else if (sleep === 3) score += 1
  if (hrv <= 2) score += 2
  else if (hrv === 3) score += 1
  if (loadRatio >= 1.3) score += 2
  else if (loadRatio >= 1.15) score += 1

  if (score >= 4) return { status: 'red', reason: '睡眠与恢复不足，近期负荷偏高，今天该休息，让身体充分恢复。' }
  if (score >= 2) return { status: 'yellow', reason: '恢复一般，今天建议降强度，把强度课换成轻松跑或交叉训练。' }
  return { status: 'green', reason: '睡眠、HRV 与负荷都在良好区间，可以放心按计划训练。' }
}

export const LIGHT_META = {
  green: { label: '放心跑', emoji: '🟢', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  yellow: { label: '降强度', emoji: '🟡', color: '#FACC15', bg: 'rgba(250,204,21,0.12)' },
  red: { label: '该休息', emoji: '🔴', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  black: { label: '建议就医', emoji: '⚫', color: '#9CA3AF', bg: 'rgba(156,163,175,0.14)' },
}

/**
 * 完赛预测（规则估算）。
 * 基于：当前能力配速 + 12 周提升曲线 + 目标配速。
 * 返回 { predictedSec, gapSec, weeksLeft, advice }
 */
export function predictFinish(user, weeksLeft = 12) {
  const targetSec = parseTime(user.targetTime) || 7200
  const targetPace = goalPaceFromTime(targetSec)

  // 当前能力配速
  const cur10k = parseTime(user.current10K)
  const cur5k = parseTime(user.current5K)
  let abilityPace = targetPace + 40 // 默认比目标慢 40s
  if (cur10k) abilityPace = cur10k / 10
  else if (cur5k) abilityPace = cur5k / 5 + 8
  else if (user.avgPace) abilityPace = parsePace(user.avgPace)

  // 预计每周提升约 1.5%（越接近目标越慢）
  const weeksTrained = 12 - weeksLeft
  const improvePerWeek = Math.min(0.018, (abilityPace - targetPace) / 12 / 5)
  const predictedPace = Math.max(targetPace, abilityPace * Math.pow(1 - improvePerWeek, weeksTrained))
  const predictedSec = Math.round(predictedPace * RACE_DISTANCE)

  const gapSec = predictedSec - targetSec
  let advice
  if (gapSec <= 0) advice = '目前预测已快于目标，保持节奏，注意减量周与恢复。'
  else {
    const needPace = predictedPace - targetPace
    advice = `还需把配速提升约 ${fmtPace(needPace)}/km，剩余 ${weeksLeft} 周，重点加强节奏跑与长距离耐力。`
  }
  return { predictedSec, targetSec, gapSec, weeksLeft, predictedPace, advice }
}

/** 疼痛决策树：根据部位+等级返回分级建议 */
export function painAdvice(part, level) {
  const base = {
    1: { action: '可跑（减量）', color: '#22C55E', note: '轻微不适，可正常训练但降低 10~20% 距离，注意跑后冰敷与拉伸。' },
    2: { action: '可跑（明显减量）', color: '#22C55E', note: '轻度疼痛，改为轻松跑，距离减半，避开坡道，跑后观察是否加重。' },
    3: { action: '停强度', color: '#FACC15', note: '中度疼痛，取消间歇/节奏等强度课，仅做低强度活动或完全休息 1~2 天。' },
    4: { action: '停跑', color: '#EF4444', note: '明显疼痛，暂停跑步 3~7 天，做力量与柔韧训练，必要时就医。' },
    5: { action: '建议就医', color: '#9CA3AF', note: '剧烈/影响日常活动的疼痛，建议尽快就医，避免带伤硬撑。' },
  }[level]
  return { part, level, ...base }
}
