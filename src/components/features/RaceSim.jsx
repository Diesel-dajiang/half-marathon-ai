import React, { useState } from 'react'
import { Flag, Coffee, Utensils, Flame, Loader2 } from 'lucide-react'
import { Sheet, Btn } from '../../components/ui.jsx'
import { fmtPace, parseTime } from '../../lib/format.js'
import { goalPaceFromTime } from '../../lib/rules.js'
import { generateRaceStrategy } from '../../lib/ai.js'

// 比赛日模拟（功能3）：按比赛配速跑 10-15K，模拟早餐/补给/热身，跑后 AI 评估
export default function RaceSim({ open, onClose, user }) {
  const [phase, setPhase] = useState('form') // form | result
  const [dist, setDist] = useState(12)
  const [pace, setPace] = useState('')
  const [feeling, setFeeling] = useState('平稳')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const targetPace = goalPaceFromTime(parseTime(user.targetTime) || 7200)
  const tpDisp = fmtPace(targetPace)

  const run = async () => {
    setLoading(true)
    const simPace = parseTime(pace) || targetPace + 8
    const out = await generateRaceStrategy({ pace: simPace, targetPace, feeling })
    setResult(out)
    setLoading(false)
    setPhase('result')
  }

  const reset = () => { setPhase('form'); setResult(''); setPace('') }

  return (
    <Sheet open={open} onClose={() => { onClose(); reset() }} title="🏁 模拟比赛日">
      {phase === 'form' ? (
        <div className="space-y-4 animate-fadein">
          <div className="bg-card2 rounded-xl p-3 text-xs text-muted space-y-1">
            <div className="flex gap-2"><Coffee size={14} className="text-primary mt-0.5" /><span>早餐：赛前 3 小时，白粥+香蕉+小面包，约 250kcal 易吸收碳水。</span></div>
            <div className="flex gap-2"><Flame size={14} className="text-primary mt-0.5" /><span>热身：动态拉伸 10 分钟 + 慢跑 1K 激活。</span></div>
            <div className="flex gap-2"><Utensils size={14} className="text-primary mt-0.5" /><span>补给：每 5K 补水，10K 后补 1 支能量胶。</span></div>
          </div>
          <div>
            <div className="text-sm text-ink mb-1">模拟距离（10-15K）</div>
            <input type="range" min="10" max="15" value={dist} onChange={(e) => setDist(+e.target.value)} className="w-full accent-primary" />
            <div className="text-center text-primary font-semibold">{dist} km</div>
          </div>
          <div>
            <div className="text-sm text-ink mb-1">实际平均配速（目标 {tpDisp}/km）</div>
            <input value={pace} onChange={(e) => setPace(e.target.value)} placeholder={tpDisp} className="w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary" />
          </div>
          <div>
            <div className="text-sm text-ink mb-1">跑后状态</div>
            <div className="flex gap-2 flex-wrap">
              {['很轻松', '平稳', '有点累', '吃力'].map((f) => (
                <button key={f} onClick={() => setFeeling(f)} className={`tap px-3 py-1.5 rounded-full text-sm border ${feeling === f ? 'bg-primary text-white border-primary' : 'border-line text-muted'}`}>{f}</button>
              ))}
            </div>
          </div>
          <Btn onClick={run} disabled={loading}>
            {loading ? <><Loader2 size={16} className="inline animate-spin" /> AI 评估中…</> : '跑完，生成评估'}
          </Btn>
        </div>
      ) : (
        <div className="space-y-3 animate-fadein">
          <div className="bg-primarydim border border-primary/30 rounded-xl p-3 text-sm text-ink whitespace-pre-line leading-relaxed">{result}</div>
          <div className="text-[11px] text-muted">以上为 AI 基于本次模拟给出的比赛日策略，仅供参考。</div>
          <Btn primary={false} onClick={reset}>再模拟一次</Btn>
        </div>
      )}
    </Sheet>
  )
}
