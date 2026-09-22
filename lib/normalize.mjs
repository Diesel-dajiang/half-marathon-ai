// 纯函数：Cloudflare Pages Functions 与前端（浏览器）共用的字段归一化逻辑。
// 只依赖标准 JS，无任何 Node / 浏览器专有 API，因此前后端可共用同一份。
//
// 支持的推送/导入格式：
//   1) 普通 workout 数组：[{ startDate, totalDistance, duration, avgHeartRate, ... }]
//   2) { workouts: [...] }  /  { items: [...] }
//   3) Health Auto Export「采样数组」：[{ type:'HKQuantityTypeIdentifierDistanceWalkingRunning', value, startDate, unit }]
//   4) Health Auto Export「REST metrics」：[{ type:'distance_walking_running', units, data:[{date,value}] }]

export function toKm(dist) {
  if (dist == null) return 0
  const n = typeof dist === 'string' ? parseFloat(dist) : dist
  if (!isFinite(n)) return 0
  return n > 500 ? +(n / 1000).toFixed(2) : +n.toFixed(2) // 健康导出常以「米」为单位
}
export function toSec(dur) {
  if (dur == null) return 0
  if (typeof dur === 'number') return dur
  const s = String(dur).trim()
  const m = s.match(/^(?:(\d+):)?(\d+):(\d+)$/)
  if (m) return (+m[1] || 0) * 3600 + +m[2] * 60 + +m[3]
  const n = parseFloat(s)
  return isFinite(n) ? n : 0
}
export function parseDate(s) {
  if (!s) return null
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const t = Date.parse(s)
  if (!isFinite(t)) return null
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 在对象里按「归一化后的键名」取值（忽略大小写/空格/下划线），兼容中英文导出列名
function pick(raw, keys) {
  if (!raw || typeof raw !== 'object') return undefined
  for (const k of Object.keys(raw)) {
    const nk = k.trim().toLowerCase().replace(/[\s_]/g, '')
    if (keys.includes(nk)) return raw[k]
  }
  return undefined
}

const DATE_KEYS = ['startdate', 'date', 'start', 'starttime', 'timestamp', 'workoutdate', 'enddate']
const DIST_KEYS = ['distance', 'distancekm', 'dist', 'totaldistance']
const UNIT_KEYS = ['distanceunit', 'totaldistanceunit', 'unit']
const DUR_KEYS = ['duration', 'durationinseconds', 'activeduration', 'elapsedduration', 'durationsec']
const HR_KEYS = ['avgheartrate', 'averageheartrate', 'heartrate', 'averagehr']
const CAD_KEYS = ['averagecadence', 'cadence', 'avgcadence']

export function normWorkout(raw) {
  const date = parseDate(pick(raw, DATE_KEYS))
  if (!date) return null
  let distRaw = pick(raw, DIST_KEYS)
  const distUnit = String(pick(raw, UNIT_KEYS) || '').toLowerCase()
  if (distRaw != null && ['m', 'meter', 'meters'].includes(distUnit)) distRaw = Number(distRaw) / 1000
  if (distRaw != null && ['mi', 'mile', 'miles'].includes(distUnit)) distRaw = Number(distRaw) * 1.60934
  const distance = toKm(distRaw)
  if (!distance) return null
  let duration = toSec(pick(raw, DUR_KEYS))
  if (!duration && raw.startDate && raw.endDate) duration = (Date.parse(raw.endDate) - Date.parse(raw.startDate)) / 1000
  if (!duration && raw.start_time && raw.end_time) duration = (Date.parse(raw.end_time) - Date.parse(raw.start_time)) / 1000
  const pace = duration && distance ? Math.round(duration / distance) : 0
  return {
    id: `hw-${date}-${distance}`,
    userId: 'u1',
    date,
    distance,
    duration: Math.round(duration),
    pace,
    avgHr: +(pick(raw, HR_KEYS) || 0),
    cadence: +(pick(raw, CAD_KEYS) || 0),
    rpe: 0,
    pain: 0,
    notes: '来自 Apple 健康 (Health Auto Export)',
    source: 'apple-health',
  }
}

// ---------- Health Auto Export 采样数组 ----------
function dayOf(s) {
  const iso = String(s || '')
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const d = new Date(s)
  if (!isFinite(d)) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function isHAESamples(payload) {
  return Array.isArray(payload) && payload.length && typeof payload[0] === 'object' &&
    'type' in payload[0] && 'value' in payload[0]
}
// 采样 -> 按天聚合的原始记录（再交给 normWorkout 归一化）
export function haeSamplesToRaw(samples) {
  const dist = {}, hr = {}, dur = {}
  for (const s of samples) {
    const t = s.type || ''
    const ds = s.startDate || s.date
    if (!ds) continue
    const day = dayOf(ds)
    if (!day) continue
    const val = parseFloat(s.value)
    if (!isFinite(val)) continue
    if (t.includes('DistanceWalkingRunning')) {
      dist[day] = (dist[day] || 0) + (String(s.unit).toLowerCase() === 'm' ? val / 1000 : val)
    } else if (t.includes('HeartRate')) {
      const a = hr[day] || { sum: 0, n: 0 }
      a.sum += val; a.n++
      hr[day] = a
    } else if (t.includes('Workout')) {
      const d = (Date.parse(s.endDate) - Date.parse(s.startDate)) / 1000
      if (isFinite(d) && d > 0) dur[day] = Math.max(dur[day] || 0, d)
    }
  }
  return toRawList(dist, hr, dur)
}
// REST metrics -> 按天聚合的原始记录
export function haeMetricsToRaw(metrics) {
  const dist = {}, hr = {}
  for (const m of metrics) {
    const t = String(m.type || '').toLowerCase().replace(/[_\s]/g, '')
    const isDist = t.includes('distancewalkingrunning')
    const isHr = t.includes('heartrate')
    if (!isDist && !isHr) continue
    const pts = Array.isArray(m.data) ? m.data : []
    for (const pt of pts) {
      const day = dayOf(pt.date || pt.startDate)
      const val = parseFloat(pt.value ?? pt.qty)
      if (!day || !isFinite(val)) continue
      if (isDist) dist[day] = (dist[day] || 0) + (String(m.units || m.unit).toLowerCase() === 'm' ? val / 1000 : val)
      else { const a = hr[day] || { sum: 0, n: 0 }; a.sum += val; a.n++; hr[day] = a }
    }
  }
  return toRawList(dist, hr, {})
}
function toRawList(dist, hr, dur) {
  const out = []
  for (const day of Object.keys(dist)) {
    const distance = +dist[day].toFixed(2)
    if (!distance) continue
    const h = hr[day]
    const avgHr = h ? Math.round(h.sum / h.n) : 0
    const duration = Math.round(dur[day] || 0)
    out.push({ startDate: day, totalDistance: distance * 1000, distanceUnit: 'm', duration, avgHeartRate: avgHr })
  }
  return out
}
