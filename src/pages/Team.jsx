import React, { useState, useMemo } from 'react'
import { Users, Trophy, Swords, Target, Plus, Crown, Flame, Zap } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { parseTime, fmtTime } from '../lib/format.js'
import { Card, Sheet, Btn, SectionTitle, Bar } from '../components/ui.jsx'

export default function Team() {
  const { state, dispatch } = useApp()
  const team = state.team
  const [editOpen, setEditOpen] = useState(false)
  const [name, setName] = useState(team.name)
  const [joined, setJoined] = useState({})

  const byMileage = useMemo(() => [...team.members].sort((a, b) => b.weeklyMileage - a.weeklyMileage), [team.members])
  const maxM = Math.max(1, ...byMileage.map((m) => m.weeklyMileage))
  const byPred = useMemo(() => [...team.members].sort((a, b) => parseTime(a.predicted) - parseTime(b.predicted)), [team.members])
  const pks = useMemo(() => team.members.filter((m) => m.target === state.user.targetTime && m.name !== '你'), [team.members, state.user.targetTime])

  const saveName = () => { dispatch({ type: 'SET_TEAM', payload: { ...team, name } }); setEditOpen(false) }

  return (
    <div className="space-y-4">
      <SectionTitle icon={Users}>跑团 · {team.name}</SectionTitle>

      {/* 头部信息 */}
      <Card className="flex items-center justify-between">
        <div>
          <div className="text-ink font-semibold">{team.members.length} 名成员</div>
          <div className="text-xs text-muted">本周总跑量 {team.members.reduce((s, m) => s + m.weeklyMileage, 0)} km</div>
        </div>
        <button onClick={() => setEditOpen(true)} className="tap bg-card2 border border-line rounded-lg px-3 py-1.5 text-xs text-ink flex items-center gap-1">
          <Plus size={14} /> 创建/改名
        </button>
      </Card>

      {/* 成员周跑量排行 */}
      <Card>
        <SectionTitle icon={Flame}>成员周跑量排行</SectionTitle>
        <div className="space-y-2">
          {byMileage.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3">
              <div className="w-5 text-center text-sm">{i === 0 ? '👑' : i + 1}</div>
              <div className="text-xl">{m.avatar}</div>
              <div className="flex-1">
                <div className="flex justify-between text-xs">
                  <span className="text-ink">{m.name}</span>
                  <span className="text-muted">{m.weeklyMileage} km</span>
                </div>
                <Bar value={m.weeklyMileage / maxM} color={i === 0 ? '#FACC15' : '#FF6B35'} height={6} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 每周挑战 */}
      <Card>
        <SectionTitle icon={Zap}>每周挑战</SectionTitle>
        <div className="space-y-2">
          {team.challenges.map((c) => (
            <div key={c.id} className="bg-card2 rounded-lg p-3 flex items-center gap-3">
              <Trophy size={18} className="text-yellow shrink-0" />
              <div className="flex-1">
                <div className="text-sm text-ink font-medium">{c.title}</div>
                <div className="text-[11px] text-muted">{c.desc} · 奖励 {c.reward}</div>
              </div>
              <button onClick={() => setJoined((j) => ({ ...j, [c.id]: !j[c.id] }))}
                className={`tap px-3 py-1.5 rounded-lg text-xs font-medium ${joined[c.id] ? 'bg-green text-white' : 'bg-primary text-white'}`}>
                {joined[c.id] ? '已参与' : '参与'}
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* 好友 PK（同目标时间） */}
      <Card>
        <SectionTitle icon={Swords}>好友 PK · 同目标 {state.user.targetTime}</SectionTitle>
        {pks.length ? (
          <div className="space-y-2">
            {pks.map((m) => {
              const win = parseTime(m.predicted) <= parseTime(state.prediction.predictedTime)
              return (
                <div key={m.id} className="bg-card2 rounded-lg p-3 flex items-center gap-3">
                  <div className="text-xl">{m.avatar}</div>
                  <div className="flex-1">
                    <div className="text-sm text-ink">{m.name}</div>
                    <div className="text-[11px] text-muted">预测 {m.predicted} · 目标 {m.target}</div>
                  </div>
                  <div className={`text-xs font-semibold ${win ? 'text-green' : 'text-red'}`}>{win ? '你暂领先' : '对方领先'}</div>
                </div>
              )
            })}
          </div>
        ) : <div className="text-xs text-muted">暂无同目标时间的跑友，去拉好友入团吧～</div>}
      </Card>

      {/* 完赛预测排行榜 */}
      <Card>
        <SectionTitle icon={Target}>完赛预测排行榜</SectionTitle>
        <div className="space-y-1">
          {byPred.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 py-1.5">
              <div className={`w-6 text-center text-sm font-bold ${i === 0 ? 'text-yellow' : 'text-muted'}`}>{i + 1}</div>
              <div className="text-lg">{m.avatar}</div>
              <div className="flex-1 text-sm text-ink">{m.name}</div>
              <div className="text-sm font-semibold text-primary">{m.predicted}</div>
            </div>
          ))}
        </div>
      </Card>

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="创建 / 重命名跑团">
        <div className="space-y-3 animate-fadein">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="跑团名称" className="w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary" />
          <div className="text-xs text-muted">演示环境：点击「加入」可模拟加入现有团；真实环境由 WorkBuddy 云数据库管理成员关系。</div>
          <Btn onClick={saveName}>保存</Btn>
        </div>
      </Sheet>
    </div>
  )
}
