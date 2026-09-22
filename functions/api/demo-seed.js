import { normWorkout } from '../../lib/normalize.mjs'

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

const readStore = async (env) => {
  const v = await env.WORKOUTS.get('workouts')
  return v ? JSON.parse(v) : []
}
const writeStore = async (env, store) => {
  await env.WORKOUTS.put('workouts', JSON.stringify(store))
}

// 一键生成一批真实感示例跑步记录（不依赖任何外部服务）
export async function onRequest(ctx) {
  const { env } = ctx
  const base = new Date()
  const day = (off) => {
    const x = new Date(base)
    x.setDate(x.getDate() - off)
    return x.toISOString().slice(0, 10)
  }
  const samples = [
    { date: day(1), distance: 7.0, duration: 2322, avgHr: 168 },
    { date: day(3), distance: 10.5, duration: 3720, avgHr: 162 },
    { date: day(5), distance: 5.0, duration: 1620, avgHr: 150 },
    { date: day(8), distance: 12.0, duration: 4380, avgHr: 165 },
    { date: day(10), distance: 6.0, duration: 2016, avgHr: 158 },
    { date: day(12), distance: 15.0, duration: 5580, avgHr: 160 },
    { date: day(15), distance: 8.0, duration: 2700, avgHr: 155 },
    { date: day(18), distance: 21.1, duration: 8040, avgHr: 163 },
  ].map((s) => normWorkout({ startDate: s.date, totalDistance: s.distance * 1000, distanceUnit: 'm', duration: s.duration, avgHeartRate: s.avgHr }))

  const store = await readStore(env)
  const seen = new Set(store.map((w) => w.id))
  let added = 0
  for (const w of samples) {
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
