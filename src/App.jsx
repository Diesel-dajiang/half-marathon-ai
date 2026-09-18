import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { useApp } from './store/AppContext.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Home from './pages/Home.jsx'
import Plan from './pages/Plan.jsx'
import Records from './pages/Records.jsx'
import Coach from './pages/Coach.jsx'
import Team from './pages/Team.jsx'
import Profile from './pages/Profile.jsx'

// Strava OAuth 回调后（/?strava=connected）自动触发同步并清理地址栏参数
function StravaReturnHandler() {
  const { syncHealth } = useApp()
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    const s = params.get('strava')
    if (s) {
      if (s === 'connected') syncHealth()
      params.delete('strava')
      setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

export default function App() {
  return (
    <>
      <StravaReturnHandler />
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/records" element={<Records />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="/team" element={<Team />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
