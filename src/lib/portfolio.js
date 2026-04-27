// ── Portfolio Analytics ───────────────────────────────────────────────────────
// Each robot entry: { robot, lots, adjOps }
// adjOps already have desagio applied

// Build unified timeline: merge all ops from all robots, weighted by lots
export function buildPortfolioTimeline(entries) {
  const allOps = []
  for (const { robot, lots, adjOps } of entries) {
    for (const op of adjOps) {
      allOps.push({
        ...op,
        robotId: robot.id,
        robotName: robot.name,
        resWeighted: op.resAdj * lots,
        lots,
      })
    }
  }
  // Sort by abertura date+time
  allOps.sort((a, b) => parseDateTime(a.abertura) - parseDateTime(b.abertura))

  // Build cumulative
  let acc = 0
  return allOps.map(op => {
    acc += op.resWeighted
    return { ...op, portfolioTotal: acc }
  })
}

function parseDateTime(s) {
  if (!s) return 0
  const [datePart, timePart = '00:00:00'] = s.split(' ')
  const [d, m, y] = datePart.split('/')
  return new Date(`${y}-${m}-${d}T${timePart}`).getTime()
}

// Portfolio metrics from timeline ops
export function calcPortfolioMetrics(timelineOps, multiplier = 3) {
  if (!timelineOps.length) return {}

  const results = timelineOps.map(o => o.resWeighted)
  const totalBruto = results.reduce((a, b) => a + b, 0)
  const wins = results.filter(r => r > 0)
  const losses = results.filter(r => r < 0)
  const winRate = results.length ? wins.length / results.length * 100 : 0
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0
  const avgLoss = losses.length ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 1
  const grossWin = wins.reduce((a, b) => a + b, 0)
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0))
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : 999
  const payoff = avgLoss > 0 ? avgWin / avgLoss : 0

  // Real drawdown from consolidated curve
  let acc = 0, peak = 0, maxDD = 0
  timelineOps.forEach(op => {
    acc += op.resWeighted
    if (acc > peak) peak = acc
    const dd = peak - acc
    if (dd > maxDD) maxDD = dd
  })

  const capital = maxDD * multiplier
  let acc2 = 0, peak2 = 0, ddAtual = 0
  timelineOps.forEach(op => {
    acc2 += op.resWeighted
    if (acc2 > peak2) peak2 = acc2
    ddAtual = peak2 - acc2
  })

  const rentPct = capital > 0 ? totalBruto / capital * 100 : 0
  const ddAtualPct = capital > 0 ? ddAtual / capital * 100 : 0
  const ddMaxPct = capital > 0 ? maxDD / capital * 100 : 0

  // Annualized recovery factor
  const anos = calcAnosFromOps(timelineOps)
  const fatRec = maxDD > 0 ? totalBruto / maxDD : 0
  const fatRecAnual = anos > 0 ? fatRec / anos : 0
  const m6015 = profitFactor + fatRecAnual

  // Sharpe
  const mean = results.reduce((a, b) => a + b, 0) / results.length
  const std = Math.sqrt(results.reduce((a, b) => a + (b - mean) ** 2, 0) / results.length)
  const sharpe = std > 0 ? mean / std * Math.sqrt(252) : 0

  return {
    totalBruto, winRate, profitFactor, payoff, maxDD, capital,
    ddAtual, ddAtualPct, ddMaxPct, rentPct, fatRec, fatRecAnual,
    m6015, sharpe, mean, std, anos,
    nOps: results.length, nWins: wins.length, nLosses: losses.length,
  }
}

function calcAnosFromOps(ops) {
  if (ops.length < 2) return 1
  const t0 = parseDateTime(ops[0].abertura)
  const t1 = parseDateTime(ops[ops.length - 1].abertura)
  return Math.max((t1 - t0) / (1000 * 60 * 60 * 24 * 365.25), 1 / 12)
}

// ── Correlation ───────────────────────────────────────────────────────────────
// Build daily PnL series per robot, aligned on same date axis
export function buildDailyPnl(entries) {
  const allDates = new Set()
  const robotDailyMap = {}

  for (const { robot, lots, adjOps } of entries) {
    const daily = {}
    for (const op of adjOps) {
      const date = op.abertura.split(' ')[0] // dd/mm/yyyy
      daily[date] = (daily[date] || 0) + op.resAdj * lots
    }
    robotDailyMap[robot.id] = { name: robot.name, daily }
    Object.keys(daily).forEach(d => allDates.add(d))
  }

  const dates = Array.from(allDates).sort((a, b) => {
    const [da, ma, ya] = a.split('/').map(Number)
    const [db, mb, yb] = b.split('/').map(Number)
    return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db)
  })

  // Build series aligned to all dates (0 if no trade that day)
  const series = {}
  for (const [robotId, { name, daily }] of Object.entries(robotDailyMap)) {
    series[robotId] = { name, values: dates.map(d => daily[d] || 0) }
  }

  return { dates, series }
}

// Pearson correlation between two arrays
export function pearsonCorr(x, y) {
  const n = x.length
  if (n < 2) return 0
  const mx = x.reduce((a, b) => a + b, 0) / n
  const my = y.reduce((a, b) => a + b, 0) / n
  const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0)
  const den = Math.sqrt(
    x.reduce((s, xi) => s + (xi - mx) ** 2, 0) *
    y.reduce((s, yi) => s + (yi - my) ** 2, 0)
  )
  return den === 0 ? 0 : num / den
}

// Build full correlation matrix
export function buildCorrelationMatrix(entries) {
  const { series } = buildDailyPnl(entries)
  const ids = Object.keys(series)
  const names = ids.map(id => series[id].name)
  const matrix = []

  for (let i = 0; i < ids.length; i++) {
    const row = []
    for (let j = 0; j < ids.length; j++) {
      row.push(pearsonCorr(series[ids[i]].values, series[ids[j]].values))
    }
    matrix.push(row)
  }

  return { ids, names, matrix }
}

// Scatter data for a pair of robots
export function buildScatterData(entries, idA, idB) {
  const { dates, series } = buildDailyPnl(entries)
  const sA = series[idA]
  const sB = series[idB]
  if (!sA || !sB) return []
  return dates.map((d, i) => ({ x: sA.values[i], y: sB.values[i], date: d }))
    .filter(p => p.x !== 0 || p.y !== 0)
}
