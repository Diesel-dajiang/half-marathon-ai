import React, { useState, useRef, useEffect } from 'react'
import { MessageCircle, Send, Stethoscope, Sparkles, Loader2 } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { QUICK_QUESTIONS } from '../data/mockData.js'
import { chatReply } from '../lib/ai.js'
import { Card, Sheet, SectionTitle } from '../components/ui.jsx'
import PainTree from '../components/features/PainTree.jsx'
import { fmtDate } from '../lib/format.js'

export default function Coach() {
  const { state, dispatch } = useApp()
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [painOpen, setPainOpen] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [state.chat, thinking])

  const send = async (text) => {
    const q = (text ?? input).trim()
    if (!q || thinking) return
    dispatch({ type: 'ADD_CHAT', payload: { id: 'u' + Date.now(), role: 'user', content: q, createdAt: fmtDate(new Date()) } })
    setInput('')
    setThinking(true)
    const ans = await chatReply(q, state.user)
    dispatch({ type: 'ADD_CHAT', payload: { id: 'a' + Date.now(), role: 'assistant', content: ans, createdAt: fmtDate(new Date()) } })
    setThinking(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <SectionTitle icon={MessageCircle}>AI 教练 · 对话</SectionTitle>

      {/* 入口：疼痛决策树 */}
      <button onClick={() => setPainOpen(true)} className="tap w-full bg-card2 border border-line rounded-xl p-3 flex items-center gap-3 mb-3">
        <Stethoscope size={20} className="text-primary" />
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold text-ink">🩹 我哪里疼？</div>
          <div className="text-xs text-muted">疼痛决策树 · 分级建议</div>
        </div>
        <Sparkles size={16} className="text-muted" />
      </button>

      {/* 对话区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1">
        {state.chat.map((m) => (
          <div key={m.id} className={`animate-fadein ${m.role === 'user' ? 'text-right' : ''}`}>
            <div className={`inline-block rounded-2xl px-3 py-2 text-sm max-w-[88%] whitespace-pre-line leading-relaxed ${m.role === 'user' ? 'bg-primary text-white rounded-tr-sm' : 'bg-card2 text-ink rounded-tl-sm'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="text-muted text-sm flex items-center gap-2 animate-pulse2">
            <Loader2 size={14} className="animate-spin" /> AI 思考中…
          </div>
        )}
      </div>

      {/* 快捷问题 */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
        {QUICK_QUESTIONS.map((q) => (
          <button key={q} onClick={() => send(q)} className="tap shrink-0 bg-card border border-line rounded-full px-3 py-1.5 text-xs text-muted">{q}</button>
        ))}
      </div>

      {/* 输入 */}
      <div className="flex gap-2 pt-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="问问配速、伤痛、补给…" className="flex-1 bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary text-sm" />
        <button onClick={() => send()} disabled={thinking} className="tap bg-primary text-white rounded-xl px-4 flex items-center justify-center">
          <Send size={18} />
        </button>
      </div>

      <PainTree open={painOpen} onClose={() => setPainOpen(false)} />
    </div>
  )
}
