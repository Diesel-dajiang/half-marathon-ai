// 健康数据同步层
// 前端只「拉取」后端已接收的 Apple 健康跑步记录（推送由 Health Auto Export -> 后端完成）。
// 所有请求走相对路径 /api，本地 dev 由 vite 代理到 8080，生产由后端同源托管。

const API = '/api'

export async function fetchHealthWorkouts() {
  try {
    const res = await fetch(`${API}/workouts`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return { ok: false }
    const data = await res.json()
    const list = Array.isArray(data) ? data : data.workouts || []
    return { ok: true, workouts: list }
  } catch {
    // 后端未启动（如纯静态托管）时静默降级，继续使用本地 mock
    return { ok: false }
  }
}

export async function fetchHealthStatus() {
  try {
    const res = await fetch(`${API}/health`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return { ok: false }
    return { ok: true, ...(await res.json()) }
  } catch {
    return { ok: false }
  }
}

// 一键示例数据：无需任何外部配置即可获得一批真实感跑步记录
export async function fetchDemoWorkouts() {
  try {
    const res = await fetch(`${API}/demo-seed`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return { ok: false }
    return { ok: true, workouts: await res.json() }
  } catch {
    return { ok: false }
  }
}

// 去重 key：同一天 + 距离相近视为同一条
function sameKey(a, b) {
  return a.date === b.date && Math.abs((a.distance || 0) - (b.distance || 0)) < 0.15
}

// 把后端拉取的记录合并进现有列表（仅追加本地没有的）
export function mergeWorkouts(existing, incoming) {
  const merged = [...existing]
  for (const w of incoming) {
    if (!merged.some((e) => sameKey(e, w))) merged.push(w)
  }
  merged.sort((a, b) => (a.date < b.date ? 1 : -1))
  return merged
}

// 当前后端接收地址（用于配置 Health Auto Export）
export function healthExportUrl() {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${API}/health-export`
}
