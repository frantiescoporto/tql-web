import { useData } from '../context/DataContext.jsx'
import React, { useState, useEffect, useRef } from 'react'
import PlatformBadge from '../components/PlatformBadge'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { buildAdjOps, calcMetrics, calcMonteCarlo, calcRecoveryStats, fmtR, fmtPct, fmtNum } from '../lib/analytics'
import {
  buildPortfolioTimeline, calcPortfolioMetrics,
  buildCorrelationMatrix, buildScatterData, buildDailyPnl
} from '../lib/portfolio'
import { Chart, registerables } from 'chart.js'
import { calcStagnation } from '../lib/stagnation'
import { corrToColor, corrToTextColor, makeStagnationPlugin } from '../lib/chartBuilder'
import AIRecommendations from '../components/AIRecommendations'
import { exportPortfolioPDF } from '../lib/pdfExport'
import GoalsLimitsTab from '../components/GoalsLimitsTab'
import DiarioTab from '../components/DiarioTab'
import GestorPage from './GestorPage'
import AvaliacaoTab from '../components/AvaliacaoTab'
import CalendarioMensal from '../components/CalendarioMensal'
Chart.register(...registerables)

export default function PortfolioPage({  autoConfig, autoName, readOnly }) {
  const { robots, portfolios, getRobot, getPortfolio } = useData()
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  // Config vinda do modal "Novo portfólio" via navigate state
  const portConfig = location.state || null
  const initCapital = portConfig?.capital || 100000
  const initMode    = portConfig?.mode || 'manual'  // 'auto' | 'manual'
  const [allRobots, setAllRobots] = useState([])
  const [selected, setSelected] = useState(autoConfig || [])
  const [robotData, setRobotData] = useState({})
  const [portfolioName, setPortfolioName] = useState(autoName || 'Novo Portfólio')
  const [timeline, setTimeline] = useState([])
  const [metrics, setMetrics] = useState({})
  const [tab, setTab] = useState('composicao')
  const [saving, setSaving] = useState(false)
  const [portfolioMC, setPortfolioMC] = useState(null)
  const [showAutoAlloc, setShowAutoAlloc] = useState(false)
  const [robotListFilter, setRobotListFilter] = useState('all')
  const [robotPlatformFilter, setRobotPlatformFilter] = useState('all')
  const [robotAtivoFilter, setRobotAtivoFilter] = useState('all') // 'all' | 'APROVADO' | 'APROVADO_CAUTELA' | 'APROVADO_SIMULADOR' | 'REPROVADO' | null
  const [allocCapital, setAllocCapital] = useState(initCapital)
  const [allocCapitalStr, setAllocCapitalStr] = useState(initCapital.toLocaleString('pt-BR',{maximumFractionDigits:0}))
  const [allocMaxRisk, setAllocMaxRisk] = useState(portConfig?.maxRisk || 30)
  const [allocMultiplier, setAllocMultiplier] = useState(portConfig?.multiplier || 3)
  const [allocObjective, setAllocObjective] = useState('sharpe')
  const [allocMinUsage, setAllocMinUsage] = useState(portConfig?.minUsage || 80)
  const [allocResult, setAllocResult] = useState(null)
  // Limites de risco por status da estratégia
  const [allocStatusLimits, setAllocStatusLimits] = useState({
    APROVADO: 35,           // % máx de risco para estratégias aprovadas
    APROVADO_CAUTELA: 25,   // % máx de risco para aprovadas com cautela
    APROVADO_SIMULADOR: 15, // % máx de risco para simulador
    OTHER: 0,               // Reprovadas e sem status: 0 (excluídas)
  })
  const [useStatusLimits, setUseStatusLimits] = useState(false) // toggle on/off
  // Modo do portfólio: 'auto' (auto-alocação) | 'manual'
  const [portMode] = useState(initMode)
  const [corrMatrix, setCorrMatrix] = useState(null)
  const [scatterPair, setScatterPair] = useState(null)
  const [multiplier, setMultiplier] = useState(3)
  const [targetMonthly, setTargetMonthly] = useState('')
  const [thresholdX, setThresholdX] = useState(500)
  const [ddRecoveryThresh, setDdRecoveryThresh] = useState(10)  // % p/ DDs recuperados
  const charts = useRef({})

  useEffect(() => {
    if (!robots.length) return   // aguarda dados chegarem do DataContext
    loadRobots()
    if (autoConfig?.length) {
      autoConfig.forEach(s => loadRobotData(s.robotId))
    }
  }, [robots])   // roda sempre que robots mudar (inclusive quando chegar do fetch)

  useEffect(() => {
    if (!robots.length || !id || id === 'new') return
    loadPortfolio(id)
  }, [robots, id])

  useEffect(() => {
    if (!selected.length) { setTimeline([]); setMetrics({}); return }
    const entries = buildEntries()
    if (!entries.length) return
    const tl = buildPortfolioTimeline(entries)
    setTimeline(tl)
    setMetrics(calcPortfolioMetrics(tl, multiplier))
    setCorrMatrix(buildCorrelationMatrix(entries))
    if (entries.length >= 2) setScatterPair([entries[0].robot.id, entries[1].robot.id])
  }, [selected, robotData, multiplier])

  const [robotStatuses, setRobotStatuses] = useState({})
  const [robotMetrics, setRobotMetrics] = useState({})

  const loadRobots = async () => {
    const list = robots
    setAllRobots(list || [])
    const statuses = {}, metrics = {}
    const { getValidationStatus, calcRecoveredDD } = await import('../lib/analytics.js')
    for (const r of (list || [])) {
      try {
        const full = getRobot(r.id)
        if (full?.operations?.length) {
          const adjOps = buildAdjOps(full.operations, full.desagio || 0, full.tipo || 'backtest')
          const m = calcMetrics(adjOps)
          const { recoveredMaxDD } = calcRecoveredDD(adjOps)
          metrics[r.id] = { m6015: m.m6015, recoveredMaxDD }
          if (full.periods) statuses[r.id] = getValidationStatus(m, full.periods)
        }
      } catch(e) {}
    }
    setRobotStatuses(statuses)
    setRobotMetrics(metrics)
  }

  const loadPortfolio = async (pid) => {
    const p = getPortfolio(parseInt(pid))
    if (!p) return
    setPortfolioName(p.name)
    const config = typeof p.robots_config === 'string' ? JSON.parse(p.robots_config) : p.robots_config
    const mult = config.multiplier || 3
    const target = config.targetMonthly || ''
    setMultiplier(mult)
    setTargetMonthly(target)
    const robots = config.robots || config
    setSelected(Array.isArray(robots) ? robots : [])
    for (const { robotId } of (Array.isArray(robots) ? robots : [])) {
      await loadRobotData(robotId)
    }
  }

  const loadRobotData = async (robotId) => {
    // Se já está em cache E já tem avgMonthlyReal calculado, não recarrega
    if (robotData[robotId] && 'avgMonthlyReal' in robotData[robotId]) return
    const r = getRobot(robotId)
    if (!r) return
    const adjOps = buildAdjOps(r.operations, r.desagio || 0, r.tipo || 'backtest')
    // Calcular média mensal conta real
    let avgMonthlyReal = null
    if (r.realOps?.length) {
      const realMonthly = {}
      r.realOps.forEach(o => {
        const pts = (o.abertura||'').split(' ')[0].split('/')
        if (pts.length === 3) {
          const k = `${pts[2]}-${pts[1]}`
          realMonthly[k] = (realMonthly[k]||0) + (o.res_op||0)
        }
      })
      const vals = Object.values(realMonthly)
      if (vals.length) avgMonthlyReal = vals.reduce((a,b)=>a+b,0)/vals.length
    }
    setRobotData(prev => ({ ...prev, [robotId]: { robot: r, adjOps, avgMonthlyReal, nRealOps: r.realOps?.length || 0 } }))
  }

  const getPaperMonths = (periods) => {
    if (!periods) return 0
    const start = periods.paper_start
    const end = periods.paper_end
    if (!start || !end) return 0
    const d1 = new Date(start), d2 = new Date(end)
    return Math.max(0, (d2 - d1) / (1000 * 60 * 60 * 24 * 30.44))
  }

  const autoAllocate = async () => {
    if (!allocCapital || !allocMaxRisk || !selected.length) return
    const { calcRecoveredDD, calcMetrics } = await import('../lib/analytics.js')

    // ── Step 1: compute each robot's DD base (1 lot) ─────────────────
    const robots = []
    for (const s of selected) {
      const rd = robotData[s.robotId]
      if (!rd) continue
      const { recoveredMaxDD } = calcRecoveredDD(rd.adjOps)
      const ddBase = Math.abs(recoveredMaxDD) || Math.abs(rd.m?.maxDD) || 1
      robots.push({ robotId: s.robotId, ddBase, adjOps: rd.adjOps, name: rd.robot?.name || s.robotId })
    }
    if (!robots.length) return

    // ── Step 3: find max lots each robot can have ─────────────────────
    // When useStatusLimits=true, each robot's risk limit depends on its status
    const capital = allocCapital
    const robotLimits = robots.map(r => {
      let riskPct = allocMaxRisk  // default: slider global
      if (useStatusLimits) {
        const st = robotStatuses[r.robotId]
        if (st === 'APROVADO') riskPct = allocStatusLimits.APROVADO
        else if (st === 'APROVADO_CAUTELA') riskPct = allocStatusLimits.APROVADO_CAUTELA
        else if (st === 'APROVADO_SIMULADOR') riskPct = allocStatusLimits.APROVADO_SIMULADOR
        else riskPct = allocStatusLimits.OTHER  // reprovado / sem status = 0
      }
      const maxDDforRobot = (capital / allocMultiplier) * (riskPct / 100)
      return {
        ...r,
        maxLots: Math.floor(maxDDforRobot / r.ddBase),
        riskPct,
      }
    })
    const maxDDperRobot = (capital / allocMultiplier) * (allocMaxRisk / 100)

    // ── Step 4: separate violators (maxLots === 0) from usable robots ──
    // Violators get lots=0 automatically — we continue with the rest.
    // Only block if ALL robots violate.
    const violators = robotLimits.filter(r => r.maxLots === 0)
    const usable = robotLimits.filter(r => r.maxLots > 0)

    if (usable.length === 0) {
      // Truly impossible — every robot exceeds the limit
      const byDD = [...violators].sort((a,b) => b.ddBase - a.ddBase)
      setAllocResult({
        ok: false,
        violators: violators.map(r => ({
          name: r.name,
          ddBase: r.ddBase,
          capitalNeeded: r.ddBase * allocMultiplier,
        })),
        suggestions: byDD.slice(0, 3).map(r => r.name),
        maxDDperRobot,
        capital,
      })
      return
    }

    // ── Step 5: optimize per chosen objective + min usage floor ───────────
    // Two pre-computed series:
    //  A) Daily PnL series per robot (used for Sharpe — daily is industry std)
    //  B) Op-by-op timeline sorted by full timestamp (used for capital used,
    //     to match calcPortfolioMetrics granularity exactly — otherwise the
    //     auto-allocator and the displayed metrics.capital disagree)
    const parseDT = (s) => {
      if (!s) return 0
      const [datePart, timePart = '00:00:00'] = s.split(' ')
      const [d, m, y] = datePart.split('/')
      return new Date(`${y}-${m}-${d}T${timePart}`).getTime()
    }

    // ── A) Daily PnL per robot (for Sharpe) ────────────────────────────
    const allDates = new Set()
    const robotDailyByLot = {}
    for (const r of robots) {
      const daily = {}
      for (const op of r.adjOps) {
        const date = (op.abertura || '').split(' ')[0]
        if (!date) continue
        daily[date] = (daily[date] || 0) + op.resAdj
        allDates.add(date)
      }
      robotDailyByLot[r.robotId] = daily
    }
    const dateAxis = Array.from(allDates).sort((a, b) => {
      const [da, ma, ya] = a.split('/').map(Number)
      const [db, mb, yb] = b.split('/').map(Number)
      return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db)
    })
    const robotDailyArr = {}
    for (const r of robots) {
      const daily = robotDailyByLot[r.robotId]
      robotDailyArr[r.robotId] = dateAxis.map(d => daily[d] || 0)
    }

    // ── B) Op-by-op merged timeline (for capital used calc) ────────────
    // Each entry: { robotId, resAdj, ts }. Sorted by timestamp.
    const opsTimeline = []
    for (const r of robots) {
      for (const op of r.adjOps) {
        opsTimeline.push({ robotId: r.robotId, resAdj: op.resAdj, ts: parseDT(op.abertura) })
      }
    }
    opsTimeline.sort((a, b) => a.ts - b.ts)
    const N_OPS = opsTimeline.length

    // ── Real consolidated capital (op-by-op, matches calcPortfolioMetrics) ──
    // For each candidate lotMap: walk the op timeline weighting each op's
    // resAdj by its robot's lots, build the equity curve, find max DD.
    // O(N_ops) per call but pre-sorted, so each iteration is cheap.
    const totalCapUsed = (lotMap) => {
      if (N_OPS === 0) return 0
      let acc = 0, peak = 0, maxDD = 0
      for (let i = 0; i < N_OPS; i++) {
        const op = opsTimeline[i]
        const lots = lotMap[op.robotId] || 0
        if (lots <= 0) continue
        acc += op.resAdj * lots
        if (acc > peak) peak = acc
        const dd = peak - acc
        if (dd > maxDD) maxDD = dd
      }
      return maxDD * allocMultiplier
    }

    // ── Score functions for each objective ────────────────────────────
    // Sharpe still uses daily PnL (D values) — industry standard.
    const buildCombined = (lotMap) => {
      const D = dateAxis.length
      const combined = new Array(D).fill(0)
      for (const r of robots) {
        const lots = lotMap[r.robotId] || 0
        if (lots <= 0) continue
        const arr = robotDailyArr[r.robotId]
        for (let i = 0; i < D; i++) combined[i] += arr[i] * lots
      }
      return combined
    }
    const sharpeOf = (combined) => {
      const D = combined.length
      if (D === 0) return -Infinity
      let sum = 0
      for (let i = 0; i < D; i++) sum += combined[i]
      const mean = sum / D
      let varSum = 0
      for (let i = 0; i < D; i++) { const d = combined[i] - mean; varSum += d * d }
      const std = Math.sqrt(varSum / D)
      if (std === 0) return mean > 0 ? Infinity : (mean < 0 ? -Infinity : 0)
      return (mean / std) * Math.sqrt(252)
    }
    const totalOf = (combined) => combined.reduce((a, b) => a + b, 0)

    // buildScore returns the value of the chosen objective.
    const buildScore = (lotMap) => {
      const combined = buildCombined(lotMap)
      if (allocObjective === 'sharpe') return sharpeOf(combined)
      if (allocObjective === 'rentTotal') return totalOf(combined)
      // rentPct
      const total = totalOf(combined)
      const cap = totalCapUsed(lotMap)
      return cap > 0 ? (total / cap) : -Infinity
    }

    // Total return for result display (always in R$)
    const buildReturn = (lotMap) => totalOf(buildCombined(lotMap))

    // ── Capital window ────────────────────────────────────────────────
    const maxCap = capital
    const minCap = capital * (allocMinUsage / 100)

    // Start: 1 lot for each USABLE robot, 0 for violators
    const currentLots = {}
    robots.forEach(r => { currentLots[r.robotId] = 0 })
    usable.forEach(r => { currentLots[r.robotId] = 1 })

    // ── Phase 1: greedy hill climb maximizing the chosen objective ────
    // Add the lot that improves the objective most, while staying ≤ maxCap.
    let phase1Lots = 0
    let improved = true
    while (improved) {
      improved = false
      let bestScore = -Infinity
      let bestRobotId = null
      for (const r of usable) {
        if (currentLots[r.robotId] >= r.maxLots) continue
        const trial = { ...currentLots, [r.robotId]: currentLots[r.robotId] + 1 }
        if (totalCapUsed(trial) > maxCap) continue
        const s = buildScore(trial)
        if (s > bestScore) { bestScore = s; bestRobotId = r.robotId }
      }
      if (bestRobotId) {
        currentLots[bestRobotId]++
        improved = true
        phase1Lots++
      }
    }

    // ── Phase 2: if still below min usage, force lots to reach floor ──
    // Accept any lot addition (even if it worsens the objective) that
    // brings capital usage closer to minCap, while staying within
    // per-robot risk limits and ≤ maxCap.
    let phase2Lots = 0
    if (totalCapUsed(currentLots) < minCap) {
      let pushing = true
      while (pushing) {
        pushing = false
        if (totalCapUsed(currentLots) >= minCap) break
        // Pick the lot addition that minimizes objective loss while
        // moving capital closer to minCap (and never exceeds maxCap).
        let bestRobotId = null
        let bestScore = -Infinity
        for (const r of usable) {
          if (currentLots[r.robotId] >= r.maxLots) continue
          const trial = { ...currentLots, [r.robotId]: currentLots[r.robotId] + 1 }
          const trialCap = totalCapUsed(trial)
          if (trialCap > maxCap) continue
          // Prefer the lot that gives best objective (least bad)
          const s = buildScore(trial)
          if (s > bestScore) { bestScore = s; bestRobotId = r.robotId }
        }
        if (bestRobotId) {
          currentLots[bestRobotId]++
          pushing = true
          phase2Lots++
        }
      }
    }

    // ── Diagnose stopping reason ──────────────────────────────────────
    const robotsAtMaxLots = usable.filter(r => currentLots[r.robotId] >= r.maxLots).length
    const robotsBelowMaxLots = usable.length - robotsAtMaxLots
    let stopReason = null
    if (totalCapUsed(currentLots) < minCap) {
      // Check if remaining headroom would fit any more lots
      const anyFits = usable.some(r => {
        if (currentLots[r.robotId] >= r.maxLots) return false
        const trial = { ...currentLots, [r.robotId]: currentLots[r.robotId] + 1 }
        return totalCapUsed(trial) <= maxCap
      })
      if (!anyFits) {
        stopReason = robotsBelowMaxLots === 0
          ? 'maxLots'   // all usable robots hit per-robot risk limit
          : 'maxCap'    // capital ceiling reached even though robots have room
      }
    }

    // ── Step 6: apply lots ───────────────────────────────────────────
    setMultiplier(allocMultiplier)
    const newSelected = selected.map(s => ({
      ...s,
      lots: currentLots[s.robotId] ?? 0,
    }))
    setSelected(newSelected)
    const finalCapUsed = totalCapUsed(currentLots)
    const finalReturn = buildReturn(currentLots)
    const finalScore = buildScore(currentLots)
    const reachedMin = finalCapUsed >= minCap
    setAllocResult({
      ok: true,
      objective: allocObjective,
      objectiveValue: finalScore,
      rentTotal: finalReturn.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}),
      capitalUsed: finalCapUsed.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}),
      capitalPct: capital > 0 ? ((finalCapUsed/capital)*100).toFixed(1) : '—',
      capitalUsedRaw: finalCapUsed,
      capitalTarget: capital,
      minUsagePct: allocMinUsage,
      reachedMin,
      phase1Lots,
      phase2Lots,
      robotsAtMaxLots,
      totalUsable: usable.length,
      stopReason,    // 'maxLots' | 'maxCap' | null
      zeroed: violators.map(r => r.name),
    })
    // Note: panel stays open so user can see the result/diagnostic.
    // User closes via Cancelar button or by toggling the ⚡ Auto-alocar button.
    newSelected.filter(s => s.lots > 0).forEach(s => loadRobotData(s.robotId))
  }

  const buildEntries = () =>
    selected.filter(s => robotData[s.robotId]).map(s => ({
      robot: robotData[s.robotId].robot,
      lots: s.lots || 1,
      adjOps: robotData[s.robotId].adjOps,
      periods: robotData[s.robotId].robot.periods || {},
    }))

  const addRobot = async (robotId) => {
    if (selected.find(s => s.robotId === robotId)) return
    setSelected(prev => [...prev, { robotId, lots: 1 }])
    await loadRobotData(robotId)
  }

  const removeRobot = (robotId) => setSelected(prev => prev.filter(s => s.robotId !== robotId))
  const setLots = (robotId, lots) =>
    setSelected(prev => prev.map(s => s.robotId === robotId ? { ...s, lots: Math.max(0, parseInt(lots) || 0) } : s))

  const handleSave = async () => {
    // Web: read-only, sem salvar
  }

  // ── Charts ──────────────────────────────────────────────────────────────────
  const destroyChart = (key) => {
    if (charts.current[key]) { try { charts.current[key].destroy() } catch(e) {} delete charts.current[key] }
    const el = document.getElementById('pc-' + key)
    if (!el) return
    try { const ex = Chart.getChart(el); if (ex) ex.destroy() } catch(e) {}
    try { const ctx = el.getContext('2d'); if (ctx) ctx.clearRect(0, 0, el.width, el.height) } catch(e) {}
  }
  const destroyAll = () => {
    ['equity','equity-dd','dd','monthly','scatter','ranking'].forEach(k => destroyChart(k))
  }

  const getC = () => {
    const d = window.matchMedia('(prefers-color-scheme: dark)').matches
    return {
      pos: d?'#4ade80':'#16a34a', neg: d?'#f87171':'#dc2626',
      blue: d?'#60a5fa':'#2563eb', purple: d?'#a78bfa':'#7c3aed',
      amber: d?'#fbbf24':'#d97706',
      grid: d?'rgba(255,255,255,.07)':'rgba(0,0,0,.06)',
      text: d?'#9ca3af':'#6b7280',
    }
  }

  // Monte Carlo for portfolio
  useEffect(() => {
    if (!timeline.length || !metrics?.capital) return
    const mc = calcMonteCarlo(
      timeline.map(o => ({ resAdj: o.resWeighted })),
      metrics.capital, 1000, 0.50
    )
    setPortfolioMC(mc)
  }, [timeline])

  useEffect(() => {
    if (tab !== 'analise' || !timeline.length) return
    destroyChart('equity'); destroyChart('dd'); destroyChart('monthly')
    const t = setTimeout(() => { renderEquity(); renderDD(); renderMonthly() }, 60)
    return () => clearTimeout(t)
  }, [tab, timeline, metrics])

  useEffect(() => {
    if (tab !== 'correlacao' || !corrMatrix) return
    destroyChart('scatter')
    const t = setTimeout(() => renderScatter(), 60)
    return () => clearTimeout(t)
  }, [tab, corrMatrix, scatterPair])

  useEffect(() => {
    if (tab !== 'avancado' || !timeline.length) return
    destroyChart('adv-equity')
    const t = setTimeout(() => renderAdvancedEquity(), 60)
    return () => clearTimeout(t)
  }, [tab, timeline, metrics, ddRecoveryThresh])

  useEffect(() => {
    if (tab !== 'ranking') return
    destroyChart('ranking')
    const t = setTimeout(() => renderRanking(), 60)
    return () => clearTimeout(t)
  }, [tab, robotData, selected])

  const renderAdvancedEquity = () => {
    const el = document.getElementById('adv-equity-canvas'); if (!el) return
    const c = getC()
    const labels = timeline.map(o => o.abertura.slice(0,10))
    const equityData = timeline.map(o => +o.portfolioTotal.toFixed(2))
    const stag = calcStagnation(timeline.map(o => ({...o, resAdj: o.resWeighted, abertura: o.abertura})))

    // Só mostrar períodos com perda ≥ ddRecoveryThresh% do capital
    // (mesma lógica do card "DDs recuperados" — gráfico e card ficam sincronizados)
    const cap = metrics.capital || 1
    const minLoss = (ddRecoveryThresh / 100) * cap
    const significant = stag.periods.filter(p => (p.loss || 0) >= minLoss)

    const stagPlugin = makeStagnationPlugin(significant, labels, true)

    charts.current['adv-equity'] = new Chart(el, {
      type: 'line',
      plugins: [stagPlugin],
      data: { labels, datasets: [{
        data: equityData,
        borderColor: '#22c55e',
        borderWidth: 1.5,
        pointRadius: 0,
        fill: true,
        tension: 0.3,
        backgroundColor: (ctx) => {
          if (!ctx.chart.chartArea) return 'rgba(34,197,94,0.1)'
          const g = ctx.chart.ctx.createLinearGradient(0, ctx.chart.chartArea.top, 0, ctx.chart.chartArea.bottom)
          g.addColorStop(0, 'rgba(34,197,94,0.35)')
          g.addColorStop(0.6, 'rgba(34,197,94,0.08)')
          g.addColorStop(1, 'rgba(34,197,94,0.01)')
          return g
        },
      }]},
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxTicksLimit: 8, color: c.text }, grid: { color: c.grid } },
          y: { ticks: { color: c.text, callback: v => 'R$ ' + v.toLocaleString('pt-BR') }, grid: { color: c.grid } },
        },
      },
    })
  }

  useEffect(() => () => destroyAll(), [])

  const renderEquity = () => {
    const el = document.getElementById('pc-equity'); if (!el) return
    const elDD = document.getElementById('pc-equity-dd')
    const c = getC()
    const labels = timeline.map(o => o.abertura.slice(0,10))
    const equityData = timeline.map(o => +o.portfolioTotal.toFixed(2))
    const stag = calcStagnation(timeline.map(o => ({...o, resAdj: o.resWeighted, abertura: o.abertura})))
    const stagPlugin = makeStagnationPlugin(stag.periods, labels)
    // logoPlugin removed
    charts.current['equity'] = new Chart(el, {
      type: 'line', plugins: [stagPlugin, {
        id: 'peakMarkerP',
        afterDraw(chart) {
          const ds = chart.data.datasets[0]; if (!ds) return
          const data = ds.data
          const maxVal = Math.max(...data)
          const maxIdx = data.indexOf(maxVal)
          if (maxIdx < 0) return
          const { ctx, chartArea, scales: { x, y } } = chart
          const px = x.getPixelForValue(maxIdx)
          const py = y.getPixelForValue(maxVal)
          ctx.save()
          ctx.setLineDash([4,3]); ctx.strokeStyle='rgba(34,197,94,0.5)'; ctx.lineWidth=1
          ctx.beginPath(); ctx.moveTo(px,chartArea.top); ctx.lineTo(px,py); ctx.stroke()
          ctx.setLineDash([])
          ctx.beginPath(); ctx.arc(px,py,6,0,Math.PI*2); ctx.fillStyle='#22c55e'; ctx.fill()
          ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke()
          const valLabel = 'R$ '+maxVal.toLocaleString('pt-BR',{maximumFractionDigits:2})
          ctx.font='bold 11px sans-serif'; ctx.fillStyle='#22c55e'
          ctx.textAlign = px > chartArea.right-120 ? 'right' : 'left'
          const tx = px > chartArea.right-120 ? px-10 : px+10
          ctx.fillText('Pico: '+valLabel, tx, py-10)
          ctx.restore()
        }
      }],
      data: { labels, datasets: [{
        data: equityData, borderColor: '#22c55e',
        backgroundColor: (ctx) => {
          if (!ctx.chart.chartArea) return 'rgba(34,197,94,0.1)'
          const g = ctx.chart.ctx.createLinearGradient(0,ctx.chart.chartArea.top,0,ctx.chart.chartArea.bottom)
          g.addColorStop(0,'rgba(34,197,94,0.35)'); g.addColorStop(0.6,'rgba(34,197,94,0.08)'); g.addColorStop(1,'rgba(34,197,94,0.01)'); return g
        },
        fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
      }]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { ticks: { color: c.text, maxTicksLimit: 10 }, grid: { color: c.grid } },
          y: { ticks: { color: c.text, callback: v => 'R$ '+v.toLocaleString('pt-BR') }, grid: { color: c.grid } } } }
    })
    if (elDD) {
      const cap = metrics.capital || 1; let a2=0, pk=0
      const ddData = timeline.map(o => { a2+=o.resWeighted; if(a2>pk) pk=a2; return cap>0?+((-(pk-a2)/cap*100).toFixed(2)):0 })
      charts.current['equity-dd'] = new Chart(elDD, {
        type: 'line', plugins: [],
        data: { labels, datasets: [{ data: ddData, borderColor:'rgb(239,68,68)',
          backgroundColor: (ctx) => {
            if (!ctx.chart.chartArea) return 'rgba(239,68,68,0.2)'
            const g = ctx.chart.ctx.createLinearGradient(0,ctx.chart.chartArea.top,0,ctx.chart.chartArea.bottom)
            g.addColorStop(0,'rgba(239,68,68,0.65)'); g.addColorStop(0.5,'rgba(239,68,68,0.25)'); g.addColorStop(1,'rgba(239,68,68,0.03)'); return g
          },
          fill:'origin', tension:0.2, pointRadius:0, borderWidth:1.5 }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
          scales: { x:{ticks:{color:c.text,maxTicksLimit:10},grid:{color:c.grid}}, y:{max:0,ticks:{color:c.text,callback:v=>v.toFixed(1)+'%'},grid:{color:c.grid}} } }
      })
    }
  }

  const renderDD = () => {
    const el = document.getElementById('pc-dd'); if (!el) return
    const c = getC()
    const cap = metrics.capital || 1
    let acc = 0, peak = 0
    const ddData = timeline.map(o => {
      acc += o.resWeighted; if (acc > peak) peak = acc
      return cap > 0 ? +((-(peak-acc)/cap*100).toFixed(2)) : 0
    })
    charts.current['dd'] = new Chart(el, {
      type: 'line',
      data: {
        labels: timeline.map(o => o.abertura.slice(0,10)),
        datasets: [{ data: ddData, borderColor: c.neg, backgroundColor: c.neg+'22', fill: true, tension: 0.2, pointRadius: 0, borderWidth: 1.5 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: c.text, maxTicksLimit: 10 }, grid: { color: c.grid } },
          y: { ticks: { color: c.text, callback: v => v.toFixed(1)+'%' }, grid: { color: c.grid } }
        }
      }
    })
  }

  const renderMonthly = () => {
    const el = document.getElementById('pc-monthly'); if (!el) return
    const c = getC()
    const monthly = {}
    timeline.forEach(o => {
      const pts = o.abertura.split(' ')[0].split('/')
      const key = `${pts[2]}-${pts[1]}`
      monthly[key] = (monthly[key]||0) + o.resWeighted
    })
    const keys = Object.keys(monthly).sort()
    const labels = keys.map(k => { const [y,m]=k.split('-'); return `${m}/${y.slice(2)}` })
    const data = keys.map(k => +monthly[k].toFixed(2))
    charts.current['monthly'] = new Chart(el, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: data.map(v=>v>=0?c.pos+'bb':c.neg+'bb'), borderWidth:0 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: c.text, maxRotation: 45, font:{size:10}, autoSkip: true, maxTicksLimit: 20 }, grid: { color: c.grid } },
          y: { ticks: { color: c.text, callback: v=>'R$ '+v.toLocaleString('pt-BR') }, grid: { color: c.grid } }
        }
      }
    })
  }

  const renderScatter = () => {
    if (!scatterPair || !corrMatrix) return
    const el = document.getElementById('pc-scatter'); if (!el) return
    const c = getC()
    const entries = buildEntries()
    const pts = buildScatterData(entries, scatterPair[0], scatterPair[1])
    const nameA = robotData[scatterPair[0]]?.robot.name || 'A'
    const nameB = robotData[scatterPair[1]]?.robot.name || 'B'
    charts.current['scatter'] = new Chart(el, {
      type: 'scatter',
      data: { datasets: [{ data: pts.map(p=>({x:p.x,y:p.y})), backgroundColor: c.blue+'aa', pointRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: nameA, color: c.text }, ticks: { color: c.text }, grid: { color: c.grid } },
          y: { title: { display: true, text: nameB, color: c.text }, ticks: { color: c.text }, grid: { color: c.grid } }
        }
      }
    })
  }

  const renderRanking = () => {
    const el = document.getElementById('pc-ranking'); if (!el) return
    const c = getC()
    const entries = buildEntries()
    if (!entries.length) return
    const ranked = entries.map(({ robot, adjOps, lots }) => {
      const m = calcMetrics(adjOps)
      // Score: M.6015 30% + FL 22% + DD 22% + Sharpe 14% + Paper meses 12%
      // Paper: 0 meses=0, 3 meses=metade, 12+ meses=máximo
      const paperMonths = getPaperMonths(robotData[robot.id]?.robot?.periods)
      const paperScore = Math.min(paperMonths / 12, 1)
      const score = (
        Math.min((m.m6015||0) / 10, 1) * 5 * 0.30 +
        Math.min((m.profitFactor||0) / 5, 1) * 5 * 0.22 +
        Math.max(0, 1 - (m.ddMaxPct||0) / 100) * 5 * 0.22 +
        Math.min(Math.max((m.sharpe||0), 0) / 3, 1) * 5 * 0.14 +
        paperScore * 5 * 0.12
      )
      return { name: robot.name, score: +score.toFixed(2), m, lots }
    }).sort((a,b) => b.score - a.score)

    charts.current['ranking'] = new Chart(el, {
      type: 'bar',
      data: {
        labels: ranked.map(r => r.name),
        datasets: [{
          label: 'Score',
          data: ranked.map(r => r.score),
          backgroundColor: ranked.map((r,i) => i===0?c.pos+'ee':i===1?c.blue+'cc':c.amber+'99'),
          borderWidth: 0,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: c.text }, grid: { color: c.grid }, min: 0, max: 5 },
          y: { ticks: { color: c.text, font: { size: 11 } }, grid: { display: false } }
        }
      }
    })
    return ranked
  }

  // ── Computed metrics ─────────────────────────────────────────────────────────
  const extMetrics = (() => {
    if (!timeline.length) return {}
    const monthly = {}
    timeline.forEach(o => {
      const pts = o.abertura.split(' ')[0].split('/')
      const key = `${pts[2]}-${pts[1]}`
      monthly[key] = (monthly[key]||0) + o.resWeighted
    })
    const monthVals = Object.values(monthly)
    const avgMonthly = monthVals.reduce((a,b)=>a+b,0) / (monthVals.length||1)
    const posMonths = monthVals.filter(v=>v>0).length
    const pctPosMonths = monthVals.length ? posMonths/monthVals.length*100 : 0
    const worstMonth = Math.min(...monthVals)
    const bestMonth = Math.max(...monthVals)

    // Daily
    const daily = {}
    timeline.forEach(o => {
      const d = o.abertura.split(' ')[0]
      daily[d] = (daily[d]||0) + o.resWeighted
    })
    const dayVals = Object.values(daily)
    const posDays = dayVals.filter(v=>v>0).length
    const pctPosDays = dayVals.length ? posDays/dayVals.length*100 : 0
    const worstDay = Math.min(...dayVals)
    const bestDay = Math.max(...dayVals)
    const avgDayPos = dayVals.filter(v=>v>0).reduce((a,b)=>a+b,0) / (dayVals.filter(v=>v>0).length||1)
    const avgDayNeg = dayVals.filter(v=>v<0).reduce((a,b)=>a+b,0) / (dayVals.filter(v=>v<0).length||1)
    const daysAboveX = dayVals.filter(v => v < -Math.abs(thresholdX)).length
    const pctDaysAboveX = dayVals.length ? daysAboveX/dayVals.length*100 : 0

    // Volatility
    const meanDay = dayVals.reduce((a,b)=>a+b,0)/dayVals.length
    const stdDay = Math.sqrt(dayVals.reduce((a,b)=>a+(b-meanDay)**2,0)/dayVals.length)
    const volMonthly = stdDay * Math.sqrt(21)
    const totalLots = selected.reduce((a,s)=>a+(s.lots||1),0)

    const stag = calcStagnation(timeline)

    // ── Conta Real consolidada ──────────────────────────────────────────
    // Agrega realOps de todos os robôs selecionados ponderados por lots
    const realMonthly = {}     // { 'YYYY-MM': total_real_R$ }
    const realMonthlyByRobot = {}  // { robotId: Set<YYYY-MM> }
    let nRobotsWithReal = 0

    selected.forEach(s => {
      const rd = robotData[s.robotId]
      const realOps = rd?.robot?.realOps || []
      if (!realOps.length) return
      nRobotsWithReal++
      realMonthlyByRobot[s.robotId] = new Set()
      realOps.forEach(o => {
        const pts = (o.abertura||'').split(' ')[0].split('/')
        if (pts.length === 3) {
          const k = `${pts[2]}-${pts[1]}`
          realMonthly[k] = (realMonthly[k]||0) + (o.res_op||0) * (s.lots||1)
          realMonthlyByRobot[s.robotId].add(k)
        }
      })
    })

    // Meses em que TODAS as estratégias têm dados reais
    const nRobots = selected.length
    const realMonths = Object.keys(realMonthly).filter(k => {
      const count = Object.values(realMonthlyByRobot).filter(set => set.has(k)).length
      return count === nRobotsWithReal && nRobotsWithReal === nRobots
    }).sort()

    const realMonthVals = realMonths.map(k => realMonthly[k])
    const avgMonthlyReal = realMonthVals.length
      ? realMonthVals.reduce((a,b)=>a+b,0) / realMonthVals.length
      : null
    const totalReal = realMonthVals.reduce((a,b)=>a+b,0)

    return {
      avgMonthly, pctPosMonths, worstMonth, bestMonth,
      posDays, pctPosDays, worstDay, bestDay,
      avgDayPos, avgDayNeg, daysAboveX, pctDaysAboveX,
      stdDay, volMonthly, totalLots, nMonths: monthVals.length,
      stagWorstDays: stag.worstDays, stagAvgDays: stag.avgDays, stagPeriods: stag.periods,
      stagWorstPeriod: stag.worstPeriod, stagAvgLoss: stag.avgLoss,
      // Conta real
      avgMonthlyReal, totalReal,
      nMonthsAllReal: realMonths.length,
      nRobotsWithReal,
    }
  })()

  const corrColor = (v) => {
    const abs = Math.abs(v)
    if (abs > 0.7) return v > 0 ? '#dc262640' : '#16a34a40'
    if (abs > 0.4) return v > 0 ? '#d9770620' : '#0891b220'
    return 'transparent'
  }

  const hasData = timeline.length > 0

  // Ranking data for table
  const rankingData = (() => {
    const entries = buildEntries()
    return entries.map(({ robot, adjOps, lots }) => {
      const m = calcMetrics(adjOps)
      // Score: M.6015 30% + FL 22% + DD 22% + Sharpe 14% + Paper meses 12%
      // Paper: 0 meses=0, 3 meses=metade, 12+ meses=máximo
      const paperMonths = getPaperMonths(robotData[robot.id]?.robot?.periods)
      const paperScore = Math.min(paperMonths / 12, 1)
      const score = (
        Math.min((m.m6015||0) / 10, 1) * 5 * 0.30 +
        Math.min((m.profitFactor||0) / 5, 1) * 5 * 0.22 +
        Math.max(0, 1 - (m.ddMaxPct||0) / 100) * 5 * 0.22 +
        Math.min(Math.max((m.sharpe||0), 0) / 3, 1) * 5 * 0.14 +
        paperScore * 5 * 0.12
      )
      return { name: robot.name, score: +score.toFixed(2), m, lots, id: robot.id }
    }).sort((a,b) => b.score - a.score)
  })()

  // ── Exposure calculations ────────────────────────────────────────────────────
  const exposureData = (() => {
    const entries = buildEntries()
    const byType = {}, byAtivo = {}
    let totalLots = 0
    for (const { robot, lots } of entries) {
      totalLots += lots
      const st = robot.strategy_type || 'Não definido'
      const at = robot.ativo || 'Não definido'
      byType[st] = (byType[st] || 0) + lots
      byAtivo[at] = (byAtivo[at] || 0) + lots
    }
    const toPct = (obj) => Object.entries(obj)
      .map(([k, v]) => ({ label: k, pct: totalLots > 0 ? v / totalLots * 100 : 0, lots: v }))
      .sort((a, b) => b.pct - a.pct)
    return { byType: toPct(byType), byAtivo: toPct(byAtivo), totalLots }
  })()

  // ── Individual risk per robot ─────────────────────────────────────────────
  // Base: capital consolidado real do portfólio (metrics.capital).
  // Coerente com a rentabilidade % e o card 'Capital' do topo.
  const robotRiskData = (() => {
    const entries = buildEntries()
    const portfolioCapital = metrics.capital || 0
    return entries.map(({ robot, lots, adjOps }) => {
      const m = calcMetrics(adjOps)
      const robotDD = (m.maxDD || 0) * lots  // DD weighted by lots
      const worstCase = robotDD * 2           // 2x historical DD
      const riskPct = portfolioCapital > 0 ? worstCase / portfolioCapital * 100 : 0
      return { name: robot.name, robotDD, worstCase, riskPct, lots, id: robot.id }
    }).sort((a, b) => b.riskPct - a.riskPct)
  })()

  return (
    <div>
      <div className="page-header">
        <input
          value={portfolioName} onChange={e => setPortfolioName(e.target.value)}
          style={{ fontWeight:600, fontSize:20, border:'none', background:'transparent', color:'var(--text)', outline:'none', borderBottom:'1.5px solid var(--border)', paddingBottom:2, minWidth:200 }}
        />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:'auto' }}>
          <label style={{ fontSize:12, color:'var(--text-muted)' }}>Capital:</label>
          <select
            value={multiplier} onChange={e => setMultiplier(parseInt(e.target.value))}
            style={{ fontSize:13, padding:'5px 8px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)' }}
          >
            {[2,3,4,5,6,7,8,10].map(v => <option key={v} value={v}>{v}× DD máximo</option>)}
          </select>
          {hasData && <button className="btn" onClick={async () => {
              // Garante aba Análise para os canvas existirem no DOM
              if (tab !== 'analise') {
                setTab('analise')
                // espera o React renderizar e o Chart.js desenhar
                await new Promise(r => setTimeout(r, 600))
              }
              exportPortfolioPDF({
                portfolio: { name: portfolioName },
                metrics,
                extMetrics,
                timeline,
                selected,
                robotDataMap: robotData,
                exposureData,
                robotRiskData,
                portfolioMC,
                multiplier,
                fmtR, fmtPct, fmtNum,
                calcMetrics,
              })
            }} title="Exportar PDF (download direto)">📄 PDF</button>}
          <button className="btn" onClick={() => setShowAutoAlloc(v => !v)} disabled={!selected.length} title="Montar automaticamente pelo capital disponível">
            ⚡ Auto-alocar
          </button>
          {!readOnly && (
            <button className="btn primary" onClick={handleSave} disabled={saving || !selected.length}>
              {saving ? 'Salvando...' : (id && id !== 'new') ? 'Salvar' : 'Criar portfólio'}
            </button>
          )}

        </div>
      </div>

      {/* Sticky capital summary bar */}
      {hasData && (
        <div style={{
          position:'sticky', top:0, zIndex:10,
          background:'var(--bg)', borderBottom:'1px solid var(--border)',
          display:'flex', gap:8, flexWrap:'wrap',
          margin:'0 -24px 16px', padding:'10px 24px',
          boxShadow:'0 2px 8px rgba(0,0,0,0.06)'
        }}>
          {[
            { label:'Capital', value: fmtR(metrics.capital||0), sub: allocResult?.ok && allocResult.capitalTarget ? `${((metrics.capital||0)/allocResult.capitalTarget*100).toFixed(1)}% de ${fmtR(allocResult.capitalTarget)}` : `${multiplier}× DD`, color:'var(--text)' },
            { label:'DD máximo', value: fmtPct(-(metrics.ddMaxPct||0)), sub: fmtR(metrics.maxDD||0), color:'var(--danger)' },
            { label:'Rent. média mensal', value: metrics.capital ? fmtPct((extMetrics.avgMonthly||0)/metrics.capital*100) : '—', sub:'sobre capital', color:(extMetrics.avgMonthly||0)>=0?'var(--success)':'var(--danger)' },
            { label:'Ganho médio mensal', value: fmtR(extMetrics.avgMonthly||0), sub:`${fmtNum(extMetrics.pctPosMonths||0,1)}% meses positivos`, color:(extMetrics.avgMonthly||0)>=0?'var(--success)':'var(--danger)' },
            { label:'Sharpe', value: fmtNum(metrics.sharpe||0), sub:'M.6015: '+fmtNum(metrics.m6015||0), color:(metrics.sharpe||0)>1?'var(--success)':(metrics.sharpe||0)>0?'var(--warning)':'var(--danger)' },
          ].map((c,i) => (
            <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 14px', flex:'1', minWidth:120 }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>{c.label}</div>
              <div style={{ fontSize:16, fontWeight:700, color:c.color, lineHeight:1.2 }}>{c.value}</div>
              <div style={{ fontSize:10, color:'var(--text-muted)' }}>{c.sub}</div>
            </div>
          ))}
        </div>
      )}

      <div className="tabs">
        {['composicao','analise','metas','diario','avancado','correlacao','avaliacao','gestor','ranking','recomendacoes'].map(t => (
          <div key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>
            {{ composicao:'Composição', analise:'Análise', metas:'Metas/Limites', diario:'Diário', avancado:'Avançado', correlacao:'Correlação', avaliacao:'Avaliação', gestor:'Gestor', ranking:'Ranking', recomendacoes:'Recomendações IA' }[t]}
          </div>
        ))}
      </div>

      {/* ── AUTO-ALLOC PANEL ── */}
      {showAutoAlloc && (
        <div id="autoalloc-panel" style={{ background:'var(--surface)', border:'1px solid var(--accent)', borderRadius:'var(--radius-lg)', padding:'16px 20px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>⚡ Alocação automática</div>
            <button onClick={() => { setShowAutoAlloc(false); setAllocResult(null) }}
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:20, lineHeight:1, padding:'0 4px', borderRadius:4 }}
              title="Fechar">×</button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'auto auto 1fr', gap:20, flexWrap:'wrap', alignItems:'start', marginBottom:14 }}>
            {/* Capital */}
            <div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>Capital disponível (R$)</div>
              <input
                type="text"
                value={allocCapitalStr}
                onChange={e => {
                  const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '')
                  const num = parseInt(raw) || 0
                  setAllocCapital(num)
                  setAllocCapitalStr(num > 0 ? num.toLocaleString('pt-BR') : '')
                }}
                onBlur={() => setAllocCapitalStr(allocCapital > 0 ? allocCapital.toLocaleString('pt-BR') : '')}
                placeholder="Ex: 10.000"
                style={{ width:150, padding:'7px 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)', fontSize:15, fontWeight:700 }}
              />
              <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>
                DD máx portfólio: R$ {allocMultiplier > 0 ? (allocCapital/allocMultiplier).toLocaleString('pt-BR', {maximumFractionDigits:0}) : '—'}
              </div>
            </div>

            {/* Multiplicador */}
            <div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>Multiplicador DD</div>
              <div style={{ display:'flex', gap:5 }}>
                {[2,3,4,5].map(x => (
                  <button key={x}
                    onClick={() => { setAllocMultiplier(x); setMultiplier(x) }}
                    className={'btn sm' + (allocMultiplier===x?' primary':'')}>{x}×</button>
                ))}
              </div>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>sincroniza com o topo da página</div>
            </div>

            {/* Risco */}
            <div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>
                Risco máximo por robô — <span style={{ fontWeight:700, color: allocMaxRisk>40?'var(--danger)':allocMaxRisk>15?'var(--warning)':'var(--success)' }}>{allocMaxRisk}%</span>
                {useStatusLimits && <span style={{ marginLeft:6, fontSize:10, color:'var(--accent)' }}>(sobrescrito por status)</span>}
              </div>
              <input type="range" min="1" max="50" step="1" value={allocMaxRisk}
                onChange={e => setAllocMaxRisk(+e.target.value)} style={{ width:'100%' }} disabled={useStatusLimits} />
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)', marginTop:2 }}>
                <span>DD máx/robô: R$ {allocCapital > 0 ? ((allocCapital/allocMultiplier)*(allocMaxRisk/100)).toLocaleString('pt-BR', {maximumFractionDigits:0}) : '—'}</span>
                <span>{allocMaxRisk<=15?'🟢 Baixo':allocMaxRisk<=40?'🟡 Médio':'🔴 Alto'}</span>
              </div>
            </div>
          </div>

          {/* Limites por status */}
          <div style={{ marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <div onClick={() => setUseStatusLimits(v=>!v)} style={{ width:34, height:18, borderRadius:9, cursor:'pointer', background:useStatusLimits?'var(--accent)':'rgba(255,255,255,0.1)', position:'relative', transition:'background .2s', flexShrink:0 }}>
                <div style={{ position:'absolute', top:2, left:useStatusLimits?18:2, width:14, height:14, borderRadius:'50%', background:'#fff', transition:'left .2s' }}/>
              </div>
              <span style={{ fontSize:12, fontWeight:600, color:useStatusLimits?'var(--text)':'var(--text-muted)' }}>Limites de risco por status da estratégia</span>
            </div>
            {useStatusLimits && (
              <div style={{ background:'var(--bg)', borderRadius:8, padding:'12px 14px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                {[
                  { key:'APROVADO', label:'✓ Aprovada', color:'#16a34a' },
                  { key:'APROVADO_CAUTELA', label:'⚠ Cautela', color:'#d97706' },
                  { key:'APROVADO_SIMULADOR', label:'~ Simulador', color:'#7c3aed' },
                ].map(({ key, label, color }) => (
                  <div key={key}>
                    <div style={{ fontSize:11, fontWeight:600, color, marginBottom:4 }}>{label}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <input type="number" min="0" max="60" value={allocStatusLimits[key]}
                        onChange={e => setAllocStatusLimits(prev => ({...prev, [key]: +e.target.value||0}))}
                        style={{ width:50, padding:'3px 6px', borderRadius:5, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:12, textAlign:'center' }}/>
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>%</span>
                    </div>
                  </div>
                ))}
                <div style={{ gridColumn:'1/-1', fontSize:10, color:'var(--text-hint)', marginTop:2 }}>
                  Estratégias Reprovadas e sem status recebem 0 lotes automaticamente.
                </div>
              </div>
            )}
          </div>

          {/* Linha 2: Objetivo + Piso de capital */}
          <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:20, alignItems:'start', marginBottom:14 }}>
            <div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>Otimizar por</div>
              <div style={{ display:'flex', gap:5 }}>
                {[
                  {k:'sharpe',     l:'Sharpe',          tip:'Melhor relação retorno/risco (estabilidade)'},
                  {k:'rentTotal',  l:'Rentab. R$',      tip:'Maior retorno absoluto histórico'},
                  {k:'rentPct',    l:'Rentab. %',       tip:'Maior retorno por capital usado'},
                ].map(o => (
                  <button key={o.k} title={o.tip}
                    onClick={() => setAllocObjective(o.k)}
                    className={'btn sm' + (allocObjective===o.k?' primary':'')}>{o.l}</button>
                ))}
              </div>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>
                {allocObjective==='sharpe' && 'Sharpe anualizado do portfólio'}
                {allocObjective==='rentTotal' && 'Soma dos resultados em R$'}
                {allocObjective==='rentPct' && 'Retorno total ÷ capital consolidado'}
              </div>
            </div>

            <div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>
                Usar pelo menos — <span style={{ fontWeight:700, color:'var(--text)' }}>{allocMinUsage}%</span> do capital
              </div>
              <input type="range" min="50" max="100" step="5" value={allocMinUsage}
                onChange={e => setAllocMinUsage(+e.target.value)} style={{ width:'100%' }} />
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)', marginTop:2 }}>
                <span>Faixa alvo: R$ {allocCapital > 0 ? (allocCapital*allocMinUsage/100).toLocaleString('pt-BR',{maximumFractionDigits:0}) : '—'} – R$ {allocCapital.toLocaleString('pt-BR',{maximumFractionDigits:0})}</span>
                <span>{allocMinUsage<=70?'flexível':allocMinUsage<=90?'balanceado':'rígido'}</span>
              </div>
            </div>
          </div>

          {/* Info box */}
          <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:14, padding:'8px 12px', background:'var(--bg)', borderRadius:'var(--radius)', lineHeight:1.6 }}>
            💡 Objetivo: maximizar <strong>{allocObjective==='sharpe'?'Sharpe':allocObjective==='rentTotal'?'rentabilidade total (R$)':'rentabilidade %'}</strong> do
            portfólio respeitando o DD máximo por robô e usando entre <strong>{allocMinUsage}%</strong> e <strong>100%</strong> do capital.
            Capital usado é o DD consolidado real × multiplicador (considera diversificação).
            Robôs que não cabem no limite ficam com 0 lotes.
          </div>

          {/* Error result */}
          {allocResult && !allocResult.ok && (
            <div style={{ marginBottom:14, padding:'12px 16px', background:'var(--danger-bg)', border:'1px solid var(--danger)', borderRadius:'var(--radius)', fontSize:12 }}>
              <div style={{ fontWeight:700, color:'var(--danger)', marginBottom:8 }}>
                ⚠ Nenhum robô cabe nos limites definidos
              </div>
              <div style={{ marginBottom:8 }}>Todos os robôs ultrapassam o limite de DD mesmo com 1 lote — aumente o capital, o risco máximo ou reduza o multiplicador:</div>
              <table style={{ width:'100%', fontSize:11, borderCollapse:'collapse', marginBottom:10 }}>
                <thead>
                  <tr style={{ background:'rgba(220,38,38,.1)' }}>
                    <th style={{ padding:'4px 8px', textAlign:'left' }}>Robô</th>
                    <th style={{ padding:'4px 8px', textAlign:'right' }}>DD (1 lote)</th>
                    <th style={{ padding:'4px 8px', textAlign:'right' }}>Capital necessário</th>
                    <th style={{ padding:'4px 8px', textAlign:'right' }}>Limite atual</th>
                  </tr>
                </thead>
                <tbody>
                  {allocResult.violators.map((v,i) => (
                    <tr key={i} style={{ borderTop:'1px solid var(--border)' }}>
                      <td style={{ padding:'4px 8px', fontWeight:600 }}>{v.name}</td>
                      <td style={{ padding:'4px 8px', textAlign:'right', color:'var(--danger)' }}>R$ {v.ddBase.toLocaleString('pt-BR', {maximumFractionDigits:0})}</td>
                      <td style={{ padding:'4px 8px', textAlign:'right' }}>R$ {v.capitalNeeded.toLocaleString('pt-BR', {maximumFractionDigits:0})}</td>
                      <td style={{ padding:'4px 8px', textAlign:'right', color:'var(--warning)' }}>R$ {allocResult.maxDDperRobot.toLocaleString('pt-BR', {maximumFractionDigits:0})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ color:'var(--text-muted)' }}>
                💡 Sugestão: considere remover <strong>{allocResult.suggestions.join(', ')}</strong> (maior DD) ou aumente o capital / risco máximo.
              </div>
            </div>
          )}

          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button className="btn primary" onClick={autoAllocate} disabled={!allocCapital || !selected.length}>
              ⚡ Calcular melhor alocação
            </button>
            <button className="btn" onClick={() => { setShowAutoAlloc(false); setAllocResult(null) }}>Cancelar</button>
            {allocResult?.ok && (
              <div style={{ fontSize:12, display:'flex', flexDirection:'column', gap:3 }}>
                <span style={{ color:'var(--success)', fontWeight:600 }}>
                  ✓ Alocação aplicada — Retorno histórico: {allocResult.rentTotal} · Capital alocado: {allocResult.capitalUsed} ({allocResult.capitalPct}% do disponível)
                </span>
                {!allocResult.reachedMin && (
                  <span style={{ color:'var(--warning)' }}>
                    {allocResult.stopReason === 'maxLots' && (
                      <>⚠ Não atingiu o piso de {allocResult.minUsagePct}% — todos os {allocResult.totalUsable} robôs usáveis bateram o limite individual de risco ({allocMaxRisk}% por robô). Solução: <strong>aumente "Risco máximo por robô"</strong> (ex: {Math.min(50, allocMaxRisk + 15)}%) ou adicione mais robôs ao portfólio.</>
                    )}
                    {allocResult.stopReason === 'maxCap' && (
                      <>⚠ Não atingiu o piso de {allocResult.minUsagePct}% — qualquer lote adicional ultrapassaria o capital total. Provavelmente o DD consolidado dos robôs disponíveis com 1 lote já consome muito. Solução: <strong>aumente o capital disponível</strong> ou reduza o piso.</>
                    )}
                    {!allocResult.stopReason && (
                      <>⚠ Não atingiu o piso de {allocResult.minUsagePct}% — limite de risco ou DD impediu. Considere aumentar o risco máximo, reduzir o piso, ou adicionar mais robôs.</>
                    )}
                    {' '}({allocResult.robotsAtMaxLots}/{allocResult.totalUsable} robôs em maxLots · fase1: {allocResult.phase1Lots}, fase2: {allocResult.phase2Lots})
                  </span>
                )}
                {allocResult.zeroed?.length > 0 && (
                  <span style={{ color:'var(--warning)' }}>
                    ⚠ Zerados (DD acima do limite): {allocResult.zeroed.join(', ')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── COMPOSIÇÃO ── */}
      {tab === 'composicao' && (
        <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
          {/* Coluna esquerda — rola com a página */}
          <div style={{ flex:1, minWidth:0 }}>
          <div className="card">
            <div style={{ fontWeight:600, marginBottom:10 }}>Robôs disponíveis</div>
            {/* Ativo + Platform filter */}
            <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
              <select value={robotAtivoFilter} onChange={e => setRobotAtivoFilter(e.target.value)}
                style={{ fontSize:11, padding:'3px 8px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)' }}>
                <option value="all">Todos ativos</option>
                {[...new Set(allRobots.map(r => r.ativo).filter(Boolean))].sort().map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={robotPlatformFilter} onChange={e => setRobotPlatformFilter(e.target.value)}
                style={{ fontSize:11, padding:'3px 8px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)' }}>
                <option value="all">Todas plataformas</option>
                <option value="profit">Profit</option>
                <option value="mt5">MetaTrader 5</option>
              </select>
            </div>
            {/* Status filter */}
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:10 }}>
              {[
                { value:'all', label:'Todos', color:null },
                { value:'APROVADO', label:'✓', color:'#16a34a', title:'Aprovadas' },
                { value:'APROVADO_CAUTELA', label:'⚠', color:'#d97706', title:'Com cautela' },
                { value:'APROVADO_SIMULADOR', label:'~', color:'#7c3aed', title:'Simulador' },
                { value:'REPROVADO', label:'✕', color:'#dc2626', title:'Reprovadas' },
                { value:'none', label:'○', color:'#9ca3af', title:'Sem validação' },
              ].map(opt => (
                <button key={opt.value} onClick={() => setRobotListFilter(opt.value)}
                  title={opt.title || 'Todos'}
                  style={{
                    padding:'3px 8px', fontSize:11, cursor:'pointer', borderRadius:'var(--radius)',
                    border:'1px solid var(--border)',
                    background: robotListFilter===opt.value ? (opt.color||'var(--accent)') : 'transparent',
                    color: robotListFilter===opt.value ? '#fff' : (opt.color||'var(--text-muted)'),
                    fontWeight: robotListFilter===opt.value ? 700 : 400,
                  }}>{opt.value==='all' ? 'Todos' : opt.label}</button>
              ))}
            </div>
            {(() => {
              const ranking = window.__ranking__ || []
              const sorted = [...allRobots].sort((a, b) => {
                const ra = ranking.find(x => x.id === a.id)
                const rb = ranking.find(x => x.id === b.id)
                return (rb?.score ?? -1) - (ra?.score ?? -1)
              }).filter(r => {
                if (robotListFilter !== 'all') {
                  const st = robotStatuses[r.id] || null
                  if (robotListFilter === 'none' && st) return false
                  if (robotListFilter !== 'none' && st !== robotListFilter) return false
                }
                if (robotAtivoFilter !== 'all' && r.ativo !== robotAtivoFilter) return false
                if (robotPlatformFilter !== 'all' && (r.platform || 'profit') !== robotPlatformFilter) return false
                return true
              })
              const iconMap = { APROVADO:{icon:'✓',bg:'#16a34a'}, APROVADO_CAUTELA:{icon:'⚠',bg:'#d97706'}, APROVADO_SIMULADOR:{icon:'~',bg:'#7c3aed'}, REPROVADO:{icon:'✕',bg:'#dc2626'} }
              return sorted.map(r => {
                const isAdded = selected.find(s => s.robotId === r.id)
                const st = robotStatuses[r.id]
                const si = st ? iconMap[st] : { icon:'○', bg:'#9ca3af' }
                const rk = ranking.find(x => x.id === r.id)
                return (
                  <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                    <span title={st||'Sem validação'} style={{ width:16, height:16, borderRadius:'50%', flexShrink:0, background:si.bg, color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700 }}>{si.icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:500, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</span>
                        <PlatformBadge platform={r.platform} size={14} />
                        {r.strategy_type && <span className="badge gray" style={{ fontSize:9 }}>{r.strategy_type}</span>}
                        {r.timeframe && <span className="badge gray" style={{ fontSize:9 }}>{r.timeframe}</span>}
                      </div>
                      <div style={{ display:'flex', gap:8, marginTop:2, flexWrap:'wrap', alignItems:'center' }}>
                        <span style={{ fontSize:10, color:'var(--text-muted)' }}>{r.ativo} · {r.op_count} ops</span>
                        {robotMetrics[r.id]?.m6015 != null && (
                          <span style={{ fontSize:10, fontWeight:700, color:(robotMetrics[r.id].m6015||0)>3?'var(--success)':(robotMetrics[r.id].m6015||0)>2?'var(--warning)':'var(--danger)' }}>
                            M {(robotMetrics[r.id].m6015||0).toFixed(2)}
                          </span>
                        )}
                        {robotMetrics[r.id]?.recoveredMaxDD > 0 && (
                          <span style={{ fontSize:10, color:'var(--danger)' }}>
                            DD {fmtR(-(robotMetrics[r.id].recoveredMaxDD||0))}
                          </span>
                        )}
                        {rk && <span style={{ fontSize:10, fontWeight:700, color:'var(--accent)' }}>★ {rk.score}</span>}
                      </div>
                    </div>
                    <button className={`btn sm ${isAdded?'':'primary'}`} onClick={() => isAdded ? removeRobot(r.id) : addRobot(r.id)}>
                      {isAdded ? 'Remover' : '+ Adicionar'}
                    </button>
                  </div>
                )
              })
            })()}
          </div>
          </div>{/* fim coluna esquerda */}

          {/* Coluna direita — fixa, scroll independente */}
          <div style={{ width:380, flexShrink:0, position:'sticky', top: hasData ? 80 : 16, maxHeight:'calc(100vh - 140px)', overflowY:'auto', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', background:'var(--surface)', padding:'16px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontWeight:600 }}>
                Composição {selected.length > 0 && <span className="badge blue" style={{ marginLeft:8 }}>{selected.length} robôs</span>}
              </div>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background: portMode==='auto'?'#eff6ff':'#f0fdf4', color: portMode==='auto'?'var(--accent)':'#16a34a', fontWeight:600 }}>
                {portMode==='auto'?'⚡ Auto':'✏️ Manual'}
              </span>
            </div>

            {/* Barra de capital usado vs disponível */}
            {(() => {
              const capTotal = allocCapital || initCapital
              const capUsed  = metrics.capital || 0
              const pct      = capTotal > 0 ? Math.min(capUsed / capTotal * 100, 100) : 0
              const pctDisplay = capTotal > 0 ? (capUsed / capTotal * 100).toFixed(1) : '0.0'
              const barColor = pct > 100 ? '#dc2626' : pct > 85 ? '#d97706' : '#16a34a'
              if (!capTotal) return null
              return (
                <div style={{ marginBottom:16, background:'var(--bg)', borderRadius:8, padding:'10px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>Capital utilizado</span>
                    <span style={{ fontSize:12, fontWeight:700, color: barColor }}>{pctDisplay}%</span>
                  </div>
                  {/* Barra */}
                  <div style={{ height:8, background:'var(--border)', borderRadius:4, overflow:'hidden', marginBottom:6 }}>
                    <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, background: barColor, borderRadius:4, transition:'width .4s ease' }}/>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                    <span style={{ color: barColor, fontWeight:600 }}>{fmtR(capUsed)}</span>
                    <span style={{ color:'var(--text-muted)' }}>de {fmtR(capTotal)} disponíveis</span>
                  </div>
                  {capUsed > capTotal && (
                    <div style={{ fontSize:10, color:'#dc2626', marginTop:4 }}>⚠ Capital necessário excede o disponível</div>
                  )}
                </div>
              )
            })()}

            <div className="form-row" style={{ marginBottom:16 }}>
              <label>Meta de ganho mensal (R$)</label>
              <input type="number" value={targetMonthly} onChange={e => setTargetMonthly(e.target.value)} placeholder="Ex: 5000" style={{ maxWidth:180 }}/>
            </div>

            {selected.length === 0 && <div style={{ color:'var(--text-muted)', fontSize:13 }}>Adicione robôs ao portfólio.</div>}
            {selected.map(s => {
              const rd = robotData[s.robotId]
              const rInfo = allRobots.find(r => r.id === s.robotId)
              const name = rd?.robot.name || rInfo?.name || `Robô ${s.robotId}`
              const m = rd ? calcMetrics(rd.adjOps) : null
              // Risco individual do robô sobre o capital disponível
              const capTotal = allocCapital || initCapital
              const robotDD = m ? (m.maxDD || 0) * s.lots : 0
              const riskPct = (capTotal > 0 && robotDD > 0) ? ((robotDD * 2) / capTotal * 100) : 0
              const riskColor = riskPct > 30 ? '#dc2626' : riskPct > 15 ? '#d97706' : '#16a34a'
              return (
                <div key={s.robotId} style={{ padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <div style={{ fontWeight:500, fontSize:13, flex:1 }}>{name}</div>
                    <button className="btn sm danger" onClick={() => removeRobot(s.robotId)}>×</button>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <label style={{ fontSize:12, color:'var(--text-muted)' }}>Lotes:</label>
                    <input type="number" min="0" max="100" value={s.lots}
                      onChange={e => setLots(s.robotId, e.target.value)}
                      style={{ width:70, padding:'4px 8px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)', fontSize:13 }}
                    />
                    {m && (
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                        FL {fmtNum(Math.min(m.profitFactor||0,99))} · DD {fmtPct(-(m.ddMaxPct||0))} · M {fmtNum(m.m6015||0)}
                      </span>
                    )}
                    {riskPct > 0 && (
                      <span style={{ fontSize:11, fontWeight:600, color: riskColor, marginLeft:'auto' }} title="Risco individual: % do capital disponível">
                        Risco {fmtNum(riskPct,1)}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Botão auto-alocar para modo auto, após seleção */}
            {portMode === 'auto' && selected.length > 0 && (
              <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid var(--border)' }}>
                <button className="btn primary" style={{ width:'100%' }}
                  onClick={() => {
                    setShowAutoAlloc(true)
                    // Aguarda render do painel e dá scroll até ele
                    setTimeout(() => {
                      const el = document.getElementById('autoalloc-panel')
                      if (el) el.scrollIntoView({ behavior:'smooth', block:'start' })
                    }, 80)
                  }}>
                  ⚡ Calcular alocação automática
                </button>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6, textAlign:'center' }}>
                  {'Capital: ' + fmtR(allocCapital) + ' · Multiplicador: ' + allocMultiplier + '× · Piso: ' + allocMinUsage + '%'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ANÁLISE ── */}
      {tab === 'analise' && (
        !hasData ? <div className="empty-state"><p>Adicione robôs na aba Composição.</p></div> : (
          <>
            {/* ── 1: Indicadores gerais (com pior/médio/melhor mês embutidos) ── */}
            {(() => {
              // Pré-cálculo dos resultados esperados (μ ± 2σ)
              const monthly = {}
              timeline.forEach(o => {
                const p = o.abertura?.split(' ')[0]?.split('/')
                if (p?.length===3) { const k=`${p[2]}-${p[1]}`; monthly[k]=(monthly[k]||0)+o.resWeighted }
              })
              const vals = Object.values(monthly)
              const hasMonthlyStats = vals.length >= 3
              const avg = hasMonthlyStats ? vals.reduce((a,b)=>a+b,0)/vals.length : 0
              const std = hasMonthlyStats ? Math.sqrt(vals.reduce((a,b)=>a+(b-avg)**2,0)/vals.length) : 0
              const worst = avg - 2*std
              const best  = avg + 2*std
              const cap = metrics.capital || 1
              return (
                <div className="card" style={{ marginBottom:16 }}>
                  <div style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>Indicadores gerais</div>
                  <div className="metrics-grid">
                    <MetricCard label="Resultado total" value={fmtR(metrics.totalBruto||0)} cls={(metrics.totalBruto||0)>=0?'pos':'neg'} sub={`${metrics.nOps||0} operações`}/>
                    <MetricCard label="Capital necessário" value={fmtR(metrics.capital||0)} sub={`${multiplier}× DD máximo`}/>
                    <MetricCard label="Rentabilidade total" value={fmtPct(metrics.rentPct||0)} cls={(metrics.rentPct||0)>=0?'pos':'neg'} sub="sobre capital"/>
                    <MetricCard label="Ganho médio mensal" value={fmtR(extMetrics.avgMonthly||0)} cls={(extMetrics.avgMonthly||0)>=0?'pos':'neg'} sub={`${extMetrics.nMonths||0} meses`}/>
                    <MetricCard label="Meses positivos" value={fmtNum(extMetrics.pctPosMonths||0,1)+'%'} cls={(extMetrics.pctPosMonths||0)>=50?'pos':'neg'} sub={`${extMetrics.nMonths||0} meses`}/>
                    <MetricCard label="Taxa de acerto" value={fmtNum(metrics.winRate||0,1)+'%'} cls={(metrics.winRate||0)>=50?'pos':'neg'} sub={`${metrics.nWins||0}W / ${metrics.nLosses||0}L`}/>
                    <MetricCard label="Fator de lucro" value={fmtNum(Math.min(metrics.profitFactor||0,99))} cls={(metrics.profitFactor||0)>=1?'pos':'neg'}/>
                    <MetricCard label="Payoff médio" value={fmtNum(metrics.payoff||0)} cls={(metrics.payoff||0)>=1?'pos':'neg'}/>
                    <MetricCard label="M.6015" value={fmtNum(metrics.m6015||0)} cls={(metrics.m6015||0)>3?'pos':(metrics.m6015||0)>1?'warn':'neg'} sub={`FL ${fmtNum(Math.min(metrics.profitFactor||0,99))} + FRA ${fmtNum(metrics.fatRecAnual||0)}`}/>
                    <MetricCard label="DD atual" value={fmtPct(-(metrics.ddAtualPct||0))} cls="neg" sub={fmtR(-(metrics.ddAtual||0))}/>
                    <MetricCard label="DD máximo" value={fmtPct(-(metrics.ddMaxPct||0))} cls="neg" sub={fmtR(-(metrics.maxDD||0))}/>
                    <MetricCard label="Sharpe (est.)" value={fmtNum(metrics.sharpe||0)} cls={(metrics.sharpe||0)>1?'pos':'neg'}/>
                    {hasMonthlyStats && <>
                      <MetricCard label="Pior mês esperado" value={fmtR(worst)} cls="neg" sub={`${((worst/cap)*100).toFixed(1)}% · μ−2σ`}/>
                      <MetricCard label="Resultado mensal (μ)" value={fmtR(avg)} cls={avg>=0?'pos':'neg'} sub={`${((avg/cap)*100).toFixed(1)}% · ${vals.length} meses`}/>
                      <MetricCard label="Melhor mês esperado" value={fmtR(best)} cls="pos" sub={`${((best/cap)*100).toFixed(1)}% · μ+2σ`}/>
                    </>}

                    {/* ── Cards de conta real — sempre visíveis ── */}
                    <MetricCard
                      label="Méd. mensal conta real"
                      value={extMetrics.avgMonthlyReal != null ? fmtR(extMetrics.avgMonthlyReal) : '—'}
                      cls={extMetrics.avgMonthlyReal != null ? (extMetrics.avgMonthlyReal >= 0 ? 'pos' : 'neg') : ''}
                      sub={extMetrics.avgMonthlyReal != null
                        ? `Total: ${fmtR(extMetrics.totalReal||0)} · ${extMetrics.nMonthsAllReal}m`
                        : 'Sem dados de conta real'}
                    />
                    <MetricCard
                      label="Tempo c/ todas em real"
                      value={extMetrics.nMonthsAllReal > 0 ? `${extMetrics.nMonthsAllReal} meses` : '—'}
                      cls={extMetrics.nMonthsAllReal >= 3 ? 'pos' : extMetrics.nMonthsAllReal > 0 ? 'warn' : ''}
                      sub={extMetrics.nRobotsWithReal > 0
                        ? `${extMetrics.nRobotsWithReal} de ${selected.length} robôs com dados reais`
                        : 'Nenhum robô com conta real'}
                    />
                    <MetricCard
                      label="Diferença BT vs Real"
                      value={extMetrics.avgMonthlyReal != null
                        ? fmtR((extMetrics.avgMonthly||0) - extMetrics.avgMonthlyReal)
                        : '—'}
                      cls={extMetrics.avgMonthlyReal != null
                        ? ((extMetrics.avgMonthly||0) - extMetrics.avgMonthlyReal > 0 ? 'neg' : 'pos')
                        : ''}
                      sub={extMetrics.avgMonthlyReal != null
                        ? `BT ${fmtR(extMetrics.avgMonthly||0)} · Real ${fmtR(extMetrics.avgMonthlyReal)}`
                        : 'Importe conta real para comparar'}
                    />
                  </div>
                </div>
              )
            })()}

            {/* ── 2: Monte Carlo ── */}
            {portfolioMC && (
              <div className="card" style={{ marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>Monte Carlo — {portfolioMC.simulations.toLocaleString()} simulações</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>Embaralhamento aleatório das operações do portfólio</div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px,1fr))', gap:10 }}>
                  {[
                    { label:'DD mediano (P50)', value: fmtPct(-portfolioMC.ddP50Pct), sub: fmtR(-portfolioMC.ddP50)+' · 50% das sims', color:'var(--warning)' },
                    { label:'DD conservador (P90)', value: fmtPct(-portfolioMC.ddP90Pct), sub: fmtR(-portfolioMC.ddP90)+' · 90% das sims', color:'var(--danger)' },
                    { label:'DD extremo (P95)', value: fmtPct(-portfolioMC.ddP95Pct), sub: fmtR(-portfolioMC.ddP95)+' · 95% das sims', color:'var(--danger)' },
                    { label:'Prob. resultado positivo', value: portfolioMC.probPositive+'%', sub: 'das simulações no lucro', color: portfolioMC.probPositive>=70?'var(--success)':portfolioMC.probPositive>=50?'var(--warning)':'var(--danger)' },
                    { label:'Risco de Ruína', value: portfolioMC.riskOfRuin+'%', sub: 'perda >50% do capital · Davey: <10%', color: portfolioMC.riskOfRuin<=1?'var(--success)':portfolioMC.riskOfRuin<=5?'var(--warning)':'var(--danger)', border: true },
                    { label:'Resultado mediano (P50)', value: fmtR(portfolioMC.resultP50), sub: `P10: ${fmtR(portfolioMC.resultP10)} · P90: ${fmtR(portfolioMC.resultP90)}`, color: portfolioMC.resultP50>=0?'var(--success)':'var(--danger)' },
                  ].map((m,i) => (
                    <div key={i} style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'10px 14px', ...(m.border?{borderLeft:`3px solid ${m.color}`}:{}) }}>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>{m.label}</div>
                      <div style={{ fontSize:18, fontWeight:700, color:m.color }}>{m.value}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>{m.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 3: Exposição do portfólio ── */}
            <div className="card" style={{ marginBottom:16 }}>
              <div style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>Exposição do portfólio</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:500, color:'var(--text-muted)', marginBottom:8 }}>Por tipo de estratégia</div>
                  {exposureData.byType.length === 0
                    ? <div style={{ fontSize:12, color:'var(--text-muted)' }}>Nenhum tipo definido. Configure o tipo em cada estratégia.</div>
                    : exposureData.byType.map((item, i) => (
                    <div key={i} style={{ marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ fontSize:13, fontWeight:500 }}>{item.label}</span>
                        <span style={{ fontSize:13, fontWeight:600 }}>{item.pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${item.pct}%`, background:'var(--accent)', borderRadius:3 }}/>
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{item.lots} lotes</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:500, color:'var(--text-muted)', marginBottom:8 }}>Por ativo</div>
                  {exposureData.byAtivo.length === 0
                    ? <div style={{ fontSize:12, color:'var(--text-muted)' }}>Adicione robôs ao portfólio.</div>
                    : exposureData.byAtivo.map((item, i) => {
                    const colors = ['var(--accent)','var(--success)','var(--warning)','var(--purple)','var(--danger)']
                    return (
                      <div key={i} style={{ marginBottom:10 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                          <span style={{ fontSize:13, fontWeight:500 }}>{item.label}</span>
                          <span style={{ fontSize:13, fontWeight:600 }}>{item.pct.toFixed(1)}%</span>
                        </div>
                        <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${item.pct}%`, background:colors[i%colors.length], borderRadius:3 }}/>
                        </div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{item.lots} lotes</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* ── Gráficos: curva de capital + drawdown ── */}
            <div className="chart-card">
              <div className="chart-title">Curva de capital consolidada</div>
              <div style={{ position:'relative', height:200 }}><canvas id="pc-equity" role="img" aria-label="Curva consolidada"/></div>
              <div style={{ borderTop:'1px solid var(--border)', marginTop:6, paddingTop:4 }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2, textTransform:'uppercase', letterSpacing:'.04em', fontWeight:500 }}>Drawdown (%)</div>
                <div style={{ position:'relative', height:72 }}><canvas id="pc-equity-dd" role="img" aria-label="Drawdown portfolio"/></div>
              </div>
            </div>
            <div className="chart-2col">
              <div className="chart-card">
                <div className="chart-title">Drawdown acumulado (%)</div>
                <div style={{ position:'relative', height:200 }}><canvas id="pc-dd" role="img" aria-label="Drawdown"/></div>
              </div>
              <div className="chart-card">
                <div className="chart-title">Resultado mensal consolidado</div>
                <div style={{ position:'relative', height:200 }}><canvas id="pc-monthly" role="img" aria-label="Mensal"/></div>
              </div>
            </div>

            {/* ── Contribuição por robô (sempre por último) ── */}
            <div className="card">
              <div style={{ fontWeight:600, marginBottom:12 }}>Contribuição por robô</div>
              <div className="tbl-wrap">
                <table>
                  <thead><tr>
                    {[
                      { label:'Robô',         tip: null },
                      { label:'⚑',            tip:'Alertas: 🔴 DD atual ≥ 50% do capital · ⚠️ Degradação (EM últimos 6m ≥ 50% abaixo da média geral)' },
                      { label:'Tipo',         tip:'Tipo/estilo da estratégia: Tendência, Pullback, Scalper, Exaustão…' },
                      { label:'TF',           tip:'Timeframe principal da estratégia' },
                      { label:'Lotes',        tip:'Quantidade de contratos alocados a esta estratégia no portfólio' },
                      { label:'Ops',          tip:'Total de operações no período analisado' },
                      { label:'Total (R$)',   tip:'Resultado bruto total da estratégia com os lotes alocados' },
                      { label:'% portfólio',  tip:'Participação desta estratégia no resultado total do portfólio' },
                      { label:'FL',           tip:'Fator de Lucro — quanto foi ganho para cada R$ 1 perdido. Acima de 1,5 é positivo.' },
                      { label:'DD máx.',      tip:'Maior drawdown histórico atingido pela estratégia' },
                      { label:'M.6015',       tip:'Pontuação do Método 6015 — combina Fator de Lucro e Fator de Recuperação Anual. Acima de 3 é aprovado.' },
                      { label:'Méd. Real',    tip:'Média mensal em conta real (se disponível). Baseado nas operações reais importadas para esta estratégia.' },
                      { label:'Risco indiv.', tip:'% do capital total do portfólio que seria consumido se esta estratégia atingir 2× seu maior DD histórico (ponderado pelos lotes).' },
                    ].map(({ label, tip }, i) => (
                      <th key={i} style={{ whiteSpace: label === '⚑' ? 'nowrap' : undefined }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                          {label}
                          {tip && (
                            <span title={tip} style={{
                              display:'inline-flex', alignItems:'center', justifyContent:'center',
                              width:13, height:13, borderRadius:'50%',
                              border:'1px solid var(--border-strong)',
                              color:'var(--text-hint)', fontSize:8, fontWeight:700,
                              cursor:'help', flexShrink:0, lineHeight:1,
                              userSelect:'none',
                            }}>?</span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {selected.map(s => {
                      const rd = robotData[s.robotId]; if (!rd) return null
                      const m = calcMetrics(rd.adjOps)
                      const totalLotado = (m.totalBruto||0) * s.lots
                      const pct = metrics.totalBruto ? totalLotado/metrics.totalBruto*100 : 0
                      const riskEntry = robotRiskData.find(r => r.id === s.robotId)
                      const riskPct = (s.lots === 0) ? 0 : (riskEntry?.riskPct || 0)
                      // ── Alerts (mesma lógica do Painel) ──
                      const ddAlert = (m.ddAtualPct || 0) >= 50
                      let degAlert = false
                      const adj = rd.adjOps || []
                      if (adj.length > 0) {
                        const lastDateStr = adj[adj.length-1].abertura?.split(' ')[0]
                        const lp = lastDateStr?.split('/')
                        if (lp?.length === 3) {
                          const lastDate = new Date(+lp[2], +lp[1]-1, +lp[0])
                          const sixMonthsAgo = new Date(lastDate); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
                          const recentOps = adj.filter(o => {
                            const p = o.abertura?.split(' ')[0]?.split('/')
                            if (p?.length !== 3) return false
                            return new Date(+p[2], +p[1]-1, +p[0]) >= sixMonthsAgo
                          })
                          const emRecent = recentOps.length > 0 ? recentOps.reduce((a,b)=>a+b.resAdj,0)/recentOps.length : null
                          const emGeral = m.mean || 0
                          if (emRecent !== null && emGeral !== 0) {
                            const degradePct = (emRecent - emGeral) / Math.abs(emGeral) * 100
                            degAlert = degradePct <= -50
                          }
                        }
                      }
                      const ddTitle = ddAlert ? `DD atual em alerta: ${fmtNum(m.ddAtualPct,1)}%` : ''
                      const degTitle = degAlert ? 'Degradação: EM últimos 6 meses ≥ 50% abaixo da média geral' : ''
                      return (
                        <tr key={s.robotId}>
                          <td style={{ fontWeight:500 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                              {/* Status icon — SVG moderno por status */}
                              {(() => {
                                const st = robotStatuses[s.robotId]
                                const size = 17
                                if (st === 'APROVADO') return (
                                  <svg title="Aprovada" width={size} height={size} viewBox="0 0 20 20" style={{flexShrink:0}} xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="10" cy="10" r="10" fill="#16a34a"/>
                                    <polyline points="5,10 8.5,14 15,7" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )
                                if (st === 'APROVADO_CAUTELA') return (
                                  <svg title="Aprovada com cautela" width={size} height={size} viewBox="0 0 20 20" style={{flexShrink:0}} xmlns="http://www.w3.org/2000/svg">
                                    <polygon points="10,1 19,18 1,18" fill="#f59e0b" stroke="#d97706" strokeWidth="1"/>
                                    <text x="10" y="15.5" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#fff">!</text>
                                  </svg>
                                )
                                if (st === 'APROVADO_SIMULADOR') return (
                                  <svg title="Simulador" width={size} height={size} viewBox="0 0 20 20" style={{flexShrink:0}} xmlns="http://www.w3.org/2000/svg">
                                    <rect x="1" y="1" width="18" height="18" rx="4" fill="#7c3aed"/>
                                    <text x="10" y="14.5" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#fff">S</text>
                                  </svg>
                                )
                                if (st === 'REPROVADO') return (
                                  <svg title="Reprovada" width={size} height={size} viewBox="0 0 20 20" style={{flexShrink:0}} xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="10" cy="10" r="9.5" fill="#dc2626"/>
                                    <line x1="6" y1="6" x2="14" y2="14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
                                    <line x1="14" y1="6" x2="6" y2="14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
                                  </svg>
                                )
                                // Em análise — relógio
                                return (
                                  <svg title="Em análise" width={size} height={size} viewBox="0 0 20 20" style={{flexShrink:0}} xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="10" cy="10" r="9" fill="none" stroke="#94a3b8" strokeWidth="1.5"/>
                                    <line x1="10" y1="5" x2="10" y2="10.5" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round"/>
                                    <line x1="10" y1="10.5" x2="13.5" y2="13" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
                                  </svg>
                                )
                              })()}
                              {/* Robot name */}
                              <span>{rd.robot.name}</span>
                              {/* Ranking position */}
                              {(() => {
                                const rk = (window.__ranking__ || []).findIndex(x => x.id === s.robotId)
                                if (rk < 0) return null
                                const pos = rk + 1
                                return (
                                  <span title={`#${pos} no ranking geral`} style={{ fontSize:10, color:'#d97706', fontWeight:600, flexShrink:0 }}>
                                    #{pos}
                                  </span>
                                )
                              })()}
                            </div>
                          </td>
                          <td style={{ whiteSpace:'nowrap', textAlign:'center', fontSize:14 }}>
                            {ddAlert && <span title={ddTitle} style={{ marginRight:3 }}>🔴</span>}
                            {degAlert && <span title={degTitle}>⚠️</span>}
                          </td>
                          <td><span className="badge gray" style={{ fontSize:10 }}>{rd.robot.strategy_type || '—'}</span></td>
                          <td style={{ fontSize:11, color:'var(--text-muted)' }}>{rd.robot.timeframe || '—'}</td>
                          <td>
                            <input type="number" min="0" max="100" value={s.lots}
                              onChange={e => setLots(s.robotId, e.target.value)}
                              style={{ width:52, padding:'2px 6px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)', fontSize:13, textAlign:'center' }}
                            />
                          </td>
                          <td>{rd.adjOps.length}</td>
                          <td className={totalLotado>=0?'pos':'neg'}>{fmtR(totalLotado)}</td>
                          <td className={pct>=0?'pos':'neg'}>{fmtPct(pct)}</td>
                          <td className={(m.profitFactor||0)>=1?'pos':'neg'}>{fmtNum(Math.min(m.profitFactor||0,99))}</td>
                          <td className="neg">{fmtPct(-(m.ddMaxPct||0))}</td>
                          <td className={(m.m6015||0)>3?'pos':(m.m6015||0)>1?'':'neg'}>{fmtNum(m.m6015||0)}</td>
                          <td>
                            {rd.avgMonthlyReal != null
                              ? <span className={rd.avgMonthlyReal>=0?'pos':'neg'} title={`${rd.nRealOps} ops reais`}>{fmtR(rd.avgMonthlyReal)}</span>
                              : <span style={{ color:'var(--text-hint)' }}>—</span>}
                          </td>
                          <td>
                            <span style={{ fontWeight:600, color: riskPct>30?'var(--danger)':riskPct>15?'var(--warning)':'var(--success)' }}>
                              {fmtNum(riskPct,1)}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {/* Legenda */}
              <div style={{ marginTop:10, fontSize:11, color:'var(--text-muted)', padding:'10px 12px', background:'var(--bg)', borderRadius:'var(--radius)', display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ display:'flex', flexWrap:'wrap', gap:14, alignItems:'center' }}>
                  {[
                    { svg: <svg width="14" height="14" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10" fill="#16a34a"/><polyline points="5,10 8.5,14 15,7" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>, label: 'Aprovada' },
                    { svg: <svg width="14" height="14" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="10,1 19,18 1,18" fill="#f59e0b" stroke="#d97706" strokeWidth="1"/><text x="10" y="15.5" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#fff">!</text></svg>, label: 'Aprovada com cautela' },
                    { svg: <svg width="14" height="14" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="18" height="18" rx="4" fill="#7c3aed"/><text x="10" y="14.5" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#fff">S</text></svg>, label: 'Simulador' },
                    { svg: <svg width="14" height="14" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9.5" fill="#dc2626"/><line x1="6" y1="6" x2="14" y2="14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/><line x1="14" y1="6" x2="6" y2="14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/></svg>, label: 'Reprovada' },
                    { svg: <svg width="14" height="14" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" fill="none" stroke="#94a3b8" strokeWidth="1.5"/><line x1="10" y1="5" x2="10" y2="10.5" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round"/><line x1="10" y1="10.5" x2="13.5" y2="13" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/></svg>, label: 'Em análise' },
                    { text: '#1', color:'#d97706', label: 'Top 3 ranking' },
                    { text: '#N', color:'#64748b', label: 'Posição ranking' },
                  ].map((item, i) => (
                    <span key={i} style={{ display:'flex', alignItems:'center', gap:4 }}>
                      {item.svg ?? <span style={{ fontSize:11, fontWeight:700, color:item.color }}>{item.text}</span>}
                      <span>{item.label}</span>
                    </span>
                  ))}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:14, alignItems:'center', borderTop:'1px solid var(--border)', paddingTop:6 }}>
                  <span>Risco individual = % do capital consumido se o robô perder 2× seu maior DD (ponderado por lotes).</span>
                  <span style={{ color:'var(--success)' }}>≤15% baixo</span>
                  <span style={{ color:'var(--warning)' }}>15–30% médio</span>
                  <span style={{ color:'var(--danger)' }}>&gt;30% alto</span>
                  <span style={{ borderLeft:'1px solid var(--border)', paddingLeft:14 }}>Alertas: 🔴 DD atual ≥ 50% · ⚠️ Degradação (EM 6m ≥ 50% abaixo da média)</span>
                </div>
              </div>
            </div>
          </>
        )
      )}

      {/* ── METAS/LIMITES ── */}
      {tab === 'metas' && (
        <GoalsLimitsTab timeline={timeline} capital={metrics.capital || 0} metrics={metrics} />
      )}

      {/* ── DIÁRIO ── */}
      {tab === 'diario' && (
        !hasData
          ? <div className="empty-state"><p>Adicione robôs ao portfólio para ver o diário.</p></div>
          : <div>
              <CalendarioMensal
                timeline={timeline}
                capital={metrics.capital || 0}
                title={portfolioName || 'Portfólio'}
              />
              <div style={{ marginTop:24 }}>
                <DiarioTab timeline={timeline} capital={metrics.capital || 0} metrics={metrics} />
              </div>
            </div>
      )}

      {/* ── AVANÇADO ── */}
      {tab === 'avancado' && (
        !hasData ? <div className="empty-state"><p>Adicione robôs na aba Composição.</p></div> : (
          <>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 14px' }}>
              <label style={{ fontSize:13, color:'var(--text-muted)' }}>Dias com perda acima de R$</label>
              <input type="number" value={thresholdX} onChange={e => setThresholdX(parseFloat(e.target.value)||0)}
                style={{ width:100, padding:'4px 8px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)', fontSize:13 }}/>
            </div>
            <div className="metrics-grid">
              <MetricCard label="Rent. média mensal" value={metrics.capital ? fmtPct((extMetrics.avgMonthly||0)/metrics.capital*100) : '—'} cls={(extMetrics.avgMonthly||0)>=0?'pos':'neg'} sub={fmtR(extMetrics.avgMonthly||0)+'/mês'}/>
              <MetricCard label="Dias positivos" value={fmtNum(extMetrics.pctPosDays||0,1)+'%'} cls={(extMetrics.pctPosDays||0)>=50?'pos':'neg'} sub={`Payoff diário: ${fmtNum((extMetrics.avgDayPos||0)/Math.abs(extMetrics.avgDayNeg||1))}`}/>
              <MetricCard label="Pior dia" value={fmtR(extMetrics.worstDay||0)} cls="neg" sub={`Melhor: ${fmtR(extMetrics.bestDay||0)}`}/>
              <MetricCard label="Pior mês" value={fmtR(extMetrics.worstMonth||0)} cls="neg" sub={`Melhor: ${fmtR(extMetrics.bestMonth||0)}`}/>
              <MetricCard label={`Dias piores que R$ ${thresholdX}`} value={fmtNum(extMetrics.pctDaysAboveX||0,1)+'%'} cls={(extMetrics.pctDaysAboveX||0)>10?'neg':''} sub={`${extMetrics.daysAboveX||0} dias`}/>
              <MetricCard label="Volatilidade diária" value={fmtR(extMetrics.stdDay||0)} sub="Desvio padrão diário"/>
              <MetricCard label="Volatilidade mensal" value={fmtR(extMetrics.volMonthly||0)} sub="σ diária × √21"/>
              <MetricCard label="Total de lotes" value={extMetrics.totalLots||0} sub={`${selected.length} robôs`}/>
              <MetricCard label="Meses positivos" value={fmtNum(extMetrics.pctPosMonths||0,1)+'%'} cls={(extMetrics.pctPosMonths||0)>=50?'pos':'neg'} sub={`${extMetrics.nMonths||0} meses no total`}/>
              <MetricCard label="Fat. recuperação" value={fmtNum(metrics.fatRec||0)} cls={(metrics.fatRec||0)>=1?'pos':'neg'} sub={`${fmtNum(metrics.fatRecAnual||0)}/ano`}/>
              {targetMonthly && (
                <MetricCard label="Meta mensal" value={fmtR(parseFloat(targetMonthly))} cls="" sub={`Atual: ${fmtPct(((extMetrics.avgMonthly||0)/parseFloat(targetMonthly))*100)} da meta`}/>
              )}
              <MetricCard label="Período analisado" value={fmtNum(metrics.anos||0,1)+' anos'} sub={`${metrics.nOps||0} operações`}/>
              {(() => {
                const wp = extMetrics.stagWorstPeriod
                const range = wp ? `${wp.start} → ${wp.end}` : '—'
                const cap = metrics.capital || 1
                const lossPct = ((extMetrics.stagAvgLoss||0)/cap)*100
                return (<>
                  <MetricCard label="Estagnação máxima" value={`${extMetrics.stagWorstDays||0} dias`} cls="neg" sub={range}/>
                  <MetricCard label="Estagnação média" value={`${extMetrics.stagAvgDays||0} dias`} sub={`${extMetrics.stagPeriods?.length||0} períodos de DD`}/>
                  <MetricCard label="Loss médio em estagnação" value={fmtR(extMetrics.stagAvgLoss||0)} cls="neg" sub={`${fmtNum(lossPct,1)}% do capital`}/>
                </>)
              })()}
              {/* Item 2: Média de contratos operados por mês */}
              {(() => {
                const nMonths = extMetrics.nMonths || 0
                if (!nMonths) return null
                // Soma de lotes × ops por robô / nº de meses
                let totalContracts = 0
                selected.forEach(s => {
                  const rd = robotData[s.robotId]
                  if (rd) totalContracts += (rd.adjOps?.length || 0) * (s.lots || 0)
                })
                const avgPerMonth = totalContracts / nMonths
                return (
                  <MetricCard label="Contratos/mês (média)"
                    value={fmtNum(avgPerMonth, 0)}
                    sub={`${totalContracts.toLocaleString('pt-BR')} contratos · ${nMonths} meses`}/>
                )
              })()}
              {/* Item 6: DDs recuperados ≥ X% (configurável) */}
              {(() => {
                const cap = metrics.capital || 0
                if (!cap || !timeline.length) return null
                // Adapta timeline (resWeighted) para a forma esperada pelo calcRecoveryStats (resAdj)
                const ops = timeline.map(o => ({ resAdj: o.resWeighted || 0 }))
                const stats = calcRecoveryStats(ops, cap, ddRecoveryThresh)
                return (
                  <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 14px' }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>DDs recuperados ≥ {ddRecoveryThresh}%</div>
                    <div style={{ fontSize:22, fontWeight:700, color:stats.recovered>0?'var(--success)':'var(--text)' }}>
                      {stats.recovered}<span style={{ fontSize:14, color:'var(--text-muted)', fontWeight:500 }}> / {stats.total}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                      <input type="range" min="5" max="50" step="1" value={ddRecoveryThresh}
                        onChange={e => setDdRecoveryThresh(+e.target.value)}
                        style={{ flex:1, height:4 }} title="Limiar mínimo de DD%"/>
                      <span style={{ fontSize:11, color:'var(--text-muted)', minWidth:30 }}>{ddRecoveryThresh}%</span>
                    </div>
                    {stats.active>0 && <div style={{ fontSize:10, color:'var(--warning)', marginTop:2 }}>1 DD ativo (não recuperado)</div>}
                  </div>
                )
              })()}
              {/* Item 7: DDs ≥ DD atual recuperados */}
              {(() => {
                const cap = metrics.capital || 0
                const ddAtualPct = metrics.ddAtualPct || 0
                if (!cap || ddAtualPct <= 0 || !timeline.length) return null
                const ops = timeline.map(o => ({ resAdj: o.resWeighted || 0 }))
                const stats = calcRecoveryStats(ops, cap, ddAtualPct)
                return (
                  <MetricCard
                    label={`DDs ≥ DD atual (${fmtNum(ddAtualPct,1)}%)`}
                    value={`${stats.recovered} / ${stats.total}`}
                    cls={stats.recovered>0?'pos':'neg'}
                    sub={stats.recovered>0
                      ? `${stats.recovered} de ${stats.total} já se recuperaram`
                      : `Nenhum DD desse tamanho foi recuperado`}/>
                )
              })()}
            </div>

            {/* Curva de capital com todos os períodos de estagnação */}
            <div className="chart-card" style={{ marginTop:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div className="chart-title" style={{ marginBottom:0 }}>Curva de capital — todos os períodos de estagnação</div>
                <div style={{ display:'flex', gap:14, fontSize:11, color:'var(--text-muted)' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ width:18, height:2, background:'rgba(245,158,11,0.6)', display:'inline-block', borderRadius:1 }}/>
                    Pior estagnação
                  </span>
                  <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ width:18, height:2, background:'rgba(52,212,126,0.4)', display:'inline-block', borderRadius:1 }}/>
                    Recuperada
                  </span>
                </div>
              </div>
              <div style={{ position:'relative', height:200 }}>
                <canvas id="adv-equity-canvas" role="img" aria-label="Curva de capital com estagnações"/>
              </div>
              <div style={{ marginTop:5, fontSize:11, color:'var(--text-hint)' }}>
                Exibindo períodos com perda ≥ {ddRecoveryThresh}% do capital
                {extMetrics.stagWorstPeriod && ` · pior: ${extMetrics.stagWorstDays}d (${extMetrics.stagWorstPeriod.start} → ${extMetrics.stagWorstPeriod.end})`}
                {' · '}{extMetrics.stagPeriods?.length || 0} total detectados
              </div>
            </div>
          </>
        )
      )}
      {tab === 'correlacao' && (
        !hasData || selected.length < 2
          ? <div className="empty-state"><p>Adicione ao menos 2 robôs para ver a correlação.</p></div>
          : (
            <>
              <div className="card" style={{ marginBottom:12 }}>
                <div style={{ fontWeight:600, marginBottom:12 }}>Matriz de correlação (Pearson · PnL diário)</div>
                {corrMatrix && (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ fontSize:12, borderCollapse:'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ padding:'6px 10px', textAlign:'left', background:'var(--bg)', fontSize:11 }}></th>
                          {corrMatrix.names.map((n,i) => <th key={i} style={{ padding:'6px 10px', fontSize:11, fontWeight:500, color:'var(--text-muted)', maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {corrMatrix.matrix.map((row,i) => (
                          <tr key={i}>
                            <td style={{ padding:'6px 10px', fontWeight:500, fontSize:12, whiteSpace:'nowrap', color:'var(--text)' }}>{corrMatrix.names[i]}</td>
                            {row.map((v,j) => (
                              <td key={j} style={{ padding:'6px 12px', textAlign:'center', background: i===j?'var(--bg)':corrToColor(v, 0.65), fontWeight: i===j?400:Math.abs(v)>0.5?600:400, color: i===j?'var(--text-muted)':corrToTextColor(v), borderRadius:4 }}>
                                {i===j ? '—' : v.toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>Escala:</span>
                      <div style={{ display:'flex', height:12, width:180, borderRadius:4, overflow:'hidden' }}>
                        {Array.from({length:20}).map((_,i) => {
                          const v = -1 + i * 0.1
                          return <div key={i} style={{ flex:1, background: corrToColor(v, 0.75) }}/>
                        })}
                      </div>
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>-1 (diversif.) → 0 (neutro) → +1 (alta correl.)</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="card">
                <div style={{ fontWeight:600, marginBottom:12 }}>Dispersão entre par</div>
                <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>Par:</span>
                  {[0,1].map(idx => (
                    <select key={idx} value={scatterPair?scatterPair[idx]:''} onChange={e => setScatterPair(prev => { const p=[...(prev||[null,null])]; p[idx]=parseInt(e.target.value); return p })}
                      style={{ fontSize:13, padding:'4px 8px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)' }}>
                      {selected.map(s => <option key={s.robotId} value={s.robotId}>{robotData[s.robotId]?.robot.name||s.robotId}</option>)}
                    </select>
                  ))}
                  {scatterPair && corrMatrix && (() => {
                    const iA = corrMatrix.ids.indexOf(String(scatterPair[0]))
                    const iB = corrMatrix.ids.indexOf(String(scatterPair[1]))
                    const corr = iA>=0&&iB>=0 ? corrMatrix.matrix[iA][iB] : null
                    return corr!==null ? <span style={{ fontSize:13, fontWeight:600, color:Math.abs(corr)>0.5?'var(--danger)':'var(--success)' }}>r = {corr.toFixed(3)}</span> : null
                  })()}
                </div>
                <div style={{ position:'relative', height:280 }}><canvas id="pc-scatter" role="img" aria-label="Dispersão"/></div>
              </div>

              {/* ── Correlação de Estagnação ── */}
              {(() => {
                // Para cada par de robôs, calcula sobreposição de períodos de estagnação
                // Índice 0-100: 0=nunca juntos, 100=sempre juntos
                const entries = selected.filter(s => robotData[s.robotId]?.adjOps?.length)
                if (entries.length < 2) return null

                // Para cada robô, gera set de datas em estagnação
                const stagDays = {}
                entries.forEach(s => {
                  const adj = robotData[s.robotId].adjOps
                  const name = robotData[s.robotId].robot?.name || `R${s.robotId}`
                  // Percorre ops e marca dias em drawdown (abaixo do pico)
                  let acc = 0, peak = 0
                  const days = new Set()
                  adj.forEach(o => {
                    acc += o.resAdj
                    if (acc > peak) peak = acc
                    if (peak - acc > 0) {
                      const d = o.abertura?.split(' ')[0]
                      if (d) days.add(d)
                    }
                  })
                  stagDays[s.robotId] = { name, days }
                })

                // Calcula índice par-a-par
                const n = entries.length
                const matrix = []
                for (let i = 0; i < n; i++) {
                  const row = []
                  for (let j = 0; j < n; j++) {
                    if (i === j) { row.push(100); continue }
                    const dA = stagDays[entries[i].robotId].days
                    const dB = stagDays[entries[j].robotId].days
                    const intersection = [...dA].filter(d => dB.has(d)).length
                    const union = new Set([...dA, ...dB]).size
                    const idx = union > 0 ? Math.round(intersection / union * 100) : 0
                    row.push(idx)
                  }
                  matrix.push(row)
                }
                const names = entries.map(s => stagDays[s.robotId].name)

                // Média geral (off-diagonal)
                let sum = 0, cnt = 0
                for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) { sum += matrix[i][j]; cnt++ }
                const avgIdx = cnt ? Math.round(sum / cnt) : 0
                const idxColor = avgIdx < 25 ? 'var(--success)' : avgIdx < 50 ? '#f5a623' : 'var(--danger)'
                const idxLabel = avgIdx < 25 ? 'Excelente — estagnações raramente simultâneas'
                  : avgIdx < 50 ? 'Moderado — alguma sobreposição de estagnação'
                  : 'Alto — estagnações frequentemente simultâneas'

                const cellColor = (v) => {
                  if (v === 100) return 'var(--border)'
                  if (v < 20) return 'rgba(52,212,126,0.25)'
                  if (v < 40) return 'rgba(79,142,247,0.2)'
                  if (v < 60) return 'rgba(245,166,35,0.25)'
                  return 'rgba(240,96,96,0.3)'
                }

                return (
                  <div className="card" style={{ marginTop:16 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                      <div style={{ fontWeight:600, fontSize:14 }}>Índice de Correlação de Estagnação</div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:24, fontWeight:800, color:idxColor }}>{avgIdx}</div>
                          <div style={{ fontSize:10, color:'var(--text-hint)' }}>média geral / 100</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize:12, color:idxColor, fontWeight:600, marginBottom:12 }}>{idxLabel}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:12 }}>
                      Índice de Jaccard: % de dias que ambas estratégias estão em drawdown simultaneamente.
                      0 = nunca juntas · 100 = sempre juntas. Quanto menor, mais eficiente a diversificação.
                    </div>

                    {/* Mini barra de progresso geral */}
                    <div style={{ height:8, background:'var(--border)', borderRadius:4, overflow:'hidden', marginBottom:16 }}>
                      <div style={{ height:'100%', width:`${avgIdx}%`, background: avgIdx<25?'#34d47e':avgIdx<50?'#f5a623':'#f06060', borderRadius:4, transition:'width .4s' }}/>
                    </div>

                    {/* Matriz */}
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ borderCollapse:'collapse', fontSize:12 }}>
                        <thead>
                          <tr>
                            <th style={{ padding:'6px 10px', textAlign:'left', color:'var(--text-muted)', fontWeight:500, minWidth:120 }}></th>
                            {names.map((nm,i) => (
                              <th key={i} style={{ padding:'6px 8px', fontSize:10, fontWeight:500, color:'var(--text-muted)', maxWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'center' }}>{nm}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {matrix.map((row, i) => (
                            <tr key={i}>
                              <td style={{ padding:'4px 10px', fontSize:11, color:'var(--text)', fontWeight:500, whiteSpace:'nowrap' }}>{names[i]}</td>
                              {row.map((v, j) => (
                                <td key={j} style={{ padding:'6px 8px', textAlign:'center', background:cellColor(v), borderRadius:4, fontWeight: v===100?400:600, color: v===100?'var(--text-hint)':v<30?'var(--success)':v<60?'#f5a623':'var(--danger)' }}>
                                  {v === 100 ? '—' : v}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ marginTop:10, display:'flex', gap:16, fontSize:10, color:'var(--text-hint)' }}>
                      {[['< 20','Verde · raramente juntas'],['20–40','Azul · baixa sobreposição'],['40–60','Âmbar · sobreposição moderada'],['> 60','Vermelho · frequentemente juntas']].map(([range,label])=>(
                        <span key={range}><b>{range}</b>: {label}</span>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </>
          )
      )}

      {/* ── RECOMENDAÇÕES IA ── */}
      {tab === 'recomendacoes' && (
        <AIRecommendations metrics={metrics} extMetrics={extMetrics} exposureData={exposureData} rankingData={rankingData} corrMatrix={corrMatrix} selected={selected} robotData={robotData} />
      )}

      {/* ── AVALIAÇÃO (Score Scherman) ── */}
      {tab === 'avaliacao' && (
        !hasData
          ? <div className="empty-state"><p>Adicione robôs na aba Composição.</p></div>
          : <AvaliacaoTab
              corrMatrix={corrMatrix}
              selected={selected}
              robotData={robotData}
              metrics={metrics}
              extMetrics={extMetrics}
            />
      )}

      {/* ── GESTOR (comparativo CDI/IBOV/benchmarks) ── */}
      {tab === 'gestor' && (
        !hasData
          ? <div className="empty-state"><p>Adicione robôs na aba Composição.</p></div>
          : <GestorPage inline={true} inlineData={(() => {
              const monthly = {}, capital = metrics.capital || 1
              timeline.forEach(o => {
                const pts = o.abertura?.split(' ')[0]?.split('/')
                if (pts?.length===3) { const k=`${pts[2]}-${pts[1]}`; monthly[k]=(monthly[k]||0)+o.resWeighted }
              })
              const monthlyPct = {}
              Object.entries(monthly).forEach(([k,v]) => { monthlyPct[k] = (v/capital)*100 })
              return { monthly, monthlyPct, capital, name: portfolioName, multiplier }
            })()} />
      )}

      {/* ── RANKING ── */}
      {tab === 'ranking' && (
        !hasData ? <div className="empty-state"><p>Adicione robôs na aba Composição.</p></div> : (
          <>
            <div className="card" style={{ marginBottom:12 }}>
              <div style={{ fontWeight:600, marginBottom:4 }}>Score composto</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>M.6015 (30%) · FL (22%) · DD máximo (22%) · Sharpe (14%) · Paper trading (12%)</div>
              <div style={{ position:'relative', height: Math.max(180, rankingData.length * 44) }}>
                <canvas id="pc-ranking" role="img" aria-label="Ranking"/>
              </div>
            </div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr><th>#</th><th>Robô</th><th>Score</th><th>Lotes</th><th>FL</th><th>M.6015</th><th>Acerto</th><th>DD máx.</th><th>Sharpe</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {rankingData.map((r, i) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight:700, color: i===0?'var(--success)':i===1?'var(--accent)':'var(--text-muted)' }}>{i+1}º</td>
                      <td style={{ fontWeight:500 }}>{r.name}</td>
                      <td style={{ fontWeight:700, color: r.score>=3?'var(--success)':r.score>=2?'var(--warning)':'var(--danger)' }}>{r.score}</td>
                      <td>{r.lots}</td>
                      <td className={(r.m.profitFactor||0)>=1?'pos':'neg'}>{fmtNum(Math.min(r.m.profitFactor||0,99))}</td>
                      <td className={(r.m.m6015||0)>3?'pos':(r.m.m6015||0)>1?'':'neg'}>{fmtNum(r.m.m6015||0)}</td>
                      <td className={(r.m.winRate||0)>=50?'pos':'neg'}>{fmtNum(r.m.winRate||0,1)}%</td>
                      <td className="neg">{fmtPct(-(r.m.ddMaxPct||0))}</td>
                      <td className={(r.m.sharpe||0)>1?'pos':'neg'}>{fmtNum(r.m.sharpe||0)}</td>
                      <td>
                        <span className={`badge ${r.score>=3?'green':r.score>=2?'warn':'red'}`}>
                          {r.score>=3?'Forte':r.score>=2?'Regular':'Fraco'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </div>
  )
}

function MetricCard({ label, value, cls='', sub }) {
  return (
    <div className="metric">
      <div className="lbl">{label}</div>
      <div className={`val ${cls}`}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}
