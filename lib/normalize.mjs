// 纯函数：Cloudflare Pages Functions 与本地 server 共用的字段归一化逻辑
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
export function normWorkout(raw) {
  const date = parseDate(raw.startDate || raw.date || raw.workoutDate || raw.endDate)
  if (!date) return null
  let distRaw = raw.distance ?? raw.distanceKm ?? raw.totalDistance
  const distUnit = String(raw.distanceUnit || raw.totalDistanceUnit || raw.unit || '').toLowerCase()
  if (distRaw != null && ['m', 'meter', 'meters'].includes(distUnit)) distRaw = Number(distRaw) / 1000
  if (distRaw != null && ['mi', 'mile', 'miles'].includes(distUnit)) distRaw = Number(distRaw) * 1.60934
  const distance = toKm(distRaw)
  if (!distance) return null
  let duration = toSec(raw.duration)
  if (!duration && raw.startDate && raw.endDate) duration = (Date.parse(raw.endDate) - Date.parse(raw.startDate)) / 1000
  const pace = duration && distance ? Math.round(duration / distance) : 0
  return {
    id: `hw-${date}-${distance}`,
    userId: 'u1',
    date,
    distance,
    duration: Math.round(duration),
    pace,
    avgHr: +raw.avgHeartRate || +raw.averageHeartRate || +raw.heartRate || 0,
    cadence: +raw.averageCadence || +raw.cadence || 0,
    rpe: 0,
    pain: 0,
    notes: '来自 Apple 健康 (Health Auto Export)',
    source: 'apple-health',
  }
}
