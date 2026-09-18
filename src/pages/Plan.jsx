import React, { useState, useMemo } from 'react'
import {
  CalendarDays, ChevronLeft, ChevronRight, Check, Flag, Play, Dumbbell,
  Flame, ListChecks, Sparkles,
} from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { WEEK_CN, TRAIN_TYPES, fmtDate, daysUntil } from '../lib/format.js'
import { Card, Ring, Sheet, SectionTitle, Bar } from '../components/ui.jsx'
import RaceSim from '../components/features/RaceSim.jsx'

export default function Plan() {
  const { state, currentWeek, dispatch } = useApp()
  const [selWeek, setSelWeek] = useState(currentWeek)
  const [dayOpen, setDayOpen] = useState(null)
  const [raceSimOpen, setRaceSimOpen] = useState(false)
  const [previewTaper, setPreviewTaper] = useState(false)

  const user = state.user
  const countdown = daysUntil(user.raceDate)
  const showChecklist = state.preview === 'taper' || previewTaper || (countdown != null && countdown <= 14 && countdown >= 0)

  const weekPlan = state.plan.filter((p) => p.weekNumber === selWeek).sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  const weekTotal = weekPlan.filter((p) => p.type !== 'rest').reduce((s, p) => s + p.distance, 0)
  const isTaperWeek = selWeek % 4 === 0 || selWeek >= 11

  // 赛前 14 天倒计时清单（按日期倒推）
  const checklist = useMemo(() => {
    if (!user.raceDate) return []
    return state.raceChecklist.map((c) => {
      const dt = new Date(user.raceDate + 'T00:00:00')
      dt.setDate(dt.getDate() - c.dayOffset)
      return { ...c, date: fmtDate(dt) }
    }).sort((a, b) => b.dayOffset - a.dayOffset)
  }, [state.raceChecklist, user.raceDate])

  const todayDow = (new Date().getDay() + 6) % 7 + 1

  return (
    <div className="space-y-4">
      <SectionTitle icon={CalendarDays}>12 周训练计划</SectionTitle>

      {/* 总览进度环 */}
      <Card className="flex items-center gap-4">
        <Ring value={currentWeek / 12} size={92} color="#FF6B35">
          <div className="text-center">
            <div className="text-lg font-bold text-primary">{currentWeek}</div>
            <div className="text-[10px] text-muted">/ 12 周</div>
          </div>
        </Ring>
        <div className="flex-1 text-sm space-y-1">
          <div className="text-ink font-semibold">目标 {user.targetTime}</div>
          <div className="text-muted">总计划 {state.plan.reduce((s, p) => s + (p.type !== 'rest' ? p.distance : 0), 0)} km</div>
          <div className="text-muted">当前周跑量 {weekTotal} km {isTaperWeek && <span className="text-yellow">· 减量周</span>}</div>
        </div>
      </Card>

      {/* 功能7：赛前 14 天倒计时清单 */}
      {showChecklist && (
        <Card className="border border-yellow/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-ink font-semibold">
              <Flag size={16} className="text-yellow" /> 赛前 {countdown != null ? `${countdown} 天` : '14 天'} 倒计时清单
            </div>
            {!showChecklist && null}
          </div>
          <div className="space-y-2">
            {checklist.map((c) => (
              <button key={c.id} onClick={() => dispatch({ type: 'TOGGLE_CHECKLIST', id: c.id })}
                className="tap w-full flex items-center gap-3 bg-card2 rounded-lg p-2.5 text-left">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${c.completed ? 'bg-green border-green' : 'border-line'}`}>
                  {c.completed && <Check size={14} className="text-white" />}
                </div>
                <div className="flex-1">
                  <div className={`text-sm ${c.completed ? 'text-muted line-through' : 'text-ink'}`}>
                    D-{c.dayOffset} · {c.task}
                  </div>
                  <div className="text-[11px] text-muted">{c.date}</div>
                </div>
              </button>
            ))}
          </div>
          {countdown != null && countdown > 14 && (
            <div className="text-[11px] text-muted mt-2">（当前距比赛 {countdown} 天，此为预览；进入 14 天区间后自动高亮）</div>
          )}
        </Card>
      )}
      {!showChecklist && (
        <button onClick={() => setPreviewTaper(true)} className="tap w-full text-center text-[11px] text-muted underline">（演示）查看赛前 14 天倒计时清单</button>
      )}

      {/* 功能3：比赛日模拟（赛前 2-3 周出现） */}
      {(selWeek >= 10 || state.preview) && (
        <Card className="border border-primary/40 bg-primarydim">
          <div className="flex items-center gap-3">
            <Play size={20} className="text-primary" />
            <div className="flex-1">
              <div className="text-ink font-semibold text-sm">🏁 模拟比赛日</div>
              <div className="text-xs text-muted">按比赛配速跑 10-15K，演练早餐/补给/热身，跑后 AI 评估</div>
            </div>
            <button onClick={() => setRaceSimOpen(true)} className="tap bg-primary text-white text-xs px-3 py-1.5 rounded-lg font-medium">去模拟</button>
          </div>
        </Card>
      )}

      {/* 周选择器 */}
      <div className="flex items-center gap-2">
        <button className="tap p-1" onClick={() => setSelWeek((w) => Math.max(1, w - 1))}><ChevronLeft size={18} className="text-muted" /></button>
        <div className="flex-1 flex gap-1 overflow-x-auto no-scrollbar">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
            <button key={w} onClick={() => setSelWeek(w)}
              className={`tap shrink-0 w-8 h-8 rounded-full text-xs font-medium ${w === selWeek ? 'bg-primary text-white' : w === currentWeek ? 'bg-card2 text-primary border border-primary/40' : 'bg-card text-muted'}`}>
              {w}
            </button>
          ))}
        </div>
        <button className="tap p-1" onClick={() => setSelWeek((w) => Math.min(12, w + 1))}><ChevronRight size={18} className="text-muted" /></button>
      </div>

      {/* 周视图：7 天卡片 */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekPlan.map((p) => {
          const t = TRAIN_TYPES[p.type]
          const isToday = selWeek === currentWeek && p.dayOfWeek === todayDow
          return (
            <button key={p.id} onClick={() => setDayOpen(p)}
              className={`tap rounded-xl p-2 text-center border ${isToday ? 'border-primary bg-primarydim' : 'border-line bg-card'}`}>
              <div className="text-[10px] text-muted">{WEEK_CN[p.dayOfWeek - 1].slice(1)}</div>
              <div className="text-lg my-0.5">{t.emoji}</div>
              <div className="text-[10px] text-ink">{p.type === 'rest' ? '休息' : `${p.distance}K`}</div>
            </button>
          )
        })}
      </div>

      {/* 调整记录 */}
      <Card>
        <SectionTitle icon={ListChecks}>AI 动态调整记录</SectionTitle>
        <div className="text-xs text-muted bg-card2 rounded-lg p-3 leading-relaxed">
          第 {Math.max(1, currentWeek - 1)} 周：根据跑后反馈（RPE 偏高、睡眠 3/5），AI 将本周强度课降为轻松跑，并增加 1 个休息日，跑量下调约 10%。<br />
          <span className="text-primary">原因：恢复指标未达标，优先保证超量恢复，避免受伤。</span>
        </div>
      </Card>

      <RaceSim open={raceSimOpen} onClose={() => setRaceSimOpen(false)} user={user} />

      {/* 日详情 */}
      <Sheet open={!!dayOpen} onClose={() => setDayOpen(null)} title={dayOpen ? `${WEEK_CN[dayOpen.dayOfWeek - 1]} · ${TRAIN_TYPES[dayOpen.type].label}` : ''}>
        {dayOpen && <DayDetail plan={dayOpen} />}
      </Sheet>
    </div>
  )
}

function DayDetail({ plan }) {
  const t = TRAIN_TYPES[plan.type]
  if (plan.type === 'rest') {
    return (
      <div className="space-y-3 animate-fadein">
        <div className="text-center text-4xl">{t.emoji}</div>
        <p className="text-sm text-ink text-center">{plan.restAdvice}</p>
        <div className="bg-card2 rounded-lg p-3 text-xs text-muted">休息也是训练的一部分。可散步、滚泡沫轴、做核心，给关节放假。</div>
      </div>
    )
  }
  return (
    <div className="space-y-3 animate-fadein">
      <div className="flex items-center justify-between bg-card2 rounded-lg p-3">
        <div className="text-2xl">{t.emoji}</div>
        <div className="text-right">
          <div className="text-ink font-semibold">{plan.distance} km</div>
          <div className="text-xs text-muted">{plan.paceRange}/km</div>
        </div>
      </div>
      <Step icon={Flame} k="热身" v="动态拉伸 8-10 分钟 + 慢跑 1K 激活心率" />
      <Step icon={Dumbbell} k="主课" v={`${plan.distance} km · ${plan.paceRange}/km · 心率 ${plan.hrRange} bpm`} />
      <Step icon={Check} k="冷身" v="慢走 5 分钟 + 静态拉伸小腿/髂胫束" />
      <Step icon={Sparkles} k="注意点" v={plan.notes} />
      <Step icon={ListChecks} k="休息建议" v={plan.restAdvice} />
    </div>
  )
}

function Step({ icon: Icon, k, v }) {
  return (
    <div className="flex gap-2">
      <Icon size={16} className="text-primary mt-0.5 shrink-0" />
      <div><span className="text-muted text-sm">{k}：</span><span className="text-ink text-sm">{v}</span></div>
    </div>
  )
}
