import { useData } from '../context/DataContext.jsx'
import React, { useState, useEffect, useRef } from 'react'
import { buildAdjOps, fmtR, fmtNum } from '../lib/analytics'
import { buildPortfolioTimeline, calcPortfolioMetrics } from '../lib/portfolio'
import { CDI_MONTHLY, IBOV_MONTHLY, FAMOUS_TRADERS, getBenchmarkRange, accumulate, lastValid, annualize } from '../lib/benchmarks'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

function monthKey(s) {
  if (!s) return null
  const p = s.split('/'); return p.length < 3 ? null : `${p[2]}-${p[1]}`
}

const PERIODS = [
  { k:'all', l:'Todo o período' },
  { k:'1y',  l:'1 ano' },
  { k:'2y',  l:'2 anos' },
  { k:'3y',  l:'3 anos' },
]

const GRANULARITIES = [
  { k:'monthly',   l:'Mensal' },
  { k:'quarterly', l:'Trimestral' },
  { k:'semester',  l:'Semestral' },
  { k:'annual',    l:'Anual' },
]

function groupMonths(months, portPct, portR, cdi, ibov, gran) {
  if (gran === 'monthly') return { keys: months, portPct, portR, cdi, ibov }
  const groupSize = gran === 'quarterly' ? 3 : gran === 'semester' ? 6 : 12
  const keys = [], gPortPct = [], gPortR = [], gCdi = [], gIbov = []
  for (let i = 0; i < months.length; i += groupSize) {
    const slice = months.slice(i, i + groupSize)
    keys.push(slice[0] + (slice.length > 1 ? ' → ' + slice[slice.length - 1] : ''))
    // Compound returns
    const compound = arr => arr.slice(i, i + groupSize).reduce((acc, v) => acc * (1 + (v||0)/100), 1) - 1
    gPortPct.push(compound(portPct) * 100)
    gPortR.push(portR.slice(i, i + groupSize).reduce((a, b) => a + (b||0), 0))
    gCdi.push(compound(cdi) * 100)
    gIbov.push(compound(ibov) * 100)
  }
  return { keys, portPct: gPortPct, portR: gPortR, cdi: gCdi, ibov: gIbov }
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function GestorPage({ portfolios, inline = false, inlineData = null }) {
  const { robots: ctxRobots, portfolios: ctxPortfolios, getRobot } = useData()
  const [selectedPort, setSelectedPort] = useState(null)
  const [period, setPeriod] = useState('all')
  const [gran, setGran] = useState('annual')
  const [portData, setPortData] = useState(null)
  const [loading, setLoading] = useState(false)
  const chartRef = useRef(null)
  const chartInst = useRef(null)

  // Se inline (dentro do portfólio), usa dados já carregados
  useEffect(() => {
    if (inlineData) { setPortData(inlineData); return }
    if (!selectedPort) return
    setLoading(true); setPortData(null)
    ;(async () => {
      try {
        const p = (portfolios||[]).find(p => p.id === selectedPort); if (!p) return
        const cfg = typeof p.robots_config === 'string' ? JSON.parse(p.robots_config) : p.robots_config
        const robotsCfg = Array.isArray(cfg) ? cfg : (cfg.robots || [])
        const entries = []
        for (const s of robotsCfg) {
          const full = getRobot(s.robotId)
          if (!full?.operations?.length) continue
          const adjOps = buildAdjOps(full.operations, full.desagio||0, full.tipo||'backtest')
          entries.push({ robot: full, lots: s.lots||1, adjOps })
        }
        if (!entries.length) return
        const timeline = buildPortfolioTimeline(entries)
        const multiplier = cfg.multiplier || 3
        const metrics = calcPortfolioMetrics(timeline, multiplier)
        const monthly = {}, capital = metrics.capital || 1
        timeline.forEach(op => {
          const k = monthKey(op.abertura?.split(' ')[0])
          if (k) monthly[k] = (monthly[k]||0) + op.resWeighted
        })
        const monthlyPct = {}
        Object.entries(monthly).forEach(([k,v]) => { monthlyPct[k] = (v/capital)*100 })
        setPortData({ monthly, monthlyPct, capital, name: p.name, multiplier })
      } finally { setLoading(false) }
    })()
  }, [selectedPort, portfolios, inlineData])

  // Filtrar período
  const getFiltered = () => {
    if (!portData) return { months:[], portPct:[], portR:[], cdi:[], ibov:[] }
    const allMonths = Object.keys(portData.monthlyPct).sort()
    if (!allMonths.length) return { months:[], portPct:[], portR:[], cdi:[], ibov:[] }
    const last = allMonths[allMonths.length-1]
    let first = allMonths[0]
    if (period !== 'all') {
      const yrs = period==='1y'?1:period==='2y'?2:3
      const [y,m] = last.split('-').map(Number)
      const fm = m - yrs*12, fy = y + Math.floor((fm-1)/12), fmm = ((fm-1+120)%12)+1
      first = `${fy}-${String(fmm).padStart(2,'0')}`
    }
    const months = allMonths.filter(k => k >= first)
    if (!months.length) return { months:[], portPct:[], portR:[], cdi:[], ibov:[] }
    const { cdi, ibov } = getBenchmarkRange(months[0], months[months.length-1])
    return {
      months,
      portPct: months.map(k => portData.monthlyPct[k]??0),
      portR: months.map(k => portData.monthly[k]??0),
      cdi, ibov,
    }
  }

  const { months, portPct, portR, cdi, ibov } = getFiltered()
  const portAcc = accumulate(portPct)
  const cdiAcc  = accumulate(cdi)
  const ibovAcc = accumulate(ibov)

  const portTotal  = lastValid(portAcc) - 100
  const cdiTotal   = lastValid(cdiAcc) - 100
  const ibovTotal  = lastValid(ibovAcc) - 100
  const alpha = portTotal - cdiTotal
  const yrs = months.length / 12
  const portAnnual = annualize(portTotal, yrs)
  const cdiAnnual  = annualize(cdiTotal,  yrs)
  const ibovAnnual = annualize(ibovTotal, yrs)

  // Agrupar para tabela
  const grouped = groupMonths(months, portPct, portR, cdi, ibov, gran)

  // Gráfico
  useEffect(() => {
    if (!chartRef.current || !months.length) return
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null }
    const isDark = document.documentElement.classList.contains('theme-dark')
    const grid = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
    const text = isDark ? '#8890a8' : '#6b6965'
    chartInst.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          { label: portData?.name||'Portfólio', data: portAcc, borderColor:'#4f8ef7', borderWidth:2, pointRadius:0, tension:0.3, fill:false },
          { label: 'CDI', data: cdiAcc, borderColor:'#34d47e', borderWidth:1.5, pointRadius:0, borderDash:[4,2], fill:false },
          { label: 'IBOVESPA', data: ibovAcc, borderColor:'#f59e0b', borderWidth:1.5, pointRadius:0, borderDash:[6,3], fill:false },
        ],
      },
      options: {
        responsive:true, maintainAspectRatio:false, animation:false,
        plugins: {
          legend: { display:true, labels:{ color:text, boxWidth:22, font:{size:11} } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${(ctx.raw-100).toFixed(1)}% acum.` } },
        },
        scales: {
          x: { ticks:{ color:text, maxTicksLimit:10, font:{size:10} }, grid:{ color:grid } },
          y: { ticks:{ color:text, font:{size:10}, callback: v=>`${(v-100).toFixed(0)}%` }, grid:{ color:grid } },
        },
      },
    })
    return () => { if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null } }
  }, [months.join(','), portData])

  const noData = !portData && !inlineData && !loading

  return (
    <div>
      {/* Seletor — só no modo standalone */}
      {!inline && (
        <div className="card" style={{ marginBottom:18, display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:'1 1 240px' }}>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:5 }}>Portfólio</label>
            <select value={selectedPort||''} onChange={e => setSelectedPort(+e.target.value||null)}
              style={{ width:'100%', padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface)', color:'var(--text)', fontSize:14 }}>
              <option value="">Selecione um portfólio…</option>
              {(portfolios||[]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {PERIODS.map(p=>(
              <button key={p.k} onClick={()=>setPeriod(p.k)}
                style={{ padding:'7px 12px', borderRadius:7, fontSize:12, cursor:'pointer', fontWeight:period===p.k?700:400,
                  border:period===p.k?'1px solid var(--accent)':'1px solid var(--border)',
                  background:period===p.k?'var(--accent-bg)':'transparent',
                  color:period===p.k?'var(--accent)':'var(--text-muted)' }}>{p.l}</button>
            ))}
          </div>
        </div>
      )}

      {/* Controles de período e granularidade (inline) */}
      {inline && (
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ display:'flex', gap:4 }}>
            {PERIODS.map(p=>(
              <button key={p.k} onClick={()=>setPeriod(p.k)}
                style={{ padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer', fontWeight:period===p.k?700:400,
                  border:period===p.k?'1px solid var(--accent)':'1px solid var(--border)',
                  background:period===p.k?'var(--accent-bg)':'transparent',
                  color:period===p.k?'var(--accent)':'var(--text-muted)' }}>{p.l}</button>
            ))}
          </div>
          <div style={{ width:1, height:20, background:'var(--border)' }}/>
          <div style={{ display:'flex', gap:4 }}>
            {GRANULARITIES.map(g=>(
              <button key={g.k} onClick={()=>setGran(g.k)}
                style={{ padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer', fontWeight:gran===g.k?700:400,
                  border:gran===g.k?'1px solid var(--accent)':'1px solid var(--border)',
                  background:gran===g.k?'var(--accent-bg)':'transparent',
                  color:gran===g.k?'var(--accent)':'var(--text-muted)' }}>{g.l}</button>
            ))}
          </div>
        </div>
      )}

      {noData && <div className="empty-state"><p>Selecione um portfólio para iniciar a comparação.</p></div>}
      {loading && <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>Carregando…</div>}

      {portData && months.length > 0 && (<>

        {/* Cards de resumo */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
          {[
            { label:portData.name||'Portfólio', sub:'Portfólio', total:portTotal, annual:portAnnual, color:'#4f8ef7', icon:'📂' },
            { label:'CDI', sub:'Renda fixa referência', total:cdiTotal, annual:cdiAnnual, color:'#34d47e', icon:'🏦' },
            { label:'IBOVESPA', sub:'Índice B3', total:ibovTotal, annual:ibovAnnual, color:'#f59e0b', icon:'📈' },
            { label:'Alpha vs CDI', sub:`${months.length}m · ${portAnnual.toFixed(1)}% a.a.`, total:alpha, annual:portAnnual-cdiAnnual, color:alpha>=0?'#4f8ef7':'#f06060', icon:alpha>=0?'🚀':'⚠️' },
          ].map((c,i) => (
            <div key={i} className="card" style={{ padding:'12px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:7 }}>
                <span style={{ fontSize:16 }}>{c.icon}</span>
                <div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>{c.sub}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{c.label}</div>
                </div>
              </div>
              <div style={{ fontSize:24, fontWeight:800, color:c.color, letterSpacing:'-0.5px', lineHeight:1 }}>
                {c.total>=0?'+':''}{c.total.toFixed(1)}%
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>
                {c.annual>=0?'+':''}{c.annual.toFixed(1)}% ao ano
              </div>
            </div>
          ))}
        </div>

        {/* Gráfico curva acumulada */}
        <div className="chart-card" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div className="chart-title" style={{ marginBottom:0 }}>Curva acumulada — base 100</div>
            <div style={{ fontSize:10, color:'var(--text-hint)' }}>Portfólio em % do capital (DD × {portData.multiplier||3}×)</div>
          </div>
          <div style={{ position:'relative', height:260 }}>
            <canvas ref={chartRef}/>
          </div>
        </div>

        {/* Benchmarks famosos */}
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:12 }}>
            <div style={{ fontWeight:600, fontSize:14 }}>Traders e Fundos Famosos</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>
              Seu portfólio: <b style={{ color:'#4f8ef7' }}>{portAnnual>=0?'+':''}{portAnnual.toFixed(1)}% a.a.</b>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {FAMOUS_TRADERS.map((t,i) => {
              const barW = Math.min((t.avgAnnual/70)*100, 100)
              const yourW = portAnnual>0 ? Math.min((portAnnual/70)*100,100) : 0
              const beating = portAnnual > t.avgAnnual
              return (
                <div key={i} style={{ padding:'10px 12px', background:'var(--bg)', borderRadius:8, border:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:18 }}>{t.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'baseline', gap:7, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:700, fontSize:12 }}>{t.name}</span>
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>— {t.manager}</span>
                        <span style={{ fontSize:10, color:'var(--text-hint)' }}>{t.period}</span>
                        {beating && <span style={{ fontSize:10, fontWeight:700, color:'#4f8ef7', background:'rgba(79,142,247,0.12)', border:'1px solid rgba(79,142,247,0.2)', borderRadius:4, padding:'1px 6px' }}>Acima 🎯</span>}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-hint)' }}>{t.strategy}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:17, fontWeight:800, color:t.color }}>{t.avgAnnual}%</div>
                      <div style={{ fontSize:9, color:'var(--text-hint)' }}>ao ano</div>
                    </div>
                  </div>
                  <div style={{ height:5, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ position:'absolute', height:5, width:`${barW}%`, background:t.color+'50', borderRadius:3 }}/>
                    {portAnnual>0 && <div style={{ height:'100%', width:`${yourW}%`, background:'rgba(79,142,247,0.7)', borderRadius:3 }}/>}
                  </div>
                  <div style={{ fontSize:9, color:'var(--text-hint)', marginTop:3 }}>{t.note}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tabela comparativa — última (maior) */}
        {!inline && (
          <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center' }}>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>Comparativo:</span>
            {GRANULARITIES.map(g=>(
              <button key={g.k} onClick={()=>setGran(g.k)}
                style={{ padding:'4px 10px', borderRadius:6, fontSize:11, cursor:'pointer', fontWeight:gran===g.k?700:400,
                  border:gran===g.k?'1px solid var(--accent)':'1px solid var(--border)',
                  background:gran===g.k?'var(--accent-bg)':'transparent',
                  color:gran===g.k?'var(--accent)':'var(--text-muted)' }}>{g.l}</button>
            ))}
          </div>
        )}

        <div className="card">
          <div style={{ fontWeight:600, marginBottom:12, fontSize:14 }}>Comparativo {GRANULARITIES.find(g=>g.k===gran)?.l}</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:'2px solid var(--border)' }}>
                  {[
                    { l:'Período', c:'var(--text-muted)' },
                    { l:'Portfólio %', c:'#4f8ef7' },
                    { l:'Portfólio R$', c:'#4f8ef7' },
                    { l:'CDI %', c:'#34d47e' },
                    { l:'IBOV %', c:'#f59e0b' },
                    { l:'Alpha', c:'var(--text-muted)' },
                  ].map((h,i)=>(
                    <th key={i} style={{ textAlign:i===0?'left':'right', padding:'6px 10px', color:h.c, fontWeight:600 }}>{h.l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...grouped.keys].reverse().map((label, ri) => {
                  const i = grouped.keys.length - 1 - ri
                  const pp = grouped.portPct[i]??0, pr = grouped.portR[i]??0
                  const cp = grouped.cdi[i]??0, ip = grouped.ibov[i]??0, al = pp - cp
                  return (
                    <tr key={label} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'5px 10px', color:'var(--text-muted)', fontSize:11 }}>{label}</td>
                      <td style={{ padding:'5px 10px', textAlign:'right', fontWeight:600, color:pp>=0?'var(--success)':'var(--danger)' }}>{pp>=0?'+':''}{pp.toFixed(2)}%</td>
                      <td style={{ padding:'5px 10px', textAlign:'right', color:pr>=0?'var(--success)':'var(--danger)' }}>{fmtR(pr)}</td>
                      <td style={{ padding:'5px 10px', textAlign:'right', color:'var(--text-muted)' }}>+{cp.toFixed(2)}%</td>
                      <td style={{ padding:'5px 10px', textAlign:'right', color:ip>=0?'var(--success)':'var(--danger)' }}>{ip>=0?'+':''}{ip.toFixed(2)}%</td>
                      <td style={{ padding:'5px 10px', textAlign:'right', fontWeight:600, color:al>=0?'var(--success)':'var(--danger)' }}>{al>=0?'+':''}{al.toFixed(2)}%</td>
                    </tr>
                  )
                })}
                <tr style={{ background:'var(--bg)', fontWeight:700, borderTop:'2px solid var(--border)' }}>
                  <td style={{ padding:'7px 10px' }}>Total acumulado</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:portTotal>=0?'var(--success)':'var(--danger)' }}>{portTotal>=0?'+':''}{portTotal.toFixed(1)}%</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:portTotal>=0?'var(--success)':'var(--danger)' }}>{fmtR(grouped.portR.reduce((a,b)=>a+b,0))}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:'var(--text-muted)' }}>+{cdiTotal.toFixed(1)}%</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:ibovTotal>=0?'var(--success)':'var(--danger)' }}>{ibovTotal>=0?'+':''}{ibovTotal.toFixed(1)}%</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:alpha>=0?'var(--success)':'var(--danger)' }}>{alpha>=0?'+':''}{alpha.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:8, fontSize:10, color:'var(--text-hint)' }}>
            CDI e IBOVESPA: dados históricos de referência aproximados (Banco Central / B3).
          </div>
        </div>

      </>)}
    </div>
  )
}
