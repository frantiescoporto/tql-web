// Goals & Limits simulation
// Rules:
// - Cycle = calendar month (Jan, Feb, ...)
// - Check is done at END of each trading day
// - If monthly cumulative hits target OR stop → block NEXT days of that month
// - The day that triggered the block IS INCLUDED fully (operates normally)
// - Resets on 1st of next month

export function simWithGoals(timelineOps, capital, stopPct, targetPct) {
  if (!timelineOps.length || !capital) return {
    filteredOps: [], allOps: [], dailyCurve: [],
    blockedMonthsList: [], monthlyFree: {}, monthlyGoals: {},
    _stopAbs: 0, _targetAbs: 0, stats: null
  }

  const stopAbs = capital * stopPct / 100    // negative
  const targetAbs = capital * targetPct / 100 // positive

  // Group ops by day
  const byDay = {}
  timelineOps.forEach(op => {
    const d = op.abertura.split(' ')[0]
    if (!byDay[d]) byDay[d] = []
    byDay[d].push(op)
  })

  const days = Object.keys(byDay).sort((a, b) => parseDate(a) - parseDate(b))

  let globalAcc = 0, monthAcc = 0, currentMonth = null
  let blockNextDays = false  // flag set AFTER day closes, affects NEXT days
  const blockedMonthsMap = {}
  const filteredOps = []
  const dailyCurve = []
  let cumWithout = 0

  for (const day of days) {
    const dayOps = byDay[day]
    const month = getMonth(day)

    // New month — reset
    if (month !== currentMonth) {
      currentMonth = month
      monthAcc = 0
      blockNextDays = false  // new month always unblocks
    }

    const dayResult = dayOps.reduce((a, o) => a + o.resWeighted, 0)
    cumWithout += dayResult

    // Is this day blocked? (blocked by previous day's end-of-day check)
    const todayBlocked = blockNextDays

    if (!todayBlocked) {
      // Day operates normally
      globalAcc += dayResult
      monthAcc += dayResult
      dayOps.forEach(op => filteredOps.push({ ...op, included: true }))

      // End-of-day check: did we hit target or stop TODAY?
      let triggeredReason = null
      if (targetAbs > 0 && monthAcc >= targetAbs) {
        blockNextDays = true
        triggeredReason = 'Meta atingida'
        blockedMonthsMap[month] = 'Meta atingida'
      } else if (stopAbs < 0 && monthAcc <= stopAbs) {
        blockNextDays = true
        triggeredReason = 'Stop atingido'
        blockedMonthsMap[month] = 'Stop atingido'
      }

      dailyCurve.push({
        date: day, cumGoals: globalAcc, cumFree: cumWithout,
        monthAcc, blocked: false,  // this day itself operated
        blockReason: triggeredReason,  // reason if THIS day triggered the block
        month,
      })
    } else {
      // Day is blocked — skip all operations
      dayOps.forEach(op => filteredOps.push({ ...op, included: false, skipped: true }))

      dailyCurve.push({
        date: day, cumGoals: globalAcc, cumFree: cumWithout,
        monthAcc, blocked: true,
        blockReason: blockedMonthsMap[month] || null,
        month,
      })
    }
  }

  // Monthly totals
  const monthlyFree = {}, monthlyGoals = {}
  let prevFree = 0, prevGoals = 0
  dailyCurve.forEach(d => {
    if (!monthlyFree[d.month]) { monthlyFree[d.month] = 0; monthlyGoals[d.month] = 0 }
    monthlyFree[d.month] += d.cumFree - prevFree
    monthlyGoals[d.month] += d.cumGoals - prevGoals
    prevFree = d.cumFree
    prevGoals = d.cumGoals
  })

  const filteredWithCum = filteredOps.filter(o => o.included)
  let acc = 0
  filteredWithCum.forEach(o => { acc += o.resWeighted; o.portfolioTotal = acc })

  const totalFree = timelineOps.reduce((a, o) => a + o.resWeighted, 0)
  const totalGoals = filteredWithCum.reduce((a, o) => a + o.resWeighted, 0)
  const nOpsSkipped = filteredOps.filter(o => o.skipped).length

  let peak = 0, maxDD = 0, ddAcc = 0
  filteredWithCum.forEach(o => {
    ddAcc += o.resWeighted
    if (ddAcc > peak) peak = ddAcc
    const dd = peak - ddAcc
    if (dd > maxDD) maxDD = dd
  })

  const capitalGoals = maxDD * 2 || capital
  const blockedMonthsList = Object.entries(blockedMonthsMap)
    .map(([month, reason]) => ({ month, reason }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    filteredOps: filteredWithCum,
    allOps: filteredOps,
    dailyCurve,
    monthlyFree,
    monthlyGoals,
    blockedMonthsList,
    _stopAbs: stopAbs,
    _targetAbs: targetAbs,
    stats: {
      totalFree, totalGoals,
      rentFree: capital > 0 ? totalFree / capital * 100 : 0,
      rentGoals: capitalGoals > 0 ? totalGoals / capitalGoals * 100 : 0,
      nOpsTotal: timelineOps.length,
      nOpsFiltered: filteredWithCum.length,
      nOpsSkipped,
      daysBlocked: dailyCurve.filter(d => d.blocked).length,
      blockedMonths: blockedMonthsList.length,
      blockedByMeta: blockedMonthsList.filter(b => b.reason === 'Meta atingida').length,
      blockedByStop: blockedMonthsList.filter(b => b.reason === 'Stop atingido').length,
      maxDDGoals: maxDD,
      capitalGoals,
    }
  }
}

function getMonth(dateStr) {
  const p = dateStr.split('/')
  if (p.length === 3) return `${p[2]}-${p[1]}`
  return dateStr.slice(0, 7)
}

function parseDate(s) {
  const p = s.split('/')
  if (p.length === 3) return new Date(+p[2], +p[1]-1, +p[0]).getTime()
  return new Date(s).getTime()
}
