import React, { useState, useMemo } from 'react'
import { Plus, Footprints, HeartPulse, Gauge, Activity, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { fmtPace, fmtDate, parsePace, WEEK_CN } from '../lib/format.js'
import { Card, Sheet, Btn, SectionTitle } from '../components/ui.jsx'
import { translateTrainingEffect } from '../lib/ai.js'

export default function Records() {
  const { state, dispatch } = useApp()
  const [addOpen, setAddOpen] = useState(false)
  const [trans, setTrans] = useState({})
  const [loadingId, setLoadingId] = useState(null)

  // 周复盘：按周聚合跑量（近 6 周）
  const weeks = useMemo(() => buildWeekly(state.workouts), [state.workouts])
  const maxKm = Math.max(1, ...weeks.map((w) => w.km))

  const doTranslate = async (w) => {
    setLoadingId(w.id)
    const text = await translateTrainingEffect(w, state.user)
    setTrans((t) => ({ ...t, [w.id]: text }))
    setLoadingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle icon={Footprints}>跑步记录</SectionTitle>
        <button onClick={() => setAddOpen(true)} className="tap bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-medium flex items-center gap-1">
          <Plus size={16} /> 添加
        </button>
      </div>

      {/* 周复盘柱状图 */}
      <Card>
        <SectionTitle icon={Activity}>周复盘 · 跑量趋势</SectionTitle>
        <div className="flex items-end justify-between gap-2 h-32 mt-2">
          {weeks.map((w) => (
            <div key={w.label} className="flex-1 flex flex-col items-center justify-end h-full">
              <div className="text-[11px] text-muted mb-1">{w.km ? w.km.toFixed(0) : ''}</div>
              <div className="w-full rounded-t-md bg-gradient-to-t from-primary/40 to-primary transition-all" style={{ height: `${(w.km / maxKm) * 100}%`, minHeight: w.km ? 6 : 2 }} />
              <div className="text-[10px] text-muted mt-1">{w.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-muted">近 6 周跑量（km）。配速变化与下周调整见计划页 AI 建议。</div>
      </Card>

      {/* 记录列表 + 训练效果翻译 */}
      <div className="space-y-3">
        {state.workouts.map((w) => (
          <Card key={w.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-ink font-medium">{w.date} · {WEEK_CN[new Date(w.date).getDay()]}</div>
              <div className="text-xs text-muted">{w.distance} km</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Mini icon={Gauge} k="配速" v={fmtPace(w.pace)} />
              <Mini icon={HeartPulse} k="心率" v={`${w.avgHr}`} />
              <Mini icon={Activity} k="步频" v={`${w.cadence}`} />
            </div>
            {w.notes && <div className="text-xs text-muted">备注：{w.notes}</div>}

            {/* 功能5：训练效果翻译器 */}
            <div className="pt-2 border-t border-line">
              {trans[w.id] ? (
                <div className="bg-card2 rounded-lg p-2.5 text-xs text-ink leading-relaxed flex gap-2">
                  <Sparkles size={14} className="text-primary shrink-0 mt-0.5" />
                  <span>{trans[w.id]}</span>
                </div>
              ) : (
                <button onClick={() => doTranslate(w)} disabled={loadingId === w.id}
                  className="tap w-full text-center text-xs text-primary py-1.5 flex items-center justify-center gap-1">
                  {loadingId === w.id ? <><Loader2 size={14} className="animate-spin" /> AI 翻译中…</> : <><Sparkles size={14} /> 用「人话」翻译这条记录</>}
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <AddWorkout open={addOpen} onClose={() => setAddOpen(false)} user={state.user} shoes={state.shoes}
        onSubmit={(w) => dispatch({ type: 'ADD_WORKOUT', payload: { id: 'w' + Date.now(), userId: 'u1', ...w } })} />
    </div>
  )
}

function Mini({ icon: Icon, k, v }) {
  return (
    <div className="bg-card2 rounded-lg py-2">
      <Icon size={14} className="text-primary mx-auto" />
      <div className="text-[10px] text-muted mt-0.5">{k}</div>
      <div className="text-ink text-sm font-semibold">{v}</div>
    </div>
  )
}

function buildWeekly(workouts) {
  const map = {}
  const order = []
  workouts.forEach((w) => {
    const d = new Date(w.date + 'T00:00:00')
    const dw = (d.getDay() + 6) % 7
    const mon = new Date(d)
    mon.setDate(d.getDate() - dw)
    const key = fmtDate(mon)
    if (!map[key]) { map[key] = 0; order.push(key) }
    map[key] += w.distance
  })
  // 补齐近 6 周
  const out = []
  const today = new Date()
  for (let i = 5; i >= 0; i--) {
    const mon = new Date(today)
    const dw = (mon.getDay() + 6) % 7
    mon.setDate(mon.getDate() - dw - i * 7)
    const key = fmtDate(mon)
    out.push({ label: `${mon.getMonth() + 1}/${mon.getDate()}`, km: map[key] || 0 })
  }
  return out
}

function AddWorkout({ open, onClose, user, shoes, onSubmit }) {
  const [f, setF] = useState({ date: fmtDate(new Date()), distance: '', pace: '', avgHr: '', cadence: '', rpe: 3, pain: 0, shoeId: shoes[0]?.id || '', notes: '' })
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const submit = () => {
    if (!f.distance || !f.pace) return
    const paceSec = parsePace(f.pace) || 360
    const duration = Math.round(paceSec * Number(f.distance))
    onSubmit({ ...f, distance: Number(f.distance), pace: paceSec, duration, avgHr: Number(f.avgHr) || 0, cadence: Number(f.cadence) || 0, rpe: Number(f.rpe), pain: Number(f.pain) })
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="手动添加跑步记录">
      <div className="space-y-3 animate-fadein">
        <Field label="日期"><input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} className="w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary [color-scheme:dark]" /></Field>
        <Field label="距离 (km)"><input type="number" value={f.distance} onChange={(e) => set('distance', e.target.value)} placeholder="如 6.5" className="w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary" /></Field>
        <Field label={'平均配速 (例 6\'30")'}><input value={f.pace} onChange={(e) => set('pace', e.target.value)} placeholder={'如 6\'30"'} className="w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="平均心率"><input type="number" value={f.avgHr} onChange={(e) => set('avgHr', e.target.value)} className="w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary" /></Field>
          <Field label="步频"><input type="number" value={f.cadence} onChange={(e) => set('cadence', e.target.value)} className="w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary" /></Field>
        </div>
        <Field label={`主观疲劳 RPE：${f.rpe}`}><input type="range" min="1" max="5" value={f.rpe} onChange={(e) => set('rpe', e.target.value)} className="w-full accent-primary" /></Field>
        <Field label={`疼痛等级：${f.pain}`}><input type="range" min="0" max="5" value={f.pain} onChange={(e) => set('pain', e.target.value)} className="w-full accent-primary" /></Field>
        <Field label="跑鞋">
          <select value={f.shoeId} onChange={(e) => set('shoeId', e.target.value)} className="w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary">
            {shoes.map((s) => <option key={s.id} value={s.id}>{s.brand} {s.model}</option>)}
          </select>
        </Field>
        <Field label="备注"><input value={f.notes} onChange={(e) => set('notes', e.target.value)} className="w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary" /></Field>
        <Btn onClick={submit}>保存记录</Btn>
      </div>
    </Sheet>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-xs text-muted mb-1">{label}</div>
      {children}
    </div>
  )
}
