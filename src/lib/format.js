// 时间 / 配速 / 距离 格式化工具
// 统一以「秒」为内部存储单位，展示时再格式化，避免单位混乱。

/** 秒 -> "H:MM:SS" 或 "M:SS" */
export function fmtTime(totalSec) {
  if (totalSec == null || isNaN(totalSec)) return '--'
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

/** "H:MM:SS" 文本 -> 秒 */
export function parseTime(str) {
  if (!str) return null
  const parts = String(str).split(':').map((n) => parseInt(n, 10))
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0]
}

/** 配速文本 -> 秒/km，兼容 "5'41\"" 与 "5:41" 两种写法 */
export function parsePace(str) {
  if (!str) return null
  const s = String(str).trim().replace(/"/g, '')
  if (s.includes("'")) {
    const [m, sec] = s.split("'")
    const mm = parseInt(m, 10)
    const ss = parseInt(sec || '0', 10)
    if (isNaN(mm) || isNaN(ss)) return null
    return mm * 60 + ss
  }
  return parseTime(s)
}

/** 秒/km -> "M'SS\"" */
export function fmtPace(secPerKm) {
  if (secPerKm == null || isNaN(secPerKm)) return '--'
  const s = Math.round(secPerKm)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}'${String(sec).padStart(2, '0')}"`
}

/** 配速区间 -> "5'41\"-6'11\"" */
export function fmtPaceRange(lo, hi) {
  return `${fmtPace(lo)}–${fmtPace(hi)}`
}

/** 秒 -> "+M:SS" 差距（带符号） */
export function fmtGap(sec) {
  if (sec == null) return '--'
  const sign = sec >= 0 ? '+' : '-'
  return sign + fmtTime(Math.abs(sec))
}

/** 距离 km（保留 1 位小数） */
export function fmtKm(km) {
  if (km == null) return '--'
  return `${Number(km).toFixed(1)}`
}

/** 日期 -> "2025-03-01" */
export function fmtDate(d) {
  const dt = typeof d === 'string' ? new Date(d) : d
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 相对今天的倒计时天数 */
export function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

/** 中文星期 */
export const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 中文训练类型 */
export const TRAIN_TYPES = {
  easy: { label: '轻松跑', color: '#22C55E', emoji: '🟢' },
  tempo: { label: '节奏跑', color: '#FF6B35', emoji: '🔥' },
  interval: { label: '间歇跑', color: '#EF4444', emoji: '⚡' },
  long: { label: '长距离', color: '#3B82F6', emoji: '🏞️' },
  strength: { label: '力量/交叉', color: '#A855F7', emoji: '💪' },
  rest: { label: '休息日', color: '#6B7280', emoji: '😴' },
  race: { label: '比赛', color: '#FACC15', emoji: '🏁' },
}
