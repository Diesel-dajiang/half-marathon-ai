import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarClock, TrafficCone, Target, Flame, ChevronDown, ChevronUp, Mail, Sparkles,
  Mic, TrendingUp, Clock, HeartPulse,
} from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import {
  fmtTime, fmtGap, fmtPace, daysUntil, WEEK_CN, TRAIN_TYPES, parseTime,
} from '../lib/format.js'
import { LIGHT_META, predictFinish } from '../lib/rules.js'
import { Card, Ring, Bar, Sheet, SectionTitle, Btn } from '../components/ui.jsx'
import RacePace from '../components/features/RacePace.jsx'

export default function Home() {
  const { state, currentWeek, dispatch } = useApp()
  const nav = useNavigate()
  const [lightOpen, setLightOpen] = useState(false)
  const [letterOpen, setLetterOpen] = useState(false)
  const [racePaceOpen, setRacePaceOpen] = useState(false)

  const user = state.user
  const light = state.dailyCheck
  const lm = LIGHT_META[light.status]
  const countdown = daysUntil(user.raceDate)

  // 今日任务
  const todayDow = (new Date().getDay() + 6) % 7 + 1
  const todayPlan = state.plan.find((p) => p.weekNumber === currentWeek && p.dayOfWeek === todayDow)
  const [expanded, setExpanded] = useState(false)

  // 完赛预测（实时用规则估算，结合 mock 初始值作展示）
  const pred = useMemo(() => predictFinish(user, Math.max(0, 12 - currentWeek + 1)), [user, currentWeek])
  const targetSec = parseTime(user.targetTime) || 7200
  const predictedSec = parseTime(state.prediction.predictedTime) || pred.predictedSec
  const gapSec = predictedSec - targetSec
  const reach = Math.min(1, targetSec / predictedSec) // 达标接近度

  // 本周进度
  const weekPlanned = state.plan.filter((p) => p.weekNumber === currentWeek && p.type !== 'rest').reduce((s, p) => s + p.distance, 0)
  const weekDone = state.workouts
    .filter((w) => {
      const diff = (Date.now() - new Date(w.date).getTime()) / 86400000
      return diff <= 7 && diff >= 0
    })
    .reduce((s, w) => s + w.distance, 0)
  const weekRate = weekPlanned ? weekDone / weekPlanned : 0

  const isRaceDay = state.preview === 'race' || countdown === 0

  return (
    <div className="space-y-4">
      {/* 顶部问候 + 比赛倒计时 */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs text-muted">第 {currentWeek} / 12 周</div>
          <div className="text-lg font-bold text-ink">嗨，今天练点啥？👟</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted">距比赛</div>
          <div className="text-xl font-bold grad-text">{countdown != null ? `D-${countdown}` : '--'}</div>
        </div>
      </div>
      <Card className="flex items-center justify-between" onClick={() => nav('/plan')}>
        <div className="flex items-center gap-2 text-sm text-muted">
          <CalendarClock size={16} className="text-primary" />
          比赛日 {user.raceDate || '未设置'}
        </div>
        <Bar value={currentWeek / 12} className="w-24" />
      </Card>

      {/* 功能1：每日红绿灯 */}
      <div className="rounded-xl p-4 shadow-card animate-pop" style={{ background: lm.bg, border: `1px solid ${lm.color}55` }}>
        <div className="flex items-center gap-3">
          <div className="text-3xl">{lm.emoji}</div>
          <div className="flex-1">
            <div className="font-bold text-lg" style={{ color: lm.color }}>{lm.label}</div>
            <div className="text-sm text-ink">{light.reason}</div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={() => setLightOpen(true)} className="tap flex-1 py-2 rounded-lg bg-white/10 text-ink text-sm font-medium">查看详情</button>
          <button onClick={() => nav('/plan')} className="tap flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium">调整今日计划</button>
        </div>
      </div>

      {/* 功能2：完赛预测 + 差距可视化 */}
      <Card>
        <SectionTitle icon={Target} >完赛预测</SectionTitle>
        <div className="flex items-center gap-4">
          <Ring value={reach} size={108} color="#FF6B35">
            <div className="text-center">
              <div className="text-[10px] text-muted">达标度</div>
              <div className="text-lg font-bold text-primary">{Math.round(reach * 100)}%</div>
            </div>
          </Ring>
          <div className="flex-1 space-y-2 text-sm">
            <Line label="预测完赛" value={fmtTime(predictedSec)} color="#FF6B35" />
            <Line label="目标时间" value={fmtTime(targetSec)} color="#EAEAEA" />
            <Line label="差距" value={fmtGap(gapSec)} color={gapSec <= 0 ? '#22C55E' : '#FACC15'} />
          </div>
        </div>
        <div className="mt-3 bg-card2 rounded-lg p-3 text-xs text-muted leading-relaxed">{pred.advice}</div>
      </Card>

      {/* 今日任务卡片（可展开） */}
      {todayPlan && (
        <Card onClick={() => setExpanded((v) => !v)}>
          <div className="flex items-center justify-between">
            <SectionTitle icon={Flame}>今日任务</SectionTitle>
            {expanded ? <ChevronUp size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
          </div>
          <TodayHead plan={todayPlan} />
          {expanded && <TodayDetail plan={todayPlan} />}
        </Card>
      )}

      {/* 本周进度 */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-ink">本周进度</span>
          <span className="text-xs text-muted">{weekDone.toFixed(1)} / {weekPlanned} km</span>
        </div>
        <Bar value={weekRate} color={weekRate >= 1 ? '#22C55E' : '#FF6B35'} />
        <div className="mt-1 text-right text-[11px] text-muted">完成度 {Math.round(weekRate * 100)}%</div>
      </Card>

      {/* 功能6：每周教练信 */}
      <Card onClick={() => setLetterOpen(true)} className="border border-primary/20">
        <div className="flex items-center gap-2 mb-1">
          <Mail size={16} className="text-primary" />
          <span className="text-sm font-semibold text-ink">第 {state.coachLetter.weekNumber} 周 · 教练信</span>
        </div>
        <p className="text-xs text-muted line-clamp-2 whitespace-pre-line">{state.coachLetter.content.slice(0, 80)}…</p>
        <div className="text-[11px] text-primary mt-1">点击查看完整 →</div>
      </Card>

      {/* AI 问答入口 */}
      <button onClick={() => nav('/coach')} className="tap w-full bg-card2 rounded-xl p-4 flex items-center gap-3 border border-line">
        <Sparkles size={20} className="text-primary" />
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold text-ink">问问 AI 教练</div>
          <div className="text-xs text-muted">配速、伤痛、补给，随时解答</div>
        </div>
        <ChevronDown size={18} className="text-muted rotate-[-90deg]" />
      </button>

      {/* 功能10：比赛日 AI 陪跑（比赛日当天出现） */}
      {isRaceDay ? (
        <button onClick={() => setRacePaceOpen(true)} className="tap w-full bg-gradient-to-r from-primary to-yellow-500 rounded-xl p-4 flex items-center gap-3 shadow-glow">
          <Mic size={22} className="text-white" />
          <div className="flex-1 text-left text-white">
            <div className="text-sm font-bold">AI 陪跑模式 · 进行中</div>
            <div className="text-xs text-white/85">每公里报时 · 补给提醒 · 冲刺策略</div>
          </div>
        </button>
      ) : (
        <button onClick={() => dispatch({ type: 'SET_PREVIEW', mode: 'race' })} className="tap w-full text-center text-[11px] text-muted underline">
          （演示）体验比赛日 AI 陪跑
        </button>
      )}

      {/* 红绿灯详情弹窗 */}
      <Sheet open={lightOpen} onClose={() => setLightOpen(false)} title="今日能不能跑 · 详细评估">
        <LightDetail light={light} lm={lm} user={user} />
      </Sheet>

      {/* 教练信弹窗 */}
      <Sheet open={letterOpen} onClose={() => setLetterOpen(false)} title={`第 ${state.coachLetter.weekNumber} 周教练信`}>
        <pre className="whitespace-pre-wrap text-sm text-ink leading-relaxed font-sans">{state.coachLetter.content}</pre>
        <div className="mt-3 text-[11px] text-muted">可长按截图分享给跑友 📸</div>
      </Sheet>

      <RacePace open={racePaceOpen} onClose={() => { setRacePaceOpen(false); dispatch({ type: 'SET_PREVIEW', mode: null }) }} user={user} />
    </div>
  )
}

function Line({ label, value, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-semibold" style={{ color }}>{value}</span>
    </div>
  )
}

function TodayHead({ plan }) {
  const t = TRAIN_TYPES[plan.type]
  return (
    <div className="flex items-center justify-between mt-1">
      <div className="flex items-center gap-2">
        <span className="text-xl">{t.emoji}</span>
        <div>
          <div className="font-semibold text-ink">{t.label}</div>
          <div className="text-xs text-muted">{plan.distance} km · {plan.paceRange}/km</div>
        </div>
      </div>
      <div className="text-xs text-muted">心率 {plan.hrRange}</div>
    </div>
  )
}

function TodayDetail({ plan }) {
  const t = TRAIN_TYPES[plan.type]
  return (
    <div className="mt-3 pt-3 border-t border-line space-y-2 text-sm animate-fadein">
      <Row icon={Flame} k="主课" v={`${plan.distance} km · ${plan.paceRange}/km`} />
      <Row icon={HeartPulse} k="心率区间" v={`${plan.hrRange} bpm`} />
      <Row icon={Target} k="注意点" v={plan.notes} />
      <Row icon={Clock} k="休息建议" v={plan.restAdvice} />
    </div>
  )
}

function Row({ icon: Icon, k, v }) {
  return (
    <div className="flex gap-2">
      <Icon size={15} className="text-primary mt-0.5 shrink-0" />
      <div><span className="text-muted">{k}：</span><span className="text-ink">{v}</span></div>
    </div>
  )
}

function LightDetail({ light, lm, user }) {
  const items = [
    { k: '睡眠评分', v: `${light.sleep || 3} / 5` },
    { k: 'HRV（模拟）', v: `${light.hrv || 3} / 5` },
    { k: '疼痛等级', v: `${light.pain ?? 1} / 5` },
    { k: '近期负荷比', v: `${(light.loadRatio || 1).toFixed(2)}×` },
  ]
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: lm.bg }}>
        <span className="text-2xl">{lm.emoji}</span>
        <div className="font-bold" style={{ color: lm.color }}>{lm.label}</div>
      </div>
      <p className="text-sm text-ink">{light.reason}</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <div key={it.k} className="bg-card2 rounded-lg p-3">
            <div className="text-[11px] text-muted">{it.k}</div>
            <div className="text-ink font-semibold">{it.v}</div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted">数据来自手表同步（睡眠/HRV）与近期跑量模拟。AI 依据上述指标给出建议，仅供参考。</p>
    </div>
  )
}
