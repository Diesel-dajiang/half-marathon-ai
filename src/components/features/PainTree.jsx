import React, { useState } from 'react'
import { Sheet, Btn } from '../../components/ui.jsx'
import { painAdvice } from '../../lib/rules.js'
import { MapPin, Stethoscope } from 'lucide-react'

const PARTS = [
  { v: 'knee', label: '膝盖', emoji: '🦵' },
  { v: 'ankle', label: '脚踝', emoji: '🦶' },
  { v: 'foot', label: '足底', emoji: '👣' },
  { v: 'calf', label: '小腿', emoji: '💪' },
  { v: 'hip', label: '髋部', emoji: '🦴' },
  { v: 'other', label: '其他', emoji: '❓' },
]
const CLINICS = [
  { name: '市运动康复中心', dist: '2.3km', tag: '运动损伤' },
  { name: '禾普运动医学诊所', dist: '4.1km', tag: '跑步专项' },
  { name: '三甲医院骨科门诊', dist: '6.8km', tag: '影像检查' },
]

// 疼痛决策树（功能4）
export default function PainTree({ open, onClose }) {
  const [part, setPart] = useState(null)
  const [level, setLevel] = useState(null)

  const reset = () => { setPart(null); setLevel(null) }
  const advice = part && level != null ? painAdvice(part, level) : null

  return (
    <Sheet open={open} onClose={() => { onClose(); reset() }} title="🩹 我哪里疼 · 疼痛决策树">
      <div className="space-y-4 animate-fadein">
        {/* 步骤1：部位 */}
        <div>
          <div className="text-xs text-muted mb-2">① 选择疼痛部位</div>
          <div className="grid grid-cols-3 gap-2">
            {PARTS.map((p) => (
              <button key={p.v} onClick={() => setPart(p)} className={`tap rounded-xl p-3 text-center border ${part?.v === p.v ? 'border-primary bg-primarydim' : 'border-line bg-card'}`}>
                <div className="text-2xl">{p.emoji}</div>
                <div className="text-sm text-ink mt-1">{p.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 步骤2：等级 */}
        {part && (
          <div className="animate-fadein">
            <div className="text-xs text-muted mb-2">② {part.label}疼痛等级（1 轻微 → 5 剧烈）</div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((l) => (
                <button key={l} onClick={() => setLevel(l)} className={`tap flex-1 py-3 rounded-xl font-bold border ${level === l ? 'bg-primary text-white border-primary' : 'border-line bg-card text-ink'}`}>{l}</button>
              ))}
            </div>
          </div>
        )}

        {/* 结果 */}
        {advice && (
          <div className="animate-pop space-y-3">
            <div className="rounded-xl p-4" style={{ background: `${advice.color}22`, border: `1px solid ${advice.color}66` }}>
              <div className="font-bold text-lg" style={{ color: advice.color }}>{advice.action}</div>
              <p className="text-sm text-ink mt-1">{advice.note}</p>
            </div>
            {(level >= 4) && (
              <div className="bg-card2 rounded-xl p-3">
                <div className="flex items-center gap-2 text-ink text-sm font-semibold mb-2"><Stethoscope size={16} className="text-primary" /> 附近运动康复机构（模拟）</div>
                <div className="space-y-2">
                  {CLINICS.map((c) => (
                    <div key={c.name} className="flex items-center gap-2 text-xs text-muted">
                      <MapPin size={14} className="text-primary shrink-0" />
                      <span className="text-ink">{c.name}</span>
                      <span>· {c.dist}</span>
                      <span className="ml-auto bg-card px-2 py-0.5 rounded-full">{c.tag}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="text-[11px] text-muted">分级建议仅供参考，疼痛持续或加重请及时就医。</div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
