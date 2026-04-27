import React, { useState, useEffect, useRef } from 'react'
import { parseCSV, fmtR, fmtNum } from '../lib/analytics'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

// Converte timeframe string → duração em minutos
function tfToMinutes(tf) {
  if (!tf) return null
  const s = tf.toLowerCase().trim()
  if (s.endsWith('m') && !s.includes('r')) return parseInt(s) || null
  if (s === 'diario')  return 1440
  if (s === 'semanal') return 10080
  if (s === '60m' || s === '1h') return 60
  // Renkos: sem duração fixa — usar margem de 30 min
  if (s.endsWith('r')) return 30
  return null
}

// Match BT vs Real por janela de candle
function matchByCandle(btOps, realOps, tfMinutes) {
  // Para cada op BT, procura uma op real dentro da janela do candle
  // Janela: [bt_abertura, bt_abertura + tfMinutes)
  // Se não tiver timeframe configurado, usa margem de 5 min (compatibilidade)
  const margin = tfMinutes || 5

  // Converte data DD/MM/YYYY HH:MM:SS para timestamp
  const toTs = (s) => {
    if (!s) return 0
    const [datePart, timePart = '00:00:00'] = s.split(' ')
    const [d, m, y] = datePart.split('/')
    return new Date(`${y}-${m}-${d}T${timePart}`).getTime()
  }

  // Indexa realOps por data (para acelerar busca)
  const realByDay = {}
  realOps.forEach(r => {
    const day = r.abertura?.slice(0, 10) || ''
    if (!realByDay[day]) realByDay[day] = []
    realByDay[day].push(r)
  })

  const usedReal = new Set()
  const pairs = btOps.map(bt => {
    const btTs = toTs(bt.abertura)
    const day = bt.abertura?.slice(0, 10) || ''
    // Procura no mesmo dia e no dia seguinte (operações noturnas)
    const candidates = [...(realByDay[day] || []), ...(realByDay[nextDay(day)] || [])]
    let best = null, bestDiff = Infinity
    for (const r of candidates) {
      if (usedReal.has(r)) continue
      const rTs = toTs(r.abertura)
      const diff = rTs - btTs
      // Real deve estar DENTRO do candle: [0, margin * 60000)
      if (diff >= 0 && diff < margin * 60000) {
        if (diff < bestDiff) { bestDiff = diff; best = r }
      }
    }
    if (best) usedReal.add(best)
    return { bt, real: best }
  })

  // Ops reais SEM match
  const unmatched = realOps.filter(r => !usedReal.has(r))
  return { pairs, unmatchedReal: unmatched }
}

function nextDay(ddmmyyyy) {
  if (!ddmmyyyy || !ddmmyyyy.includes('/')) return ddmmyyyy
  const [d, m, y] = ddmmyyyy.split('/').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + 1)
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
}

export default function RealOpsTab({ robotId, adjOps, timeframe }) {
  const [realOps, setRealOps] = useState([])
  const [pairs, setPairs] = useState([])
  const [unmatchedReal, setUnmatchedReal] = useState([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [normalizeContracts, setNormalizeContracts] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const charts = useRef({})
  const tfMin = tfToMinutes(timeframe)

  useEffect(() => { loadRealOps() }, [robotId])

  useEffect(() => {
    if (realOps.length && adjOps.length) {
      const { pairs: p, unmatchedReal: u } = matchByCandle(adjOps, realOps, tfMin)
      setPairs(p)
      setUnmatchedReal(u)
    }
  }, [realOps, adjOps, tfMin])

  useEffect(() => {
    const matchedPairs = pairs.filter(p => p.real)
    if (!matchedPairs.length) return
    const t = setTimeout(() => { renderCompareChart(matchedPairs); renderDiffChart(matchedPairs) }, 80)
    return () => {
      clearTimeout(t)
      Object.values(charts.current).forEach(c => { try { c.destroy() } catch(e) {} })
      charts.current = {}
    }
  }, [pairs])

  const loadRealOps = async () => {
    setLoading(true)
    const ops = await window.api.realops.get(robotId)
    setRealOps(ops || [])
    setLoading(false)
  }

  const handleImport = async () => {
    const result = await window.api.openFile()
    if (!result) return
    setImporting(true)
    try {
      const { ops } = parseCSV(result.buffer)
      const toSave = ops.map(op => ({ robotId, abertura: op.abertura, fechamento: op.fechamento, lado: op.lado, qtd: op.qtd || 1, res_op: op.res_op, res_op_pct: op.res_op_pct }))
      await window.api.realops.save({ robotId, operations: toSave })
      await loadRealOps()
    } catch(e) { alert('Erro ao importar: ' + e.message) }
    setImporting(false)
  }

  const handleAppend = async () => {
    const result = await window.api.openFile()
    if (!result) return
    setImporting(true)
    try {
      const { ops } = parseCSV(result.buffer)
      const toAppend = ops.map(op => ({ robotId, abertura: op.abertura, fechamento: op.fechamento, lado: op.lado, qtd: op.qtd || 1, res_op: op.res_op, res_op_pct: op.res_op_pct }))
      const res = await window.api.realops.append({ robotId, operations: toAppend })
      await loadRealOps()
      if (res) alert(`✓ ${res.added} operações adicionadas · ${res.skipped} duplicatas ignoradas`)
    } catch(e) { alert('Erro ao adicionar: ' + e.message) }
    setImporting(false)
  }

  const handleDelete = async () => {
    if (!confirm('Remover todos os dados de conta real desta estratégia?')) return
    await window.api.realops.delete(robotId)
    setRealOps([]); setPairs([]); setUnmatchedReal([])
  }

  const getColors = () => {
    const d = window.matchMedia('(prefers-color-scheme: dark)').matches
    return {
      green: d ? '#4ade80' : '#16a34a', red: d ? '#f87171' : '#dc2626',
      blue: d ? '#60a5fa' : '#2563eb', orange: '#f5a623',
      grid: d ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
      text: d ? '#9ca3af' : '#6b7280',
    }
  }

  const renderCompareChart = (matchedPairs) => {
    const el = document.getElementById('rc-compare'); if (!el) return
    try { charts.current['compare']?.destroy() } catch(e) {}
    const c = getColors()
    let accBt = 0, accReal = 0
    const labels = matchedPairs.map(p => p.bt.abertura.slice(0, 10))
    const btData = matchedPairs.map(p => { accBt += p.bt.resAdj; return +accBt.toFixed(2) })
    const realData = matchedPairs.map(p => {
      const res = normalizeContracts ? p.real.res_op / (p.real.qtd || 1) : p.real.res_op
      accReal += res; return +accReal.toFixed(2)
    })
    charts.current['compare'] = new Chart(el, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Backtest', data: btData, borderColor: c.blue, tension: 0.3, pointRadius: 0, fill: false, borderWidth: 1.5 },
          { label: 'Conta Real', data: realData, borderColor: c.orange, tension: 0.3, pointRadius: 0, fill: false, borderWidth: 2 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: true, labels: { color: c.text, boxWidth: 20, font: { size: 11 } } } },
        scales: {
          x: { ticks: { color: c.text, maxTicksLimit: 12 }, grid: { color: c.grid } },
          y: { ticks: { color: c.text, callback: v => 'R$ ' + v.toLocaleString('pt-BR') }, grid: { color: c.grid } }
        }
      }
    })
  }

  const renderDiffChart = (matchedPairs) => {
    const el = document.getElementById('rc-diff'); if (!el) return
    try { charts.current['diff']?.destroy() } catch(e) {}
    const c = getColors()
    const diffs = matchedPairs.map(p => {
      const res = normalizeContracts ? p.real.res_op / (p.real.qtd || 1) : p.real.res_op
      return +(res - p.bt.resAdj).toFixed(2)
    })
    charts.current['diff'] = new Chart(el, {
      type: 'bar',
      data: {
        labels: matchedPairs.map(p => p.bt.abertura.slice(0, 10)),
        datasets: [{ data: diffs, backgroundColor: diffs.map(v => v >= 0 ? c.green + 'cc' : c.red + 'cc'), borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: c.text, maxTicksLimit: 12 }, grid: { display: false } },
          y: { ticks: { color: c.text, callback: v => 'R$ ' + v.toLocaleString('pt-BR') }, grid: { color: c.grid } }
        }
      }
    })
  }

  const matchedPairs = pairs.filter(p => p.real)
  const btTotal   = matchedPairs.reduce((a,p) => a + p.bt.resAdj, 0)
  const realTotal = matchedPairs.reduce((a,p) => a + (normalizeContracts ? p.real.res_op/(p.real.qtd||1) : p.real.res_op), 0)
  const diffPct   = btTotal !== 0 ? ((realTotal - btTotal) / Math.abs(btTotal)) * 100 : 0
  const allRealTotal = realOps.reduce((a,o) => a + (o.res_op||0), 0)

  // Para exibição: todas as ops BT + ops reais sem match
  // Converte DD/MM/YYYY HH:MM:SS para timestamp para sort correto
  const toSortKey = (s) => {
    if (!s) return 0
    const [datePart, timePart = '00:00:00'] = s.split(' ')
    const [d, m, y] = datePart.split('/')
    return new Date(`${y}-${m}-${d}T${timePart}`).getTime()
  }

  const tableRows = [
    ...pairs.map(p => ({ type:'bt', bt: p.bt, real: p.real })),
    ...unmatchedReal.map(r => ({ type:'real_only', bt: null, real: r })),
  ].sort((a,b) => {
    const ta = toSortKey(a.bt?.abertura || a.real?.abertura)
    const tb = toSortKey(b.bt?.abertura || b.real?.abertura)
    return tb - ta  // desc — mais recente primeiro
  })
  const displayRows = showAll ? tableRows : tableRows.slice(0, 100)

  // Cores de fundo por tipo de linha
  const rowBgColor = (type, real) => {
    if (type === 'real_only') return 'rgba(245,166,35,0.08)'    // âmbar = só real
    if (type === 'bt' && real) return 'rgba(52,212,126,0.07)'   // verde claro = match BT+Real
    return 'transparent'                                         // neutro = só BT
  }
  const rowBorderLeft = (type, real) => {
    if (type === 'real_only') return '2px solid rgba(245,166,35,0.45)'
    if (type === 'bt' && real) return '2px solid rgba(52,212,126,0.35)'
    return '2px solid transparent'
  }

  // Definições de tooltip para os cards
  const cardTips = [
    { label:'Total conta real', tip:'Soma de todas as operações importadas da conta real, independente de match com o backtest.' },
    { label:'Match com backtest', tip:'Operações reais que encontraram uma operação correspondente no backtest dentro da janela do candle configurado.' },
    { label:'BT (matched)', tip:'Resultado acumulado das operações do backtest que tiveram correspondência na conta real.' },
    { label:'Real (matched)', tip:'Resultado acumulado das operações reais que tiveram correspondência no backtest.' + (normalizeContracts ? ' Normalizado para 1 contrato.' : '') },
    { label:'Diferença BT vs Real', tip:'Variação percentual entre o resultado real e o backtest nas operações com match. Positivo = real superou o backtest.' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontWeight:600, fontSize:15 }}>Conta Real</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
            {realOps.length > 0
              ? `${realOps.length} ops reais · ${matchedPairs.length} com match BT · ${unmatchedReal.length} sem match`
              + (tfMin ? ` · janela ${tfMin}min` : ' · janela 5min (configure o TF)')
              : 'Nenhum dado importado'}
          </div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {!timeframe && realOps.length > 0 && (
            <span style={{ fontSize:11, color:'var(--warning)', background:'var(--warning-bg)', border:'1px solid var(--warning)', borderRadius:6, padding:'3px 8px' }}>
              ⚠ Configure o Timeframe para match preciso
            </span>
          )}
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer',
            padding:'6px 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--bg)' }}>
            <input type="checkbox" checked={normalizeContracts} onChange={e => setNormalizeContracts(e.target.checked)} />
            <span>Normalizar 1 contrato</span>
          </label>
          <button className="btn primary" onClick={handleImport} disabled={importing}
            title="Substitui todos os dados de conta real pelo arquivo importado">
            {importing ? 'Importando...' : realOps.length > 0 ? '↺ Reimportar' : '+ Importar CSV'}
          </button>
          {realOps.length > 0 && <>
            <button className="btn" onClick={handleAppend} disabled={importing}
              title="Adiciona operações ao existente, ignorando duplicatas">
              + Adicionar CSV
            </button>
            <button className="btn danger" onClick={handleDelete}>Remover</button>
          </>}
        </div>
      </div>

      {loading && <div style={{ color:'var(--text-muted)', fontSize:13 }}>Carregando...</div>}

      {!loading && realOps.length === 0 && (
        <div className="empty-state">
          <p>Importe o CSV de conta real desta estratégia exportado do Profit.</p>
          <p style={{ fontSize:12, marginTop:6, color:'var(--text-muted)' }}>
            O match usa a janela do candle (configure o Timeframe da estratégia).
          </p>
        </div>
      )}

      {realOps.length > 0 && (<>
        {/* Summary */}
        <div className="metrics-grid" style={{ marginBottom:16 }}>
          {[
            { label:'Total conta real', value: fmtR(allRealTotal), cls: allRealTotal>=0?'pos':'neg', sub: `${realOps.length} operações` },
            { label:'Match com backtest', value: matchedPairs.length, sub: `de ${adjOps.length} BT · ${unmatchedReal.length} reais sem match` },
            { label:'BT (matched)', value: fmtR(btTotal), cls: btTotal>=0?'pos':'neg', sub:'operações com correspondência' },
            { label:'Real (matched)', value: fmtR(realTotal), cls: realTotal>=0?'pos':'neg', sub: normalizeContracts?'normalizado 1 contrato':'valor bruto' },
            { label:'Diferença BT vs Real', value: (diffPct>=0?'+':'') + diffPct.toFixed(1)+'%', cls: Math.abs(diffPct)<15?'pos':Math.abs(diffPct)<40?'warn':'neg', sub: fmtR(realTotal-btTotal) },
          ].map((m,i) => (
            <div key={i} style={{ background:'var(--bg)', borderRadius:'var(--radius)', padding:'10px 14px', position:'relative' }}>
              <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:2 }}>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{m.label}</div>
                <span title={cardTips[i]?.tip} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                  width:13, height:13, borderRadius:'50%', border:'1px solid var(--border-strong)',
                  color:'var(--text-hint)', fontSize:8, fontWeight:700, cursor:'help', flexShrink:0, lineHeight:1 }}>?</span>
              </div>
              <div className={`metric-value ${m.cls||''}`} style={{ fontSize:18, fontWeight:700 }}>{m.value}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {matchedPairs.length > 0 && (<>
          <div className="chart-card" style={{ marginBottom:12 }}>
            <div className="chart-title">Backtest vs Conta Real — curva acumulada</div>
            <div style={{ position:'relative', height:220 }}><canvas id="rc-compare"/></div>
          </div>
          <div className="chart-card" style={{ marginBottom:16 }}>
            <div className="chart-title">Diferença por operação: Real − Backtest (R$)</div>
            <div style={{ position:'relative', height:140 }}><canvas id="rc-diff"/></div>
          </div>
        </>)}

        {/* Tabela — TODAS as operações */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontWeight:600, fontSize:14 }}>
            Todas as operações
            <span style={{ fontSize:11, fontWeight:400, color:'var(--text-muted)', marginLeft:8 }}>
              {matchedPairs.length} com match · {unmatchedReal.length} reais sem match · {pairs.filter(p=>!p.real).length} BT sem correspondência
            </span>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:11 }}>
              <span style={{ color:'var(--accent)' }}>━</span> BT+Real &nbsp;
              <span style={{ color:'var(--text-hint)' }}>━</span> Só BT &nbsp;
              <span style={{ color:'#f5a623' }}>━</span> Só Real
            </span>
          </div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Lado</th>
                <th style={{ color:'#f5a623' }}>Res. Conta Real</th>
                <th style={{ color:'var(--accent)' }}>Res. Backtest</th>
                <th>Diferença</th>
                <th>Dif. %</th>
                <th>Data/Hora Real</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => {
                const isMatch   = row.type === 'bt' && row.real
                const isBtOnly  = row.type === 'bt' && !row.real
                const isRealOnly= row.type === 'real_only'
                const resReal   = row.real ? (normalizeContracts ? row.real.res_op/(row.real.qtd||1) : row.real.res_op) : null
                const resBt     = row.bt?.resAdj ?? null
                const diff      = isMatch ? resReal - resBt : null
                const diffP     = diff != null && resBt !== 0 ? (diff/Math.abs(resBt))*100 : null
                return (
                  <tr key={i} style={{
                    background: rowBgColor(row.type, row.real),
                    borderLeft: rowBorderLeft(row.type, row.real),
                  }}>
                    <td style={{ fontSize:11 }}>{row.bt?.abertura || row.real?.abertura || '—'}</td>
                    <td>
                      {row.bt?.lado
                        ? <span className={`badge ${row.bt.lado==='C'?'blue':'green'}`} style={{ fontSize:10 }}>{row.bt.lado==='C'?'Compra':'Venda'}</span>
                        : <span style={{ color:'var(--text-hint)', fontSize:11 }}>—</span>}
                    </td>
                    <td className={resReal != null ? (resReal>=0?'pos':'neg') : ''} style={{ color: resReal==null?'var(--text-hint)':undefined }}>
                      {resReal != null ? fmtR(resReal) : '—'}
                    </td>
                    <td className={resBt != null ? (resBt>=0?'pos':'neg') : ''} style={{ color: resBt==null?'var(--text-hint)':undefined }}>
                      {resBt != null ? fmtR(resBt) : '—'}
                    </td>
                    <td className={diff != null ? (diff>=0?'pos':'neg') : ''}>
                      {diff != null ? fmtR(diff) : '—'}
                    </td>
                    <td style={{ fontSize:12, color: diffP==null?'var(--text-hint)':Math.abs(diffP)<15?'var(--success)':Math.abs(diffP)<40?'var(--warning)':'var(--danger)' }}>
                      {diffP != null ? (diffP>=0?'+':'')+diffP.toFixed(1)+'%' : '—'}
                    </td>
                    <td style={{ fontSize:10, color:'var(--text-muted)' }}>{row.real?.abertura || '—'}</td>
                    <td style={{ fontSize:11 }}>
                      {isMatch    && <span style={{ color:'var(--success)' }}>✓ Match</span>}
                      {isBtOnly   && <span style={{ color:'var(--text-hint)' }}>BT sem real</span>}
                      {isRealOnly && <span style={{ color:'#f5a623' }}>Só real</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {tableRows.length > 100 && !showAll && (
          <div style={{ textAlign:'center', marginTop:10 }}>
            <button className="btn" onClick={() => setShowAll(true)}>
              Mostrar todas ({tableRows.length}) operações
            </button>
          </div>
        )}
      </>)}
    </div>
  )
}
