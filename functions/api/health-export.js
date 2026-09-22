import {
  normWorkout, isHAESamples, haeSamplesToRaw, haeMetricsToRaw,
} from '../../lib/normalize.mjs'

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

const readStore = async (env) => {
  const v = await env.WORKOUTS.get('workouts')
  return v ? JSON.parse(v) : []
}
const writeStore = async (env, store) => {
  await env.WORKOUTS.put('workouts', JSON.stringify(store))
}

// 把任意支持的推送格式解析为归一化后的跑步记录
function parsePayload(payload) {
  let raws = []
  if (Array.isArray(payload)) {
    // 采样数组（Health Auto Export）或普通 workout 数组
    raws = isHAESamples(payload) ? haeSamplesToRaw(payload) : payload
  } else if (payload && typeof payload === 'object') {
    const d = payload.data && typeof payload.data === 'object' ? payload.data : payload
    const workoutArr = [d.workouts, payload.workouts, payload.items].find(Array.isArray) || []
    const metricArr = [d.metrics, payload.metrics].find(Array.isArray) || []
    if (workoutArr.length) raws = workoutArr
    else if (metricArr.length) raws = haeMetricsToRaw(metricArr)
  }
  return raws.map(normWorkout).filter(Boolean)
}

export async function onRequest(ctx) {
  const { request, env } = ctx
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  let payload
  try {
    payload = await request.json()
  } catch {
    return json({ ok: false, error: 'JSON 解析失败' }, 400)
  }
  const incoming = parsePayload(payload)
  if (!incoming.length) return json({ ok: false, error: '未解析到有效跑步记录' }, 400)

  const store = await readStore(env)
  const seen = new Set(store.map((w) => w.id))
  let added = 0
  for (const w of incoming) {
    if (!seen.has(w.id)) {
      store.push(w)
      seen.add(w.id)
      added++
    }
  }
  store.sort((a, b) => (a.date < b.date ? 1 : -1))
  await writeStore(env, store)
  return json({ ok: true, added, total: store.length })
}
