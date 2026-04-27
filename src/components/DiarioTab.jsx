import React, { useState, useEffect, useMemo } from 'react'
import { fmtR, fmtPct, fmtNum } from '../lib/analytics'
import { simWithGoals } from '../lib/goalsLimits'

export default function DiarioTab({ timeline, capital, metrics }) {
  const [stopPct, setStopPct] = useState(15)
  const [targetPct, setTargetPct] = useState(30)
  const [result, setResult] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null)

  useEffect(() => {
    if (!timeline.length || !capital) return
    const r = simWithGoals(timeline, capital, -Math.abs(stopPct), Math.abs(targetPct))
    setResult(r)
    // Default to last month
    if (r.dailyCurve.length) {
      const lastMonth = r.dailyCurve[r.dailyCurve.length - 1].month
      setSelectedMonth(lastMonth)
    }
  }, [timeline, capital, stopPct, targetPct])

  const stopAbs = capital * stopPct / 100
  const targetAbs = capital * targetPct / 100

  // Build month options
  const months = useMemo(() => {
    if (!result) return []
    const seen = new Set()
    return result.dailyCurve
      .map(d => d.month)
      .filter(m => { if (seen.has(m)) return false; seen.add(m); return true })
      .sort((a, b) => b.localeCompare(a)) // newest first
  }, [result])

  // Filter dailyCurve for selected month
  const monthDays = useMemo(() => {
    if (!result || !selectedMonth) return []
    return result.dailyCurve.filter(d => d.month === selectedMonth)
  }, [result, selectedMonth])

  // Month stats
  const monthStats = useMemo(() => {
    if (!monthDays.length) return null
    const first = monthDays[0]
    const last = monthDays[monthDays.length - 1]

    // Cumulative at start of month (day before first day)
    const allDays = result.dailyCurve
    const firstIdx = allDays.indexOf(first)
    const prevFree = firstIdx > 0 ? allDays[firstIdx - 1].cumFree : 0
    const prevGoals = firstIdx > 0 ? allDays[firstIdx - 1].cumGoals : 0

    const monthFree = last.cumFree - prevFree
    const monthGoals = last.cumGoals - prevGoals

    // Max DD during month (goals curve)
    let peak = prevGoals, maxDD = 0
    monthDays.forEach(d => {
      if (d.cumGoals > peak) peak = d.cumGoals
      const dd = peak - d.cumGoals
      if (dd > maxDD) maxDD = dd
    })

    // Max DD during month (free curve)
    let peakF = prevFree, maxDDF = 0
    monthDays.forEach(d => {
      if (d.cumFree > peakF) peakF = d.cumFree
      const dd = peakF - d.cumFree
      if (dd > maxDDF) maxDDF = dd
    })

    const blocked = result.blockedMonthsList.find(b => b.month === selectedMonth)

    return {
      monthFree, monthGoals,
      maxDD, maxDDF,
      blocked,
      daysTraded: monthDays.filter(d => !d.blocked).length,
      daysBlocked: monthDays.filter(d => d.blocked).length,
    }
  }, [monthDays, result, selectedMonth])

  // Global DD with limits
  const globalDD = useMemo(() => {
    if (!result?.dailyCurve.length) return { ddGoals: 0, ddFree: 0 }
    let peakG = 0, ddG = 0, peakF = 0, ddF = 0
    result.dailyCurve.forEach(d => {
      if (d.cumGoals > peakG) peakG = d.cumGoals
      if (peakG - d.cumGoals > ddG) ddG = peakG - d.cumGoals
      if (d.cumFree > peakF) peakF = d.cumFree
      if (peakF - d.cumFree > ddF) ddF = peakF - d.cumFree
    })
    return { ddGoals: ddG, ddFree: ddF }
  }, [result])

  if (!timeline.length) return (
    <div className="empty-state"><p>Adicione robôs ao portfólio para ver o diário.</p></div>
  )

  const fmtMonth = (m) => {
    if (!m) return ''
    const [y, mo] = m.split('-')
    const names = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return `${names[parseInt(mo)]} ${y}`
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display:'flex', gap:16, padding:'12px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', marginBottom:16, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>Stop mensal</div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="range" min="1" max="50" step="1" value={stopPct} onChange={e => setStopPct(+e.target.value)} style={{ width:100 }} />
            <span style={{ fontWeight:700, color:'var(--danger)' }}>-{stopPct}% = {fmtR(-stopAbs)}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>Meta mensal</div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="range" min="1" max="100" step="1" value={targetPct} onChange={e => setTargetPct(+e.target.value)} style={{ width:100 }} />
            <span style={{ fontWeight:700, color:'var(--success)' }}>+{targetPct}% = {fmtR(targetAbs)}</span>
          </div>
        </div>
        <div style={{ marginLeft:'auto' }}>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>Mês</div>
          <select value={selectedMonth || ''} onChange={e => setSelectedMonth(e.target.value)}
            style={{ padding:'6px 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)', fontSize:13 }}>
            {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </select>
        </div>
      </div>

      {/* Global DD cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        <div style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'10px 14px', borderLeft:'3px solid var(--danger)' }}>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>DD máx. geral (c/ limites)</div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--danger)' }}>{fmtR(-globalDD.ddGoals)}</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>{capital > 0 ? fmtPct(-globalDD.ddGoals/capital*100) : '—'}</div>
        </div>
        <div style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'10px 14px', borderLeft:'3px solid var(--text-hint)' }}>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>DD máx. geral (sem limites)</div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--text-muted)' }}>{fmtR(-globalDD.ddFree)}</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>{capital > 0 ? fmtPct(-globalDD.ddFree/capital*100) : '—'}</div>
        </div>
        <div style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'10px 14px', borderLeft:'3px solid var(--accent)' }}>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>Stop configurado</div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--danger)' }}>{fmtR(-stopAbs)}/mês</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>-{stopPct}% do capital</div>
        </div>
        <div style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'10px 14px', borderLeft:'3px solid var(--success)' }}>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>Meta configurada</div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--success)' }}>{fmtR(targetAbs)}/mês</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>+{targetPct}% do capital</div>
        </div>
      </div>

      {/* Month summary */}
      {monthStats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10, marginBottom:16 }}>
          {[
            { label:`Resultado ${fmtMonth(selectedMonth)} (c/ limites)`, value: fmtR(monthStats.monthGoals), color: monthStats.monthGoals>=0?'var(--success)':'var(--danger)' },
            { label:`Resultado ${fmtMonth(selectedMonth)} (sem limites)`, value: fmtR(monthStats.monthFree), color: monthStats.monthFree>=0?'var(--success)':'var(--danger)' },
            { label:'DD máx. do mês (c/ limites)', value: fmtR(-monthStats.maxDD), color:'var(--danger)' },
            { label:'DD máx. do mês (sem limites)', value: fmtR(-monthStats.maxDDF), color:'var(--text-muted)' },
            { label:'Dias operados', value: monthStats.daysTraded, color:'var(--text)' },
            { label:'Dias bloqueados', value: monthStats.daysBlocked, color: monthStats.daysBlocked>0?'var(--warning)':'var(--success)' },
          ].map((m,i) => (
            <div key={i} style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'10px 14px' }}>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>{m.label}</div>
              <div style={{ fontSize:16, fontWeight:700, color:m.color }}>{m.value}</div>
            </div>
          ))}
          {monthStats.blocked && (
            <div style={{ background: monthStats.blocked.reason==='Meta atingida'?'var(--success-bg)':'var(--danger-bg)', borderRadius:'var(--radius)', padding:'10px 14px', gridColumn:'span 2' }}>
              <div style={{ fontSize:12, fontWeight:600, color: monthStats.blocked.reason==='Meta atingida'?'var(--success)':'var(--danger)' }}>
                {monthStats.blocked.reason === 'Meta atingida' ? '✓ Meta atingida neste mês' : '✗ Stop acionado neste mês'}
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                Operações bloqueadas após atingir o limite
              </div>
            </div>
          )}
        </div>
      )}

      {/* Daily table */}
      {monthDays.length > 0 && (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th style={{ textAlign:'right' }}>Resultado dia</th>
                <th style={{ textAlign:'right' }}>Acum. mês (c/ limites)</th>
                <th style={{ textAlign:'right' }}>Acum. mês (sem limites)</th>
                <th style={{ textAlign:'right' }}>Acum. geral (c/ limites)</th>
                <th style={{ textAlign:'right' }}>Acum. geral (sem limites)</th>
                <th style={{ textAlign:'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const allDays = result.dailyCurve
                const firstIdx = allDays.indexOf(monthDays[0])
                const prevFree = firstIdx > 0 ? allDays[firstIdx - 1].cumFree : 0
                const prevGoals = firstIdx > 0 ? allDays[firstIdx - 1].cumGoals : 0
                let prevDayFree = prevFree, prevDayGoals = prevGoals

                return monthDays.map((d, i) => {
                  const dayResultFree = d.cumFree - prevDayFree
                  const dayResultGoals = d.cumGoals - prevDayGoals
                  const monthAccFree = d.cumFree - prevFree
                  const monthAccGoals = d.cumGoals - prevGoals
                  prevDayFree = d.cumFree
                  prevDayGoals = d.cumGoals

                  const isBlocked = d.blocked
                  const dayResult = isBlocked ? 0 : dayResultGoals

                  return (
                    <tr key={i} style={{ background: isBlocked ? 'var(--warning-bg)' : (i%2===0?'var(--surface)':'var(--bg)'), opacity: isBlocked ? 0.7 : 1 }}>
                      <td style={{ fontSize:12 }}>{d.date}</td>
                      <td style={{ textAlign:'right', fontWeight:600, color: dayResult>=0?'var(--success)':'var(--danger)', fontSize:13 }}>{fmtR(dayResult)}</td>
                      <td style={{ textAlign:'right', fontWeight:600, color: monthAccGoals>=0?'var(--success)':'var(--danger)' }}>{fmtR(monthAccGoals)}</td>
                      <td style={{ textAlign:'right', color:'var(--text-muted)' }}>{fmtR(monthAccFree)}</td>
                      <td style={{ textAlign:'right', fontWeight:600, color: d.cumGoals>=0?'var(--success)':'var(--danger)' }}>{fmtR(d.cumGoals)}</td>
                      <td style={{ textAlign:'right', color:'var(--text-muted)' }}>{fmtR(d.cumFree)}</td>
                      <td style={{ textAlign:'center' }}>
                        {isBlocked
                          ? <span style={{ fontSize:11, color:'var(--warning)', fontWeight:600 }}>🚫 Bloqueado</span>
                          : d.blockReason
                          ? <span style={{ fontSize:11, color: d.blockReason==='Meta atingida'?'var(--success)':'var(--danger)', fontWeight:600 }}>
                              {d.blockReason==='Meta atingida'?'✓ Meta':'✗ Stop'}
                            </span>
                          : <span style={{ fontSize:11, color:'var(--text-hint)' }}>Operou</span>
                        }
                      </td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
