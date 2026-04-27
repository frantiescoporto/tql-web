import React, { useState, useEffect, useRef } from 'react'
import { useData } from '../context/DataContext.jsx'
import PlatformBadge from '../components/PlatformBadge'
import { useParams, useNavigate } from 'react-router-dom'
import {
  buildAdjOps, calcMetrics, filterByPeriod, calcPeriodMetrics,
  buildMonthlyData, buildYearlyData, buildHourlyData, buildSideData,
  calcRecoveredDD, calcRollingPF, calcStreaks, calcByWeekday,
  calcRecoveryStats,
  fmtR, fmtPct, fmtNum, calcMonteCarlo, calcRobotScore
} from '../lib/analytics'
import { calcStagnation } from '../lib/stagnation'

import RealOpsTab from '../components/RealOpsTab'
import CalendarioMensal from '../components/CalendarioMensal'
import { buildEquityWithDrawdown, logoWatermarkPlugin, getChartColors, corrToColor, corrToTextColor, makeEquityGradient, makeStagnationPlugin } from '../lib/chartBuilder'
import { Chart, registerables } from 'chart.js'


Chart.register(...registerables)

export default function RobotDetail() {
  const { getRobot, portfolios } = useData()
  const { id } = useParams()
  const navigate = useNavigate()

  const [robot, setRobot] = useState(null)
  const [adjOps, setAdjOps] = useState([])
  const [metrics, setMetrics] = useState({})
  const [tab, setTab] = useState('overview')
  const [desagio, setDesagio] = useState(0)
  const [tipo, setTipo] = useState('backtest')
  const [name, setName] = useState('')
  const [periods, setPeriods] = useState({})
  const [savingPeriods, setSavingPeriods] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [strategyType, setStrategyType] = useState('')
  const [timeframe, setTimeframe] = useState('')
  const [observation, setObservation] = useState('')
  const [savingObs, setSavingObs] = useState(false)
  const [mcResult, setMcResult] = useState(null)
  const [showPDFModal, setShowPDFModal] = useState(false)
  const [pdfSections, setPDFSections] = useState({ visaoGeral: true, graficos: false, operacoes: false, contaReal: false, validacao: true, periodos: false })
  const [robotScore, setRobotScore] = useState(null)
  const [ddRecoveryThresh, setDdRecoveryThresh] = useState(10)
  const [monthlyYear, setMonthlyYear] = useState('all')  // 'all' | '2024' | '2023' etc
  // Situação
  const [conta, setConta] = useState([])  // array de {plataforma, conta}
  const [portfoliosList, setPortfoliosList] = useState([])
  const [platform, setPlatform] = useState('profit')
  const [rollingWindow, setRollingWindow] = useState(50)
  const [sideFilter, setSideFilter] = useState('all') // 'all' | 'C' | 'V'
  const sideFilterRef = React.useRef('all')
  const adjOpsRef = React.useRef([])
  const charts = useRef({})

  const load = () => {
    const r = getRobot(parseInt(id))
    if (!r) { navigate('/robots'); return }
    setRobot(r)
    setName(r.name)
    setTipo(r.tipo || 'backtest')
    setDesagio(r.desagio || 0)
    setStrategyType(r.strategy_type || '')
    setTimeframe(r.timeframe || '')
    setObservation(r.observation || '')
    setPlatform(r.platform || 'profit')
    setConta([])
    setPeriods(r.periods || {})
    // Filtrar portfólios que contêm este robô
    const robotIdNum = r.id
    const myPortfolios = (portfolios || []).filter(p => {
      try {
        const cfg = typeof p.robots_config === 'string' ? JSON.parse(p.robots_config) : (p.robots_config || {})
        const list = Array.isArray(cfg) ? cfg : (cfg.robots || [])
        // eslint-disable-next-line eqeqeq
        return list.some(s => s.robotId == robotIdNum)
      } catch { return false }
    })
    setPortfoliosList(myPortfolios)
    const adj = buildAdjOps(r.operations, r.desagio || 0, r.tipo || 'backtest')
    setAdjOps(adj)
    const m = calcMetrics(adj, r.desagio || 0, r.tipo || 'backtest')
    // Add monthly return
    if (m && m.anos > 0) m.rentMensal = (m.rentPct || 0) / (m.anos * 12)
    const { recoveredMaxDD, currentDD } = calcRecoveredDD(adj)

    const capitalRecovered = recoveredMaxDD * 2
    setMetrics({
      ...m,
      recoveredMaxDD,
      currentDD,
      capitalRecovered,
      capital: capitalRecovered || m.capital,
      ddAtual: currentDD,
      ddAtualPct: capitalRecovered > 0 ? currentDD / capitalRecovered * 100 : m.ddAtualPct,
      ddMaxPct: capitalRecovered > 0 ? recoveredMaxDD / capitalRecovered * 100 : m.ddMaxPct,
      rentPct: capitalRecovered > 0 ? m.totalBruto / capitalRecovered * 100 : m.rentPct,
    })
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (!robot) return
    const adj = buildAdjOps(robot.operations, desagio, tipo)
    setAdjOps(adj)
    const m = calcMetrics(adj, desagio, tipo)
    const { recoveredMaxDD, currentDD } = calcRecoveredDD(adj)
    const capitalRecovered = recoveredMaxDD * 2
    setMetrics({
      ...m,
      recoveredMaxDD,
      currentDD,
      capitalRecovered,
      capital: capitalRecovered || m.capital,
      ddAtual: currentDD,
      ddAtualPct: capitalRecovered > 0 ? currentDD / capitalRecovered * 100 : m.ddAtualPct,
      ddMaxPct: capitalRecovered > 0 ? recoveredMaxDD / capitalRecovered * 100 : m.ddMaxPct,
      rentPct: capitalRecovered > 0 ? m.totalBruto / capitalRecovered * 100 : m.rentPct,
    })
  }, [desagio, tipo])

  const destroyChart = (key) => {
    if (charts.current[key]) { charts.current[key].destroy(); delete charts.current[key] }
  }

  const saveChart = (key, instance) => {
    destroyChart(key)
    charts.current[key] = instance
  }

  const destroyAllCharts = () => {
    Object.keys(charts.current).forEach(key => {
      try { charts.current[key].destroy() } catch(e) {}
      delete charts.current[key]
    })
    const canvasIds = ['c-equity','c-equity-dd','c-dist','c-monthly','c-dd','c-bar','c-yearly','c-hourly','c-side','c-streaks','c-weekday','c-rolling-pf','c-period-monthly']
    canvasIds.forEach(cid => {
      const el = document.getElementById(cid)
      if (el) { const ex = Chart.getChart(el); if (ex) ex.destroy() }
    })
  }

  // Monte Carlo + Score — compute whenever adjOps changes
  useEffect(() => {
    if (!adjOps.length) return
    const capital = metrics?.capital || metrics?.recoveredMaxDD * 2 || 1000
    const mc = calcMonteCarlo(adjOps, capital, 1000, 0.50)
    setMcResult(mc)
    const sc = calcRobotScore(metrics, periods, adjOps, mc)
    // Look up rank position from global ranking (computed in App.jsx)
    const ranking = window.__ranking__ || []
    const rankEntry = ranking.find(r => r.id === parseInt(id))
    if (rankEntry) {
      sc.rankPosition = rankEntry.rank
      sc.rankTotal = ranking.length
    } else {
      sc.rankTotal = ranking.length || null
    }
    setRobotScore(sc)
  }, [adjOps])

  useEffect(() => {
    if (!adjOps.length || tab !== 'overview') return
    destroyAllCharts()
    const t = setTimeout(() => { renderEquity(); renderDistribution(); renderMonthly(monthlyYear) }, 50)
    return () => clearTimeout(t)
  }, [adjOps, tab])

  const filteredForCharts = sideFilter === 'all' ? adjOps : adjOps.filter(o => o.lado === sideFilter)
  sideFilterRef.current = sideFilter
  adjOpsRef.current = adjOps

  useEffect(() => {
    if (!adjOps.length || tab !== 'charts') return
    destroyAllCharts()
    const t = setTimeout(() => {
      renderDrawdown(); renderBar(); renderYearly(); renderHourly(); renderSide()
      renderStreaks(); renderWeekday(); renderRollingPF(); renderPeriodMonthly()
      renderRealEquity()
    }, 50)
    return () => clearTimeout(t)
  }, [adjOps, tab, rollingWindow, sideFilter])

  useEffect(() => { return () => destroyAllCharts() }, [])

  const getColors = () => {
    const d = window.matchMedia('(prefers-color-scheme: dark)').matches
    return {
      pos: d ? '#4ade80' : '#16a34a',
      neg: d ? '#f87171' : '#dc2626',
      blue: d ? '#60a5fa' : '#2563eb',
      purple: d ? '#a78bfa' : '#7c3aed',
      gray: d ? '#6b7280' : '#9ca3af',
      grid: d ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
      text: d ? '#9ca3af' : '#6b7280',
    }
  }

  const chartOpts = (yFmt = null) => {
    const c = getColors()
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: c.text, maxTicksLimit: 10, font: { size: 11 } }, grid: { color: c.grid } },
        y: { ticks: { color: c.text, callback: yFmt || (v => 'R$ ' + v.toLocaleString('pt-BR')), font: { size: 11 } }, grid: { color: c.grid } }
      }
    }
  }

  const mkCanvas = (id) => document.getElementById(id)

  const renderEquity = () => {
    const el = mkCanvas('c-equity'); if (!el) return
    const elDD = mkCanvas('c-equity-dd')
    const c = getColors()
    const labels = adjOps.map(o => o.abertura.slice(0, 10))
    const equityData = adjOps.map(o => +o.totalAdj.toFixed(2))
    const stag = calcStagnation(adjOps)
    const stagPlugin = makeStagnationPlugin(stag.periods, labels)
    // logoPlugin removed
    saveChart('equity', new Chart(el, {
      type: 'line', plugins: [stagPlugin, {
        id: 'peakMarker',
        afterDraw(chart) {
          const ds = chart.data.datasets[0]
          if (!ds) return
          const data = ds.data
          const maxVal = Math.max(...data)
          const maxIdx = data.indexOf(maxVal)
          if (maxIdx < 0) return
          const { ctx, chartArea, scales: { x, y } } = chart
          const px = x.getPixelForValue(maxIdx)
          const py = y.getPixelForValue(maxVal)
          ctx.save()
          // Vertical dashed line
          ctx.setLineDash([4, 3])
          ctx.strokeStyle = 'rgba(34,197,94,0.5)'
          ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(px, chartArea.top); ctx.lineTo(px, py); ctx.stroke()
          ctx.setLineDash([])
          // Circle at peak
          ctx.beginPath()
          ctx.arc(px, py, 6, 0, Math.PI * 2)
          ctx.fillStyle = '#22c55e'
          ctx.fill()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          ctx.stroke()
          // Label
          const label = chart.data.labels[maxIdx]
          const valLabel = 'R$ ' + maxVal.toLocaleString('pt-BR', {maximumFractionDigits:2})
          ctx.font = 'bold 11px sans-serif'
          ctx.fillStyle = '#22c55e'
          ctx.textAlign = px > chartArea.right - 120 ? 'right' : 'left'
          const tx = px > chartArea.right - 120 ? px - 10 : px + 10
          ctx.fillText('Pico: ' + valLabel, tx, py - 10)
          ctx.font = '10px sans-serif'
          ctx.fillStyle = 'rgba(34,197,94,0.8)'
          ctx.fillText(label, tx, py + 2)
          ctx.restore()
        }
      }],
      data: {
        labels,
        datasets: [{
          data: equityData,
          borderColor: '#22c55e',
          backgroundColor: (ctx) => {
            if (!ctx.chart.chartArea) return 'rgba(34,197,94,0.1)'
            const g = ctx.chart.ctx.createLinearGradient(0, ctx.chart.chartArea.top, 0, ctx.chart.chartArea.bottom)
            g.addColorStop(0, 'rgba(34,197,94,0.35)'); g.addColorStop(0.6, 'rgba(34,197,94,0.08)'); g.addColorStop(1, 'rgba(34,197,94,0.01)')
            return g
          },
          fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: c.text, maxTicksLimit: 10 }, grid: { color: c.grid } },
          y: { ticks: { color: c.text, callback: v => 'R$ '+v.toLocaleString('pt-BR') }, grid: { color: c.grid } }
        }
      }
    }))
    if (elDD) {
      let a2=0, pk=0
      const ddData = adjOps.map(o => { a2+=o.resAdj; if(a2>pk) pk=a2; return metrics.capital>0?+((-(pk-a2)/metrics.capital*100).toFixed(2)):0 })
      saveChart('equity-dd', new Chart(elDD, {
        type: 'line', plugins: [],
        data: { labels, datasets: [{ data: ddData, borderColor: 'rgb(239,68,68)',
          backgroundColor: (ctx) => {
            if (!ctx.chart.chartArea) return 'rgba(239,68,68,0.2)'
            const g = ctx.chart.ctx.createLinearGradient(0, ctx.chart.chartArea.top, 0, ctx.chart.chartArea.bottom)
            g.addColorStop(0,'rgba(239,68,68,0.65)'); g.addColorStop(0.5,'rgba(239,68,68,0.25)'); g.addColorStop(1,'rgba(239,68,68,0.03)')
            return g
          },
          fill: 'origin', tension: 0.2, pointRadius: 0, borderWidth: 1.5 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
          scales: { x: { ticks: { color: c.text, maxTicksLimit: 10 }, grid: { color: c.grid } },
            y: { max: 0, ticks: { color: c.text, callback: v => v.toFixed(1)+'%' }, grid: { color: c.grid } } } }
      }))
    }
  }

  const renderDistribution = () => {
    const el = mkCanvas('c-dist'); if (!el) return
    const c = getColors()
    const wins = adjOps.filter(o => o.resAdj > 0).length
    const losses = adjOps.filter(o => o.resAdj < 0).length
    const neutral = adjOps.filter(o => o.resAdj === 0).length
    saveChart('dist', new Chart(el, {
      type: 'doughnut',
      data: { labels: ['Vencedoras', 'Perdedoras', 'Neutras'], datasets: [{ data: [wins, losses, neutral], backgroundColor: [c.pos, c.neg, c.gray], borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true, position: 'bottom',
            labels: { color: c.text, font: { size: 9 }, boxWidth: 8, boxHeight: 8, padding: 6 }
          }
        }
      }
    }))
  }

  const renderMonthly = (yearFilter) => {
    const el = mkCanvas('c-monthly'); if (!el) return
    const c = getColors()
    const { labels: allLabels, data: allData } = buildMonthlyData(adjOps)
    // Labels são MM/AA (ex: "03/25") — filtrar pelos 2 últimos dígitos do ano
    let labels = allLabels, data = allData
    if (yearFilter && yearFilter !== 'all') {
      const yy = yearFilter.slice(2) // '2025' → '25'
      const filtered = allLabels.map((l, i) => ({ l, v: allData[i] })).filter(({ l }) => l.endsWith('/' + yy))
      labels = filtered.map(f => f.l)
      data = filtered.map(f => f.v)
    }
    if (!labels.length) return
    const avg = data.reduce((a, b) => a + b, 0) / data.length
    saveChart('monthly', new Chart(el, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Resultado',
            data,
            backgroundColor: data.map(v => v >= 0 ? c.pos + 'bb' : c.neg + 'bb'),
            borderWidth: 0,
            order: 2,
          },
          {
            type: 'line',
            label: `Média: ${fmtR(avg)}`,
            data: labels.map(() => avg),
            borderColor: c.text + '80',
            borderWidth: 1.5,
            borderDash: [4, 3],
            pointRadius: 0,
            fill: false,
            order: 1,
          },
        ]
      },
      options: {
        ...chartOpts(),
        plugins: {
          ...chartOpts().plugins,
          legend: { display: true, labels: { color: c.text, boxWidth: 20, font: { size: 10 },
            filter: item => item.text !== 'Resultado'  // oculta label redundante das barras
          } },
        },
        scales: {
          ...chartOpts().scales,
          x: { ...chartOpts().scales.x, ticks: { ...chartOpts().scales.x.ticks, maxRotation: 45, autoSkip: false } }
        }
      }
    }))
  }

  useEffect(() => {
    if (!adjOps.length || tab !== 'overview') return
    const t = setTimeout(() => renderMonthly(monthlyYear), 30)
    return () => clearTimeout(t)
  }, [monthlyYear, tab])

  const renderDrawdown = () => {
    const el = mkCanvas('c-dd'); if (!el) return
    const c = getColors()
    const ops = sideFilterRef.current === 'all' ? adjOpsRef.current : adjOpsRef.current.filter(o => o.lado === sideFilterRef.current)
    const cap = metrics.capital || 1
    let acc = 0, peak = 0
    const ddFinancial = []
    ops.forEach(o => {
      acc += o.resAdj; if (acc > peak) peak = acc
      ddFinancial.push(+(-(peak - acc)).toFixed(2))
    })
    saveChart('dd', new Chart(el, {
      type: 'line',
      data: {
        labels: ops.map(o => o.abertura.slice(0, 10)),
        datasets: [{ data: ddFinancial, borderColor: c.neg, backgroundColor: c.neg + '22', fill: true, tension: 0.2, pointRadius: 0, borderWidth: 1.5 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.raw
                const pct = cap > 0 ? (v/cap*100).toFixed(1) : '0.0'
                return `R$ ${v.toLocaleString('pt-BR', {minimumFractionDigits:2})} (${pct}%)`
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: c.text, maxTicksLimit: 10 }, grid: { color: c.grid } },
          y: { ticks: { color: c.text, callback: v => {
            const pct = cap > 0 ? (v/cap*100).toFixed(0) : '0'
            return 'R$ '+Math.abs(v).toLocaleString('pt-BR',{maximumFractionDigits:0})+' ('+pct+'%)'
          }}, grid: { color: c.grid } }
        }
      }
    }))
  }

  const renderBar = () => {
    const el = mkCanvas('c-bar'); if (!el) return
    const c = getColors()
    const opsBar = sideFilterRef.current === 'all' ? adjOpsRef.current : adjOpsRef.current.filter(o => o.lado === sideFilterRef.current)
    const data = opsBar.map(o => +o.resAdj.toFixed(2))
    saveChart('bar', new Chart(el, {
      type: 'bar',
      data: { labels: adjOps.map(o => '#' + o.num), datasets: [{ data, backgroundColor: data.map(v => v >= 0 ? c.pos + 'cc' : c.neg + 'cc'), borderWidth: 0 }] },
      options: { ...chartOpts(), scales: { ...chartOpts().scales, x: { ticks: { maxTicksLimit: 20, color: getColors().text, font: { size: 9 } }, grid: { display: false } }, y: chartOpts().scales.y } }
    }))
  }

  const renderYearly = () => {
    const el = mkCanvas('c-yearly'); if (!el) return
    const c = getColors()
    const ops2 = sideFilterRef.current === 'all' ? adjOpsRef.current : adjOpsRef.current.filter(o => o.lado === sideFilterRef.current)
    const { labels, data } = buildYearlyData(ops2)
    saveChart('yearly', new Chart(el, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: data.map(v => v >= 0 ? c.pos + 'cc' : c.neg + 'cc'), borderWidth: 0 }] },
      options: chartOpts()
    }))
  }

  const renderHourly = () => {
    const el = mkCanvas('c-hourly'); if (!el) return
    const c = getColors()
    const ops3 = sideFilterRef.current === 'all' ? adjOpsRef.current : adjOpsRef.current.filter(o => o.lado === sideFilterRef.current)
    const { labels, totals, counts } = buildHourlyData(ops3)
    saveChart('hourly', new Chart(el, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Total R$', data: totals, backgroundColor: totals.map(v => v >= 0 ? c.pos + 'bb' : c.neg + 'bb'), borderWidth: 0 }] },
      options: chartOpts()
    }))
  }

  const renderSide = () => {
    const el = mkCanvas('c-side'); if (!el) return
    const c = getColors()
    const ops4 = sideFilterRef.current === 'all' ? adjOpsRef.current : adjOpsRef.current.filter(o => o.lado === sideFilterRef.current)
    const { labels, totals, counts } = buildSideData(ops4)
    saveChart('side', new Chart(el, {
      type: 'bar',
      data: { labels: labels.map((l, i) => `${l} (${counts[i]})`), datasets: [{ data: totals, backgroundColor: [c.blue + 'cc', c.purple + 'cc'], borderWidth: 0 }] },
      options: chartOpts()
    }))
  }

  const renderPeriodMonthly = () => {
    const el = mkCanvas('c-period-monthly'); if (!el) return
    const c = getColors()
    const pj = (() => { try { const p = periods.periods_json; if (!p) return null; return typeof p === 'string' ? JSON.parse(p) : p } catch(e) { return null } })()
    const inSamples = pj?.inSamples || (periods.in_sample_start ? [{ start: periods.in_sample_start, end: periods.in_sample_end }] : [])
    const outSamples = pj?.outSamples || (periods.out_sample_start ? [{ start: periods.out_sample_start, end: periods.out_sample_end }] : [])
    const paper = pj?.paper || (periods.paper_start ? { start: periods.paper_start, end: periods.paper_end || new Date().toISOString().slice(0,10) } : null)

    const hasPeriodConfig = inSamples.some(p => p.start) || outSamples.some(p => p.start) || paper?.start
    const toMs = s => { if (!s) return 0; const p = s.split('/'); return p.length===3?new Date(+p[2],+p[1]-1,+p[0]).getTime():new Date(s).getTime() }

    const classify = (dateStr) => {
      const t = toMs(dateStr)
      if (inSamples.some(p => p.start && t >= toMs(p.start) && (!p.end || t <= toMs(p.end)))) return 'IS'
      if (outSamples.some(p => p.start && t >= toMs(p.start) && (!p.end || t <= toMs(p.end)))) return 'OOS'
      if (paper?.start && t >= toMs(paper.start)) return 'PT'
      return hasPeriodConfig ? null : 'ALL'
    }

    const monthly = {}
    adjOpsRef.current.forEach(o => {
      const d = o.abertura.split(' ')[0]
      const parts = d.split('/')
      if (parts.length !== 3) return
      const key = `${parts[2]}-${parts[1]}`
      const period = classify(d)
      if (!period) return
      if (!monthly[key]) monthly[key] = { IS: [], OOS: [], PT: [], ALL: [] }
      monthly[key][period].push(o.resAdj)
    })

    const months = Object.keys(monthly).sort()
    if (!months.length) return
    const avgOf = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null
    const labels = months.map(m => { const [y,mo]=m.split('-'); return `${mo}/${y.slice(2)}` })

    const datasets = hasPeriodConfig ? [
      { label: 'In Sample', data: months.map(m => avgOf(monthly[m].IS)), backgroundColor: 'rgba(37,99,235,0.75)', borderWidth: 0 },
      { label: 'Out of Sample', data: months.map(m => avgOf(monthly[m].OOS)), backgroundColor: 'rgba(217,119,6,0.75)', borderWidth: 0 },
      { label: 'Paper Trading', data: months.map(m => avgOf(monthly[m].PT)), backgroundColor: 'rgba(22,163,74,0.75)', borderWidth: 0 },
    ] : [
      { label: 'Média/mês', data: months.map(m => avgOf(monthly[m].ALL)), backgroundColor: months.map(m => avgOf(monthly[m].ALL) >= 0 ? 'rgba(37,99,235,0.75)' : 'rgba(220,38,38,0.75)'), borderWidth: 0 },
    ]

    saveChart('period-monthly', new Chart(el, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: hasPeriodConfig, position: 'top', labels: { color: c.text, font: { size: 11 }, boxWidth: 10, filter: item => item.index === 0 || datasets[item.datasetIndex]?.data.some(v => v !== null) } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y !== null ? fmtR(ctx.parsed.y) : '—'}/op` } }
        },
        scales: {
          x: { ticks: { color: c.text, maxRotation: 45, font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: c.text, callback: v => 'R$ '+v.toLocaleString('pt-BR',{maximumFractionDigits:0}) }, grid: { color: c.grid } }
        }
      }
    }))
  }

  const renderStreaks = () => {
    const el = mkCanvas('c-streaks'); if (!el) return
    const c = getColors()
    const ops5 = sideFilterRef.current === 'all' ? adjOpsRef.current : adjOpsRef.current.filter(o => o.lado === sideFilterRef.current)
    const { series, maxWin, maxLoss } = calcStreaks(ops5)
    if (!series.length) return
    const labels = series.map((_, i) => `#${i+1}`)
    const data = series
    saveChart('streaks', new Chart(el, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: data.map(v => v > 0 ? c.pos+'cc' : c.neg+'cc'), borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false },
          annotation: { annotations: {
            winLine: { type: 'line', yMin: maxWin, yMax: maxWin, borderColor: c.pos, borderWidth: 1, borderDash: [4,4] },
            lossLine: { type: 'line', yMin: -maxLoss, yMax: -maxLoss, borderColor: c.neg, borderWidth: 1, borderDash: [4,4] }
          }}
        },
        scales: {
          x: { display: false, grid: { display: false } },
          y: { ticks: { color: c.text, callback: v => v > 0 ? `+${v}W` : `${Math.abs(v)}L` }, grid: { color: c.grid } }
        }
      }
    }))
  }

  const renderWeekday = () => {
    const el = mkCanvas('c-weekday'); if (!el) return
    const c = getColors()
    const ops6 = sideFilterRef.current === 'all' ? adjOpsRef.current : adjOpsRef.current.filter(o => o.lado === sideFilterRef.current)
    const wd = calcByWeekday(ops6)
    saveChart('weekday', new Chart(el, {
      type: 'bar',
      data: {
        labels: wd.map(d => `${d.label}\n${d.count} ops`),
        datasets: [
          { label: 'Total R$', data: wd.map(d => d.total), backgroundColor: wd.map(d => d.total >= 0 ? c.pos+'cc' : c.neg+'cc'), borderWidth: 0 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: c.text, font: { size: 11 } }, grid: { display: false } },
          y: { ticks: { color: c.text, callback: v => 'R$ '+v.toLocaleString('pt-BR') }, grid: { color: c.grid } }
        }
      }
    }))
  }

  const renderRollingPF = () => {
    const el = mkCanvas('c-rolling-pf'); if (!el) return
    const c = getColors()
    const ops7 = sideFilterRef.current === 'all' ? adjOpsRef.current : adjOpsRef.current.filter(o => o.lado === sideFilterRef.current)
    const rolling = calcRollingPF(ops7, rollingWindow)
    const data = rolling.map(r => r.pf)
    const labels = rolling.map(r => `#${r.num}`)
    saveChart('rolling-pf', new Chart(el, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { data, borderColor: c.blue, backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 2 },
          { data: data.map(() => 1), borderColor: c.neg+'88', borderDash: [4,4], pointRadius: 0, borderWidth: 1, backgroundColor: 'transparent' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: c.text, maxTicksLimit: 12 }, grid: { color: c.grid } },
          y: { ticks: { color: c.text }, grid: { color: c.grid }, min: 0 }
        }
      }
    }))
  }


  const handleSaveSettings = async () => {
    setSavingSettings(true)
    // Web: sem salvar (read-only)
    // web: no-op
    setSavingSettings(false)
  }

  const renderRealEquity = () => {
    const el = mkCanvas('c-real-equity'); if (!el) return
    const realOps = robot?.realOps
    if (!realOps?.length) return
    const c = getColors()
    let acc = 0
    const labels = [], data = []
    realOps.forEach(o => {
      acc += (o.res_op || 0)
      labels.push(o.abertura?.slice(0, 10) || '')
      data.push(+acc.toFixed(2))
    })
    saveChart('real-equity', new Chart(el, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: '#f5a623',
          backgroundColor: (ctx) => {
            if (!ctx.chart.chartArea) return 'rgba(245,166,35,0.1)'
            const g = ctx.chart.ctx.createLinearGradient(0, ctx.chart.chartArea.top, 0, ctx.chart.chartArea.bottom)
            g.addColorStop(0, 'rgba(245,166,35,0.3)')
            g.addColorStop(1, 'rgba(245,166,35,0.01)')
            return g
          },
          fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.8,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: c.text, maxTicksLimit: 8, font: { size: 10 } }, grid: { color: c.grid } },
          y: { ticks: { color: c.text, callback: v => 'R$ ' + v.toLocaleString('pt-BR') }, grid: { color: c.grid } },
        }
      }
    }))
  }

  const handleSavePeriods = async () => {
    setSavingPeriods(true)
    // Web: sem salvar períodos
    setSavingPeriods(false)
  }

  const periodOps = (start, end) => filterByPeriod(adjOps, start || null, end || null)

  const validationResults = () => {
    // Parse multi-period JSON
    let pj = null
    try { pj = periods.periods_json ? (typeof periods.periods_json === 'string' ? JSON.parse(periods.periods_json) : periods.periods_json) : null } catch(e) {}

    const outSamples = pj?.outSamples || [{ start: periods.out_sample_start, end: periods.out_sample_end }]
    const paperPeriod = pj?.paper || { start: periods.paper_start, end: periods.paper_end }

    // Combine all OOS periods
    const allOosOps = outSamples.flatMap(p => periodOps(p.start, p.end))
    // If paper end is blank, use today's date
    const todayISO = new Date().toISOString().slice(0, 10)
    const paperEnd = paperPeriod.end || todayISO
    const paperOps = periodOps(paperPeriod.start, paperEnd)
    const oosMet = calcPeriodMetrics(allOosOps)
    const paperMet = calcPeriodMetrics(paperOps)

    const paperVsOos = oosMet.perOp !== 0
      ? ((paperMet.perOp - oosMet.perOp) / Math.abs(oosMet.perOp)) * 100
      : null

    const hasMinReal = (() => {
      if (!paperPeriod.start) return false
      const d1 = new Date(paperPeriod.start)
      // If end is blank, use today
      const d2 = paperPeriod.end ? new Date(paperPeriod.end) : new Date()
      return (d2 - d1) / (1000 * 60 * 60 * 24 * 30.44) >= 3
    })()

    const pvalOk = metrics.pValue !== undefined ? metrics.pValue <= 0.02 : null
    const m6015Ok = metrics.m6015 !== undefined ? metrics.m6015 > 3 : null
    const desvioOk = paperVsOos !== null ? paperVsOos >= -25 : null
    const hasEnoughPaper = paperOps.length >= 3  // at least 3 months checked via hasMinReal
    const fewPaperTrades = paperOps.length > 0 && paperOps.length < 60

    // Status logic:
    // APROVADO: all OK + min 3 months real
    // APROVADO SIMULADOR: all stats OK but < 3 months real
    // EM ANÁLISE: desvio failed but < 60 paper trades
    // REPROVADO: m6015 failed OR pval failed OR desvio failed with >= 60 trades
    const m6015Val = metrics.m6015 || 0
    const m6015Cautela = pvalOk && m6015Val > 2.5 && m6015Val <= 3
    const m6015Strong = pvalOk && m6015Val > 3

    let status = 'REPROVADO'
    if (pvalOk && (m6015Ok || m6015Cautela)) {
      if (desvioOk === null || desvioOk) {
        if (m6015Strong) {
          status = hasMinReal ? 'APROVADO' : 'APROVADO_SIMULADOR'
        } else {
          // m6015 > 2.5 and <= 3
          status = hasMinReal ? 'APROVADO_CAUTELA' : 'APROVADO_SIMULADOR'
        }
      } else if (!desvioOk && fewPaperTrades) {
        status = 'EM_ANALISE'
      }
    } else if (!m6015Ok || !pvalOk) {
      status = 'REPROVADO'
    }

    return {
      oosOps: allOosOps, outSamples, paperOps, oosMet, paperMet, paperVsOos, hasMinReal,
      pvalOk, m6015Ok, desvioOk, fewPaperTrades, status,
    }
  }


  if (!robot) return <div className="empty-state">Carregando...</div>

  const vr = validationResults()

  const approved = vr.status === 'APROVADO'
  const hasValidation = periods.out_sample_start && periods.paper_start

  return (
    <div>
      <div className="page-header">
        <input
          value={name} onChange={e => setName(e.target.value)}
          style={{ fontWeight: 600, fontSize: 20, border: 'none', background: 'transparent', color: 'var(--text)', outline: 'none', borderBottom: '1.5px solid var(--border)', paddingBottom: 2, minWidth: 200 }}
        />
        <span className={`badge ${tipo === 'real' ? 'green' : 'blue'}`}>{tipo === 'real' ? 'Conta Real' : 'Backtest'}</span>
        <span className="badge gray">{robot.ativo}</span>
        <PlatformBadge platform={platform} size={20} />
        {strategyType && <span className="badge purple">{strategyType}</span>}
        {timeframe && <span className="badge gray" style={{ fontSize: 10 }}>{timeframe}</span>}
        {hasValidation && (
          <span className={`badge ${
            vr.status === 'APROVADO' ? 'green' :
            vr.status === 'APROVADO_CAUTELA' ? 'warn' :
            vr.status === 'APROVADO_SIMULADOR' ? 'purple' :
            vr.status === 'EM_ANALISE' ? 'warn' : 'red'
          }`}>
            {vr.status === 'APROVADO' ? '✓ Aprovada' :
             vr.status === 'APROVADO_CAUTELA' ? '⚠ Aprovada c/ Cautela' :
             vr.status === 'APROVADO_SIMULADOR' ? '~ Aprovada (Simulador)' :
             vr.status === 'EM_ANALISE' ? '⏳ Em análise' : '✗ Não aprovada'}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ fontSize: 13, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}>
            <option value="backtest">Backtest</option>
            <option value="real">Conta Real</option>
          </select>
          <select value={strategyType} onChange={e => setStrategyType(e.target.value)} style={{ fontSize: 13, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}>
            <option value="">Tipo...</option>
            <option value="TENDÊNCIA">Tendência</option>
            <option value="PULLBACK">Pullback</option>
            <option value="SCALPER">Scalper</option>
            <option value="REVERSÃO">Reversão</option>
            <option value="EXAUSTÃO">Exaustão</option>
          </select>
          <select value={platform} onChange={e => setPlatform(e.target.value)} title="Plataforma"
            style={{ fontSize: 13, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}>
            <option value="profit">Profit</option>
            <option value="mt5">MetaTrader 5</option>
          </select>
          <select value={['','1m','2m','3m','5m','6m','10m','15m','30m','60m','diario','semanal','21r','31r','40r'].includes(timeframe) ? timeframe : 'custom'}
            onChange={e => { if (e.target.value !== 'custom') setTimeframe(e.target.value) }}
            title="Timeframe" style={{ fontSize: 13, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}>
            <option value="">TF...</option>
            <option value="1m">1 min</option>
            <option value="2m">2 min</option>
            <option value="3m">3 min</option>
            <option value="5m">5 min</option>
            <option value="6m">6 min</option>
            <option value="10m">10 min</option>
            <option value="15m">15 min</option>
            <option value="30m">30 min</option>
            <option value="60m">60 min</option>
            <option value="diario">Diário</option>
            <option value="semanal">Semanal</option>
            <optgroup label="Renko">
              <option value="21r">21 Renkos</option>
              <option value="31r">31 Renkos</option>
              <option value="40r">40 Renkos</option>
            </optgroup>
            <option value="custom">Personalizado...</option>
          </select>
          {(!['','1m','2m','3m','5m','6m','10m','15m','30m','60m','diario','semanal','21r','31r','40r'].includes(timeframe) || timeframe === '') && (
            <input type="text" value={timeframe === '' ? '' : (!['1m','2m','3m','5m','10m','15m','30m','60m','diario','semanal'].includes(timeframe) ? timeframe : '')}
              onChange={e => setTimeframe(e.target.value)}
              placeholder="Ex: 4h, 120m..."
              style={{ width: 80, fontSize: 13, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }} />
          )}
          {tipo === 'backtest' && (
            <input type="number" step="0.1" value={desagio} onChange={e => setDesagio(e.target.value)}
              placeholder="Deságio %" title="Deságio %"
              style={{ width: 90, fontSize: 13, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }} />
          )}
          {/* PDF export removido na versão web */}
          <button style={{ display: "none" }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 1h6l3 3v8H2V1z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
              <path d="M7 1v3h3" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M4 7h5M4 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            PDF
          </button>

        </div>
      </div>

      {/* ── PDF Export Modal ── */}

      <div className="tabs">
        {['overview', 'charts', 'testes', 'operations', 'real', 'validation'].map(t => {
          const proTabs = ['charts','testes','real','validation']
          const locked = false
          const labels = { overview:'Visão geral', charts:'Gráficos', testes:'Testes', operations:'Operações', real:'Conta Real', validation:'Validação' }
          return (
            <div key={t} className={`tab ${tab === t ? 'active' : ''}`}
              style={{ opacity: locked ? 0.5 : 1 }}
              onClick={() => setTab(t)}
              title={locked ? 'Disponível no plano Pro' : ''}>
              {labels[t]}{locked ? ' 🔒' : ''}
            </div>
          )
        })}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <>
          <div style={{ fontWeight:700, fontSize:12, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--text-muted)', marginBottom:8 }}>
            Indicadores de Desempenho
          </div>
          <div className="metrics-grid">
            <MetricCard label="Resultado total" value={fmtR(metrics.totalBruto || 0)} cls={(metrics.totalBruto || 0) >= 0 ? 'pos' : 'neg'} sub={`${metrics.nOps || 0} operações`} />
            <MetricCard label="Capital necessário" value={fmtR(metrics.capital || 0)} sub="2× maior drawdown" />
            <MetricCard label="Rentabilidade" value={fmtPct(metrics.rentPct || 0)} cls={(metrics.rentPct || 0) >= 0 ? 'pos' : 'neg'} sub={`sobre capital · ${fmtPct(metrics.rentMensal || (metrics.rentPct || 0) / Math.max((metrics.anos || 1) * 12, 1))}/mês`} />
            <MetricCard label="Taxa de acerto" value={fmtNum(metrics.winRate || 0, 1) + '%'} cls={(metrics.winRate || 0) >= 50 ? 'pos' : 'neg'} sub={`${metrics.nWins || 0}W / ${metrics.nLosses || 0}L`} />
            <MetricCard label="Fator de lucro" value={fmtNum(metrics.profitFactor > 99 ? 99 : (metrics.profitFactor || 0))} cls={(metrics.profitFactor || 0) >= 1 ? 'pos' : 'neg'} sub="ganho bruto / perda total" />
            <MetricCard label="Payoff médio" value={fmtNum(metrics.payoff || 0)} cls={(metrics.payoff || 0) >= 1 ? 'pos' : 'neg'} sub="ganho médio / perda média" />
            <MetricCard label="DD atual" value={fmtPct(-(metrics.ddAtualPct || 0))} cls="neg" sub={fmtR(-(metrics.ddAtual || 0))} />
            <MetricCard label="DD máximo" value={fmtPct(-(metrics.ddMaxPct || 0))} cls="neg" sub={fmtR(-(metrics.maxDD || 0))} />
            <MetricCard label="M.6015" value={fmtNum(metrics.m6015 || 0)} cls={(metrics.m6015 || 0) > 3 ? 'pos' : (metrics.m6015 || 0) > 1 ? 'warn' : 'neg'} sub={`FL ${fmtNum(metrics.profitFactor > 99 ? 99 : (metrics.profitFactor || 0))} + FRA ${fmtNum(metrics.fatRecAnual || 0)}`} />
            <MetricCard label="Fat. recuperação" value={fmtNum(metrics.fatRec || 0)} cls={(metrics.fatRec || 0) >= 1 ? 'pos' : 'neg'} sub={`${fmtNum(metrics.fatRecAnual || 0)}/ano · ${fmtNum(metrics.anos || 0, 1)} anos`} />
            <MetricCard label="Teste de hipótese" value={fmtNum(metrics.pValue || 0, 4)} cls={(metrics.pValue || 1) <= 0.02 ? 'pos' : 'neg'} sub={(metrics.pValue || 1) <= 0.02 ? 'Significativo (p ≤ 0,02)' : 'Não significativo'} />
            <MetricCard label="Sharpe (est.)" value={fmtNum(metrics.sharpe || 0)} cls={(metrics.sharpe || 0) > 1 ? 'pos' : 'neg'} />
            {(() => {
              const s = calcStagnation(adjOps)
              const cap = metrics.capital || 1
              const range = s.worstPeriod ? `${s.worstPeriod.start} → ${s.worstPeriod.end}` : '—'
              const lossPct = (s.avgLoss / cap) * 100
              return (<>
                <MetricCard label="Estagnação máxima" value={`${s.worstDays} dias`} cls="neg" sub={range}/>
                <MetricCard label="Estagnação média" value={`${s.avgDays} dias`} sub={`${s.periods.length} períodos de DD`}/>
                <MetricCard label="Loss médio em estagnação" value={fmtR(s.avgLoss)} cls="neg" sub={`${fmtNum(lossPct,1)}% do capital`}/>
              </>)
            })()}
            {/* Item 6: DDs recuperados acima de X% (X configurável) */}
            {(() => {
              const cap = metrics.capital || 0
              if (!cap) return null
              const stats = calcRecoveryStats(adjOps, cap, ddRecoveryThresh)
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
              if (!cap || ddAtualPct <= 0) return null
              const stats = calcRecoveryStats(adjOps, cap, ddAtualPct)
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
            {(() => {
              // D: Expected next month (μ ± σ)
              const monthly = {}
              adjOps.forEach(o => {
                const p = o.abertura?.split(' ')[0]?.split('/')
                if (p?.length===3) { const k=`${p[2]}-${p[1]}`; monthly[k]=(monthly[k]||0)+o.resAdj }
              })
              const vals = Object.values(monthly)
              if (vals.length < 3) return null
              const avg = vals.reduce((a,b)=>a+b,0)/vals.length
              const std = Math.sqrt(vals.reduce((a,b)=>a+(b-avg)**2,0)/vals.length)
              const worst = avg - 2*std
              const best  = avg + 2*std
              const cap = metrics?.capital || 1
              return (<>
                <MetricCard label="Pior mês esperado" value={fmtR(worst)} cls="neg"
                  sub={`μ − 2σ · ${((worst/cap)*100).toFixed(1)}% · IC 95%`} />
                <MetricCard label="Resultado esperado (μ)" value={fmtR(avg)} cls={(avg>=0?'pos':'neg')}
                  sub={`média de ${vals.length} meses · ${((avg/cap)*100).toFixed(1)}%`} />
                <MetricCard label="Melhor mês esperado" value={fmtR(best)} cls="pos"
                  sub={`μ + 2σ · ${((best/cap)*100).toFixed(1)}% · IC 95%`} />
              </>)
            })()}
          </div>

          {/* ── Painel CONTA REAL ── */}
          {robot?.realOps?.length > 0 && (() => {
            const realOps = robot.realOps
            const totalReal = realOps.reduce((a,o)=>a+(o.res_op||0),0)
            const realMonthly = {}
            realOps.forEach(o => {
              const pts = (o.abertura||'').split(' ')[0].split('/')
              if (pts.length===3) { const k=`${pts[2]}-${pts[1]}`; realMonthly[k]=(realMonthly[k]||0)+(o.res_op||0) }
            })
            const mVals = Object.values(realMonthly)
            const avgReal = mVals.length ? mVals.reduce((a,b)=>a+b,0)/mVals.length : 0
            const nMeses = mVals.length
            return (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--text-muted)', marginBottom:8 }}>
                  📱 Conta Real
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10 }}>
                  <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                    <div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>Resultado total conta real</div>
                      <div style={{ fontSize:28, fontWeight:800, color:totalReal>=0?'var(--success)':'var(--danger)', lineHeight:1 }}>{fmtR(totalReal)}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>Média mensal: <b style={{ color:avgReal>=0?'var(--success)':'var(--danger)' }}>{fmtR(avgReal)}</b></div>
                    </div>
                  </div>
                  <MetricCard label="Meses em conta real" value={`${nMeses}`} cls={nMeses>=3?'pos':'warn'} sub={nMeses>=3?'Amostra estatística':'Amostra pequena'}/>
                  <MetricCard label="Operações reais" value={realOps.length} sub={`${fmtR(totalReal / (realOps.length||1))} por trade`}/>
                </div>
              </div>
            )
          })()}

          {/* ── Score Cards ── */}
          {robotScore && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:16 }}>
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 18px', display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ fontSize:40, fontWeight:800, color:'var(--accent)', lineHeight:1 }}>{robotScore.score}</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>Pontuação total</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{robotScore.score} de {robotScore.maxScore} pts possíveis</div>
                  <div style={{ marginTop:6, height:4, background:'var(--border)', borderRadius:2, overflow:'hidden', width:160 }}>
                    <div style={{ height:'100%', width:`${robotScore.maxScore > 0 ? (robotScore.score / robotScore.maxScore * 100) : 0}%`, background:'var(--accent)', borderRadius:2 }} />
                  </div>
                </div>
              </div>
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 18px', display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ fontSize:40, fontWeight:800, lineHeight:1,
                  color: (robotScore.rankPosition||0) <= 3 ? '#f59e0b' : (robotScore.rankPosition||0) <= 10 ? 'var(--success)' : 'var(--text-muted)' }}>
                  #{robotScore.rankPosition || '—'}
                </div>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>Posição no ranking</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                    entre {(window.__rankTotal__ || window.__ranking__?.length || robotScore.rankTotal || '—')} estratégias
                  </div>
                </div>
              </div>
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 18px', display:'flex', alignItems:'center', gap:16, borderLeft:'3px solid #7c3aed' }}>
                <div style={{ fontSize:40, fontWeight:800, color:'#7c3aed', lineHeight:1 }}>{robotScore.breakdown.length}</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>Critérios atingidos</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>de 24 possíveis</div>
                  <div style={{ marginTop:6, height:4, background:'var(--border)', borderRadius:2, overflow:'hidden', width:160 }}>
                    <div style={{ height:'100%', width:`${(robotScore.breakdown.length / 24 * 100).toFixed(0)}%`, background:'#7c3aed', borderRadius:2 }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Monte Carlo + Overfitting Score ── */}
          {mcResult && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
                <div style={{ fontWeight:600, fontSize:14 }}>Monte Carlo — {mcResult.simulations.toLocaleString()} simulações</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>Embaralhamento aleatório da sequência de trades</div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px,1fr))', gap:10 }}>
                  <div style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'10px 14px' }}>
                    <div style={{ fontSize:18, fontWeight:700, color:'var(--warning)' }}>{fmtPct(-mcResult.ddP50Pct)}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{fmtR(-mcResult.ddP50)} · 50% das simulações</div>
                  </div>
                  <div style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'10px 14px' }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>DD conservador (P90)</div>
                    <div style={{ fontSize:18, fontWeight:700, color:'var(--danger)' }}>{fmtPct(-mcResult.ddP90Pct)}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{fmtR(-mcResult.ddP90)} · 90% das simulações</div>
                  </div>
                  <div style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'10px 14px' }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>DD extremo (P95)</div>
                    <div style={{ fontSize:18, fontWeight:700, color:'var(--danger)' }}>{fmtPct(-mcResult.ddP95Pct)}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{fmtR(-mcResult.ddP95)} · 95% das simulações</div>
                  </div>
                  <div style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'10px 14px' }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>Prob. resultado positivo</div>
                    <div style={{ fontSize:18, fontWeight:700, color: mcResult.probPositive >= 70 ? 'var(--success)' : mcResult.probPositive >= 50 ? 'var(--warning)' : 'var(--danger)' }}>{mcResult.probPositive}%</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>das simulações terminam no lucro</div>
                  </div>
                  <div style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'10px 14px', borderLeft: `3px solid ${mcResult.riskOfRuin <= 1 ? 'var(--success)' : mcResult.riskOfRuin <= 5 ? 'var(--warning)' : 'var(--danger)'}` }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>Risco de Ruína</div>
                    <div style={{ fontSize:18, fontWeight:700, color: mcResult.riskOfRuin <= 1 ? 'var(--success)' : mcResult.riskOfRuin <= 5 ? 'var(--warning)' : 'var(--danger)' }}>{mcResult.riskOfRuin}%</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>perda {'>'} {mcResult.ruinThresholdPct}% do capital · Davey: {'<'}10%</div>
                  </div>
                  <div style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'10px 14px' }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>Resultado mediano (P50)</div>
                    <div style={{ fontSize:18, fontWeight:700, color: mcResult.resultP50 >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtR(mcResult.resultP50)}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>P10: {fmtR(mcResult.resultP10)} · P90: {fmtR(mcResult.resultP90)}</div>
                  </div>

                {/* ── Overfitting Score (horizontal, abaixo dos cards MC) ── */}
                {(() => {
                  // Componentes do score (0-100, maior = mais overfitting)
                  const nOps = adjOps.length
                  const pv = metrics.pValue || 1
                  const paperM = robot?.periods ? (() => {
                    const ps = robot.periods.paper_start, pe = robot.periods.paper_end
                    if (!ps || !pe) return 0
                    return Math.max(0, (new Date(pe) - new Date(ps)) / (1000*60*60*24*30.44))
                  })() : 0
                  const paperBTRatio = (() => {
                    if (!paperM || paperM < 1) return 0
                    // Compara FL em paper vs geral
                    const paperOps = adjOps.filter(o => {
                      const d = (() => { const p=o.abertura?.split(' ')[0]?.split('/'); return p?.length===3?`${p[2]}-${p[1]}-${p[0]}`:null })()
                      if (!d) return false
                      const ps = robot?.periods?.paper_start
                      const pe = robot?.periods?.paper_end
                      if (!ps || !pe) return false
                      return d >= ps && d <= pe
                    })
                    if (paperOps.length < 5) return 0
                    const pWin = paperOps.filter(o=>o.resAdj>0)
                    const pLoss = paperOps.filter(o=>o.resAdj<0)
                    const pFL = pLoss.length && Math.abs(pLoss.reduce((a,o)=>a+o.resAdj,0)) > 0
                      ? pWin.reduce((a,o)=>a+o.resAdj,0) / Math.abs(pLoss.reduce((a,o)=>a+o.resAdj,0))
                      : 0
                    const allFL = metrics.profitFactor || 1
                    // Razão paper/BT — quanto mais próximo de 1, melhor
                    return Math.min(pFL / allFL, 2)
                  })()

                  // Consistência por período (variação do FL entre semestres)
                  const semesters = {}
                  adjOps.forEach(o => {
                    const p = o.abertura?.split(' ')[0]?.split('/')
                    if (p?.length===3) {
                      const sem = `${p[2]}-${+p[1]<=6?'S1':'S2'}`
                      if (!semesters[sem]) semesters[sem] = []
                      semesters[sem].push(o.resAdj)
                    }
                  })
                  const semFLs = Object.values(semesters).map(ops => {
                    const w = ops.filter(v=>v>0), l = ops.filter(v=>v<0)
                    const gw = w.reduce((a,b)=>a+b,0), gl = Math.abs(l.reduce((a,b)=>a+b,0))
                    return gl > 0 ? gw/gl : 2
                  }).filter(f => isFinite(f))
                  const flStd = semFLs.length > 1 ? Math.sqrt(semFLs.reduce((a,v)=>a+(v - semFLs.reduce((x,y)=>x+y,0)/semFLs.length)**2,0)/semFLs.length) : 0

                  // Calcular score de overfitting (0=não overfittado, 100=muito overfittado)
                  let score = 0
                  // p-valor: < 0.02 bom
                  score += pv < 0.01 ? 0 : pv < 0.02 ? 5 : pv < 0.05 ? 15 : pv < 0.10 ? 25 : 35
                  // operações: < 100 suspeito
                  score += nOps >= 500 ? 0 : nOps >= 200 ? 5 : nOps >= 100 ? 12 : nOps >= 50 ? 20 : 30
                  // consistência por semestre: variação alta = suspeito
                  score += flStd < 0.2 ? 0 : flStd < 0.4 ? 5 : flStd < 0.7 ? 12 : 20
                  // paper trading: mais meses = melhor
                  score += paperM >= 12 ? 0 : paperM >= 6 ? 5 : paperM >= 3 ? 10 : paperM >= 1 ? 15 : 20
                  // ratio paper/BT: próximo de 1 = bom
                  if (paperBTRatio > 0) {
                    const diff = Math.abs(1 - paperBTRatio)
                    score += diff < 0.15 ? 0 : diff < 0.30 ? 3 : diff < 0.50 ? 8 : 15
                  }
                  score = Math.min(100, score)

                  const color = score <= 25 ? '#34d47e' : score <= 50 ? '#4f8ef7' : score <= 70 ? '#f5a623' : '#f06060'
                  const label = score <= 25 ? 'Baixo' : score <= 50 ? 'Moderado' : score <= 70 ? 'Alto' : 'Muito alto'

                  return (
                    <div style={{ gridColumn:'1/-1', background:'var(--bg)', borderRadius:'var(--radius)', padding:'12px 14px', marginTop:4 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                        <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em' }}>
                          Risco de Overfitting
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ fontSize:20, fontWeight:800, color, lineHeight:1 }}>{score}</div>
                          <div style={{ fontSize:12, fontWeight:700, color }}>{label}</div>
                        </div>
                      </div>

                      {/* Barra horizontal com degradê */}
                      <div style={{ position:'relative', height:16, borderRadius:8, overflow:'hidden', background:'rgba(255,255,255,0.08)' }}>
                        {/* Degradê fundo: verde → azul → amarelo → vermelho */}
                        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right, #34d47e, #4f8ef7 33%, #f5a623 66%, #f06060)', opacity:0.35, borderRadius:8 }}/>
                        {/* Indicador de posição */}
                        <div style={{
                          position:'absolute', top:0, bottom:0,
                          left: `${Math.max(0, score - 2)}%`,
                          width:6, borderRadius:3,
                          background: color,
                          boxShadow: `0 0 8px ${color}88`,
                        }}/>
                      </div>

                      {/* Ticks */}
                      <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
                        {[0,25,50,75,100].map(t => (
                          <span key={t} style={{ fontSize:8, color:'var(--text-hint)' }}>{t}</span>
                        ))}
                      </div>

                      <div style={{ fontSize:9, color:'var(--text-hint)', marginTop:4 }}>
                        Critérios: p-valor · volume de ops · consistência por período · paper trading {paperM>0?`(${Math.round(paperM)}m)`:''}
                      </div>
                    </div>
                  )
                })()}
              </div>
              <div style={{ marginTop:8, fontSize:11, color:'var(--text-hint)' }}>
                Metodologia: Davey/Pardo — embaralha aleatoriamente a sequência histórica de trades. Risco de Ruína = % das simulações com queda {'>'} {mcResult.ruinThresholdPct}% do capital recomendado.
              </div>
            </div>
          )}

          <div className="chart-card">
            <div className="chart-title">Curva de capital</div>
            <div style={{ position: 'relative', height: 220 }}><canvas id="c-equity" role="img" aria-label="Curva de capital" /></div>
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 500 }}>Drawdown (%)</div>
              <div style={{ position: 'relative', height: 80 }}><canvas id="c-equity-dd" role="img" aria-label="Drawdown" /></div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:12 }}>
            <div className="chart-card">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <div className="chart-title" style={{ marginBottom:0 }}>Resultado por mês</div>
                <select value={monthlyYear} onChange={e => setMonthlyYear(e.target.value)}
                  style={{ fontSize:11, padding:'2px 7px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)' }}>
                  <option value="all">Todos</option>
                  {(() => {
                    const years = new Set()
                    adjOps.forEach(o => { const p = o.abertura?.split(' ')[0]?.split('/'); if (p?.length===3) years.add(p[2]) })
                    return [...years].sort((a,b)=>b-a).map(y => <option key={y} value={y}>{y}</option>)
                  })()}
                </select>
              </div>
              <div style={{ position: 'relative', height: 200 }}><canvas id="c-monthly" role="img" aria-label="Mensal" /></div>
            </div>
            <div className="chart-card">
              <div className="chart-title">Distribuição de resultados</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', height: 130 }}>
                  <div style={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}><canvas id="c-dist" role="img" aria-label="Distribuição" /></div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <DDGauge pct={metrics.ddAtualPct || 0} maxPct={metrics.ddMaxPct || 0} recoveredLabel={metrics.recoveredMaxDD ? fmtR(metrics.recoveredMaxDD) : null} />
                  </div>
                </div>
                {/* Gain/Loss + consecutivos — inline pequeno */}
                {(() => {
                  const wins = adjOps.filter(o => o.resAdj > 0)
                  const losses = adjOps.filter(o => o.resAdj < 0)
                  if (!wins.length && !losses.length) return null
                  const gainMedio = wins.reduce((a,o)=>a+o.resAdj,0) / wins.length
                  const lossMedio = Math.abs(losses.reduce((a,o)=>a+o.resAdj,0) / losses.length)
                  const cap = metrics.capital || 1
                  const ddAtual = metrics.ddAtual || 0
                  const lossP50  = lossMedio > 0 ? Math.ceil((cap*0.5 - ddAtual) / lossMedio) : '—'
                  const lossP100 = lossMedio > 0 ? Math.ceil((cap - ddAtual) / lossMedio) : '—'
                  const items = [
                    { l:'Gain médio', v:fmtR(gainMedio), c:'var(--success)', sub:`${wins.length} pos` },
                    { l:'Loss médio', v:fmtR(-lossMedio), c:'var(--danger)', sub:`${losses.length} neg` },
                    { l:'Losses p/ 50% DD', v: typeof lossP50==='number'&&lossP50<=0?'≥50%':String(lossP50), c: typeof lossP50==='number'&&lossP50<=3?'var(--danger)':typeof lossP50==='number'&&lossP50<=8?'var(--warning)':'var(--success)', sub:'do atual' },
                    { l:'Losses p/ 100% DD', v: typeof lossP100==='number'&&lossP100<=0?'Atingido':String(lossP100), c: typeof lossP100==='number'&&lossP100<=5?'var(--danger)':typeof lossP100==='number'&&lossP100<=12?'var(--warning)':'var(--success)', sub:'para DD máx' },
                  ]
                  return (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
                      {items.map((it,i) => (
                        <div key={i} style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'5px 8px' }}>
                          <div style={{ fontSize:9, color:'var(--text-muted)', marginBottom:1 }}>{it.l}</div>
                          <div style={{ fontSize:13, fontWeight:700, color:it.c }}>{it.v}</div>
                          <div style={{ fontSize:9, color:'var(--text-hint)' }}>{it.sub}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── CHARTS ── */}
      {tab === 'charts' && (
        (
        <>
          {/* Side filter */}
          <div style={{ display:'flex', gap:6, marginBottom:14, alignItems:'center' }}>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>Filtrar por lado:</span>
            {[
              { value:'all', label:'Ambos' },
              { value:'C', label:'Compra' },
              { value:'V', label:'Venda' },
            ].map(opt => (
              <button key={opt.value} onClick={() => setSideFilter(opt.value)}
                className={'btn sm' + (sideFilter===opt.value?' primary':'')}
                style={{ fontSize:12 }}>{opt.label}</button>
            ))}
            {sideFilter !== 'all' && (
              <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:4 }}>
                {filteredForCharts.length} operações de {sideFilter==='C'?'compra':'venda'}
              </span>
            )}
          </div>
          {/* Side filter */}          <div className="chart-card">
            <div className="chart-title">Drawdown acumulado</div>
            <div style={{ position: 'relative', height: 200 }}><canvas id="c-dd" role="img" aria-label="Drawdown" /></div>
          </div>
          <div className="chart-card">
            <div className="chart-title">Resultado por operação (R$)</div>
            <div style={{ position: 'relative', height: 200 }}><canvas id="c-bar" role="img" aria-label="Por operação" /></div>
          </div>
          <div className="chart-2col">
            <div className="chart-card">
              <div className="chart-title">Resultado anual (R$)</div>
              <div style={{ position: 'relative', height: 200 }}><canvas id="c-yearly" role="img" aria-label="Anual" /></div>
            </div>
            <div className="chart-card">
              <div className="chart-title">Resultado por horário de entrada (R$)</div>
              <div style={{ position: 'relative', height: 200 }}><canvas id="c-hourly" role="img" aria-label="Por horário" /></div>
            </div>
          </div>
          <div className="chart-2col">
            <div className="chart-card">
              <div className="chart-title">Compra vs Venda (total R$)</div>
              <div style={{ position: 'relative', height: 180 }}><canvas id="c-side" role="img" aria-label="Compra vs Venda" /></div>
            </div>
            <div className="chart-card">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <div className="chart-title" style={{ marginBottom:0 }}>Curva de capital — Conta Real</div>
                {robot?.realOps?.length > 0 && <span style={{ fontSize:11, color:'var(--text-muted)' }}>{robot.realOps.length} ops reais</span>}
              </div>
              {robot?.realOps?.length > 0
                ? <div style={{ position:'relative', height:180 }}><canvas id="c-real-equity" role="img" aria-label="Curva conta real"/></div>
                : <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-hint)', fontSize:13 }}>Sem dados de conta real importados</div>
              }
            </div>
          </div>

          <div className="chart-2col">
            <div className="chart-card">
              <div className="chart-title">Sequência de ganhos e perdas consecutivos</div>
              {(() => { const s = calcStreaks(filteredForCharts); return (
                <div style={{ display:'flex', gap:16, marginBottom:8 }}>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>Maior win streak: <strong style={{ color:'var(--success)' }}>{s.maxWin}</strong></span>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>Maior loss streak: <strong style={{ color:'var(--danger)' }}>{s.maxLoss}</strong></span>
                </div>
              )})()}
              <div style={{ position:'relative', height:160 }}><canvas id="c-streaks" role="img" aria-label="Sequências" /></div>
            </div>
            <div className="chart-card">
              <div className="chart-title">Resultado por dia da semana (R$)</div>
              <div style={{ position:'relative', height:200 }}><canvas id="c-weekday" role="img" aria-label="Dia da semana" /></div>
            </div>
          </div>

          <div className="chart-card">
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              <span className="chart-title" style={{ margin:0 }}>Fator de lucro móvel</span>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:'auto' }}>
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>Janela:</span>
                {[25,50,75,100].map(w => (
                  <button key={w} onClick={() => setRollingWindow(w)}
                    className={'btn sm' + (rollingWindow === w ? ' primary' : '')}
                    style={{ padding:'2px 8px', fontSize:11 }}
                  >{w} ops</button>
                ))}
              </div>
            </div>
            <div style={{ position:'relative', height:180 }}><canvas id="c-rolling-pf" role="img" aria-label="FL móvel" /></div>
          </div>
        </>
        )
      )}

      {/* ── TESTES ── */}
      {tab === 'testes' && (

        <TestesTab adjOps={adjOps} periods={periods} metrics={metrics} />
      )}

      {/* ── CONTA REAL ── */}
      {tab === 'real' && (

        <RealOpsTab robotId={parseInt(id)} adjOps={adjOps} timeframe={timeframe} />
      )}

      {/* ── OPERATIONS ── */}
      {tab === 'operations' && (
        <OpsTable adjOps={adjOps} tipo={tipo} />
      )}

      {/* ── VALIDATION ── */}
      {tab === 'diario' && (
        <CalendarioMensal
          adjOps={adjOps}
          realOps={robot?.realOps}
          capital={metrics?.capital || 0}
          title={robot?.name || 'Diário'}
        />
      )}

      {tab === 'validation' && (

        <ValidationTab vr={vr} metrics={metrics} periods={periods} adjOps={adjOps} mcResult={mcResult} observation={observation} setObservation={setObservation} onSave={handleSaveSettings} />
      )}

      {/* ── PERIODS ── */}
      {tab === 'periods' && (
        <PeriodsTab periods={periods} setPeriods={setPeriods} onSave={handleSavePeriods} saving={savingPeriods} />
      )}

      {tab === 'situacao' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Portfólios que contêm esta estratégia */}
          <div className="card">
            <div style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>📁 Portfólios</div>
            {portfoliosList.length === 0 ? (
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>Esta estratégia não está em nenhum portfólio.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {portfoliosList.map(p => (
                  <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--bg)', borderRadius:8, border:'1px solid var(--border)' }}>
                    <span style={{ fontSize:16 }}>📂</span>
                    <span style={{ fontSize:13, fontWeight:600, flex:1 }}>{p.name}</span>
                    <button className="btn sm" onClick={() => navigate(`/portfolio/${p.id}`)}>Ver</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Plataforma e conta — múltiplas entradas */}
          <div className="card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontWeight:600, fontSize:14 }}>⚙️ Onde está rodando</div>
              <button className="btn sm primary" onClick={() => setConta(prev => [...prev, { plataforma:'profit', conta:'' }])}>
                + Adicionar
              </button>
            </div>

            {conta.length === 0 && (
              <div style={{ fontSize:13, color:'var(--text-muted)', fontStyle:'italic' }}>
                Nenhuma plataforma/conta cadastrada. Clique em "+ Adicionar".
              </div>
            )}

            {conta.map((item, idx) => (
              <div key={idx} style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:10, alignItems:'end', marginBottom:10 }}>
                <div>
                  {idx === 0 && <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Plataforma</label>}
                  <select value={item.plataforma}
                    onChange={e => setConta(prev => prev.map((it, i) => i===idx ? {...it, plataforma: e.target.value} : it))}
                    style={{ width:'100%', padding:'7px 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)', fontSize:13 }}>
                    <option value="profit">Profit (Nelogica)</option>
                    <option value="mt5">MetaTrader 5</option>
                    <option value="tryd">Tryd</option>
                    <option value="other">Outra</option>
                  </select>
                </div>
                <div>
                  {idx === 0 && <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Conta / Corretora</label>}
                  <input type="text" value={item.conta}
                    onChange={e => setConta(prev => prev.map((it, i) => i===idx ? {...it, conta: e.target.value} : it))}
                    placeholder="Ex: Clear 12345 / Demo"
                    style={{ width:'100%', padding:'7px 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)', fontSize:13, boxSizing:'border-box' }}/>
                </div>
                <button className="btn sm danger" onClick={() => setConta(prev => prev.filter((_, i) => i !== idx))}
                  style={{ height:34, alignSelf:'end' }}>
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Observação (espelho do campo na validação) */}
          <div className="card">
            <div style={{ fontWeight:600, fontSize:14, marginBottom:10 }}>📝 Observação</div>
            <textarea value={observation} onChange={e => setObservation(e.target.value)}
              placeholder="Notas sobre esta estratégia, comportamento esperado, condições de mercado favoráveis..."
              style={{ width:'100%', minHeight:100, padding:'10px 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--bg)', color:'var(--text)', fontSize:13, resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }}/>
          </div>

          <button className="btn primary" onClick={handleSaveSettings} disabled={savingSettings} style={{ alignSelf:'flex-start' }}>
            {savingSettings ? 'Salvando…' : 'Salvar situação'}
          </button>
        </div>
      )}
    </div>
  )
}

function TestesTab({ adjOps, periods, metrics }) {
  const getPj = () => {
    try {
      const pj = periods.periods_json
      if (!pj) return null
      return typeof pj === 'string' ? JSON.parse(pj) : pj
    } catch(e) { return null }
  }
  const pj = getPj()
  const inSamples = pj?.inSamples || [{ start: periods.in_sample_start, end: periods.in_sample_end }]
  const outSamples = pj?.outSamples || [{ start: periods.out_sample_start, end: periods.out_sample_end }]
  const paper = pj?.paper || { start: periods.paper_start, end: periods.paper_end }

  const parseD = s => { if (!s) return null; const p=s.split('/'); return p.length===3?new Date(+p[2],+p[1]-1,+p[0]):new Date(s) }
  const filterOps = (start, end) => {
    if (!start && !end) return []
    return adjOps.filter(op => {
      const d = parseD(op.abertura.split(' ')[0])
      if (!d) return false
      if (start && d < new Date(start)) return false
      if (end && d > new Date(end + 'T23:59:59')) return false
      return true
    })
  }

  const calcPeriodStats = (ops) => {
    if (!ops.length) return null
    const wins = ops.filter(o => o.resAdj > 0)
    const losses = ops.filter(o => o.resAdj < 0)
    const grossWin = wins.reduce((a,b) => a+b.resAdj, 0)
    const grossLoss = Math.abs(losses.reduce((a,b) => a+b.resAdj, 0))
    const total = ops.reduce((a,b) => a+b.resAdj, 0)
    const pf = grossLoss > 0 ? grossWin/grossLoss : grossWin > 0 ? 9.99 : 0

    // Monthly stats for % positive months
    const monthly = {}
    ops.forEach(o => {
      const pts = o.abertura.split(' ')[0].split('/')
      const key = `${pts[2]}-${pts[1]}`
      monthly[key] = (monthly[key]||0) + o.resAdj
    })
    const monthVals = Object.values(monthly)
    const posMonths = monthVals.filter(v=>v>0).length
    const pctPosMonths = monthVals.length ? posMonths/monthVals.length*100 : 0

    // M.6015
    const mean = total / ops.length
    const std = Math.sqrt(ops.reduce((a,o)=>a+(o.resAdj-mean)**2,0)/ops.length)
    let acc=0, peak=0, maxDD=0
    ops.forEach(o=>{acc+=o.resAdj;if(acc>peak)peak=acc;const dd=peak-acc;if(dd>maxDD)maxDD=dd})
    const anos = (() => {
      if(ops.length<2) return 0.1
      const p0=parseD(ops[0].abertura.split(' ')[0])
      const p1=parseD(ops[ops.length-1].abertura.split(' ')[0])
      return Math.max((p1-p0)/(1000*60*60*24*365.25),1/12)
    })()
    const fatRec = maxDD > 0 ? total/maxDD : 0
    const fatRecAnual = anos > 0 ? fatRec/anos : 0
    const m6015 = pf + fatRecAnual

    return {
      nOps: ops.length, total, pf, winRate: ops.length ? wins.length/ops.length*100 : 0,
      pctPosMonths, m6015, perOp: mean, maxDD
    }
  }

  const isOps = inSamples.flatMap(p => filterOps(p.start, p.end))
  const oosOps = outSamples.flatMap(p => filterOps(p.start, p.end))
  const ptOps = filterOps(paper.start, paper.end)

  const isStats = calcPeriodStats(isOps)
  const oosStats = calcPeriodStats(oosOps)
  const ptStats = calcPeriodStats(ptOps)

  const hasPeriods = isStats || oosStats || ptStats

  const getC = () => {
    const d = window.matchMedia('(prefers-color-scheme: dark)').matches
    return { grid: d?'rgba(255,255,255,.07)':'rgba(0,0,0,.05)', text: d?'#9ca3af':'#6b7280' }
  }

  const renderPeriodChart = (canvasId, ops, color) => {
    const el = document.getElementById(canvasId)
    if (!el || !ops.length) return
    try { const ex = Chart.getChart(el); if (ex) ex.destroy() } catch(e) {}
    const c = getC()
    let acc = 0
    const data = ops.map(o => { acc += o.resAdj; return +acc.toFixed(2) })
    const labels = ops.map(o => o.abertura.slice(0, 10))
    new Chart(el, {
      type: 'line',
      data: { labels, datasets: [{
        data,
        borderColor: color,
        backgroundColor: color.replace('rgb(', 'rgba(').replace(')', ',0.12)'),
        fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
      }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: c.text, maxTicksLimit: 8 }, grid: { color: c.grid } },
          y: { ticks: { color: c.text, callback: v => 'R$ '+v.toLocaleString('pt-BR') }, grid: { color: c.grid } }
        }
      }
    })
  }

  React.useEffect(() => {
    if (!hasPeriods) return
    const t = setTimeout(() => {
      if (isOps.length) renderPeriodChart('c-is-equity', isOps, 'rgb(37,99,235)')
      if (oosOps.length) renderPeriodChart('c-oos-equity', oosOps, 'rgb(217,119,6)')
      if (ptOps.length) renderPeriodChart('c-pt-equity', ptOps, 'rgb(22,163,74)')
    }, 80)
    return () => {
      clearTimeout(t)
      ;['c-is-equity','c-oos-equity','c-pt-equity'].forEach(id => {
        const el = document.getElementById(id)
        if (el) { try { Chart.getChart(el)?.destroy() } catch(e) {} }
      })
    }
  }, [adjOps, periods])

  const diff = (a, b, invert=false) => {
    if (!a || !b || b === 0) return null
    const pct = ((a - b) / Math.abs(b)) * 100 * (invert ? -1 : 1)
    return pct
  }

  const ColHeader = ({ label, sub }) => (
    <th style={{ padding:'10px 14px', textAlign:'center', fontWeight:600, fontSize:13,
      background:'var(--bg)', borderBottom:'1px solid var(--border)', color:'var(--text)' }}>
      {label}
      {sub && <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:400, marginTop:2 }}>{sub}</div>}
    </th>
  )

  const StatCell = ({ value, refValue, higherBetter=true, fmt }) => {
    const safeVal = (value === null || value === undefined || isNaN(value)) ? null : value
    const formatted = safeVal !== null ? (fmt ? fmt(safeVal) : fmtNum(safeVal, 2)) : '—'
    if (safeVal === null) return <td style={{ padding:'8px 14px', textAlign:'center', color:'var(--text-muted)' }}>—</td>
    if (refValue === null || refValue === undefined || isNaN(refValue)) return <td style={{ padding:'8px 14px', textAlign:'center', fontWeight:600 }}>{formatted}</td>
    const d = diff(safeVal, refValue)
    const good = higherBetter ? safeVal >= refValue : safeVal <= refValue
    return (
      <td style={{ padding:'8px 14px', textAlign:'center' }}>
        <div style={{ fontWeight:600 }}>{formatted}</div>
        {refValue !== safeVal && d !== null && (
          <div style={{ fontSize:11, color: good ? 'var(--success)' : 'var(--danger)', marginTop:2 }}>
            {d >= 0 ? '+' : ''}{(+d).toFixed(1)}%
          </div>
        )}
      </td>
    )
  }

  if (!hasPeriods) {
    return (
      <div className="empty-state">
        <p>Configure os períodos na aba Períodos para ativar a comparação IS / OOS / Paper Trading.</p>
      </div>
    )
  }

  const rows = [
    { label: 'Operações', key: 'nOps', fmt: v => v, higherBetter: true },
    { label: 'Expectativa matemática / op', key: 'perOp', fmt: v => fmtR(v), higherBetter: true },
    { label: '% Meses positivos', key: 'pctPosMonths', fmt: v => fmtNum(v,1)+'%', higherBetter: true },
    { label: 'Taxa de acerto', key: 'winRate', fmt: v => fmtNum(v,1)+'%', higherBetter: true },
    { label: 'Fator de lucro', key: 'pf', fmt: v => fmtNum(v,2), higherBetter: true },
    { label: 'M.6015', key: 'm6015', fmt: v => fmtNum(v,2), higherBetter: true },
    { label: 'Resultado total', key: 'total', fmt: v => fmtR(v), higherBetter: true },
  ]

  const periods_label = [
    { key:'is', label:'In Sample', stats: isStats, sub: inSamples.map(p=>`${p.start||'?'} → ${p.end||'?'}`).join(' + ') },
    { key:'oos', label:'Out of Sample', stats: oosStats, sub: outSamples.map(p=>`${p.start||'?'} → ${p.end||'?'}`).join(' + ') },
    { key:'pt', label:'Paper / Conta Real', stats: ptStats, sub: `${paper.start||'?'} → ${paper.end||'?'}` },
  ]

  return (
    <div>
      <div className="tbl-wrap" style={{ marginBottom: 20 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr>
              <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, fontSize:13, background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>Métrica</th>
              {periods_label.map(p => (
                <ColHeader key={p.key} label={p.label} sub={p.sub} />
              ))}
              <ColHeader label="OOS vs IS" sub="diferença %" />
              <ColHeader label="PT vs OOS" sub="diferença %" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i%2===0?'var(--surface)':'var(--bg)' }}>
                <td style={{ padding:'8px 14px', fontWeight:500, color:'var(--text)' }}>{row.label}</td>
                {periods_label.map(p => (
                  <StatCell key={p.key} value={p.stats?.[row.key]} fmt={row.fmt} higherBetter={row.higherBetter} />
                ))}
                {/* OOS vs IS diff */}
                <td style={{ padding:'8px 14px', textAlign:'center' }}>
                  {oosStats && isStats ? (() => {
                    const d = diff(oosStats[row.key], isStats[row.key])
                    if (d === null) return '—'
                    const good = row.higherBetter ? d >= -25 : d <= 25
                    return <span style={{ fontWeight:600, color: d >= 0 ? 'var(--success)' : good ? 'var(--warning)' : 'var(--danger)' }}>
                      {d >= 0 ? '+' : ''}{d.toFixed(1)}%
                    </span>
                  })() : '—'}
                </td>
                {/* PT vs OOS diff */}
                <td style={{ padding:'8px 14px', textAlign:'center' }}>
                  {ptStats && oosStats ? (() => {
                    const d = diff(ptStats[row.key], oosStats[row.key])
                    if (d === null) return '—'
                    const good = row.higherBetter ? d >= -25 : d <= 25
                    return <span style={{ fontWeight:600, color: d >= 0 ? 'var(--success)' : good ? 'var(--warning)' : 'var(--danger)' }}>
                      {d >= 0 ? '+' : ''}{d.toFixed(1)}%
                    </span>
                  })() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Visual bars comparison - 4 cards in a row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, marginBottom:20 }}>
        {['perOp','pf','m6015','winRate'].map(key => {
          const row = rows.find(r => r.key === key)
          if (!row) return null
          const vals = periods_label.map(p => ({ label: p.label, val: p.stats?.[key] || 0 }))
          const maxVal = Math.max(...vals.map(v => Math.abs(v.val)), 0.01)
          const colors = ['#2563eb', '#d97706', '#16a34a']  // IS=azul, OOS=laranja, Paper=verde
          return (
            <div key={key} className="card" style={{ padding:'12px 14px' }}>
              <div style={{ fontWeight:600, fontSize:12, marginBottom:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.04em' }}>{row.label}</div>
              {vals.map((v, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>{v.label}</span>
                    <span style={{ fontSize:12, fontWeight:700, color: colors[i] }}>{row.fmt(v.val)}</span>
                  </div>
                  <div style={{ height:5, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.abs(v.val)/maxVal*100}%`, background: colors[i], borderRadius:3, transition:'width .4s' }} />
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Equity curves - 3 side by side */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
        {[
          { key:'is', label:'In Sample', color:'#2563eb', canvasId:'c-is-equity', ops: isOps, stats: isStats,
            sub: inSamples.map(p=>`${p.start||'?'} → ${p.end||'?'}`).join(' + ') },
          { key:'oos', label:'Out of Sample', color:'#d97706', canvasId:'c-oos-equity', ops: oosOps, stats: oosStats,
            sub: outSamples.map(p=>`${p.start||'?'} → ${p.end||'?'}`).join(' + ') },
          { key:'pt', label:'Paper / Conta Real', color:'#16a34a', canvasId:'c-pt-equity', ops: ptOps, stats: ptStats,
            sub: paper ? `${paper.start||'?'} → ${paper.end||'?'}` : '—' },
        ].map(p => (
          <div key={p.key} className="chart-card" style={{ borderTop:`3px solid ${p.color}`, padding:'12px 14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <div>
                <div style={{ fontWeight:600, fontSize:13, color:p.color }}>{p.label}</div>
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:1 }}>{p.sub}</div>
              </div>
              {p.stats && (
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:13, fontWeight:700, color: p.stats.total>=0?'var(--success)':'var(--danger)' }}>{fmtR(p.stats.total)}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>{p.stats.nOps} ops</div>
                </div>
              )}
            </div>
            {p.ops.length > 0
              ? <div style={{ position:'relative', height:140 }}><canvas id={p.canvasId} role="img" aria-label={`Curva ${p.label}`}/></div>
              : <div style={{ height:80, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:12 }}>Sem dados</div>
            }
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricCard({ label, value, cls = '', sub }) {
  return (
    <div className="metric">
      <div className="lbl">{label}</div>
      <div className={`val ${cls}`}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

function DDGauge({ pct, maxPct, recoveredLabel }) {
  const current = Math.min(Math.abs(pct || 0), 100)
  const max = Math.min(Math.abs(maxPct || 0), 100)
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  const barStyle = (fillPct, color) => ({
    position: 'relative', width: 28, borderRadius: 14,
    background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
    overflow: 'hidden', height: 120,
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
  })

  const fillStyle = (fillPct, color) => ({
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: `${fillPct}%`,
    background: color,
    borderRadius: 14,
    transition: 'height .5s ease',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingBottom: 8, minWidth: 80 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em' }}>Drawdown</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={barStyle(current)}>
            <div style={fillStyle(current, 'linear-gradient(to top, #dc2626, #f97316)')} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', marginTop: 4 }}>{current.toFixed(1)}%</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>atual</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={barStyle(max)}>
            <div style={fillStyle(max, 'linear-gradient(to top, #7c3aed, #dc2626)')} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--purple)', marginTop: 4 }}>{max.toFixed(1)}%</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>máx. recuperado</div>
        </div>
      </div>
      {recoveredLabel && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
          base: {recoveredLabel}
        </div>
      )}
    </div>
  )
}

function OpsTable({ adjOps, tipo }) {
  const [filterLado, setFilterLado] = useState('')
  const [filterResult, setFilterResult] = useState('')
  const [sortDir, setSortDir] = useState('desc') // desc = mais recente primeiro
  const isbt = tipo === 'backtest'
  const filtered = adjOps.filter(o => {
    if (filterLado && o.lado !== filterLado) return false
    if (filterResult === 'pos' && o.resAdj <= 0) return false
    if (filterResult === 'neg' && o.resAdj >= 0) return false
    return true
  })
  const sorted = sortDir === 'desc' ? [...filtered].reverse() : filtered
  let acc = 0
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={filterLado} onChange={e => setFilterLado(e.target.value)} style={{ fontSize: 13, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}>
          <option value="">Todos os lados</option>
          <option value="C">Compra</option>
          <option value="V">Venda</option>
        </select>
        <select value={filterResult} onChange={e => setFilterResult(e.target.value)} style={{ fontSize: 13, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}>
          <option value="">Todos os resultados</option>
          <option value="pos">Vencedoras</option>
          <option value="neg">Perdedoras</option>
        </select>
        <button onClick={() => setSortDir(d => d==='asc'?'desc':'asc')}
          style={{ fontSize:12, padding:'4px 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)', cursor:'pointer' }}>
          {sortDir==='desc' ? '↓ Mais recente' : '↑ Mais antiga'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{filtered.length} operações</span>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Abertura</th><th>Fechamento</th><th>Lado</th><th>Qtd</th>
              <th>Original (R$)</th><th>{isbt ? 'c/ Deságio (R$)' : 'Resultado (R$)'}</th><th>Acumulado (R$)</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(o => {
              acc += o.resAdj
              const changed = isbt && Math.abs(o.resAdj - o.res_op) > 0.01
              return (
                <tr key={o.id || o.num}>
                  <td>{o.num}</td>
                  <td style={{ fontSize: 11 }}>{o.abertura}</td>
                  <td style={{ fontSize: 11 }}>{o.fechamento}</td>
                  <td><span className={`badge ${o.lado === 'C' ? 'blue' : 'green'}`}>{o.lado === 'C' ? 'Compra' : 'Venda'}</span></td>
                  <td>{o.qtd}</td>
                  <td className={o.res_op >= 0 ? 'pos' : 'neg'}>{fmtR(o.res_op)}</td>
                  <td className={o.resAdj >= 0 ? 'pos' : 'neg'} style={changed ? { fontWeight: 600 } : {}}>
                    {fmtR(o.resAdj)}{changed ? ' *' : ''}
                  </td>
                  <td className={acc >= 0 ? 'pos' : 'neg'}>{fmtR(acc)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PeriodsTab({ periods, setPeriods, onSave, saving }) {
  // Parse multi-period JSON or fall back to legacy single-period fields
  const getPj = () => {
    try {
      const pj = periods.periods_json
      if (!pj) return null
      return typeof pj === 'string' ? JSON.parse(pj) : pj
    } catch(e) { return null }
  }

  const initMulti = () => {
    const pj = getPj()
    return {
      inSamples: pj?.inSamples || [{ start: periods.in_sample_start || '', end: periods.in_sample_end || '' }],
      outSamples: pj?.outSamples || [{ start: periods.out_sample_start || '', end: periods.out_sample_end || '' }],
      paper: { start: periods.paper_start || '', end: periods.paper_end || '' },
    }
  }

  const [multi, setMulti] = React.useState(initMulti)

  const updateMulti = (updated) => {
    setMulti(updated)
    setPeriods(p => ({
      ...p,
      in_sample_start: updated.inSamples[0]?.start || '',
      in_sample_end: updated.inSamples[0]?.end || '',
      out_sample_start: updated.outSamples[0]?.start || '',
      out_sample_end: updated.outSamples[0]?.end || '',
      paper_start: updated.paper.start || '',
      paper_end: updated.paper.end || '',
      periods_json: JSON.stringify(updated),
    }))
  }

  const setInSample = (i, k, v) => {
    const arr = [...multi.inSamples]
    arr[i] = { ...arr[i], [k]: v }
    updateMulti({ ...multi, inSamples: arr })
  }
  const setOutSample = (i, k, v) => {
    const arr = [...multi.outSamples]
    arr[i] = { ...arr[i], [k]: v }
    updateMulti({ ...multi, outSamples: arr })
  }
  const setPaper = (k, v) => updateMulti({ ...multi, paper: { ...multi.paper, [k]: v } })

  const addInSample = () => {
    if (multi.inSamples.length >= 2) return
    updateMulti({ ...multi, inSamples: [...multi.inSamples, { start: '', end: '' }] })
  }
  const removeInSample = (i) => {
    if (multi.inSamples.length <= 1) return
    updateMulti({ ...multi, inSamples: multi.inSamples.filter((_, idx) => idx !== i) })
  }
  const addOutSample = () => {
    if (multi.outSamples.length >= 2) return
    updateMulti({ ...multi, outSamples: [...multi.outSamples, { start: '', end: '' }] })
  }
  const removeOutSample = (i) => {
    if (multi.outSamples.length <= 1) return
    updateMulti({ ...multi, outSamples: multi.outSamples.filter((_, idx) => idx !== i) })
  }

  const PeriodInput = React.memo(({ label, initialValue, onCommit }) => {
    const [val, setVal] = React.useState(initialValue || '')
    const inputStyle = {
      fontFamily: 'monospace', letterSpacing: 1, width: '100%',
      padding: '8px 10px', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', background: 'var(--surface)',
      color: 'var(--text)', fontSize: 14, outline: 'none',
    }
    // Auto-format: user types digits only, slashes inserted automatically
    const handleChange = (e) => {
      let raw = e.target.value.replace(/\D/g, '').slice(0, 8)
      let formatted = raw
      if (raw.length > 2) formatted = raw.slice(0,2) + '/' + raw.slice(2)
      if (raw.length > 4) formatted = raw.slice(0,2) + '/' + raw.slice(2,4) + '/' + raw.slice(4)
      setVal(formatted)
    }
    // On blur/Tab: convert DD/MM/AAAA → AAAA-MM-DD for storage
    const handleCommit = () => {
      const parts = val.split('/')
      if (parts.length === 3 && parts[2].length === 4) {
        const iso = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
        onCommit(iso)
      } else if (val.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Already ISO format
        const [y,m,d] = val.split('-')
        setVal(`${d}/${m}/${y}`)
        onCommit(val)
      }
    }
    // Display: convert ISO to DD/MM/AAAA for display
    React.useEffect(() => {
      if (initialValue && initialValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y,m,d] = initialValue.split('-')
        setVal(`${d}/${m}/${y}`)
      }
    }, [initialValue])
    return (
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
        <input
          type="text"
          value={val}
          maxLength={10}
          placeholder="DD/MM/AAAA"
          style={inputStyle}
          onChange={handleChange}
          onBlur={handleCommit}
          onKeyDown={e => {
            if (e.key === 'Enter') { handleCommit(); e.target.blur() }
          }}
          onFocus={e => e.target.select()}
        />
      </div>
    )
  })

  const PeriodRow = ({ label, item, onChange, onRemove, showRemove }) => (
    <div style={{ marginBottom: 10 }}>
      {label && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>{label}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <PeriodInput
          key={'s-' + (item.start || 'empty')}
          label="Início (AAAA-MM-DD)"
          initialValue={item.start || ''}
          placeholder="2022-01-01"
          onCommit={v => onChange('start', v)}
        />
        <PeriodInput
          key={'e-' + (item.end || 'empty')}
          label="Fim (AAAA-MM-DD)"
          initialValue={item.end || ''}
          placeholder="2024-12-31"
          onCommit={v => onChange('end', v)}
        />
        {showRemove && (
          <button className="btn sm danger" onClick={onRemove} style={{ marginBottom: 1 }}>×</button>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        Defina os períodos para ativar o comparativo e o teste de validação. Você pode adicionar até 2 períodos por fase.
      </p>

      {/* In Sample */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>In Sample</div>
          {multi.inSamples.length < 2 && (
            <button className="btn sm" onClick={addInSample}>+ Adicionar período</button>
          )}
        </div>
        {multi.inSamples.map((item, i) => (
          <PeriodRow key={i}
            label={multi.inSamples.length > 1 ? `Período ${i + 1}` : null}
            item={item}
            onChange={(k, v) => setInSample(i, k, v)}
            onRemove={() => removeInSample(i)}
            showRemove={multi.inSamples.length > 1}
          />
        ))}
      </div>

      {/* Out of Sample */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Out of Sample</div>
          {multi.outSamples.length < 2 && (
            <button className="btn sm" onClick={addOutSample}>+ Adicionar período</button>
          )}
        </div>
        {multi.outSamples.map((item, i) => (
          <PeriodRow key={i}
            label={multi.outSamples.length > 1 ? `Período ${i + 1}` : null}
            item={item}
            onChange={(k, v) => setOutSample(i, k, v)}
            onRemove={() => removeOutSample(i)}
            showRemove={multi.outSamples.length > 1}
          />
        ))}
      </div>

      {/* Paper / Real */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Paper Trading / Conta Real</div>
        <PeriodRow item={multi.paper} onChange={(k, v) => setPaper(k, v)} showRemove={false} />
      </div>

      <button className="btn primary" onClick={onSave} disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar períodos'}
      </button>
    </div>
  )
}

function ValidationTab({ vr, metrics, periods, adjOps = [], mcResult, observation = '', setObservation, onSave }) {
  const hasData = periods.out_sample_start && periods.paper_start
  if (!hasData) {
    return (
      <div className="empty-state">
        <p>Configure os períodos na aba "Períodos" para ativar a validação.</p>
      </div>
    )
  }

  const Item = ({ label, value, ok, detail }) => (
    <div className="validation-item">
      <div>
        <div className="vi-label">{label}</div>
        {detail && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{detail}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="vi-value">{value}</span>
        {ok !== null && ok !== undefined && (
          <span className={`badge ${ok ? 'green' : 'red'}`}>{ok ? 'OK' : 'Falhou'}</span>
        )}
      </div>
    </div>
  )

  const approved = vr.pvalOk && vr.m6015Ok && vr.desvioOk && vr.hasMinReal

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 20 }}>
        {vr.status === 'APROVADO' && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 18px', background:'var(--success-bg)', border:'1px solid var(--success)', borderRadius:'var(--radius-lg)', color:'var(--success)', fontWeight:600, fontSize:15 }}>
            ✓ ESTRATÉGIA APROVADA PARA CONTA REAL
          </div>
        )}
        {vr.status === 'APROVADO_CAUTELA' && (
          <div style={{ display:'flex', flexDirection:'column', gap:4, padding:'12px 18px', background:'var(--warning-bg)', border:'1px solid var(--warning)', borderRadius:'var(--radius-lg)' }}>
            <span style={{ color:'var(--warning)', fontWeight:600, fontSize:15 }}>⚠ APROVADA COM CAUTELA</span>
            <span style={{ fontSize:13, color:'var(--text-muted)' }}>Todos os critérios aprovados, mas M.6015 entre 2,5 e 3,0. Opere com lote reduzido e monitore de perto.</span>
          </div>
        )}
        {vr.status === 'APROVADO_SIMULADOR' && (
          <div style={{ display:'flex', flexDirection:'column', gap:4, padding:'12px 18px', background:'var(--accent-bg)', border:'1px solid var(--accent)', borderRadius:'var(--radius-lg)' }}>
            <span style={{ color:'var(--accent)', fontWeight:600, fontSize:15 }}>~ APROVADA PARA SIMULADOR</span>
            <span style={{ fontSize:13, color:'var(--text-muted)' }}>Todos os critérios estatísticos aprovados, mas ainda não atingiu 3 meses em conta real.</span>
          </div>
        )}
        {vr.status === 'EM_ANALISE' && (
          <div style={{ display:'flex', flexDirection:'column', gap:4, padding:'12px 18px', background:'var(--warning-bg)', border:'1px solid var(--warning)', borderRadius:'var(--radius-lg)' }}>
            <span style={{ color:'var(--warning)', fontWeight:600, fontSize:15 }}>⏳ EM ANÁLISE</span>
            <span style={{ fontSize:13, color:'var(--text-muted)' }}>Desvio Paper vs OOS fora do critério, mas com menos de 60 operações em paper — aguardar mais dados ({vr.paperOps.length} trades até agora).</span>
          </div>
        )}
        {vr.status === 'REPROVADO' && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 18px', background:'var(--danger-bg)', border:'1px solid var(--danger)', borderRadius:'var(--radius-lg)', color:'var(--danger)', fontWeight:600, fontSize:15 }}>
            ✗ NÃO APROVADA PARA CONTA REAL
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Critérios estatísticos</div>
        <Item label="Teste de Hipótese" value={fmtNum(metrics.pValue || 0, 4)} ok={vr.pvalOk} detail="Critério: p ≤ 0,02 — mede se o resultado médio por operação é estatisticamente diferente do acaso. Metodologia de David Aronson (Evidence-Based Technical Analysis). Quanto menor, mais forte a evidência de vantagem real." />
        <Item label="M.6015" value={fmtNum(metrics.m6015 || 0)} ok={vr.m6015Ok} detail="Critério: > 3 (fator de lucro + fator de recuperação anualizado)" />
        {mcResult ? (
          <Item
            label="Risco de Ruína (Monte Carlo)"
            value={`${mcResult.riskOfRuin}%`}
            ok={mcResult.riskOfRuin <= 10}
            detail={`Critério para conta real: ≤ 10% (Davey). Calculado em ${(mcResult.simulations||1000).toLocaleString('pt-BR')} simulações Monte Carlo. Atual: ${mcResult.riskOfRuin}% — ${mcResult.riskOfRuin <= 10 ? '✓ Aprovado para conta real' : '✗ Acima do limite — não recomendado para conta real'}`}
          />
        ) : (
          <Item
            label="Risco de Ruína (Monte Carlo)"
            value="Calcule o MC"
            ok={null}
            detail="Execute o Monte Carlo na aba Visão Geral para obter este critério."
          />
        )}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Comparativo OOS × Paper Trading</div>
        <Item label="Operações no OOS" value={`${vr.oosOps.length} ops`} ok={null} detail={vr.outSamples?.map(p => `${p.start||'?'} → ${p.end||'?'}`).join(' · ') || ''} />
        <Item label="Resultado médio OOS" value={fmtR(vr.oosMet.perOp)} ok={null} />
        <Item label="Operações no Paper" value={`${vr.paperOps.length} ops`} ok={null} detail={`${periods.paper_start} → ${periods.paper_end}`} />
        <Item label="Resultado médio Paper" value={fmtR(vr.paperMet.perOp)} ok={null} />
        <Item
          label="Desvio Paper vs OOS"
          value={vr.paperVsOos !== null ? fmtPct(vr.paperVsOos) : 'N/D'}
          ok={vr.desvioOk}
          detail="Critério: desvio máximo de -25% em relação ao OOS"
        />
        <Item
          label="Mínimo 3 meses em conta real"
          value={vr.hasMinReal ? 'Sim' : 'Não'}
          ok={vr.hasMinReal}
          detail="Critério: ao menos 3 meses no período Paper/Real"
        />
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Totais por período</div>
        <table style={{ width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th>Período</th><th>Ops</th><th>Total R$</th><th>Média/op</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Out of Sample', met: vr.oosMet },
              { label: 'Paper / Real', met: vr.paperMet },
            ].map(({ label, met }) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{met.nOps}</td>
                <td className={met.total >= 0 ? 'pos' : 'neg'}>{fmtR(met.total)}</td>
                <td className={met.perOp >= 0 ? 'pos' : 'neg'}>{fmtR(met.perOp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Specialist Analysis ── */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 14 }}>Análise por referência bibliográfica</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Avaliação automática baseada nos critérios de autores especializados em sistemas algorítmicos para futuros intraday.
        </div>

        {(() => {
          const pf = metrics.profitFactor || 0
          const m6 = metrics.m6015 || 0
          const pval = metrics.pValue || 1
          const nOps = adjOps.length
          const avgTrade = nOps > 0 ? (metrics.totalBruto || 0) / nOps : 0
          const sharpe = metrics.sharpe || 0

          // Check OOS consistency
          const hasOOS = vr.oosOps?.length > 0
          const oosConsistent = vr.desvioOk

          const specialists = [
            {
              name: 'Kevin Davey',
              ref: 'Building Winning Algorithmic Trading Systems',
              focus: 'Futuros intraday — robustez e risco de ruína',
              checks: [
                { label: 'Profit Factor > 1,5', ok: pf >= 1.5, value: pf.toFixed(2), detail: 'Davey aceita PF ≥ 1,5 para futuros com custos operacionais' },
                { label: 'N° de operações suficiente (≥ 100)', ok: nOps >= 100, value: nOps + ' ops', detail: 'Amostra mínima para avaliar consistência estatística' },
                { label: 'Curva suave (Sharpe ≥ 1)', ok: sharpe >= 1, value: sharpe.toFixed(2), detail: 'Curva de capital consistente e crescente' },
              ]
            },
            {
              name: 'Larry Williams',
              ref: 'Day Trade Futures Online / Long-Term Secrets to Short-Term Trading',
              focus: 'Day trade em futuros — expectativa e consistência',
              checks: [
                { label: 'Expectativa positiva por trade', ok: avgTrade > 0, value: fmtR(avgTrade), detail: 'Ganho médio por operação deve ser positivo' },
                { label: 'Taxa de acerto > 45%', ok: (metrics.winRate || 0) >= 45, value: (metrics.winRate || 0).toFixed(1) + '%', detail: 'Williams aceita taxas menores quando o payoff compensa' },
                { label: 'Payoff médio ≥ 1,0', ok: (metrics.payoff || 0) >= 1.0, value: (metrics.payoff || 0).toFixed(2), detail: 'Ganho médio ÷ perda média' },
              ]
            },
            {
              name: 'Robert Pardo',
              ref: 'The Evaluation and Optimization of Trading Strategies',
              focus: 'Walk-Forward Testing — consistência IS/OOS',
              checks: [
                { label: 'Possui períodos IS e OOS definidos', ok: hasOOS, value: hasOOS ? 'Sim' : 'Não', detail: 'Pardo exige separação obrigatória de dados in-sample e out-of-sample' },
                { label: 'Consistência IS → OOS (desvio ≤ 25%)', ok: oosConsistent, value: vr.paperVsOos !== null ? fmtPct(vr.paperVsOos) : 'N/D', detail: 'Resultado OOS não pode cair mais de 25% em relação ao IS' },
                { label: 'Amostra OOS ≥ 30 operações', ok: (vr.oosOps?.length || 0) >= 30, value: (vr.oosOps?.length || 0) + ' ops', detail: 'Mínimo para validade estatística no período OOS' },
              ]
            },
            {
              name: 'David Aronson',
              ref: 'Evidence-Based Technical Analysis',
              focus: 'Significância estatística — validação científica',
              checks: [
                { label: 'Teste de Hipótese (p ≤ 0,02)', ok: pval <= 0.02, value: pval.toFixed(4), detail: 'Apenas 2% de chance do resultado ser aleatório' },
                { label: 'M.6015 > 3,0', ok: m6 > 3, value: m6.toFixed(2), detail: 'Indicador composto de qualidade da estratégia' },
              ]
            },
          ]

          return specialists.map((sp, si) => {
            const passed = sp.checks.filter(c => c.ok).length
            const total = sp.checks.length
            const allOk = passed === total
            const someOk = passed > 0
            return (
              <div key={si} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: si < specialists.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{sp.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sp.ref}</div>
                    <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 1 }}>{sp.focus}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius)',
                    background: allOk ? 'var(--success-bg)' : someOk ? 'var(--warning-bg)' : 'var(--danger-bg)',
                    color: allOk ? 'var(--success)' : someOk ? 'var(--warning)' : 'var(--danger)' }}>
                    {passed}/{total} critérios
                  </span>
                </div>
                {sp.checks.map((c, ci) => (
                  <div key={ci} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{c.ok ? '✓' : '✗'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13 }}>{c.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: c.ok ? 'var(--success)' : 'var(--danger)' }}>{c.value}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          })
        })()}
      </div>

      {/* ── Sua observação ── */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Sua observação</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Anotação pessoal sobre esta estratégia. Salva automaticamente com o botão Salvar no cabeçalho.</div>
        <textarea
          value={observation}
          onChange={e => setObservation && setObservation(e.target.value)}
          placeholder="Escreva aqui suas observações, pontos de atenção, contexto de mercado, ajustes planejados..."
          rows={5}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <div style={{ marginTop:8, display:'flex', justifyContent:'flex-end' }}>
          <button className="btn sm primary" onClick={onSave}>Salvar observação</button>
        </div>
      </div>
    </div>
  )
}
