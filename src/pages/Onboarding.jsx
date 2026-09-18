import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flag, Clock, Footprints, Calendar, Dumbbell, HeartPulse, AlertTriangle, Sparkles } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { parseTime, fmtPace, fmtDate, TRAIN_TYPES } from '../lib/format.js'
import { goalPaceFromTime } from '../lib/rules.js'
import { Btn, Chip } from '../components/ui.jsx'

const GOAL_TYPES = [
  { v: 'finish', label: '完赛就好', desc: '平安跑完' },
  { v: 'time', label: '冲击目标时间', desc: '追求 PB' },
  { v: 'health', label: '健康跑', desc: '规律运动' },
]
const QUICK_TIMES = ['2:30:00', '2:15:00', '2:00:00', '1:50:00', '1:45:00', '1:30:00']
const INJURIES = ['膝盖', '脚踝', '足底筋膜炎', '小腿', '髋部', '腰', '无']

export default function Onboarding() {
  const { dispatch } = useApp()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    goalType: 'time',
    targetTime: '2:00:00',
    paceOverride: false,
    targetPace: '',
    raceDate: '',
    current5K: '',
    current10K: '',
    longestRun: '',
    avgPace: '',
    runDays: 4,
    weeklyMileage: 25,
    injuries: [],
  })
  const [err, setErr] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const computedPace = fmtPace(goalPaceFromTime(parseTime(form.targetTime) || 7200))
  const paceDisplay = form.paceOverride && form.targetPace ? form.targetPace : computedPace

  const toggleInjury = (i) => {
    set('injuries', form.injuries.includes(i) ? form.injuries.filter((x) => x !== i) : [...form.injuries, i])
  }

  const canNext = () => {
    if (step === 0) return !!form.targetTime
    if (step === 1) return form.weeklyMileage > 0
    return true
  }

  const submit = () => {
    if (!form.targetTime) return setErr('请填写目标完赛时间')
    if (!form.weeklyMileage) return setErr('请填写当前周跑量')
    dispatch({
      type: 'SET_USER',
      payload: {
        goalType: form.goalType,
        targetTime: form.targetTime,
        targetPace: form.paceOverride ? form.targetPace : paceDisplay,
        raceDate: form.raceDate || fmtDate(new Date(new Date().setMonth(new Date().getMonth() + 3))),
        current5K: form.current5K,
        current10K: form.current10K,
        longestRun: Number(form.longestRun) || 0,
        avgPace: form.avgPace,
        runDays: form.runDays,
        weeklyMileage: Number(form.weeklyMileage),
        injuries: form.injuries,
      },
    })
    nav('/')
  }

  const steps = ['目标', '能力', '计划']
  return (
    <div className="app-shell min-h-screen flex flex-col px-5 pt-[max(env(safe-area-inset-top),16px)] pb-6 animate-fadein">
      <div className="text-center mb-4">
        <div className="text-3xl mb-1">🏃‍♂️</div>
        <h1 className="text-xl font-bold grad-text">半马 AI 教练</h1>
        <p className="text-muted text-xs mt-1">手表的 AI 大脑 · 告诉你今天该怎么练</p>
      </div>

      {/* 步骤指示 */}
      <div className="flex gap-2 mb-5">
        {steps.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-line'}`} />
            <div className={`text-[11px] mt-1 ${i === step ? 'text-primary' : 'text-muted'}`}>{s}</div>
          </div>
        ))}
      </div>

      <div className="flex-1">
        {step === 0 && (
          <div className="space-y-5 animate-fadein">
            <div>
              <Label icon={Flag} text="目标类型" />
              <div className="grid grid-cols-3 gap-2">
                {GOAL_TYPES.map((g) => (
                  <button key={g.v} onClick={() => set('goalType', g.v)}
                    className={`tap p-3 rounded-xl border text-center ${form.goalType === g.v ? 'border-primary bg-primarydim' : 'border-line bg-card'}`}>
                    <div className="font-semibold text-ink text-sm">{g.label}</div>
                    <div className="text-[11px] text-muted mt-0.5">{g.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label icon={Clock} text="目标完赛时间" />
              <div className="flex flex-wrap gap-2">
                {QUICK_TIMES.map((t) => (
                  <Chip key={t} active={form.targetTime === t} onClick={() => set('targetTime', t)}>{t.replace(':00', '')}</Chip>
                ))}
              </div>
              <input
                value={form.targetTime}
                onChange={(e) => set('targetTime', e.target.value)}
                placeholder="自定义 时:分:秒"
                className="mt-3 w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary"
              />
            </div>

            <div>
              <Label icon={Footprints} text="目标配速" />
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-card border border-line rounded-xl px-3 py-2.5 text-ink">
                  自动计算：<span className="text-primary font-semibold">{computedPace}/km</span>
                </div>
                <label className="flex items-center gap-1 text-xs text-muted">
                  <input type="checkbox" checked={form.paceOverride} onChange={(e) => set('paceOverride', e.target.checked)} />
                  手动
                </label>
              </div>
              {form.paceOverride && (
                <input value={form.targetPace} onChange={(e) => set('targetPace', e.target.value)}
                  placeholder={'如 5\'30"'} className="mt-2 w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary" />
              )}
            </div>

            <div>
              <Label icon={Calendar} text="比赛日期（可空，默认12周后）" />
              <input type="date" value={form.raceDate} onChange={(e) => set('raceDate', e.target.value)}
                className="w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary [color-scheme:dark]" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5 animate-fadein">
            <div>
              <Label icon={Dumbbell} text="当前能力" />
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['current5K', '最近 5K'],
                  ['current10K', '最近 10K'],
                  ['longestRun', '最长距离(km)'],
                  ['avgPace', '平均配速(5\'30")'],
                ].map(([k, label]) => (
                  <div key={k}>
                    <div className="text-xs text-muted mb-1">{label}</div>
                    <input value={form[k]} onChange={(e) => set(k, e.target.value)}
                      className="w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary" />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label icon={HeartPulse} text={`每周可跑天数：${form.runDays} 天`} />
              <input type="range" min="1" max="7" value={form.runDays} onChange={(e) => set('runDays', Number(e.target.value))}
                className="w-full accent-primary" />
              <div className="flex justify-between text-[11px] text-muted"><span>1</span><span>7</span></div>
            </div>
            <div>
              <Label icon={Footprints} text="当前周跑量 (km)" />
              <input type="number" value={form.weeklyMileage} onChange={(e) => set('weeklyMileage', e.target.value)}
                className="w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary" />
            </div>
            <div>
              <Label icon={AlertTriangle} text="伤病史（多选）" />
              <div className="flex flex-wrap gap-2">
                {INJURIES.map((i) => (
                  <Chip key={i} active={form.injuries.includes(i)} onClick={() => toggleInjury(i)}>{i}</Chip>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-fadein">
            <div className="bg-card rounded-xl p-4 space-y-2 text-sm">
              <Row k="目标类型" v={GOAL_TYPES.find((g) => g.v === form.goalType)?.label} />
              <Row k="目标时间" v={form.targetTime} />
              <Row k="目标配速" v={`${paceDisplay}/km`} />
              <Row k="比赛日期" v={form.raceDate || '默认 12 周后'} />
              <Row k="每周可跑" v={`${form.runDays} 天 / ${form.weeklyMileage}km`} />
              <Row k="伤病史" v={form.injuries.length ? form.injuries.join('、') : '无'} />
            </div>
            <div className="bg-primarydim border border-primary/30 rounded-xl p-3 text-xs text-ink flex gap-2">
              <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
              点击生成后，规则引擎会立刻排出 12 周计划，AI 同时生成注意点与解释。
            </div>
            {err && <div className="text-red text-sm">{err}</div>}
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-4">
        {step > 0 && <Btn primary={false} onClick={() => setStep(step - 1)}>上一步</Btn>}
        {step < 2 ? (
          <Btn onClick={() => canNext() ? setStep(step + 1) : setErr('请填写必填项')} disabled={!canNext()}>下一步</Btn>
        ) : (
          <Btn onClick={submit}>生成我的 12 周计划 🚀</Btn>
        )}
      </div>
    </div>
  )
}

function Label({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-2 text-ink font-semibold mb-2 text-sm">
      <Icon size={16} className="text-primary" /> {text}
    </div>
  )
}
function Row({ k, v }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{k}</span>
      <span className="text-ink font-medium">{v}</span>
    </div>
  )
}
