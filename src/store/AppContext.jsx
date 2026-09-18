import React, { createContext, useContext, useReducer, useEffect, useMemo } from 'react'
import {
  mockUser, mockWorkouts, mockDailyCheck, mockPrediction, mockCoachLetter,
  mockShoes, mockTeam, mockDevices,
} from '../data/mockData.js'
import { generatePlan } from '../lib/rules.js'
import { fmtDate } from '../lib/format.js'
import { fetchHealthWorkouts, fetchHealthStatus, fetchDemoWorkouts, mergeWorkouts } from '../lib/sync.js'

const STORAGE_KEY = 'hm_coach_v1'

// 赛前 14 天倒计时清单（按 dayOffset 倒推）
function buildRaceChecklist(raceDate) {
  if (!raceDate) return []
  const base = [
    { dayOffset: 14, task: '最后一次长距离（LSD），模拟比赛配速后半程' },
    { dayOffset: 10, task: '开始减量，跑量降到峰值 60%，保持轻松跑' },
    { dayOffset: 7, task: '最后一次节奏跑（Tempo），找比赛配速感觉' },
    { dayOffset: 3, task: '碳水加载启动，减少高纤维油腻，多吃碳水' },
    { dayOffset: 2, task: '完全休息，检查比赛装备（号码布/心率带/跑鞋）' },
    { dayOffset: 1, task: '轻松慢跑 3~5K 激活，早睡，准备早餐' },
    { dayOffset: 0, task: '比赛日：早餐+热身+配速策略，按 AI 陪跑执行' },
  ]
  return base.map((b) => ({ id: `rc${b.dayOffset}`, userId: 'u1', raceDate, dayOffset: b.dayOffset, task: b.task, completed: false }))
}

function currentWeekOf(user) {
  if (!user?.createdAt || !user?.raceDate) return 2
  const start = new Date(user.createdAt + 'T00:00:00')
  const end = new Date(user.raceDate + 'T00:00:00')
  const totalDays = Math.max(1, (end - start) / 86400000)
  const elapsed = Math.max(0, (Date.now() - start.getTime()) / 86400000)
  const weekLen = totalDays / 12
  return Math.min(12, Math.max(1, Math.floor(elapsed / weekLen) + 1))
}

const initialState = {
  onboarded: true,
  user: mockUser,
  workouts: mockWorkouts,
  plan: generatePlan(mockUser),
  dailyCheck: mockDailyCheck,
  prediction: mockPrediction,
  coachLetter: mockCoachLetter,
  shoes: mockShoes,
  team: mockTeam,
  devices: mockDevices,
  healthStatus: { connected: false, lastSync: null, count: 0 },
  chat: [
    { id: 'c0', role: 'assistant', content: '嗨，我是你的半马 AI 教练 🏃 任何训练、伤痛、配速问题都可以问我。', createdAt: fmtDate(new Date()) },
  ],
  raceChecklist: buildRaceChecklist(mockUser.raceDate),
  preview: null, // null | 'race' | 'taper'  临时演示模式
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER': {
      const user = { ...state.user, ...action.payload, id: 'u1' }
      return {
        ...state,
        onboarded: true,
        user,
        plan: generatePlan(user),
        raceChecklist: buildRaceChecklist(user.raceDate),
        prediction: { ...state.prediction, targetTime: user.targetTime },
      }
    }
    case 'ADD_WORKOUT': {
      const w = action.payload
      // 自动累计跑鞋里程
      let shoes = state.shoes
      if (w.shoeId) {
        shoes = state.shoes.map((s) => (s.id === w.shoeId ? { ...s, currentMileage: s.currentMileage + (w.distance || 0) } : s))
      }
      return { ...state, workouts: [w, ...state.workouts], shoes }
    }
    case 'SET_DAILY_CHECK':
      return { ...state, dailyCheck: action.payload }
    case 'SET_PREDICTION':
      return { ...state, prediction: action.payload }
    case 'SET_COACH_LETTER':
      return { ...state, coachLetter: action.payload }
    case 'ADD_SHOE':
      return { ...state, shoes: [...state.shoes, action.payload] }
    case 'UPDATE_SHOE':
      return { ...state, shoes: state.shoes.map((s) => (s.id === action.payload.id ? { ...s, ...action.payload } : s)) }
    case 'SET_TEAM':
      return { ...state, team: action.payload }
    case 'ADD_CHAT':
      return { ...state, chat: [...state.chat, action.payload] }
    case 'TOGGLE_CHECKLIST':
      return {
        ...state,
        raceChecklist: state.raceChecklist.map((c) => (c.id === action.id ? { ...c, completed: !c.completed } : c)),
      }
    case 'SET_DEVICE':
      return { ...state, devices: state.devices.map((dv) => (dv.id === action.id ? { ...dv, connected: action.connected } : dv)) }
    case 'MERGE_WORKOUTS': {
      const workouts = mergeWorkouts(state.workouts, action.workouts)
      // 同步累计跑鞋里程（仅对带 shoeId 的本地记录，健康记录无 shoeId 不累计）
      return { ...state, workouts }
    }
    case 'SET_HEALTH_STATUS':
      return { ...state, healthStatus: action.status }
    case 'SET_PREVIEW':
      return { ...state, preview: action.mode }
    case 'RESET':
      return { ...initialState, plan: generatePlan(initialState.user), raceChecklist: buildRaceChecklist(initialState.user.raceDate) }
    default:
      return state
  }
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // 用保存的 user 重新生成 plan，避免结构漂移
        return { ...init, ...parsed, plan: generatePlan(parsed.user || init.user) }
      }
    } catch (e) {
      /* ignore */
    }
    return init
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      /* ignore */
    }
  }, [state])

  // 启动即自动获取跑步数据：优先用 Apple 健康推送（/api/workouts），
  // 若暂无真实推送则自动拉取示例数据，确保「打开链接即有数据」。无后端时静默降级为 mock。
  const syncHealth = async () => {
    const r = await fetchHealthWorkouts()
    if (r.ok && r.workouts.length) {
      dispatch({ type: 'MERGE_WORKOUTS', workouts: r.workouts })
      dispatch({ type: 'SET_HEALTH_STATUS', status: { connected: true, source: 'apple', lastSync: fmtDate(new Date()), count: r.workouts.length } })
      return
    }
    const d = await fetchDemoWorkouts()
    if (d.ok && d.workouts.length) {
      dispatch({ type: 'MERGE_WORKOUTS', workouts: d.workouts })
      dispatch({ type: 'SET_HEALTH_STATUS', status: { connected: true, source: 'demo', lastSync: fmtDate(new Date()), count: d.workouts.length } })
      return
    }
    const st = await fetchHealthStatus()
    dispatch({
      type: 'SET_HEALTH_STATUS',
      status: st.ok
        ? { connected: true, source: 'apple', lastSync: st.lastSync, count: st.count }
        : { connected: false, source: 'none', lastSync: null, count: 0 },
    })
  }

  useEffect(() => {
    syncHealth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({ state, dispatch, currentWeek: currentWeekOf(state.user), syncHealth }),
    [state]
  )
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
