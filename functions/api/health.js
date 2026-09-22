const json = (data) =>
  new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })

export async function onRequest(ctx) {
  const { env } = ctx
  const v = await env.WORKOUTS.get('workouts')
  const store = v ? JSON.parse(v) : []
  return json({ ok: true, count: store.length, lastSync: store[0]?.date || null })
}
