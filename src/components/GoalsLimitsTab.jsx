import React, { useState, useEffect, useRef } from 'react'
import { fmtR, fmtPct, fmtNum } from '../lib/analytics'
import { simWithGoals } from '../lib/goalsLimits'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

export default function GoalsLimitsTab({ timeline, capital, metrics }) {
  const [stopPct, setStopPct] = useState(15)
  const [targetPct, setTargetPct] = useState(10)
  const [result, setResult] = useState(null)
  const charts = useRef({})

  useEffect(() => {
    if (!timeline.length || !capital) return
    const r = simWithGoals(timeline, capital, -Math.abs(stopPct), Math.abs(targetPct))
    setResult(r)
  }, [timeline, capital, stopPct, targetPct])

  useEffect(() => {
    if (!result) return
    const t = setTimeout(() => renderCharts(), 60)
    return () => {
      clearTimeout(t)
      Object.values(charts.current).forEach(c => { try { c.destroy() } catch(e) {} })
      charts.current = {}
    }
  }, [result])

  const getC = () => {
    const d = window.matchMedia('(prefers-color-scheme: dark)').matches
    return {
      blue: d?'#60a5fa':'#2563eb', green: d?'#4ade80':'#16a34a',
      red: d?'#f87171':'#dc2626',
      grid: d?'rgba(255,255,255,.07)':'rgba(0,0,0,.05)',
      text: d?'#9ca3af':'#6b7280',
    }
  }

  const renderCharts = () => {
    if (!result) return
    const c = getC()
    const curve = result.dailyCurve
    Object.values(charts.current).forEach(ch => { try { ch.destroy() } catch(e) {} })
    charts.current = {}

    // Equity chart
    const el1 = document.getElementById('gl-equity')
    if (el1) {
      try { Chart.getChart(el1)?.destroy() } catch(e) {}
      charts.current['equity'] = new Chart(el1, {
        type: 'line',
        data: {
          labels: curve.map(d => d.date),
          datasets: [
            { label: 'Sem limites', data: curve.map(d => +d.cumFree.toFixed(2)), borderColor: c.blue, backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1.5, borderDash: [5,3] },
            { label: 'Com metas/limites', data: curve.map(d => +d.cumGoals.toFixed(2)), borderColor: c.green, backgroundColor: c.green+'15', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: true, position: 'top', labels: { color: c.text, font: { size: 11 }, boxWidth: 12 } } },
          scales: {
            x: { ticks: { color: c.text, maxTicksLimit: 10 }, grid: { color: c.grid } },
            y: { ticks: { color: c.text, callback: v => 'R$ '+v.toLocaleString('pt-BR') }, grid: { color: c.grid } }
          }
        }
      })
    }

    // Monthly bar chart with threshold lines
    const el2 = document.getElementById('gl-monthly')
    if (el2 && result.monthlyFree) {
      try { Chart.getChart(el2)?.destroy() } catch(e) {}
      const months = Object.keys(result.monthlyFree).sort()
      const freeData = months.map(m => +result.monthlyFree[m].toFixed(2))
      const goalsData = months.map(m => +result.monthlyGoals[m].toFixed(2))
      const labels = months.map(m => { const [y,mo]=m.split('-'); return `${mo}/${y.slice(2)}` })

      charts.current['monthly'] = new Chart(el2, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Sem limites', data: freeData, backgroundColor: c.blue+'77', borderWidth: 0 },
            { label: 'Com limites', data: goalsData, backgroundColor: goalsData.map(v => v >= 0 ? c.green+'aa' : c.red+'aa'), borderWidth: 0 },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top', labels: { color: c.text, font: { size: 11 }, boxWidth: 10 } },
          },
          scales: {
            x: { ticks: { color: c.text, maxRotation: 45, font: { size: 10 } }, grid: { display: false } },
            y: {
              ticks: { color: c.text, callback: v => 'R$ '+v.toLocaleString('pt-BR',{maximumFractionDigits:0}) },
              grid: { color: c.grid }
            }
          }
        }
      })
    }
  }

  if (!timeline.length) return (
    <div className="empty-state"><p>Adicione robôs na aba Composição para simular metas e limites.</p></div>
  )

  const stopAbs = capital * stopPct / 100
  const targetAbs = capital * targetPct / 100
  const s = result?.stats

  return (
    <div>
      {/* Info bar */}
      <div style={{ marginBottom:14, padding:'10px 16px', background:'var(--bg)', borderRadius:'var(--radius)', border:'1px solid var(--border)', fontSize:13 }}>
        💰 Base de cálculo: <strong>capital necessário = {fmtR(capital)}</strong>
        <span style={{ color:'var(--text-muted)', marginLeft:8 }}>— stop e meta são % desse valor</span>
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:24, padding:'14px 18px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', marginBottom:16, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div style={{ fontWeight:600, fontSize:14, flex:'0 0 100%' }}>Simulação de metas e limites mensais</div>

        <div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>Stop mensal (perda máxima do mês)</div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <input type="range" min="1" max="50" step="1" value={stopPct}
              onChange={e => setStopPct(+e.target.value)} style={{ width:130 }} />
            <span style={{ fontSize:15, fontWeight:700, color:'var(--danger)', minWidth:44 }}>-{stopPct}%</span>
            <span style={{ fontSize:13, fontWeight:600, color:'var(--danger)' }}>= {fmtR(-stopAbs)}</span>
          </div>
          <div style={{ fontSize:11, color:'var(--text-hint)', marginTop:2 }}>
            Se o mês acumular -{fmtR(stopAbs)}, para de operar até o mês seguinte
          </div>
        </div>

        <div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>Meta mensal (ganho alvo do mês)</div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <input type="range" min="1" max="100" step="1" value={targetPct}
              onChange={e => setTargetPct(+e.target.value)} style={{ width:130 }} />
            <span style={{ fontSize:15, fontWeight:700, color:'var(--success)', minWidth:44 }}>+{targetPct}%</span>
            <span style={{ fontSize:13, fontWeight:600, color:'var(--success)' }}>= {fmtR(targetAbs)}</span>
          </div>
          <div style={{ fontSize:11, color:'var(--text-hint)', marginTop:2 }}>
            Se o mês acumular +{fmtR(targetAbs)}, para de operar até o mês seguinte
          </div>
        </div>
      </div>

      {/* Stats */}
      {s && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(155px,1fr))', gap:10, marginBottom:16 }}>
          {[
            { label:'Resultado sem limites', value:fmtR(s.totalFree), sub:fmtPct(s.rentFree)+'% capital', color:s.totalFree>=0?'var(--success)':'var(--danger)' },
            { label:'Resultado com limites', value:fmtR(s.totalGoals), sub:fmtPct(s.rentGoals)+'% capital', color:s.totalGoals>=0?'var(--success)':'var(--danger)' },
            { label:'Diferença', value:fmtR(s.totalGoals-s.totalFree), sub:s.totalGoals>=s.totalFree?'Melhorou':'Piorou', color:s.totalGoals>=s.totalFree?'var(--success)':'var(--danger)' },
            { label:'Operações puladas', value:s.nOpsSkipped, sub:`de ${s.nOpsTotal} total`, color:'var(--text)' },
            { label:'Meses por meta', value:s.blockedByMeta, sub:'meta atingida', color:'var(--success)' },
            { label:'Meses por stop', value:s.blockedByStop, sub:'stop acionado', color:'var(--danger)' },
          ].map((m,i) => (
            <div key={i} style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'10px 14px' }}>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>{m.label}</div>
              <div style={{ fontSize:18, fontWeight:700, color:m.color }}>{m.value}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{m.sub}</div>
            </div>
          ))}
        </div>
      )}

      <div className="chart-card" style={{ marginBottom:12 }}>
        <div className="chart-title">Curva de capital — livre vs com metas/limites</div>
        <div style={{ position:'relative', height:240 }}><canvas id="gl-equity" /></div>
      </div>

      <div className="chart-card" style={{ marginBottom:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <div className="chart-title" style={{ margin:0 }}>Resultado mensal — livre vs com metas/limites</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>
            Stop: <strong style={{color:'var(--danger)'}}>{fmtR(-stopAbs)}</strong> ·
            Meta: <strong style={{color:'var(--success)'}}>{fmtR(targetAbs)}</strong> por mês
          </div>
        </div>
        <div style={{ position:'relative', height:220 }}><canvas id="gl-monthly" /></div>
      </div>

      {result?.blockedMonthsList?.length > 0 && (
        <div className="card">
          <div style={{ fontWeight:600, marginBottom:10 }}>
            Meses bloqueados ({result.blockedMonthsList.length})
            <span style={{ fontSize:12, fontWeight:400, color:'var(--text-muted)', marginLeft:8 }}>
              {s?.blockedByMeta} por meta atingida · {s?.blockedByStop} por stop
            </span>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {result.blockedMonthsList.map((b,i) => (
              <span key={i} style={{ padding:'3px 10px', fontSize:12, borderRadius:'var(--radius)',
                background: b.reason==='Meta atingida'?'var(--success-bg)':'var(--danger-bg)',
                color: b.reason==='Meta atingida'?'var(--success)':'var(--danger)', fontWeight:500 }}>
                {b.month.split('-')[1]}/{b.month.split('-')[0].slice(2)} — {b.reason}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
