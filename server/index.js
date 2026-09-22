// 半马 AI 教练 —— 轻量后端（零依赖，仅用 Node 内置模块）
// 职责：
//   1) 接收「Health Auto Export」等第三方 App 从 Apple 健康推送的跑步数据 (POST /api/health-export)
//   2) 为前端提供查询接口 (GET /api/workouts, GET /api/health)
//   3) 生产环境同时托管已构建的前端静态资源 (dist/)
//
// 说明：Apple HealthKit 不向网页开放，因此通过 Health Auto Export 把健康数据
// 定时 POST 到本服务的 /api/health-export（可在 App 内配置 URL 与自定义 Token）。
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'workouts.json')
const DIST_DIR = path.join(__dirname, '..', 'dist')
const PORT = process.env.PORT || 8080
const HEALTH_TOKEN = process.env.HEALTH_TOKEN || ''
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || ''
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET || ''
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI || ''

fs.mkdirSync(DATA_DIR, { recursive: true })
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8')

// ---------- 工具：解析 Health Auto Export 各类字段 ----------
function toKm(dist) {
  if (dist == null) return 0
  const n = typeof dist === 'string' ? parseFloat(dist) : dist
  if (!isFinite(n)) return 0
  return n > 500 ? +(n / 1000).toFixed(2) : +n.toFixed(2) // 健康导出常以「米」为单位
}
function toSec(dur) {
  if (dur == null) return 0
  if (typeof dur === 'number') return dur
  const s = String(dur).trim()
  const m = s.match(/^(?:(\d+):)?(\d+):(\d+)$/)
  if (m) return (+m[1] || 0) * 3600 + +m[2] * 60 + +m[3]
  const n = parseFloat(s)
  return isFinite(n) ? n : 0
}
function parseDate(s) {
  if (!s) return null
  // 优先取 ISO 字符串里的本地日期（HAE 带时区偏移，避免按服务器 UTC 计算差一天）
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const t = Date.parse(s)
  if (!isFinite(t)) return null
  const d = new Date(t)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}
function normStrava(a) {
  const distKm = a.distance ? +(a.distance / 1000).toFixed(2) : 0
  if (!distKm) return null
  const moving = a.moving_time || a.elapsed_time || 0
  const pace = moving && distKm ? Math.round(moving / distKm) : 0
  const date = (a.start_date_local || a.start_date || '').slice(0, 10)
  if (!date) return null
  return {
    id: `strava-${a.id}`, userId: 'u1', date, distance: distKm,
    duration: moving, pace, avgHr: Math.round(a.average_heartrate || 0),
    cadence: Math.round(a.average_cadence || 0), rpe: 0, pain: 0,
    notes: `Strava: ${a.name || '跑步'}`, source: 'strava',
  }
}
function normWorkout(raw) {
  const date = parseDate(raw.startDate || raw.date || raw.workoutDate || raw.endDate)
  if (!date) return null
  let distRaw = raw.distance ?? raw.distanceKm ?? raw.totalDistance
  // HAE 的 workout 距离单位可能为米 / 英里 / 千米
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
// ---------- 解析 Health Auto Export 的原始采样格式 ----------
// 该 App 以「采样数组」形式 POST：每条是单个指标（距离 / 心率），不是聚合后的单次跑步。
// 例：{ type:'HKQuantityTypeIdentifierDistanceWalkingRunning', startDate, endDate, value, unit }
//     { type:'HKQuantityTypeIdentifierHeartRate', startDate, endDate, value, unit:'count/min' }
// 这里按天聚合：距离求和、心率取均值、尽量用 Workout 时长。
function dayOf(s) {
  // Health Auto Export 的 startDate 带本地时区偏移（如 ...+08:00），
  // 直接取 ISO 字符串里的本地日期，避免按服务器 UTC 计算导致差一天。
  const iso = String(s || '')
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const d = new Date(s)
  if (!isFinite(d)) return null
  const y = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}
function isHAESamples(payload) {
  return Array.isArray(payload) && payload.length && typeof payload[0] === 'object' &&
    'type' in payload[0] && 'value' in payload[0]
}
function convertHAESamples(samples) {
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
      // 单位可能为 m / km
      dist[day] = (dist[day] || 0) + (s.unit === 'm' ? val / 1000 : val)
    } else if (t.includes('HeartRate')) {
      const a = hr[day] || { sum: 0, n: 0 }
      a.sum += val; a.n++
      hr[day] = a
    } else if (t.includes('Workout')) {
      const d = (Date.parse(s.endDate) - Date.parse(s.startDate)) / 1000
      if (isFinite(d) && d > 0) dur[day] = Math.max(dur[day] || 0, d)
    }
  }
  return buildFromAgg(dist, hr, dur)
}
function buildFromAgg(dist, hr, dur) {
  const out = []
  for (const day of Object.keys(dist)) {
    const distance = +dist[day].toFixed(2)
    if (!distance) continue
    const h = hr[day]
    const avgHr = h ? Math.round(h.sum / h.n) : 0
    const duration = Math.round(dur[day] || 0)
    const pace = duration && distance ? Math.round(duration / distance) : 0
    out.push({
      id: `hw-${day}-${distance}`, userId: 'u1', date: day,
      distance, duration, pace, avgHr, cadence: 0, rpe: 0, pain: 0,
      notes: '来自 Apple 健康 (Health Auto Export)', source: 'apple-health',
    })
  }
  out.sort((a, b) => (a.date < b.date ? 1 : -1))
  return out
}
// REST API 自动化的 metrics 格式：[{ type:'heart_rate'|'distance_walking_running', units, data:[{date,value}] }]
function convertHAEMetrics(metrics) {
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
      if (isDist) dist[day] = (dist[day] || 0) + ((String(m.units || m.unit).toLowerCase() === 'm') ? val / 1000 : val)
      else { const a = hr[day] || { sum: 0, n: 0 }; a.sum += val; a.n++; hr[day] = a }
    }
  }
  return buildFromAgg(dist, hr, {})
}
function readStore() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) } catch { return [] }
}
function writeStore(arr) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2), 'utf8')
}
function tokenOk(url) {
  if (!HEALTH_TOKEN) return true
  const q = url.searchParams.get('token')
  return q === HEALTH_TOKEN
}
function send(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(body)
}

// ---------- 静态资源 ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
}
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0])
  if (urlPath === '/') urlPath = '/index.html'
  const filePath = path.join(DIST_DIR, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''))
  if (!filePath.startsWith(DIST_DIR)) { res.writeHead(403); return res.end('Forbidden') }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA 回退到 index.html
      fs.readFile(path.join(DIST_DIR, 'index.html'), (e2, html) => {
        if (e2) { res.writeHead(404); return res.end('Not Found') }
        res.writeHead(200, { 'Content-Type': MIME['.html'] })
        res.end(html)
      })
      return
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' })
    res.end(data)
  })
}

// ---------- 路由 ----------
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const p = url.pathname

  // 接收推送
  if (p === '/api/health-export' && req.method === 'POST') {
    if (!tokenOk(url)) return send(res, 401, { ok: false, error: 'token 校验失败' })
    let buf = ''
    req.on('data', (c) => (buf += c))
    req.on('end', () => {
      let payload
      try { payload = JSON.parse(buf || '{}') } catch { return send(res, 400, { ok: false, error: 'JSON 解析失败' }) }
      // 兼容三种推送格式：
      //  1) 数组采样 [{type,value,startDate,...}]
      //  2) { workouts: [...] }（REST API - Workouts 数据类型）
      //  3) { data: { metrics: [...], workouts: [...] } }（REST API 完整格式）
      let incoming = []
      if (Array.isArray(payload)) {
        incoming = isHAESamples(payload) ? convertHAESamples(payload) : payload.map(normWorkout).filter(Boolean)
      } else if (payload && typeof payload === 'object') {
        const d = payload.data && typeof payload.data === 'object' ? payload.data : payload
        const workoutArr = [d.workouts, payload.workouts, payload.items].find(Array.isArray) || []
        const metricArr = [d.metrics, payload.metrics].find(Array.isArray) || []
        if (workoutArr.length) incoming = workoutArr.map(normWorkout).filter(Boolean)
        else if (metricArr.length) incoming = convertHAEMetrics(metricArr)
      }
      if (!incoming.length) return send(res, 400, { ok: false, error: '未解析到有效跑步记录' })
      const store = readStore()
      const seen = new Set(store.map((w) => w.id))
      let added = 0
      for (const w of incoming) if (!seen.has(w.id)) { store.push(w); seen.add(w.id); added++ }
      store.sort((a, b) => (a.date < b.date ? 1 : -1))
      writeStore(store)
      send(res, 200, { ok: true, added, total: store.length })
    })
    return
  }

  if (p === '/api/workouts' && req.method === 'GET') return send(res, 200, readStore())
  if (p === '/api/health' && req.method === 'GET') {
    const store = readStore()
    return send(res, 200, { ok: true, count: store.length, lastSync: store[0]?.date || null })
  }

  // 一键示例数据：打开链接即可自动获取一批真实感跑步记录（无需任何外部配置）
  if (p === '/api/demo-seed' && req.method === 'GET') {
    const base = new Date()
    const day = (off) => {
      const x = new Date(base)
      x.setDate(x.getDate() - off)
      const y = x.getFullYear(), m = String(x.getMonth() + 1).padStart(2, '0'), d = String(x.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
    const samples = [
      [1, 6.2, 392, 148, 172], [3, 8.0, 405, 150, 168], [5, 5.0, 388, 145, 174],
      [8, 10.5, 415, 152, 166], [10, 6.5, 395, 149, 170], [12, 7.0, 400, 151, 169],
      [15, 12.0, 420, 154, 165], [17, 5.5, 390, 146, 173], [19, 9.0, 408, 153, 167],
      [22, 6.0, 393, 147, 171], [24, 14.0, 425, 156, 164], [28, 5.8, 386, 144, 175],
    ]
    const list = samples.map(([off, dist, pace, hr, cad]) => ({
      id: `demo-${day(off)}`, userId: 'u1', date: day(off), distance: dist,
      duration: Math.round(pace * dist), pace, avgHr: hr, cadence: cad,
      rpe: 3, pain: 0, notes: '自动同步示例数据', source: 'demo',
    }))
    return send(res, 200, list)
  }

  // Strava 连接：返回授权地址（前端点击后跳转 Strava 登录授权）
  if (p === '/api/strava/auth-url' && req.method === 'GET') {
    if (!STRAVA_CLIENT_ID) return send(res, 200, { url: null, error: '未配置 STRAVA_CLIENT_ID' })
    const host = req.headers.host || url.host
    const redirect = STRAVA_REDIRECT_URI || `https://${host}/api/strava/callback`
    const auth = `https://www.strava.com/oauth/mobile/authorize?client_id=${STRAVA_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=activity:read&approval_prompt=force`
    return send(res, 200, { url: auth, redirect })
  }

  // Strava 回调：用 code 换 token，拉取跑步活动并存储，再跳回前端
  if (p === '/api/strava/callback') {
    ;(async () => {
      const code = url.searchParams.get('code')
      const err = url.searchParams.get('error')
      const back = (status) => { res.writeHead(302, { Location: `/?strava=${status}` }); res.end() }
      if (err || !code) return back('error')
      try {
        const tokenRes = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: STRAVA_CLIENT_ID, client_secret: STRAVA_CLIENT_SECRET, code, grant_type: 'authorization_code' }),
        })
        const token = await tokenRes.json()
        const access = token.access_token
        if (access && STRAVA_CLIENT_SECRET) {
          const actsRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=50', {
            headers: { Authorization: `Bearer ${access}` },
          })
          const acts = await actsRes.json()
          const list = (Array.isArray(acts) ? acts : []).map(normStrava).filter(Boolean)
          const store = readStore()
          const seen = new Set(store.map((w) => w.id))
          let added = 0
          for (const w of list) if (!seen.has(w.id)) { store.push(w); seen.add(w.id); added++ }
          store.sort((a, b) => (a.date < b.date ? 1 : -1))
          writeStore(store)
        }
        back('connected')
      } catch (e) {
        back('error')
      }
    })()
    return
  }

  if (p.startsWith('/api/')) return send(res, 404, { ok: false, error: 'not found' })

  // 生产：托管前端
  if (fs.existsSync(DIST_DIR)) return serveStatic(req, res)
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('前端未构建，请先运行 npm run build。')
})

server.listen(PORT, () => {
  console.log(`[half-marathon-ai-coach] server on http://localhost:${PORT}`)
  console.log(`[health-export] POST /api/health-export${HEALTH_TOKEN ? '?token=***' : ''}`)
})
