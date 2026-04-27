// Stagnation = longest period without a new equity peak
// Logic: scan cumulative equity op-by-op, find each peak and when it's broken
// Measure calendar days from peak date to recovery date

export function calcStagnation(ops) {
  if (!ops.length) return { worstDays: 0, avgDays: 0, periods: [], worstPeriod: null, avgLoss: 0 }

  // Build op-by-op cumulative using actual trade dates
  let cum = 0
  const points = ops.map(op => {
    const val = op.resAdj !== undefined ? op.resAdj : (op.resWeighted || 0)
    cum += val
    return { date: (op.abertura || '').split(' ')[0], cum }
  }).filter(p => p.date)

  if (!points.length) return { worstDays: 0, avgDays: 0, periods: [], worstPeriod: null, avgLoss: 0 }

  let peak = -Infinity
  let peakDate = null
  let peakValue = 0
  let stagStartDate = null
  let stagBottom = Infinity     // lowest equity reached during current stagnation
  let inStag = false
  const periods = []

  for (const { date, cum: val } of points) {
    if (val > 0 && val > peak) {
      // New positive all-time high
      if (inStag && stagStartDate) {
        const days = calendarDays(stagStartDate, date)
        if (days > 0) {
          // Loss = drop from peak to lowest point during stagnation
          const loss = Math.max(0, peakValue - stagBottom)
          periods.push({ start: stagStartDate, end: date, days, loss })
        }
      }
      peak = val
      peakDate = date
      peakValue = val
      inStag = false
      stagStartDate = null
      stagBottom = Infinity
    } else if (!inStag && peak > 0 && val < peak) {
      // Dropped below a positive peak — start stagnation from peak date
      inStag = true
      stagStartDate = peakDate
      stagBottom = val
    } else if (inStag) {
      // Track lowest point inside the stagnation
      if (val < stagBottom) stagBottom = val
    }
  }

  // Still in stagnation at last op
  if (inStag && stagStartDate && peak > 0) {
    const days = calendarDays(stagStartDate, points[points.length - 1].date)
    if (days > 0) {
      const loss = Math.max(0, peakValue - stagBottom)
      periods.push({ start: stagStartDate, end: points[points.length - 1].date, days, loss, active: true })
    }
  }

  const worstDays = periods.length ? Math.max(...periods.map(p => p.days)) : 0
  const avgDays = periods.length
    ? Math.round(periods.reduce((a, p) => a + p.days, 0) / periods.length)
    : 0
  const worstPeriod = periods.length
    ? periods.reduce((a, b) => (a.days >= b.days ? a : b))
    : null
  const avgLoss = periods.length
    ? periods.reduce((a, p) => a + (p.loss || 0), 0) / periods.length
    : 0

  return { worstDays, avgDays, periods, worstPeriod, avgLoss }
}

function calendarDays(start, end) {
  return Math.round(Math.abs(toMs(end) - toMs(start)) / 86400000)
}

function toMs(s) {
  if (!s) return 0
  const p = s.split('/')
  if (p.length === 3) return new Date(+p[2], +p[1] - 1, +p[0]).getTime()
  return new Date(s).getTime()
}
