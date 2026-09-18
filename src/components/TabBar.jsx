import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, CalendarDays, ListChecks, MessageCircle, Users, User } from 'lucide-react'

const tabs = [
  { to: '/', label: '首页', icon: Home },
  { to: '/plan', label: '计划', icon: CalendarDays },
  { to: '/records', label: '记录', icon: ListChecks },
  { to: '/coach', label: '教练', icon: MessageCircle },
  { to: '/team', label: '跑团', icon: Users },
  { to: '/profile', label: '我的', icon: User },
]

export default function TabBar() {
  return (
    <nav className="app-shell fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[460px] z-40 bg-card border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `tap flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors ${isActive ? 'text-primary' : 'text-muted'}`
            }
          >
            {({ isActive }) => (
              <>
                <t.icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                <span>{t.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
