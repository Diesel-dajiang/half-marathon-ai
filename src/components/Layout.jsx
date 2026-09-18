import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import TabBar from './TabBar.jsx'

// 应用外壳：移动端容器 + 顶部安全区 + 底部 Tab + 路由切换淡入动画
export default function Layout() {
  const location = useLocation()
  return (
    <div className="app-shell min-h-screen flex flex-col">
      <main key={location.pathname} className="flex-1 pb-24 pt-[max(env(safe-area-inset-top),12px)] px-4 animate-fadein">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
