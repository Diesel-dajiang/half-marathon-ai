import React from 'react'
import { X } from 'lucide-react'

// 卡片
export function Card({ children, className = '', onClick, padding = 'p-4' }) {
  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-xl shadow-card ${padding} ${onClick ? 'tap' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

// 圆环进度（SVG）
export function Ring({ value = 0, size = 120, stroke = 10, color = '#FF6B35', track = '#2A3354', children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.min(1, Math.max(0, value)))
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

// 线性进度条
export function Bar({ value = 0, color = '#FF6B35', height = 8, track = '#2A3354' }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: track }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, value * 100)}%`, background: color, transition: 'width 0.6s ease' }} />
    </div>
  )
}

// 底部弹窗（动作面板）
export function Sheet({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 animate-fadein" />
      <div
        className="app-shell relative bg-card rounded-t-2xl shadow-card w-full max-h-[88%] overflow-y-auto no-scrollbar animate-slideup"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-line sticky top-0 bg-card z-10">
          <h3 className="font-semibold text-ink">{title}</h3>
          <button className="tap p-1" onClick={onClose} aria-label="关闭">
            <X size={20} className="text-muted" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

// 居中弹窗
export function Dialog({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 animate-fadein" />
      <div className="app-shell relative bg-card rounded-2xl shadow-card w-full max-w-[420px] max-h-[85%] overflow-y-auto no-scrollbar animate-pop p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-ink text-lg">{title}</h3>
          <button className="tap p-1" onClick={onClose} aria-label="关闭"><X size={20} className="text-muted" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// 标签
export function Chip({ children, active, onClick, color = '#FF6B35' }) {
  return (
    <button
      onClick={onClick}
      className={`tap px-3 py-1.5 rounded-full text-sm border ${active ? 'text-white' : 'text-muted border-line'}`}
      style={active ? { background: color, borderColor: color } : {}}
    >
      {children}
    </button>
  )
}

// 通用按钮
export function Btn({ children, onClick, primary = true, className = '', disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`tap w-full py-3 rounded-xl font-semibold text-base ${primary ? 'bg-primary text-white' : 'bg-card2 text-ink border border-line'} disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}

export function SectionTitle({ children, icon: Icon, action }) {
  return (
    <div className="flex items-center justify-between mb-2 px-1">
      <div className="flex items-center gap-2 text-ink font-semibold">
        {Icon && <Icon size={18} className="text-primary" />}
        {children}
      </div>
      {action}
    </div>
  )
}
