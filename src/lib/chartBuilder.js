import { calcStagnation } from './stagnation'

const LOGO_SRC = '/logo.png'
const BRAND_COLOR = '#22c55e'

// ── Logo watermark plugin ──────────────────────────────────────────────────
export const logoWatermarkPlugin = {
  id: 'logoWatermark',
  _img: null,
  _loaded: false,
  beforeDraw(chart) {
    if (!this._loaded) {
      if (!this._img) {
        const img = new Image()
        img.src = LOGO_SRC
        img.onload = () => { this._img = img; this._loaded = true; chart.draw() }
        this._img = img
      }
      return
    }
    const { ctx, chartArea: { left, top, right, bottom } } = chart
    const w = (right - left) * 0.13
    const h = w
    const x = right - w - 12
    const y = top + 8
    ctx.save()
    ctx.globalAlpha = 0.12
    ctx.drawImage(this._img, x, y, w, h)
    ctx.restore()
  }
}

// ── Color helpers ──────────────────────────────────────────────────────────
export function isDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function getChartColors() {
  const d = isDark()
  return {
    pos: d ? '#4ade80' : '#16a34a',
    neg: d ? '#f87171' : '#dc2626',
    blue: d ? '#60a5fa' : '#2563eb',
    purple: d ? '#a78bfa' : '#7c3aed',
    amber: d ? '#fbbf24' : '#d97706',
    gray: d ? '#6b7280' : '#9ca3af',
    grid: d ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)',
    text: d ? '#9ca3af' : '#6b7280',
    surface: d ? '#1e1e1c' : '#ffffff',
  }
}

// Gradient fill for equity curve (green top → transparent bottom)
export function makeEquityGradient(ctx, chartArea, positive = true) {
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
  if (positive) {
    gradient.addColorStop(0, 'rgba(34,197,94,0.35)')
    gradient.addColorStop(0.5, 'rgba(34,197,94,0.12)')
    gradient.addColorStop(1, 'rgba(34,197,94,0.01)')
  } else {
    gradient.addColorStop(0, 'rgba(239,68,68,0.35)')
    gradient.addColorStop(0.5, 'rgba(239,68,68,0.12)')
    gradient.addColorStop(1, 'rgba(239,68,68,0.01)')
  }
  return gradient
}

// Gradient fill for drawdown (red)
export function makeDrawdownGradient(ctx, chartArea) {
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
  gradient.addColorStop(0, 'rgba(239,68,68,0.60)')
  gradient.addColorStop(0.6, 'rgba(239,68,68,0.25)')
  gradient.addColorStop(1, 'rgba(239,68,68,0.05)')
  return gradient
}

// ── Stagnation band plugin ─────────────────────────────────────────────────
// showAll = false → só o pior período (modo padrão: Análise/RobotDetail)
// showAll = true  → todos os períodos, diferenciando: recuperado (azul), ativo (âmbar), pior (âmbar+label)
export function makeStagnationPlugin(stagPeriods, labels, showAll = false) {
  return {
    id: 'stagnationBands',
    beforeDraw(chart) {
      if (!stagPeriods || !stagPeriods.length) return
      const { ctx, chartArea, scales: { x } } = chart
      if (!x) return

      const toISO = (s) => {
        if (!s) return ''
        const p = s.split('/')
        return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : s
      }
      const labelsISO = labels.map(toISO)

      const worst = stagPeriods.reduce((a, b) => a.days >= b.days ? a : b)

      ctx.save()

      if (showAll) {
        // ── Modo Avançado: todos períodos ──
        // Ordem: primeiro renderiza recuperados (fundo), depois ativo/pior (frente)
        const sorted = [...stagPeriods].sort((a, b) => {
          if (a === worst) return 1
          if (b === worst) return -1
          if (a.active) return 1
          if (b.active) return -1
          return 0
        })

        for (const period of sorted) {
          const startISO = toISO(period.start)
          const endISO   = toISO(period.end)
          const si = labelsISO.findIndex(l => l >= startISO)
          if (si < 0) continue
          const rawEnd = labelsISO.findIndex(l => l >= endISO)
          const ei = rawEnd >= 0 ? rawEnd : labels.length - 1
          const x0 = x.getPixelForValue(si)
          const x1 = x.getPixelForValue(ei)
          if (x1 <= x0) continue

          const isWorst  = period === worst
          const isActive = !!period.active

          if (isWorst || isActive) {
            // Âmbar — pior ou ativo (não recuperado)
            ctx.fillStyle = `rgba(245,158,11,${isWorst ? 0.12 : 0.08})`
            ctx.fillRect(x0, chartArea.top, x1 - x0, chartArea.bottom - chartArea.top)
            ctx.strokeStyle = `rgba(245,158,11,${isWorst ? 0.55 : 0.30})`
            ctx.lineWidth = isWorst ? 1.5 : 1
            ctx.setLineDash([4, 3])
            ctx.beginPath(); ctx.moveTo(x0, chartArea.top); ctx.lineTo(x0, chartArea.bottom); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(x1, chartArea.top); ctx.lineTo(x1, chartArea.bottom); ctx.stroke()
            ctx.setLineDash([])
          } else {
            // Verde suave — recuperado
            ctx.fillStyle = 'rgba(52,212,126,0.04)'
            ctx.fillRect(x0, chartArea.top, x1 - x0, chartArea.bottom - chartArea.top)
            ctx.strokeStyle = 'rgba(52,212,126,0.18)'
            ctx.lineWidth = 0.8
            ctx.beginPath(); ctx.moveTo(x0, chartArea.top); ctx.lineTo(x0, chartArea.bottom); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(x1, chartArea.top); ctx.lineTo(x1, chartArea.bottom); ctx.stroke()
          }
        }

        // Label do pior período (âmbar, no topo)
        {
          const startISO = toISO(worst.start)
          const endISO   = toISO(worst.end)
          const si = labelsISO.findIndex(l => l >= startISO)
          const rawEnd = labelsISO.findIndex(l => l >= endISO)
          const ei = rawEnd >= 0 ? rawEnd : labels.length - 1
          if (si >= 0) {
            const x0 = x.getPixelForValue(si)
            const x1 = x.getPixelForValue(ei)
            const labelText = `Pior estagnação · ${worst.days}d · ${worst.start} → ${worst.end}`
            ctx.font = '10px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
            const tw = ctx.measureText(labelText).width
            const midX = Math.min(Math.max((x0 + x1) / 2, x0 + tw / 2 + 8), chartArea.right - tw / 2 - 8)
            const lY = chartArea.top + 14
            ctx.fillStyle = 'rgba(30,20,0,0.72)'
            const pad = 5, rx = midX - tw / 2 - pad, ry = lY - 11, rw = tw + pad * 2, rh = 16
            if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, 4); else ctx.rect(rx, ry, rw, rh)
            ctx.fill()
            ctx.fillStyle = 'rgba(251,191,36,0.92)'
            ctx.textAlign = 'center'
            ctx.fillText(labelText, midX, lY)
          }
        }

      } else {
        // ── Modo padrão: só o pior período ──
        const startISO = toISO(worst.start)
        const endISO   = toISO(worst.end)
        const startIdx = labelsISO.findIndex(l => l >= startISO)
        if (startIdx < 0) { ctx.restore(); return }
        const rawEnd = labelsISO.findIndex(l => l >= endISO)
        const endIdx = rawEnd >= 0 ? rawEnd : labels.length - 1
        const x0 = x.getPixelForValue(startIdx)
        const x1 = x.getPixelForValue(endIdx)
        if (x1 <= x0) { ctx.restore(); return }

        ctx.fillStyle = 'rgba(245,158,11,0.10)'
        ctx.fillRect(x0, chartArea.top, x1 - x0, chartArea.bottom - chartArea.top)
        ctx.strokeStyle = 'rgba(245,158,11,0.55)'
        ctx.lineWidth = 1.5; ctx.setLineDash([4, 3])
        ctx.beginPath(); ctx.moveTo(x0, chartArea.top); ctx.lineTo(x0, chartArea.bottom); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x1, chartArea.top); ctx.lineTo(x1, chartArea.bottom); ctx.stroke()
        ctx.setLineDash([])

        const labelText = `Estagnação máx. · ${worst.days}d · ${worst.start} → ${worst.end}`
        ctx.font = '10px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
        const tw = ctx.measureText(labelText).width
        const midX = Math.min(Math.max((x0 + x1) / 2, x0 + tw / 2 + 8), chartArea.right - tw / 2 - 8)
        const lY = chartArea.top + 14
        ctx.fillStyle = 'rgba(30,20,0,0.72)'
        const pad = 5, rx = midX - tw / 2 - pad, ry = lY - 11, rw = tw + pad * 2, rh = 16
        if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, 4); else ctx.rect(rx, ry, rw, rh)
        ctx.fill()
        ctx.fillStyle = 'rgba(251,191,36,0.92)'
        ctx.textAlign = 'center'
        ctx.fillText(labelText, midX, lY)
      }

      ctx.restore()
    }
  }
}

// ── Build equity chart with stagnation + drawdown ─────────────────────────
export function buildEquityWithDrawdown(equityCanvas, ddCanvas, adjOps, capital) {
  const c = getChartColors()
  const labels = adjOps.map(o => o.abertura.slice(0, 10))
  const equityData = adjOps.map(o => {
    const v = o.totalAdj !== undefined ? o.totalAdj : o.portfolioTotal
    return +v.toFixed(2)
  })

  // Drawdown series
  let acc = 0, peak = 0
  const ddData = adjOps.map(o => {
    const val = o.resAdj !== undefined ? o.resAdj : o.resWeighted
    acc += val
    if (acc > peak) peak = acc
    return capital > 0 ? +((-(peak - acc) / capital * 100).toFixed(2)) : 0
  })

  const stag = calcStagnation(adjOps)
  const stagPlugin = makeStagnationPlugin(stag.periods, labels)

  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false } },
  }

  // Equity chart
  const equityChart = new (window.Chart || require('chart.js').Chart)(equityCanvas, {
    type: 'line',
    plugins: [logoWatermarkPlugin, stagPlugin],
    data: {
      labels,
      datasets: [{
        data: equityData,
        borderColor: BRAND_COLOR,
        backgroundColor: (ctx) => {
          if (!ctx.chart.chartArea) return 'transparent'
          return makeEquityGradient(ctx.chart.ctx, ctx.chart.chartArea, true)
        },
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      }]
    },
    options: {
      ...baseOpts,
      scales: {
        x: { ticks: { color: c.text, maxTicksLimit: 10, font: { size: 11 } }, grid: { color: c.grid } },
        y: { ticks: { color: c.text, callback: v => 'R$ ' + v.toLocaleString('pt-BR') }, grid: { color: c.grid } }
      }
    }
  })

  // Drawdown chart
  const ddChart = new (window.Chart || require('chart.js').Chart)(ddCanvas, {
    type: 'line',
    plugins: [logoWatermarkPlugin],
    data: {
      labels,
      datasets: [{
        data: ddData,
        borderColor: 'rgb(239,68,68)',
        backgroundColor: (ctx) => {
          if (!ctx.chart.chartArea) return 'transparent'
          return makeDrawdownGradient(ctx.chart.ctx, ctx.chart.chartArea)
        },
        fill: 'origin',
        tension: 0.2,
        pointRadius: 0,
        borderWidth: 1.5,
      }]
    },
    options: {
      ...baseOpts,
      scales: {
        x: { ticks: { color: c.text, maxTicksLimit: 10, font: { size: 11 } }, grid: { color: c.grid } },
        y: {
          ticks: { color: c.text, callback: v => v.toFixed(1) + '%' },
          grid: { color: c.grid },
          max: 0,
        }
      }
    }
  })

  return { equityChart, ddChart, stag }
}

// ── Drawdown gauge (thermometer) ──────────────────────────────────────────
export function drawDDGauge(canvas, currentDDPct) {
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)

  const pct = Math.min(Math.abs(currentDDPct), 100) / 100
  const barW = width * 0.3
  const barH = height * 0.7
  const barX = (width - barW) / 2
  const barY = height * 0.1

  // Background bar
  ctx.fillStyle = isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
  ctx.beginPath()
  ctx.roundRect(barX, barY, barW, barH, barW / 2)
  ctx.fill()

  // Filled portion (from bottom up)
  const fillH = barH * pct
  const fillY = barY + barH - fillH
  const gradient = ctx.createLinearGradient(0, fillY, 0, barY + barH)
  gradient.addColorStop(0, '#ef4444')
  gradient.addColorStop(0.5, '#f97316')
  gradient.addColorStop(1, '#dc2626')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.roundRect(barX, fillY, barW, fillH, barW / 2)
  ctx.fill()

  // Percentage label
  ctx.fillStyle = isDark() ? '#e8e6de' : '#1a1a18'
  ctx.font = `bold ${Math.round(width * 0.13)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(Math.abs(currentDDPct).toFixed(1) + '%', width / 2, barY + barH + height * 0.1)

  ctx.font = `${Math.round(width * 0.09)}px sans-serif`
  ctx.fillStyle = isDark() ? '#9ca3af' : '#6b7280'
  ctx.fillText('DD atual', width / 2, barY + barH + height * 0.2)
}

// ── Correlation color scale ────────────────────────────────────────────────
// 0 → blue, 0.5 → neutral, 1 → fuchsia, -1 → green
export function corrToColor(v, alpha = 0.7) {
  if (v >= 0) {
    // 0→blue, 1→fuchsia
    const t = v
    const r = Math.round(59 + t * (217 - 59))   // 59→217
    const g = Math.round(130 + t * (0 - 130))    // 130→0
    const b = Math.round(246 + t * (139 - 246))  // 246→139
    return `rgba(${r},${g},${b},${alpha})`
  } else {
    // 0→blue, -1→teal/green
    const t = Math.abs(v)
    const r = Math.round(59 + t * (16 - 59))
    const g = Math.round(130 + t * (163 - 130))
    const b = Math.round(246 + t * (74 - 246))
    return `rgba(${r},${g},${b},${alpha})`
  }
}

export function corrToTextColor(v) {
  const abs = Math.abs(v)
  if (abs > 0.6) return isDark() ? '#f9fafb' : '#111827'
  return isDark() ? '#d1d5db' : '#374151'
}
