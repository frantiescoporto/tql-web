import React, { useState, useMemo } from 'react'
import { fmtR } from '../lib/analytics'

export default function CalendarioMensal({ adjOps, timeline, realOps, capital, title = 'Diário' }) {
  // Unified ops list
  const ops = useMemo(() => {
    if (timeline?.length) return timeline.map(o => ({ result: o.resWeighted, date: o.abertura?.split(' ')[0] }))
    if (adjOps?.length) return adjOps.map(o => ({ result: o.resAdj, date: o.abertura?.split(' ')[0] }))
    return []
  }, [adjOps, timeline])

  // Real ops: may come as raw DB rows (res_op) or processed (resAdj)
  const realByDay = useMemo(() => {
    const map = {}
    if (!realOps?.length) return map
    realOps.forEach(o => {
      const d = (o.abertura || '').split(' ')[0]
      if (!d) return
      const val = o.resAdj ?? o.res_op ?? 0
      map[d] = (map[d] || 0) + val
    })
    return map
  }, [realOps])

  const hasRealData = Object.keys(realByDay).length > 0

  // Available years/months from ops
  const available = useMemo(() => {
    const map = {}
    ops.forEach(o => {
      const p = o.date?.split('/')
      if (p?.length === 3) {
        if (!map[p[2]]) map[p[2]] = new Set()
        map[p[2]].add(p[1])
      }
    })
    return Object.entries(map).sort((a,b) => b[0]-a[0])
      .map(([y, ms]) => ({ year: y, months: [...ms].sort().reverse() }))
  }, [ops])

  const [showReal, setShowReal] = useState(false)
  const [selectedYear, setSelectedYear] = useState(() => available[0]?.year || String(new Date().getFullYear()))
  const [selectedMonth, setSelectedMonth] = useState(() => available[0]?.months[0] || String(new Date().getMonth()+1).padStart(2,'0'))

  const MONTH_NAMES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const WEEKDAYS = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']

  // Group by day for selected month
  const dayBT = useMemo(() => {
    const map = {}
    ops.forEach(o => {
      const p = o.date?.split('/')
      if (!p || p.length !== 3 || p[2] !== selectedYear || p[1] !== selectedMonth) return
      const day = parseInt(p[0])
      map[day] = (map[day] || 0) + o.result
    })
    return map
  }, [ops, selectedYear, selectedMonth])

  const dayReal = useMemo(() => {
    const map = {}
    Object.entries(realByDay).forEach(([date, val]) => {
      const p = date.split('/')
      if (!p || p.length !== 3 || p[2] !== selectedYear || p[1] !== selectedMonth) return
      map[parseInt(p[0])] = val
    })
    return map
  }, [realByDay, selectedYear, selectedMonth])

  // Month stats
  const btTotal = Object.values(dayBT).reduce((a,b) => a+b, 0)
  const realTotal = Object.values(dayReal).reduce((a,b) => a+b, 0)
  const btDays = Object.keys(dayBT).length
  const posDays = Object.values(dayBT).filter(v => v > 0).length
  const negDays = btDays - posDays
  const avgBT = btDays > 0 ? btTotal / btDays : 0
  const avgReal = Object.keys(dayReal).length > 0 ? realTotal / Object.keys(dayReal).length : 0
  const diffPct = btTotal !== 0 ? ((realTotal - btTotal) / Math.abs(btTotal)) * 100 : null
  const avgDiffPerOp = Object.keys(dayReal).length > 0 ? (realTotal - btTotal) / Object.keys(dayReal).length : null

  // Color scale per type
  const allBT = Object.values(dayBT).filter(v => v !== 0)
  const maxBT = allBT.length ? Math.max(...allBT.map(Math.abs)) : 1
  const allReal = Object.values(dayReal).filter(v => v !== 0)
  const maxReal = allReal.length ? Math.max(...allReal.map(Math.abs)) : 1

  const colorBT = (v) => {
    if (!v) return 'var(--bg)'
    const intensity = Math.min(0.12 + (Math.abs(v) / maxBT) * 0.88, 1)
    return v > 0
      ? `rgba(22,163,74,${intensity.toFixed(2)})`
      : `rgba(220,38,38,${intensity.toFixed(2)})`
  }
  const colorReal = (v) => {
    if (!v) return 'var(--bg)'
    const intensity = Math.min(0.12 + (Math.abs(v) / maxReal) * 0.88, 1)
    return v > 0
      ? `rgba(8,145,178,${intensity.toFixed(2)})`  // teal
      : `rgba(234,88,12,${intensity.toFixed(2)})`  // orange
  }
  const textOnColor = (intensity) => intensity > 0.45 ? '#fff' : 'var(--text)'
  const btTextColor = (v) => textOnColor(v ? Math.min(0.12 + (Math.abs(v)/maxBT)*0.88, 1) : 0)
  const realTextColor = (v) => textOnColor(v ? Math.min(0.12 + (Math.abs(v)/maxReal)*0.88, 1) : 0)

  const daysInMonth = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate()
  const firstWeekday = (new Date(parseInt(selectedYear), parseInt(selectedMonth)-1, 1).getDay() + 6) % 7

  return (
    <div>
      {/* Controls */}
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ fontWeight:700, fontSize:15 }}>{title}</div>
        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
          style={{ padding:'5px 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)', fontSize:13 }}>
          {available.map(a => <option key={a.year} value={a.year}>{a.year}</option>)}
        </select>
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          style={{ padding:'5px 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)', fontSize:13 }}>
          {(available.find(a => a.year === selectedYear)?.months || []).map(m => (
            <option key={m} value={m}>{MONTH_NAMES[parseInt(m)]}</option>
          ))}
        </select>
        {hasRealData && (
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer' }}>
            <input type="checkbox" checked={showReal} onChange={e => setShowReal(e.target.checked)} />
            Mostrar conta real
          </label>
        )}
        <div style={{ marginLeft:'auto', fontSize:12, color:'var(--text-muted)', fontWeight:500 }}>
          {MONTH_NAMES[parseInt(selectedMonth)]} {selectedYear}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns: showReal ? 'repeat(4,1fr) repeat(2,1fr)' : 'repeat(3,1fr)', gap:8, marginBottom:14 }}>
        {/* BT cards */}
        <div style={{ background:'var(--bg)', border:'2px solid rgba(22,163,74,.3)', borderRadius:'var(--radius)', padding:'8px 12px' }}>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>Resultado BT</div>
          <div style={{ fontSize:16, fontWeight:700, color: btTotal>=0?'var(--success)':'var(--danger)' }}>{fmtR(btTotal)}</div>
          <div style={{ fontSize:10, color:'var(--text-hint)', marginTop:1 }}>{capital>0?((btTotal/capital)*100).toFixed(2)+'% capital':''}</div>
        </div>
        <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 12px' }}>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>Dias operados</div>
          <div style={{ fontSize:16, fontWeight:700 }}><span style={{color:'var(--success)'}}>{posDays}↑</span> <span style={{color:'var(--danger)'}}>{negDays}↓</span></div>
          <div style={{ fontSize:10, color:'var(--text-hint)', marginTop:1 }}>de {btDays} dias no mês</div>
        </div>
        <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 12px' }}>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>Média BT por dia</div>
          <div style={{ fontSize:16, fontWeight:700, color: avgBT>=0?'var(--success)':'var(--danger)' }}>{fmtR(avgBT)}</div>
          <div style={{ fontSize:10, color:'var(--text-hint)', marginTop:1 }}>{capital>0?((avgBT/capital)*100).toFixed(2)+'% capital':''}</div>
        </div>

        {/* Real cards — only when showReal */}
        {showReal && <>
          <div style={{ background:'var(--bg)', border:'2px solid rgba(8,145,178,.3)', borderRadius:'var(--radius)', padding:'8px 12px' }}>
            <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>Resultado Real</div>
            <div style={{ fontSize:16, fontWeight:700, color: realTotal>=0?'#0891b2':'#ea580c' }}>{fmtR(realTotal)}</div>
            <div style={{ fontSize:10, color:'var(--text-hint)', marginTop:1 }}>{capital>0?((realTotal/capital)*100).toFixed(2)+'% capital':''}</div>
          </div>
          <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 12px' }}>
            <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>Real vs Esperado (BT)</div>
            <div style={{ fontSize:16, fontWeight:700, color: diffPct!=null?(diffPct>=0?'var(--success)':'var(--danger)'):'var(--text)' }}>
              {diffPct != null ? `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%` : '—'}
            </div>
            <div style={{ fontSize:10, color:'var(--text-hint)', marginTop:1 }}>
              {realTotal-btTotal >= 0 ? '+' : ''}{fmtR(realTotal-btTotal)} no mês
            </div>
          </div>
          <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 12px' }}>
            <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>Dif. média por dia</div>
            <div style={{ fontSize:16, fontWeight:700, color: avgDiffPerOp!=null?(avgDiffPerOp>=0?'var(--success)':'var(--danger)'):'var(--text)' }}>
              {avgDiffPerOp != null ? `${avgDiffPerOp>=0?'+':''}${fmtR(avgDiffPerOp)}` : '—'}
            </div>
            <div style={{ fontSize:10, color:'var(--text-hint)', marginTop:1 }}>
              Média real: {fmtR(avgReal)}
            </div>
          </div>
        </>}
      </div>

      {/* Calendar */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:14 }}>
        {/* Weekday headers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:3 }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:600, color:'var(--text-muted)', padding:'3px 0', textTransform:'uppercase', letterSpacing:'.04em' }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
          {Array(firstWeekday).fill(null).map((_,i) => <div key={`e${i}`} />)}

          {Array(daysInMonth).fill(null).map((_,i) => {
            const day = i + 1
            const btVal = dayBT[day]
            const realVal = showReal ? dayReal[day] : undefined
            const isWeekend = ((firstWeekday + i) % 7) >= 5
            const hasBT = btVal !== undefined
            const hasReal = realVal !== undefined

            return (
              <div key={day}
                title={hasBT ? `${fmtR(btVal)}${hasReal ? ` | Real: ${fmtR(realVal)}` : ''}` : ''}
                style={{
                  borderRadius:5, overflow:'hidden', minHeight: showReal ? 82 : 64,
                  border:`1px solid ${hasBT||hasReal?'rgba(0,0,0,.07)':'var(--border)'}`,
                  opacity: isWeekend && !hasBT && !hasReal ? 0.35 : 1,
                  display:'flex', flexDirection:'column',
                }}>

                {/* BT half */}
                <div style={{
                  flex: showReal ? '1 1 52%' : '1 1 100%',
                  background: colorBT(btVal),
                  display:'flex', flexDirection:'column', padding:'4px 4px 2px',
                  borderBottom: showReal ? '1px solid rgba(0,0,0,.1)' : 'none',
                  justifyContent:'space-between',
                }}>
                  <div style={{ fontSize:9, fontWeight:700, color: hasBT ? btTextColor(btVal) : 'var(--text-hint)', textAlign:'right' }}>{day}</div>
                  {hasBT ? (
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:10, fontWeight:700, color: btTextColor(btVal), lineHeight:1.2 }}>{fmtR(btVal)}</div>
                      {capital > 0 && <div style={{ fontSize:8, color: btTextColor(btVal), opacity:.85 }}>{((btVal/capital)*100).toFixed(2)}%</div>}
                    </div>
                  ) : (
                    <div style={{ textAlign:'center', fontSize:9, color:'var(--text-hint)' }}>{isWeekend?'':'-'}</div>
                  )}
                  {showReal && <div style={{ fontSize:7, color: hasBT?btTextColor(btVal):'var(--text-hint)', opacity:.7, textAlign:'center' }}>BT</div>}
                </div>

                {/* Real half */}
                {showReal && (
                  <div style={{
                    flex:'1 1 48%',
                    background: colorReal(realVal),
                    display:'flex', flexDirection:'column', padding:'2px 4px 4px',
                    justifyContent:'space-between',
                  }}>
                    {hasReal ? (
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:10, fontWeight:700, color: realTextColor(realVal), lineHeight:1.2 }}>{fmtR(realVal)}</div>
                        {capital > 0 && <div style={{ fontSize:8, color: realTextColor(realVal), opacity:.85 }}>{((realVal/capital)*100).toFixed(2)}%</div>}
                      </div>
                    ) : (
                      <div style={{ textAlign:'center', fontSize:9, color:'var(--text-hint)' }}>-</div>
                    )}
                    <div style={{ fontSize:7, color: hasReal?realTextColor(realVal):'var(--text-hint)', opacity:.7, textAlign:'center' }}>Real</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{ display:'flex', gap:14, marginTop:10, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)' }}>
            <div style={{ width:10, height:10, borderRadius:2, background:'rgba(22,163,74,.85)' }} /> Lucro BT
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)' }}>
            <div style={{ width:10, height:10, borderRadius:2, background:'rgba(220,38,38,.85)' }} /> Prejuízo BT
          </div>
          {showReal && <>
            <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)' }}>
              <div style={{ width:10, height:10, borderRadius:2, background:'rgba(8,145,178,.85)' }} /> Lucro Real
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)' }}>
              <div style={{ width:10, height:10, borderRadius:2, background:'rgba(234,88,12,.85)' }} /> Prejuízo Real
            </div>
          </>}
          <div style={{ marginLeft:'auto', fontSize:11, color:'var(--text-muted)' }}>Intensidade = magnitude do resultado</div>
        </div>
      </div>
    </div>
  )
}
