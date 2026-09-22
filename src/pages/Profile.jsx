import React, { useState, useMemo, useRef } from 'react'
import JSZip from 'jszip'
import { useNavigate } from 'react-router-dom'
import {
  User, Settings, Watch, Plus, Footprints, Crown, ShieldAlert, FileText,
  Sparkles, Check, Link2, Link2Off, RotateCcw, ScanLine,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../store/AppContext.jsx'
import { fmtDate, fmtPace, parseTime } from '../lib/format.js'
import { healthExportUrl } from '../lib/sync.js'
import { Card, Sheet, Btn, SectionTitle, Bar } from '../components/ui.jsx'

const REPLACE_LOW = 500
const REPLACE_HIGH = 800

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
const DATE_KEYS = ['startDate', 'startdate', 'date', 'start', 'timestamp']
const DIST_KEYS = ['totalDistance', 'totaldistance', 'distance', 'distanceKm', 'distancekm']
const DUR_KEYS = ['duration', 'durationInSeconds', 'activeDuration', 'elapsedDuration']
const looksLikeWorkout = (o) =>
  isObj(o) &&
  DATE_KEYS.some((k) => k in o) &&
  (DIST_KEYS.some((k) => k in o) || DUR_KEYS.some((k) => k in o))

// 递归找出 JSON 里所有“像跑步记录”的数组（兼容任意嵌套结构）
const findWorkoutArrays = (value, depth = 0) => {
  if (value == null || depth > 8) return []
  if (Array.isArray(value)) {
    if (value.length && value.some(looksLikeWorkout)) return value.filter(isObj)
    return value.flatMap((v) => findWorkoutArrays(v, depth + 1))
  }
  if (isObj(value)) return Object.values(value).flatMap((v) => findWorkoutArrays(v, depth + 1))
  return []
}

// 极简 CSV 解析（支持引号内逗号/换行）
const parseCsv = (text) => {
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((s) => s !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some((s) => s !== '')) rows.push(row) }
  return rows
}

const csvToWorkouts = (text) => {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const headers = rows[0].map((h) => h.trim())
  const lower = headers.map((h) => h.toLowerCase())
  const hasDate = lower.some((h) => DATE_KEYS.some((k) => h === k.toLowerCase()))
  const hasData = lower.some((h) => [...DIST_KEYS, ...DUR_KEYS].some((k) => h === k.toLowerCase()))
  if (!hasDate || !hasData) return []
  return rows.slice(1).map((r) => {
    const o = {}
    headers.forEach((h, i) => { o[h] = r[i] })
    return o
  })
}

// 解析 Apple「健康」App 完整导出的 export.xml（<Workout> 节点）
// 用正则逐块扫描，避免 DOMParser 在大文件下崩；stats 用于诊断
const xmlTs = (s) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : NaN
}
const getAttr = (name, src) => {
  const r = new RegExp(name + '="([^"]*)"', 'i').exec(src)
  return r ? r[1] : ''
}
const xmlToWorkouts = (text, stats = {}) => {
  const out = []
  stats.workouts = 0
  stats.running = 0
  const blockRe = /<Workout\b([^>]*)>([\s\S]*?)<\/Workout>/gi
  let m
  while ((m = blockRe.exec(text))) {
    stats.workouts++
    const attrs = m[1]
    const inner = m[2]
    const type = getAttr('workoutActivityType', attrs)
    if (!/running/i.test(type)) continue
    stats.running++
    const startDate = getAttr('startDate', attrs)
    if (!startDate) continue
    const endDate = getAttr('endDate', attrs)
    let distM = parseFloat(getAttr('totalDistance', attrs)) // 旧格式：属性直出（米）
    let duration = parseFloat(getAttr('duration', attrs)) // 秒
    let avgHr = 0
    const statRe = /<WorkoutStatistics\b([^>]*)\/?>/gi
    let s
    while ((s = statRe.exec(inner))) {
      const sa = s[1]
      const t = getAttr('type', sa)
      if (/DistanceWalkingRunning/i.test(t)) {
        const v = parseFloat(getAttr('sum', sa))
        if (isFinite(v) && v > 0) distM = /km/i.test(getAttr('unit', sa) || 'm') ? v * 1000 : v
      } else if (/HeartRate/i.test(t)) {
        avgHr = parseFloat(getAttr('average', sa)) || 0
      }
    }
    if (!isFinite(duration) && xmlTs(startDate) && xmlTs(endDate)) duration = (xmlTs(endDate) - xmlTs(startDate)) / 1000
    if (!isFinite(distM) || distM <= 0) continue
    out.push({
      startDate,
      endDate,
      totalDistance: distM,
      distanceUnit: 'm',
      duration: isFinite(duration) ? duration : 0,
      avgHeartRate: avgHr,
    })
  }
  return out
}

export default function Profile() {
  const { state, dispatch, syncHealth } = useApp()
  const nav = useNavigate()
  const [shoeOpen, setShoeOpen] = useState(false)
  const [legalOpen, setLegalOpen] = useState(false)

  const user = state.user
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const fileRef = useRef(null)
  const [importMsg, setImportMsg] = useState('')
  const onImportFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setImportMsg('解析中…')
    try {
      let payload
      if (/\.zip$/i.test(f.name)) {
        const zip = await JSZip.loadAsync(f)
        const workouts = []
        const seen = []
        const xstats = {}
        for (const name of Object.keys(zip.files)) {
          const entry = zip.files[name]
          if (entry.dir) continue
          seen.push(name.split('/').pop())
          if (/\.json$/i.test(name)) {
            try {
              workouts.push(...findWorkoutArrays(JSON.parse(await entry.async('string'))))
            } catch { /* 跳过解析失败的文件 */ }
          } else if (/\.csv$/i.test(name)) {
            try { workouts.push(...csvToWorkouts(await entry.async('string'))) } catch { /* 同上 */ }
          } else if (/\.xml$/i.test(name)) {
            try { workouts.push(...xmlToWorkouts(await entry.async('string'), xstats)) } catch { /* 同上 */ }
          }
        }
        if (!workouts.length) {
          const list = seen.slice(0, 8).join('、') + (seen.length > 8 ? ` 等 ${seen.length} 个` : '')
          const diag = xstats.workouts ? `｜发现 <Workout> ${xstats.workouts} 个、跑步 ${xstats.running} 个` : ''
          throw new Error(`ZIP 内未识别出跑步数据（${list}${diag}）。把这个提示截图发我`)
        }
        payload = JSON.stringify(workouts)
      } else {
        payload = await f.text()
      }
      const res = await fetch('/api/health-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }).then((x) => x.json())
      if (res.ok) {
        setImportMsg(`已导入 ${res.added} 条（共 ${res.total} 条），正在刷新…`)
        await syncHealth()
      } else {
        setImportMsg('导入失败：' + (res.error || '格式不支持'))
      }
    } catch (err) {
      setImportMsg('导入失败：' + (err?.message || '文件无法解析'))
    } finally {
      e.target.value = ''
    }
  }
  const stravaOn = state.workouts.some((w) => w.source === 'strava')
  const [stravaMsg, setStravaMsg] = useState('')
  const connectStrava = async () => {
    try {
      const r = await fetch('/api/strava/auth-url').then((x) => x.json())
      if (!r.url) { setStravaMsg('后端未配置 STRAVA_CLIENT_ID / SECRET'); return }
      window.location.href = r.url // 跳转 Strava 授权，回调后跳回 /?strava=connected
    } catch {
      setStravaMsg('获取授权地址失败')
    }
  }
  // 比赛日推荐跑鞋：里程适中（已磨合但未过度）的一双
  const recommended = useMemo(() => {
    const ok = state.shoes.filter((s) => s.currentMileage >= 50 && s.currentMileage < REPLACE_HIGH)
    if (!ok.length) return state.shoes[0]
    return ok.reduce((a, b) => (Math.abs(a.currentMileage - 350) < Math.abs(b.currentMileage - 350) ? a : b))
  }, [state.shoes])

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <Card className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-3xl">🏃</div>
        <div className="flex-1">
          <div className="text-ink font-bold">半马跑者</div>
          <div className="text-xs text-muted">目标 {user.targetTime} · {user.weeklyMileage}km/周 · {user.runDays}天</div>
        </div>
        <button onClick={() => nav('/onboarding')} className="tap bg-card2 border border-line rounded-lg px-3 py-1.5 text-xs text-ink flex items-center gap-1">
          <Settings size={14} /> 编辑目标
        </button>
      </Card>

      {/* 手机扫码：扫码打开应用 / 配置接收地址 */}
      <Card>
        <SectionTitle icon={ScanLine}>手机扫码</SectionTitle>
        <div className="flex gap-3">
          <div className="bg-white rounded-lg p-2 flex items-center justify-center shrink-0">
            <QRCodeSVG value={appUrl || ' '} size={104} bgColor="#ffffff" fgColor="#0b1020" level="M" />
          </div>
          <div className="flex-1 text-xs text-muted space-y-1.5">
            <div className="text-ink font-medium">① 扫左码，手机直接打开本应用</div>
            <div>② 把下方地址填进「Health Auto Export → URL」，手表数据自动同步：</div>
            <div className="text-ink break-all bg-card2 rounded p-2 leading-relaxed">{healthExportUrl() || '—'}</div>
            <button onClick={() => navigator.clipboard?.writeText(healthExportUrl())}
              className="tap bg-card2 border border-line text-ink rounded-lg px-3 py-1.5">复制接收地址</button>
          </div>
        </div>
        <div className="text-[11px] text-muted mt-2">地址基于当前站点生成，沙箱换域名后此码会自动跟着变。</div>
      </Card>

      {/* 目标速览 */}
      <Card>
        <SectionTitle icon={Crown}>我的目标</SectionTitle>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Item k="目标类型" v={{ finish: '完赛就好', time: '冲击目标时间', health: '健康跑' }[user.goalType]} />
          <Item k="目标时间" v={user.targetTime} />
          <Item k="目标配速" v={user.targetPace ? `${user.targetPace}/km` : fmtPace(parseTime(user.targetTime) / 21.0975) + '/km'} />
          <Item k="比赛日期" v={user.raceDate || '默认12周'} />
          <Item k="每周可跑" v={`${user.runDays} 天`} />
          <Item k="当前周跑量" v={`${user.weeklyMileage} km`} />
        </div>
      </Card>

      {/* 设备连接 */}
      <Card>
        <SectionTitle icon={Watch}>设备连接</SectionTitle>
        <div className="space-y-2">
          {state.devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between bg-card2 rounded-lg p-2.5">
              <div className="flex items-center gap-2">
                {d.connected ? <Link2 size={16} className="text-green" /> : <Link2Off size={16} className="text-muted" />}
                <span className="text-sm text-ink">{d.name}</span>
              </div>
              <button onClick={() => dispatch({ type: 'SET_DEVICE', id: d.id, connected: !d.connected })}
                className={`tap px-3 py-1 rounded-lg text-xs font-medium ${d.connected ? 'bg-green/20 text-green' : 'bg-primary text-white'}`}>
                {d.connected ? '已连接' : '连接'}
              </button>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-muted mt-2">手表负责采数，我们做「AI 大脑与翻译层」。真实环境通过 WorkBuddy 云数据库同步。</div>
      </Card>

      {/* 跑步数据自动同步 */}
      <Card>
        <SectionTitle icon={Watch}>跑步数据 · 自动同步</SectionTitle>
        <div className="flex items-center justify-between bg-card2 rounded-lg p-2.5 mb-2">
          <div className="flex items-center gap-2">
            {state.healthStatus.connected
              ? <Link2 size={16} className="text-green" />
              : <Link2Off size={16} className="text-muted" />}
            <span className="text-sm text-ink">数据同步</span>
          </div>
          <span className={`text-xs font-medium ${state.healthStatus.connected ? 'text-green' : 'text-muted'}`}>
            {state.healthStatus.connected
              ? `已同步 ${state.healthStatus.count} 条`
              : '未连接（使用模拟数据）'}
          </span>
        </div>
        <div className="text-[11px] text-muted mb-3">
          {state.healthStatus.lastSync
            ? `最近同步：${state.healthStatus.lastSync}（${state.healthStatus.source === 'demo' ? '示例数据' : 'Apple 健康推送'}）`
            : '打开链接即自动获取跑步数据，无需任何配置。'}
        </div>
        <div className="flex gap-2">
          <button onClick={() => syncHealth()} className="tap flex-1 bg-primary text-white rounded-lg py-2 text-xs font-medium">立即重新同步</button>
          <button onClick={() => {
            navigator.clipboard?.writeText(healthExportUrl())
          }} className="tap flex-1 bg-card2 border border-line text-ink rounded-lg py-2 text-xs font-medium">复制接收地址</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json,.zip" className="hidden" onChange={onImportFile} />
        <button onClick={() => fileRef.current?.click()} className="tap w-full bg-card2 border border-line text-ink rounded-lg py-2 text-xs font-medium mt-2">📂 导入文件（Apple 健康 / HAE 导出的 ZIP、JSON）</button>
        {importMsg && <div className="text-[11px] text-green mt-2">{importMsg}</div>}

        {/* Strava 一键连接（获取真实跑步数据） */}
        <div className="mt-3 pt-3 border-t border-line">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-orange-400 font-semibold text-sm">Strava</span>
              {stravaOn && <span className="text-[10px] bg-green/20 text-green px-2 py-0.5 rounded-full">已连接</span>}
            </div>
          </div>
          <button onClick={connectStrava} className="tap w-full bg-orange-500 text-white rounded-lg py-2 text-xs font-medium font-semibold">
            {stravaOn ? '重新连接 Strava' : '🔗 连接 Strava 获取真实数据'}
          </button>
          {stravaMsg && <div className="text-[11px] text-yellow-400 mt-2">{stravaMsg}</div>}
          <div className="text-[11px] text-muted mt-2">
            点一下跳转到 Strava 授权，同意后自动拉取你最近的跑步记录（需后端配置 STRAVA_CLIENT_ID / SECRET，并在 Strava 应用设置里把回调地址填为接收地址）。
          </div>
        </div>

        <div className="text-[11px] text-muted mt-3">
          说明：网页无法直接读取 Apple HealthKit（仅原生 App 可访问）。默认打开即自动同步示例跑步数据；如需接入你手机的真实数据，可连接 Strava，或用「Health Auto Export」把健康数据推送到上方接收地址（高级用法）。
        </div>
      </Card>

      {/* 功能8：跑鞋追踪 */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <SectionTitle icon={Footprints}>我的跑鞋</SectionTitle>
          <button onClick={() => setShoeOpen(true)} className="tap bg-primary text-white rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1">
            <Plus size={14} /> 添加
          </button>
        </div>
        <div className="space-y-2">
          {state.shoes.map((s) => {
            const ratio = s.currentMileage / REPLACE_HIGH
            const needReplace = s.currentMileage >= REPLACE_LOW
            return (
              <div key={s.id} className="bg-card2 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-ink font-medium">{s.brand} {s.model}</div>
                  {s.id === recommended.id && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">比赛推荐 👟</span>}
                </div>
                <div className="text-[11px] text-muted mb-1">购入 {s.purchaseDate} · 已跑 {s.currentMileage} km</div>
                <Bar value={ratio} color={needReplace ? '#EF4444' : '#FF6B35'} height={6} />
                <div className="text-[11px] mt-1" style={{ color: needReplace ? '#EF4444' : '#9AA3B8' }}>
                  {needReplace ? `⚠️ 已超 ${REPLACE_LOW}km，建议更换新鞋` : `距建议更换 ${REPLACE_LOW}km 还差 ${REPLACE_LOW - s.currentMileage}km`}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* 订阅 */}
      <Card className="border border-primary/30 bg-primarydim">
        <div className="flex items-center gap-3">
          <Sparkles size={20} className="text-primary" />
          <div className="flex-1">
            <div className="text-ink font-semibold text-sm">升级 Pro · AI 深度教练</div>
            <div className="text-xs text-muted">每日个性化语音陪跑 · 无限问答 · 精准完赛预测</div>
          </div>
          <button className="tap bg-primary text-white text-xs px-3 py-1.5 rounded-lg font-medium">订阅</button>
        </div>
      </Card>

      {/* 隐私 / 免责 */}
      <button onClick={() => setLegalOpen(true)} className="tap w-full flex items-center gap-2 text-muted text-sm bg-card rounded-xl p-3">
        <FileText size={16} /> 隐私政策 · 免责声明
      </button>
      <button onClick={() => dispatch({ type: 'RESET' })} className="tap w-full flex items-center gap-2 text-muted text-sm bg-card rounded-xl p-3">
        <RotateCcw size={16} /> 恢复演示数据
      </button>

      <Sheet open={shoeOpen} onClose={() => setShoeOpen(false)} title="添加跑鞋">
        <AddShoe onClose={() => setShoeOpen(false)} user={state.user} shoes={state.shoes} onAdd={(s) => dispatch({ type: 'ADD_SHOE', payload: { id: 's' + Date.now(), userId: 'u1', ...s } })} />
      </Sheet>

      <Sheet open={legalOpen} onClose={() => setLegalOpen(false)} title="隐私政策 · 免责声明">
        <div className="text-xs text-muted leading-relaxed space-y-2">
          <p>本应用仅收集为提供训练建议所必需的数据（目标、跑步记录、恢复指标），均存储于本地 / 你的云空间，不会出售给第三方。</p>
          <p>所有 AI 建议（红绿灯、完赛预测、训练翻译、动态调整）均基于规则与数据估算，<span className="text-primary">不替代医生或专业教练诊断</span>。出现持续疼痛、胸闷、眩晕等症状请立即停止运动并就医。</p>
          <p>比赛策略与配速区间为通用算法输出，请结合自身感受调整。</p>
        </div>
      </Sheet>
    </div>
  )
}

function Item({ k, v }) {
  return (
    <div className="bg-card2 rounded-lg p-2.5">
      <div className="text-[11px] text-muted">{k}</div>
      <div className="text-ink font-medium mt-0.5">{v}</div>
    </div>
  )
}

function AddShoe({ onClose, onAdd }) {
  const [f, setF] = useState({ brand: '', model: '', purchaseDate: fmtDate(new Date()), initialMileage: 0, currentMileage: 0 })
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const submit = () => {
    if (!f.brand || !f.model) return
    onAdd({ ...f, initialMileage: Number(f.initialMileage), currentMileage: Number(f.currentMileage) || Number(f.initialMileage) })
    onClose()
  }
  return (
    <div className="space-y-3 animate-fadein">
      <Field label="品牌"><input value={f.brand} onChange={(e) => set('brand', e.target.value)} className="w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary" /></Field>
      <Field label="型号"><input value={f.model} onChange={(e) => set('model', e.target.value)} className="w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary" /></Field>
      <Field label="购入日期"><input type="date" value={f.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} className="w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary [color-scheme:dark]" /></Field>
      <Field label="初始里程 (km)"><input type="number" value={f.initialMileage} onChange={(e) => set('initialMileage', e.target.value)} className="w-full bg-card border border-line rounded-xl px-3 py-2.5 text-ink outline-none focus:border-primary" /></Field>
      <Btn onClick={submit}>添加跑鞋</Btn>
    </div>
  )
}

function Field({ label, children }) {
  return <div><div className="text-xs text-muted mb-1">{label}</div>{children}</div>
}
