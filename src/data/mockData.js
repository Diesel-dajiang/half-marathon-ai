// 初始 Mock 数据（模拟「已使用一段时间」的用户）。
// 真实环境由 WorkBuddy 云数据库集合提供，结构与此一一对应。
import { parseTime, parsePace, fmtDate } from '../lib/format.js'

const today = new Date()
const d = (offset) => {
  const x = new Date(today)
  x.setDate(x.getDate() + offset)
  return fmtDate(x)
}

// 比赛日期：约 3 个月后（演示用，可在引导页/我的页修改）
export const DEMO_RACE_DATE = (() => {
  const x = new Date(today)
  x.setMonth(x.getMonth() + 3)
  return fmtDate(x)
})()

export const mockUser = {
  id: 'u1',
  goalType: 'time', // finish(完赛就好) | time(冲击目标时间) | health(健康跑)
  targetTime: '2:00:00',
  targetPace: "5'41\"",
  raceDate: DEMO_RACE_DATE,
  current5K: '24:30',
  current10K: '52:00',
  longestRun: 12,
  avgPace: "6'30\"",
  weeklyMileage: 25,
  runDays: 4,
  injuries: [],
  createdAt: d(-14),
}

// 3 条跑步记录（日期相对今天，便于演示周复盘）
export const mockWorkouts = [
  { id: 'w1', userId: 'u1', date: d(-6), distance: 5.2, duration: Math.round(parsePace("6'30\"") * 5.2), pace: parsePace("6'30\""), avgHr: 145, cadence: 170, rpe: 3, pain: 0, notes: '晨跑，体感轻松', shoeId: 's1' },
  { id: 'w2', userId: 'u1', date: d(-4), distance: 8.0, duration: Math.round(parsePace("6'45\"") * 8.0), pace: parsePace("6'45\""), avgHr: 150, cadence: 168, rpe: 4, pain: 0, notes: '有氧基础跑', shoeId: 's1' },
  { id: 'w3', userId: 'u1', date: d(-1), distance: 6.5, duration: Math.round(parsePace("6'20\"") * 6.5), pace: parsePace("6'20\""), avgHr: 148, cadence: 172, rpe: 3, pain: 1, notes: '配速略快，小腿微酸', shoeId: 's1' },
]

// 今日红绿灯（🟡降强度）
export const mockDailyCheck = {
  id: 'dc1',
  userId: 'u1',
  date: d(0),
  status: 'yellow',
  reason: '恢复一般（睡眠 3/5、HRV 偏低），今天建议降强度，把强度课换成轻松跑。',
  sleep: 3,
  hrv: 3,
  pain: 1,
  loadRatio: 1.05,
}

// 完赛预测
export const mockPrediction = {
  id: 'p1',
  userId: 'u1',
  predictedTime: '2:08:30',
  targetTime: '2:00:00',
  gap: '+8:30',
  updatedAt: d(0),
}

// 教练信（已生成一封，第 2 周）
export const mockCoachLetter = {
  id: 'cl1',
  userId: 'u1',
  weekNumber: 2,
  content: `第 2 周小结
这周你基本把计划都跑下来了，执行力很到位，继续保持这种节奏。

亮点：本周最长一次 8.0km，说明耐力底盘在打牢。
不足：若 RPE 偏高，注意睡眠质量，恢复和训练一样重要。

本周重点：稳住轻松跑底盘，周二/周四的强度课别偷懒。
必须休息日：周日务必安排完全休息，给关节和韧带放假。

—— 你的 AI 教练`,
  createdAt: d(-1),
}

// 跑鞋
export const mockShoes = [
  { id: 's1', userId: 'u1', brand: 'Nike', model: 'Pegasus 40', purchaseDate: '2026-03-01', initialMileage: 0, currentMileage: 320 },
  { id: 's2', userId: 'u1', brand: 'ASICS', model: 'Novablast 4', purchaseDate: '2026-06-15', initialMileage: 0, currentMileage: 95 },
]

// 跑团
export const mockTeam = {
  id: 't1',
  name: '威海半马训练营',
  members: [
    { id: 'm1', name: '你', weeklyMileage: 25, predicted: '2:08:30', target: '2:00:00', avatar: '🏃' },
    { id: 'm2', name: '阿杰', weeklyMileage: 31, predicted: '1:52:10', target: '1:50:00', avatar: '🚀' },
    { id: 'm3', name: 'Lily', weeklyMileage: 22, predicted: '2:15:40', target: '2:10:00', avatar: '🌸' },
    { id: 'm4', name: '老王', weeklyMileage: 28, predicted: '2:03:20', target: '2:00:00', avatar: '🐯' },
    { id: 'm5', name: '小满', weeklyMileage: 18, predicted: '2:22:00', target: '2:15:00', avatar: '🌿' },
  ],
  challenges: [
    { id: 'c1', title: '本周计划完成度挑战', desc: '谁完成计划跑量比例最高', reward: '🏆 周冠军' },
    { id: 'c2', title: '长距离打卡', desc: '本周完成一次 12K+', reward: '💎 耐力徽章' },
  ],
}

// 设备连接状态（模拟）
export const mockDevices = [
  { id: 'garmin', name: 'Garmin', connected: true },
  { id: 'coros', name: 'COROS 高驰', connected: false },
  { id: 'huawei', name: '华为运动健康', connected: false },
]

// 快捷 AI 问题
export const QUICK_QUESTIONS = [
  '半马前一周怎么练',
  '跑步膝盖疼怎么办',
  '配速上不去什么原因',
  '怎么吃碳水加载',
  '晨跑还是夜跑好',
  '心率一直很高正常吗',
]
