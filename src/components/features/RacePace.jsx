import React, { useState, useEffect, useRef } from 'react'
import { Mic, Play, Pause, Flag } from 'lucide-react'
import { Sheet } from '../../components/ui.jsx'
import { parseTime, fmtTime, fmtPace } from '../../lib/format.js'

// 比赛日 AI 陪跑（功能10）：用文字模拟耳机语音逐公里播报
export default function RacePace({ open, onClose, user }) {
  const [running, setRunning] = useState(false)
  const [idx, setIdx] = useState(0)
  const [started, setStarted] = useState(false)
  const scrollRef = useRef(null)

  const paceSec = parseTime(user.targetPace) || 341
  const totalKm = 21.1

  // 生成逐公里播报脚本
  const script = buildScript(paceSec, totalKm, user)

  useEffect(() => {
    if (!running) return
    if (idx >= script.length) { setRunning(false); return }
    const t = setTimeout(() => setIdx((i) => i + 1), 900)
    return () => clearTimeout(t)
  }, [running, idx, script.length])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [idx])

  // 每次打开重置
  useEffect(() => {
    if (open) { setStarted(false); setRunning(false); setIdx(0) }
  }, [open])

  const start = () => { setStarted(true); setRunning(true) }
  const toggle = () => { if (idx < script.length) setRunning((r) => !r) }

  return (
    <Sheet open={open} onClose={onClose} title="🎧 AI 陪跑模式">
      <div className="flex flex-col h-[60vh]">
        {!started ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 animate-fadein">
            <div className="text-5xl">🏁</div>
            <div className="text-ink font-semibold">比赛日 · 半程 21.1K</div>
            <div className="text-xs text-muted max-w-[260px]">
              点击开始，AI 会像耳机语音一样每公里报时、提醒补给、控心率，并在最后 3K 给你冲刺策略。
            </div>
            <button onClick={start} className="tap mt-2 bg-primary text-white rounded-xl px-8 py-3 font-semibold flex items-center gap-2">
              <Play size={18} /> 开始陪跑
            </button>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1">
              {script.slice(0, idx).map((m, i) => (
                <div key={i} className={`animate-fadein ${m.me ? 'text-right' : ''}`}>
                  {m.me ? (
                    <div className="inline-block bg-primary/20 text-ink rounded-2xl rounded-tr-sm px-3 py-2 text-sm max-w-[85%]">
                      <span className="text-primary font-semibold">{m.km}K · </span>{m.text}
                      {m.pace && <span className="text-muted text-xs block">配速 {m.pace}/km · 累计 {m.cum}</span>}
                    </div>
                  ) : (
                    <div className="inline-block bg-card2 text-ink rounded-2xl rounded-tl-sm px-3 py-2 text-sm max-w-[85%]">
                      {m.text}
                    </div>
                  )}
                </div>
              ))}
              {running && <div className="text-muted text-xs animate-pulse2">▍ AI 正在陪你跑…</div>}
            </div>
            <div className="flex gap-2 pt-3 border-t border-line mt-2">
              <button onClick={toggle} className="tap flex-1 bg-card2 border border-line text-ink rounded-xl py-3 font-medium flex items-center justify-center gap-2">
                {running ? <><Pause size={16} /> 暂停</> : <><Play size={16} /> 继续</>}
              </button>
              <button onClick={onClose} className="tap flex-1 bg-primary text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2">
                <Flag size={16} /> 结束
              </button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}

function buildScript(paceSec, totalKm, user) {
  const km = [1, 2, 3, 5, 8, 10, 12, 15, 18, 19, 20, 21.1]
  const msgs = []
  const push = (k, text, extra = {}) => {
    msgs.push({
      me: true, km: k, text,
      pace: fmtPace(paceSec + (Math.random() * 6 - 3)),
      cum: fmtTime(Math.round(paceSec * k)),
      ...extra,
    })
  }
  push(1, '出发！前 1K 压住，别被人群带快，热身到位了吗？')
  push(2, '配速稳，心率在 Zone2，呼吸均匀，继续保持。')
  push(3, '3K 了，计划喝点水了，润一口就行，别停。')
  push(5, '5K 中点，状态不错。记得每 5K 补水一次。')
  push(8, '半程过半，配速仍在目标区间，身体反馈如何？')
  push(10, '10K！补给点，吃一支能量胶 + 水。后半程靠它了。')
  push(12, '12K，心率略升正常，步频保持 170+，落地轻。')
  push(15, '15K，最难的「撞墙期」前夜，节奏别乱，相信训练。')
  push(18, '🔥 最后 3K！这是冲刺区：配速可抬到目标 -10s，跟住呼吸。')
  push(19, '19K，听着耳机里这首歌，数步子，1-2-3 顶住！')
  push(20, '20K，终点在望，能冲就冲，腿酸是正常的，咬牙！')
  push(21.1, '🏁 冲线！完赛达成！慢走放松，披上保暖衣，补糖补水。', { finished: true })
  msgs.push({ me: false, text: '恭喜完赛 🎉 你按策略跑完了，后半程没有崩。赛后记得拉伸 + 30 分钟内补碳水蛋白质。' })
  return msgs
}
