const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export async function onRequest(ctx) {
  const { env } = ctx
  const v = await env.WORKOUTS.get('workouts')
  return json(v ? JSON.parse(v) : [])
}
