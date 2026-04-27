// ── CSV Parser ────────────────────────────────────────────────────────────────
export function parseCSV(buffer) {
  const bytes = new Uint8Array(buffer)
  const decoder = new TextDecoder('windows-1252')
  const text = decoder.decode(bytes)
  const lines = text.split('\n')

  const meta = {
    conta: lines[0]?.split(':').slice(1).join(':').trim() || '',
    titular: lines[1]?.split(':').slice(1).join(':').trim() || '',
    dtInicial: lines[2]?.split(':').slice(1).join(':').trim() || '',
    dtFinal: lines[3]?.split(':').slice(1).join(':').trim() || '',
  }

  const headers = lines[5]?.split(';').map(h => h.trim()) || []
  const ops = []

  for (let i = 6; i < lines.length; i++) {
    const row = lines[i].split(';')
    if (row.length < 5 || !row[0]?.trim()) continue
    const obj = {}
    headers.forEach((h, j) => { obj[h] = row[j]?.trim() })

    const resOp = parseNum(obj['Res. Operação'])
    if (isNaN(resOp)) continue

    ops.push({
      num: parseInt(obj['Número Operação']) || i - 5,
      ativo: obj['Ativo'] || '',
      abertura: obj['Abertura'] || '',
      fechamento: obj['Fechamento'] || '',
      lado: obj['Lado'] || '',
      qtd: parseInt(obj['Qtd Compra']) || 1,
      res_op: resOp,
      res_op_pct: parseNum(obj['Res. Operação (%)']) || 0,
      tempo: obj['Tempo Operação'] || '',
    })
  }

  return { meta, ops }
}

function parseNum(s) {
  if (s === undefined || s === null || s === '') return NaN
  if (typeof s === 'number') return s
  return parseFloat(String(s).replace(/\./g, '').replace(',', '.'))
}

// ── Desagio ───────────────────────────────────────────────────────────────────
export function applyDesagio(val, pct) {
  if (!pct) return val
  const f = Math.abs(pct) / 100
  if (val > 0) return val * (1 - f)
  if (val < 0) return val * (1 + f)
  return val
}

export function buildAdjOps(ops, desagio, tipo) {
  const pct = tipo === 'backtest' ? (desagio || 0) : 0
  let acc = 0
  return ops.map(op => {
    const adj = applyDesagio(op.res_op, pct)
    acc += adj
    return { ...op, resAdj: adj, totalAdj: acc }
  })
}

// ── Metrics ───────────────────────────────────────────────────────────────────
export function calcMetrics(adjOps, desagio = 0, tipo = 'backtest') {
  if (!adjOps.length) return {}
  const totalBruto = adjOps[adjOps.length - 1].totalAdj
  const wins = adjOps.filter(o => o.resAdj > 0)
  const losses = adjOps.filter(o => o.resAdj < 0)
  const winRate = adjOps.length ? wins.length / adjOps.length * 100 : 0
  const avgWin = wins.length ? wins.reduce((a, b) => a + b.resAdj, 0) / wins.length : 0
  const avgLoss = losses.length ? Math.abs(losses.reduce((a, b) => a + b.resAdj, 0) / losses.length) : 1
  const grossWin = wins.reduce((a, b) => a + b.resAdj, 0)
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b.resAdj, 0))
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : 999
  const payoff = avgLoss > 0 ? avgWin / avgLoss : 0

  // Drawdown & capital
  let acc = 0, peak = 0, maxDD = 0
  adjOps.forEach(o => {
    acc += o.resAdj
    if (acc > peak) peak = acc
    const dd = peak - acc
    if (dd > maxDD) maxDD = dd
  })
  const capital = maxDD * 2

  // Current DD
  acc = 0; peak = 0
  let ddAtual = 0
  adjOps.forEach(o => {
    acc += o.resAdj
    if (acc > peak) peak = acc
    ddAtual = peak - acc
  })

  const rentPct = capital > 0 ? totalBruto / capital * 100 : 0
  const ddAtualPct = capital > 0 ? ddAtual / capital * 100 : 0
  const ddMaxPct = capital > 0 ? maxDD / capital * 100 : 0

  // Anos
  const anos = calcAnos(adjOps)
  const fatRec = maxDD > 0 ? totalBruto / maxDD : 0
  const fatRecAnual = anos > 0 ? fatRec / anos : 0
  const m6015 = profitFactor + fatRecAnual

  // Sharpe
  const returns = adjOps.map(o => o.resAdj)
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const std = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length)
  const sharpe = std > 0 ? mean / std * Math.sqrt(252) : 0

  // T-test (one sample, H0: mean = 0)
  const tStat = std > 0 ? mean / (std / Math.sqrt(returns.length)) : 0
  const pValue = tDistPValue(Math.abs(tStat), returns.length - 1)

  return {
    totalBruto, winRate, avgWin, avgLoss, grossWin, grossLoss,
    profitFactor, payoff, maxDD, capital, ddAtual, ddAtualPct,
    ddMaxPct, rentPct, anos, fatRec, fatRecAnual, m6015, sharpe,
    mean, std, tStat, pValue, nOps: adjOps.length,
    nWins: wins.length, nLosses: losses.length,
  }
}

function calcAnos(ops) {
  if (!ops.length) return 1
  const parseDate = s => {
    const parts = s.split(' ')[0].split('/')
    return new Date(+parts[2], +parts[1] - 1, +parts[0])
  }
  const d1 = parseDate(ops[0].abertura)
  const d2 = parseDate(ops[ops.length - 1].fechamento || ops[ops.length - 1].abertura)
  return Math.max((d2 - d1) / (1000 * 60 * 60 * 24 * 365.25), 1 / 12)
}

// Approximate two-tailed p-value via t-distribution (Abramowitz & Stegun)
function tDistPValue(t, df) {
  const x = df / (df + t * t)
  const betaInc = incompleteBeta(x, df / 2, 0.5)
  return Math.min(1, betaInc)
}

function incompleteBeta(x, a, b) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b)
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a
  return front * betaCF(x, a, b)
}

function betaCF(x, a, b) {
  const MAXIT = 200, EPS = 3e-7
  let qab = a + b, qap = a + 1, qam = a - 1
  let c = 1, d = 1 - qab * x / qap
  if (Math.abs(d) < 1e-30) d = 1e-30
  d = 1 / d; let h = d
  for (let m = 1; m <= MAXIT; m++) {
    let m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d; h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d; let del = d * c; h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x, tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let s = 1.000000000190015
  for (let j = 0; j < 6; j++) s += c[j] / ++y
  return -tmp + Math.log(2.5066282746310005 * s / x)
}

// ── Period analytics ──────────────────────────────────────────────────────────
export function filterByPeriod(adjOps, start, end) {
  if (!start && !end) return adjOps
  return adjOps.filter(op => {
    const d = parseOpDate(op.abertura)
    if (start && d < new Date(start)) return false
    if (end && d > new Date(end + 'T23:59:59')) return false
    return true
  })
}

function parseOpDate(s) {
  const parts = s.split(' ')[0].split('/')
  return new Date(+parts[2], +parts[1] - 1, +parts[0])
}

export function calcPeriodMetrics(ops) {
  if (!ops.length) return { total: 0, perOp: 0, nOps: 0 }
  const total = ops.reduce((a, b) => a + b.resAdj, 0)
  return { total, perOp: total / ops.length, nOps: ops.length }
}

// ── Chart helpers ─────────────────────────────────────────────────────────────
export function buildMonthlyData(adjOps) {
  const monthly = {}
  adjOps.forEach(o => {
    const parts = o.abertura.split(' ')[0].split('/')
    const key = `${parts[2]}-${parts[1]}`
    monthly[key] = (monthly[key] || 0) + o.resAdj
  })
  const keys = Object.keys(monthly).sort()
  return {
    labels: keys.map(k => { const [y, m] = k.split('-'); return `${m}/${y.slice(2)}` }),
    data: keys.map(k => +monthly[k].toFixed(2))
  }
}

export function buildYearlyData(adjOps) {
  const yearly = {}
  adjOps.forEach(o => {
    const y = o.abertura.split(' ')[0].split('/')[2]
    yearly[y] = (yearly[y] || 0) + o.resAdj
  })
  const keys = Object.keys(yearly).sort()
  return { labels: keys, data: keys.map(k => +yearly[k].toFixed(2)) }
}

export function buildHourlyData(adjOps) {
  const hourly = {}
  adjOps.forEach(o => {
    const timePart = o.abertura.split(' ')[1] || '00:00:00'
    const h = timePart.slice(0, 2)
    if (!hourly[h]) hourly[h] = { total: 0, count: 0 }
    hourly[h].total += o.resAdj
    hourly[h].count++
  })
  const keys = Object.keys(hourly).sort()
  return {
    labels: keys.map(h => `${h}h`),
    totals: keys.map(k => +hourly[k].total.toFixed(2)),
    counts: keys.map(k => hourly[k].count)
  }
}

export function buildSideData(adjOps) {
  const compras = adjOps.filter(o => o.lado === 'C')
  const vendas = adjOps.filter(o => o.lado === 'V')
  const sumAdj = arr => arr.reduce((a, b) => a + b.resAdj, 0)
  return {
    labels: ['Compra', 'Venda'],
    totals: [+sumAdj(compras).toFixed(2), +sumAdj(vendas).toFixed(2)],
    counts: [compras.length, vendas.length]
  }
}

// ── Formatting ────────────────────────────────────────────────────────────────
export function fmtR(v) {
  const abs = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (v < 0 ? '- R$ ' : 'R$ ') + abs
}

export function fmtPct(v, decimals = 1) {
  return (v >= 0 ? '+' : '') + v.toFixed(decimals) + '%'
}

export function fmtNum(v, dec = 2) {
  return v.toFixed(dec)
}

// ── Recovered Drawdown ────────────────────────────────────────────────────
// Returns the largest drawdown that was FULLY RECOVERED (new peak made after)
// plus the current (possibly unrecovered) drawdown
export function calcRecoveredDD(adjOps) {
  if (!adjOps.length) return { recoveredMaxDD: 0, currentDD: 0, currentDDPct: null }

  // Build cumulative curve
  let acc = 0
  const curve = adjOps.map(o => { acc += o.resAdj; return acc })

  let peak = -Infinity
  let troughAfterPeak = Infinity
  let recoveredMaxDD = 0
  let currentPeak = -Infinity
  let currentDD = 0

  // Scan for completed DD cycles (peak → trough → new peak)
  let localPeak = curve[0]
  let localTrough = curve[0]
  let inDD = false

  for (let i = 0; i < curve.length; i++) {
    const val = curve[i]
    if (val > localPeak) {
      if (inDD) {
        // Recovered! Record this DD
        const dd = localPeak - localTrough
        if (dd > recoveredMaxDD) recoveredMaxDD = dd
        inDD = false
      }
      localPeak = val
      localTrough = val
    } else if (val < localTrough) {
      localTrough = val
      inDD = true
    }
  }

  // Current DD (may or may not be recovered)
  const lastVal = curve[curve.length - 1]
  currentDD = Math.max(0, localPeak - lastVal)

  return { recoveredMaxDD, currentDD }
}

// ── DD recovery counts ─────────────────────────────────────────────────────
// Counts how many drawdown cycles (peak→trough→new peak) were recovered
// for a given DD threshold (in % of capital).
//   capital: capital base to convert DD R$ to %
//   threshPct: minimum DD% to count (e.g., 10 = "≥ 10%")
//
// Returns:
//   total: total cycles ≥ threshold (recovered + still active)
//   recovered: cycles that fully recovered (price made a new peak)
//   active: 1 if currently in a DD ≥ threshold and not yet recovered, else 0
export function calcRecoveryStats(adjOps, capital, threshPct = 10) {
  if (!adjOps?.length || !capital || capital <= 0) {
    return { total: 0, recovered: 0, active: 0, threshPct }
  }

  let acc = 0
  const curve = adjOps.map(o => { acc += o.resAdj; return acc })

  let localPeak = curve[0]
  let localTrough = curve[0]
  let inDD = false
  let recovered = 0
  let total = 0
  const minDD = (threshPct / 100) * capital  // R$

  for (let i = 0; i < curve.length; i++) {
    const val = curve[i]
    if (val > localPeak) {
      if (inDD) {
        const dd = localPeak - localTrough
        if (dd >= minDD) { total++; recovered++ }
        inDD = false
      }
      localPeak = val
      localTrough = val
    } else if (val < localTrough) {
      localTrough = val
      inDD = true
    }
  }

  // Active DD at the end?
  let active = 0
  if (inDD) {
    const dd = localPeak - localTrough
    if (dd >= minDD) { total++; active = 1 }
  }

  return { total, recovered, active, threshPct }
}

// ── Rolling profit factor ─────────────────────────────────────────────────
export function calcRollingPF(adjOps, window = 50) {
  const result = []
  for (let i = window - 1; i < adjOps.length; i++) {
    const slice = adjOps.slice(i - window + 1, i + 1)
    const wins = slice.filter(o => o.resAdj > 0).reduce((a, b) => a + b.resAdj, 0)
    const losses = Math.abs(slice.filter(o => o.resAdj < 0).reduce((a, b) => a + b.resAdj, 0))
    result.push({
      index: i,
      num: i + 1,
      pf: losses > 0 ? +(wins / losses).toFixed(3) : wins > 0 ? 9.99 : 0
    })
  }
  return result
}

// ── Streak analysis ───────────────────────────────────────────────────────
export function calcStreaks(adjOps) {
  if (!adjOps.length) return { maxWin: 0, maxLoss: 0, series: [] }

  let curWin = 0, curLoss = 0
  let maxWin = 0, maxLoss = 0
  const series = [] // +N for win streaks, -N for loss streaks

  for (const op of adjOps) {
    if (op.resAdj > 0) {
      curWin++
      if (curLoss > 0) { series.push(-curLoss); if (curLoss > maxLoss) maxLoss = curLoss }
      curLoss = 0
    } else if (op.resAdj < 0) {
      curLoss++
      if (curWin > 0) { series.push(curWin); if (curWin > maxWin) maxWin = curWin }
      curWin = 0
    }
  }
  if (curWin > 0) { series.push(curWin); if (curWin > maxWin) maxWin = curWin }
  if (curLoss > 0) { series.push(-curLoss); if (curLoss > maxLoss) maxLoss = curLoss }

  return { maxWin, maxLoss, series }
}

// ── Day of week analysis ──────────────────────────────────────────────────
export function calcByWeekday(adjOps) {
  const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const data = {}
  for (let i = 0; i < 7; i++) data[i] = { total: 0, count: 0, wins: 0, losses: 0 }

  adjOps.forEach(op => {
    const parts = op.abertura.split(' ')[0].split('/')
    const date = new Date(+parts[2], +parts[1]-1, +parts[0])
    const dow = date.getDay()
    data[dow].total += op.resAdj
    data[dow].count++
    if (op.resAdj > 0) data[dow].wins++
    else if (op.resAdj < 0) data[dow].losses++
  })

  return [1,2,3,4,5].map(d => ({
    label: days[d],
    total: +data[d].total.toFixed(2),
    count: data[d].count,
    avg: data[d].count > 0 ? +(data[d].total / data[d].count).toFixed(2) : 0,
    winRate: data[d].count > 0 ? +(data[d].wins / data[d].count * 100).toFixed(1) : 0
  }))
}

// ── Validation status helper ──────────────────────────────────────────────
export function getValidationStatus(metrics, periods) {
  if (!metrics || !periods) return null
  const hasPeriods = periods.out_sample_start || periods.paper_start
  if (!hasPeriods) return null

  const pvalOk = metrics.pValue !== undefined ? metrics.pValue <= 0.02 : false
  const m6015Val = metrics.m6015 || 0

  if (!pvalOk || m6015Val <= 2.5) return 'REPROVADO'

  // Parse paper period — if end is blank, use today
  let paperMonths = 0
  try {
    const pj = periods.periods_json ? (typeof periods.periods_json === 'string' ? JSON.parse(periods.periods_json) : periods.periods_json) : null
    const paper = pj?.paper || (periods.paper_start ? { start: periods.paper_start, end: periods.paper_end } : null)
    if (paper?.start) {
      const d1 = new Date(paper.start)
      const d2 = paper.end ? new Date(paper.end) : new Date()
      paperMonths = Math.max(0, (d2 - d1) / (1000 * 60 * 60 * 24 * 30.44))
    }
  } catch(e) {}

  const hasMinReal = paperMonths >= 3

  if (!hasMinReal) return 'APROVADO_SIMULADOR'
  if (m6015Val > 2.5 && m6015Val <= 3) return 'APROVADO_CAUTELA'
  return 'APROVADO'
}

export const STATUS_LABELS = {
  APROVADO:          { label: 'Aprovada',       short: '✓', color: '#16a34a', bg: '#dcfce7' },
  APROVADO_CAUTELA:  { label: 'Com cautela',    short: '⚠', color: '#d97706', bg: '#fef9c3' },
  APROVADO_SIMULADOR:{ label: 'Simulador',      short: '~', color: '#7c3aed', bg: '#ede9fe' },
  EM_ANALISE:        { label: 'Em análise',     short: '⏳', color: '#ea580c', bg: '#fff7ed' },
  REPROVADO:         { label: 'Reprovada',      short: '✗', color: '#dc2626', bg: '#fee2e2' },
}


// ── Monte Carlo Simulation ────────────────────────────────────────────────
// Shuffles trade sequence N times to build DD and result distributions
// Returns percentiles and risk of ruin (% simulations with loss > ruinPct of capital)
export function calcMonteCarlo(adjOps, capital, simulations = 1000, ruinThreshold = 0.50) {
  if (!adjOps || adjOps.length < 10) return null

  const returns = adjOps.map(o => o.resAdj || 0)
  const n = returns.length
  const maxDDs = [], finalResults = []
  let ruinCount = 0
  const ruinLevel = -(capital * ruinThreshold)

  for (let sim = 0; sim < simulations; sim++) {
    // Fisher-Yates shuffle
    const shuffled = [...returns]
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp
    }
    let acc = 0, peak = 0, maxDD = 0, ruined = false
    for (const r of shuffled) {
      acc += r
      if (acc > peak) peak = acc
      const dd = peak - acc
      if (dd > maxDD) maxDD = dd
      if (!ruined && capital > 0 && acc <= ruinLevel) { ruinCount++; ruined = true }
    }
    maxDDs.push(maxDD)
    finalResults.push(acc)
  }

  maxDDs.sort((a, b) => a - b)
  finalResults.sort((a, b) => a - b)

  const pct = (arr, p) => arr[Math.floor(arr.length * p / 100)] || 0
  const probPositive = finalResults.filter(r => r > 0).length / simulations * 100

  return {
    simulations,
    ddP50: +pct(maxDDs, 50).toFixed(2),
    ddP90: +pct(maxDDs, 90).toFixed(2),
    ddP95: +pct(maxDDs, 95).toFixed(2),
    ddP50Pct: capital > 0 ? +(pct(maxDDs, 50) / capital * 100).toFixed(1) : 0,
    ddP90Pct: capital > 0 ? +(pct(maxDDs, 90) / capital * 100).toFixed(1) : 0,
    ddP95Pct: capital > 0 ? +(pct(maxDDs, 95) / capital * 100).toFixed(1) : 0,
    resultP10: +pct(finalResults, 10).toFixed(2),
    resultP50: +pct(finalResults, 50).toFixed(2),
    resultP90: +pct(finalResults, 90).toFixed(2),
    probPositive: +probPositive.toFixed(1),
    riskOfRuin: +(ruinCount / simulations * 100).toFixed(1),
    ruinThresholdPct: ruinThreshold * 100,
  }
}

// ── Robot Score Calculator ───────────────────────────────────────────────
// 1pt each green metric in Visão Geral + Monte Carlo
// 2pt each ok criterion in Validação
// 1.5pt each green criterion in specialist analysis
export function calcRobotScore(metrics, periods, adjOps, mcResult) {
  let score = 0
  let maxScore = 0
  const breakdown = []

  const add = (pts, label, ok) => {
    maxScore += pts
    if (ok !== false) { score += pts; breakdown.push({ pts, label }) }
  }

  if (!metrics) return { score: 0, maxScore: 0, breakdown }

  // ── Visão Geral (1pt each) ──
  add(1, 'Resultado positivo', (metrics.totalBruto || 0) > 0)
  add(1, 'Taxa de acerto ≥ 50%', (metrics.winRate || 0) >= 50)
  add(1, 'Fator de lucro ≥ 1,5', (metrics.profitFactor || 0) >= 1.5)
  add(1, 'Payoff ≥ 1', (metrics.payoff || 0) >= 1)
  add(1, 'DD atual ≤ 20%', (metrics.ddAtualPct || 0) <= 20)
  add(1, 'M.6015 > 3', (metrics.m6015 || 0) > 3)
  add(1, 'Fat. recuperação anual ≥ 2', (metrics.fatRecAnual || 0) >= 2)
  add(1, 'Teste de hipótese significativo', (metrics.pValue || 1) <= 0.02)
  add(1, 'Sharpe ≥ 1', (metrics.sharpe || 0) >= 1)

  // ── Monte Carlo (1pt each) ──
  // MC items (optional)
  add(1, 'MC: prob. positivo ≥ 70%', mcResult && (mcResult.probPositive || 0) >= 70)
  add(1, 'MC: risco de ruína ≤ 5%', mcResult && (mcResult.riskOfRuin || 100) <= 5)
  add(1, 'MC: DD P90 ≤ 50%', mcResult && (mcResult.ddP90Pct || 100) <= 50)
  // Risco de Ruína ≤ 10% para conta real — 2 pontos (critério mais amplo que o ≤5%)
  add(2, 'MC: risco de ruína ≤ 10% (conta real)', mcResult && (mcResult.riskOfRuin || 100) <= 10)

  // ── Validação (2pt each) ──
  const hasOOS = periods?.out_sample_start || periods?.paper_start
  if (hasOOS) {
    const pj = (() => { try { return periods.periods_json ? (typeof periods.periods_json === 'string' ? JSON.parse(periods.periods_json) : periods.periods_json) : null } catch(e) { return null } })()
    const oosPeriods = pj?.outSamples || (periods.out_sample_start ? [{ start: periods.out_sample_start, end: periods.out_sample_end }] : [])
    const paper = pj?.paper || (periods.paper_start ? { start: periods.paper_start, end: periods.paper_end } : null)

    add(2, 'Val: Teste de hipótese OK', (metrics.pValue || 1) <= 0.02)
    add(2, 'Val: M.6015 > 3', (metrics.m6015 || 0) > 3)

    // Paper months
    let paperMonths = 0
    if (paper?.start) {
      const d1 = new Date(paper.start), d2 = paper.end ? new Date(paper.end) : new Date()
      paperMonths = (d2 - d1) / (1000 * 60 * 60 * 24 * 30.44)
    }
    add(2, 'Val: ≥ 3 meses real/paper', paperMonths >= 3)
  }

  // ── Especialistas (1.5pt each) ──
  const pf = metrics.profitFactor || 0
  const nOps = adjOps?.length || 0
  const sharpe = metrics.sharpe || 0
  const avgTrade = nOps > 0 ? (metrics.totalBruto || 0) / nOps : 0

  // Davey
  add(1.5, 'Davey: PF ≥ 1,5', pf >= 1.5)
  add(1.5, 'Davey: N ops ≥ 100', nOps >= 100)
  add(1.5, 'Davey: Sharpe ≥ 1', sharpe >= 1)
  // Williams
  add(1.5, 'Williams: expectativa positiva', avgTrade > 0)
  add(1.5, 'Williams: acerto ≥ 45%', (metrics.winRate || 0) >= 45)
  if ((metrics.payoff || 0) >= 1)            add(1.5, 'Williams: payoff ≥ 1')
  // Pardo
  add(1.5, 'Pardo: possui IS/OOS', !!hasOOS)
  // Aronson
  add(1.5, 'Aronson: p ≤ 0,02', (metrics.pValue || 1) <= 0.02)
  add(1.5, 'Aronson: M.6015 > 3', (metrics.m6015 || 0) > 3)

  return { score: +score.toFixed(1), maxScore: +maxScore.toFixed(1), breakdown }
}
