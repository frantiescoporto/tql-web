/**
 * Aba Avaliação — Score Scherman
 * Baseado na filosofia de Ivan Scherman (Emerge Funds / SciTech Investments)
 * Campeão Mundial de Trading de Futuros 2023 (+491% auditado)
 *
 * Critérios implementados:
 * 1. Descorrelação de PNL (25 pts) — "Santo Graal do trading"
 * 2. Diversidade de Lógicas (20 pts) — Multi-estratégia / Multi-timeframe
 * 3. Distribuição de Risco — Risk Parity (20 pts)
 * 4. Qualidade das Estratégias (20 pts) — Edge estatístico comprovado
 * 5. Robustez do conjunto (15 pts) — % aprovados individualmente
 */

import React, { useState } from 'react'
import { fmtR, fmtNum, fmtPct } from '../lib/analytics'

// ── Funções auxiliares ──────────────────────────────────────────────────────

/** Gini coefficient — 0=perfeita igualdade, 1=concentração total */
function gini(values) {
  if (!values.length) return 0
  const n = values.length
  const sorted = [...values].sort((a, b) => a - b)
  const total = sorted.reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  const sum = sorted.reduce((acc, v, i) => acc + v * (2 * (i + 1) - n - 1), 0)
  return sum / (n * total)
}

/** Média das correlações par-a-par (upper triangle, sem diagonal) */
function avgPairwiseCorr(matrix) {
  const n = matrix.length
  if (n < 2) return 0
  let sum = 0, count = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      sum += Math.abs(matrix[i][j])
      count++
    }
  }
  return count ? sum / count : 0
}

/** Classifica correlação em tier */
function corrTier(avg) {
  if (avg < 0.25) return { label: 'Excelente', color: '#34d47e', pts: 25 }
  if (avg < 0.40) return { label: 'Boa',       color: '#4f8ef7', pts: 18 }
  if (avg < 0.55) return { label: 'Moderada',  color: '#f5a623', pts: 10 }
  return                 { label: 'Alta',       color: '#f06060', pts: 4  }
}

// ── Componente principal ───────────────────────────────────────────────────

export default function AvaliacaoTab({ corrMatrix, selected, robotData, metrics, extMetrics }) {
  const [showDetails, setShowDetails] = useState(false)

  if (!selected.length) {
    return <div className="empty-state"><p>Adicione robôs na aba Composição para avaliar o portfólio.</p></div>
  }

  // ── 1. Descorrelação de PNL ──────────────────────────────────────────────
  const hasCorr = corrMatrix?.matrix?.length >= 2
  const avgCorr = hasCorr ? avgPairwiseCorr(corrMatrix.matrix) : null
  const corrT = avgCorr != null ? corrTier(avgCorr) : null
  const score1 = corrT?.pts ?? 0
  const corrNote = avgCorr == null
    ? 'Abra a aba Correlação uma vez para calcular.'
    : `Correlação média: ${avgCorr.toFixed(2)} — ${corrT.label}`

  // ── 2. Diversidade de Lógicas ────────────────────────────────────────────
  const stratTypes = new Set()
  const timeframes = new Set()
  selected.forEach(s => {
    const rd = robotData[s.robotId]
    const st = rd?.robot?.strategy_type || 'Não definido'
    const tf = rd?.robot?.timeframe || ''
    if (st && st !== 'Não definido') stratTypes.add(st)
    if (tf) timeframes.add(tf)
  })
  const nTypes = stratTypes.size
  const nTF = timeframes.size
  // Verifica se tem tendência E reversão/pullback/mean-reversion
  const hasTrend = [...stratTypes].some(t => /tendência|trend|breakout/i.test(t))
  const hasReversion = [...stratTypes].some(t => /pullback|reversão|scalper|exaustão|mean/i.test(t))
  const complementar = hasTrend && hasReversion

  let score2 = 0
  if (nTypes >= 4) score2 = 20
  else if (nTypes === 3) score2 = 15
  else if (nTypes === 2 && complementar) score2 = 14
  else if (nTypes === 2) score2 = 10
  else score2 = 5
  if (nTF >= 3) score2 = Math.min(20, score2 + 2)

  const typeLabel = nTypes === 0 ? 'Nenhum tipo definido' :
    `${nTypes} tipo${nTypes > 1 ? 's' : ''}: ${[...stratTypes].join(', ')}`

  // ── 3. Distribuição de Risco (Risk Parity) ────────────────────────────────
  // Proxy: DD_base × lots por robô
  const riskByRobot = selected.map(s => {
    const rd = robotData[s.robotId]
    const m = rd ? (() => {
      try {
        const { calcMetrics, buildAdjOps } = require('../lib/analytics')
        return calcMetrics(rd.adjOps)
      } catch { return null }
    })() : null
    const dd = Math.abs(m?.maxDD || 0) || 1
    return { name: rd?.robot?.name || `Robô ${s.robotId}`, risk: dd * (s.lots || 1) }
  })
  const riskValues = riskByRobot.map(r => r.risk)
  const totalRisk = riskValues.reduce((a, b) => a + b, 0)
  const riskPcts = riskValues.map(v => totalRisk > 0 ? v / totalRisk * 100 : 0)
  const maxRiskPct = Math.max(...riskPcts)
  const g = gini(riskValues)

  let score3 = 0
  if (g < 0.15) score3 = 20
  else if (g < 0.28) score3 = 16
  else if (g < 0.42) score3 = 10
  else score3 = 4
  const giniLabel = g < 0.15 ? 'Excelente equilíbrio' :
    g < 0.28 ? 'Bom equilíbrio' :
    g < 0.42 ? 'Concentração moderada' : 'Risco concentrado'

  // ── 4. Qualidade das Estratégias ──────────────────────────────────────────
  let m6015Sum = 0, m6015Count = 0, pfSum = 0
  selected.forEach(s => {
    const rd = robotData[s.robotId]
    if (!rd?.adjOps?.length) return
    try {
      // Use pre-computed metrics from robotData if available, else skip
      const vals = rd.adjOps
      if (!vals.length) return
      const gross = vals.reduce((a, o) => a + o.resAdj, 0)
      const wins = vals.filter(o => o.resAdj > 0)
      const losses = vals.filter(o => o.resAdj < 0)
      const gw = wins.reduce((a, o) => a + o.resAdj, 0)
      const gl = Math.abs(losses.reduce((a, o) => a + o.resAdj, 0))
      const pf = gl > 0 ? gw / gl : 99
      pfSum += pf; m6015Count++
      // approximate m6015 from pf (can't import calcMetrics due to require)
      m6015Sum += pf // fallback
    } catch {}
  })
  // Better: use robotData cached metrics if available
  let avgM6015 = 0, avgPF = 0
  let m6015Data = []
  selected.forEach(s => {
    const rd = robotData[s.robotId]
    // Try to get m6015 from pre-computed data in robotData
    // robotData[id] = { robot, adjOps, avgMonthlyReal }
    // We need to compute inline or trust extMetrics
    if (rd?.adjOps?.length) {
      const adj = rd.adjOps
      const total = adj.reduce((a,o)=>a+o.resAdj,0)
      const wins2 = adj.filter(o=>o.resAdj>0)
      const losses2 = adj.filter(o=>o.resAdj<0)
      const gw2 = wins2.reduce((a,o)=>a+o.resAdj,0)
      const gl2 = Math.abs(losses2.reduce((a,o)=>a+o.resAdj,0))
      const pf2 = gl2 > 0 ? Math.min(gw2/gl2, 99) : 99
      // DD and recovery factor
      let acc=0,peak=0,maxDD=0
      adj.forEach(o=>{ acc+=o.resAdj; if(acc>peak)peak=acc; const dd=peak-acc; if(dd>maxDD)maxDD=dd })
      const t0=adj[0]?.abertura, t1=adj[adj.length-1]?.abertura
      const parseD = s => { const p=s?.split(' ')[0]?.split('/'); return p?.length===3?new Date(`${p[2]}-${p[1]}-${p[0]}`):new Date() }
      const anos = t0&&t1 ? Math.max((parseD(t1)-parseD(t0))/(365.25*86400000), 1/12) : 1
      const fra = maxDD>0 ? (total/maxDD)/anos : 0
      const m = pf2 + fra
      avgM6015 += m; avgPF += pf2
      m6015Data.push({ name: rd.robot?.name||`R${s.robotId}`, m6015: +m.toFixed(2), pf: +pf2.toFixed(2) })
    }
  })
  if (m6015Data.length) { avgM6015 /= m6015Data.length; avgPF /= m6015Data.length }

  let score4 = 0
  if (avgM6015 >= 5) score4 = 20
  else if (avgM6015 >= 3.5) score4 = 17
  else if (avgM6015 >= 2.5) score4 = 12
  else if (avgM6015 >= 1.5) score4 = 7
  else score4 = 3

  // ── 5. Robustez do conjunto ────────────────────────────────────────────────
  const aprovados = m6015Data.filter(r => r.m6015 >= 3).length
  const totalRobots = m6015Data.length || selected.length
  const pctAprov = totalRobots ? aprovados / totalRobots * 100 : 0

  let score5 = 0
  if (pctAprov >= 90) score5 = 15
  else if (pctAprov >= 70) score5 = 12
  else if (pctAprov >= 50) score5 = 8
  else score5 = 3

  // ── Score total ────────────────────────────────────────────────────────────
  const total = score1 + score2 + score3 + score4 + score5
  const totalMax = 100

  const tier = total >= 80 ? { label:'Portfólio Excelente', color:'#34d47e', icon:'🏆' }
    : total >= 65 ? { label:'Portfólio Bom', color:'#4f8ef7', icon:'✅' }
    : total >= 45 ? { label:'Portfólio Moderado', color:'#f5a623', icon:'⚠️' }
    : { label:'Portfólio Frágil', color:'#f06060', icon:'🔴' }

  // ── Recomendações ──────────────────────────────────────────────────────────
  const recs = []
  if (score1 < 15) recs.push({
    icon:'🔗', title:'Melhorar descorrelação',
    text: avgCorr != null
      ? `Correlação média ${avgCorr.toFixed(2)} está acima do ideal (<0.40). Adicione estratégias de lógicas opostas (ex: reversão se o portfólio é majoritariamente tendência).`
      : 'Abra a aba Correlação para calcular a descorrelação entre os robôs.'
  })
  if (score2 < 14) recs.push({
    icon:'🧩', title:'Diversificar lógicas operacionais',
    text: `Portfólio tem ${nTypes} tipo${nTypes!==1?'s':''} de estratégia. Scherman recomenda pelo menos tendência + reversão operando simultaneamente. Adicione estratégias complementares.`
  })
  if (score3 < 12) recs.push({
    icon:'⚖️', title:'Equalizar distribuição de risco',
    text: `Gini de ${g.toFixed(2)} indica concentração de risco. O robô com maior exposição consome ${maxRiskPct.toFixed(0)}% do risco total. Ajuste os lotes para que nenhum robô tenha peso de risco desproporcional.`
  })
  if (score4 < 12) recs.push({
    icon:'📊', title:'Elevar qualidade média',
    text: `M.6015 médio de ${avgM6015.toFixed(2)} está abaixo do ideal (≥3.5). Substitua estratégias com pontuação baixa por robôs com edge estatístico mais sólido.`
  })
  if (score5 < 10) recs.push({
    icon:'🎯', title:'Aumentar % de aprovados',
    text: `${pctAprov.toFixed(0)}% dos robôs têm M.6015 ≥ 3. Scherman recomenda que todos os sistemas tenham edge comprovado. Remova ou substitua estratégias reprovadas.`
  })
  if (!recs.length) recs.push({
    icon:'✅', title:'Portfólio dentro dos critérios',
    text: 'Todos os critérios de Scherman estão satisfeitos. Mantenha o monitoramento mensal e reavalie a cada 3-6 meses conforme a performance individual das estratégias.'
  })

  // ── Critérios individuais ─────────────────────────────────────────────────
  const criterios = [
    {
      n: 1, label: 'Descorrelação de PNL', max: 25, score: score1,
      icon: '🔗',
      desc: '"Santo Graal do trading" — Scherman. Perdas de um sistema devem ocorrer enquanto outros performam.',
      detail: corrNote,
      ref: 'Correlação média par-a-par < 0.25 = excelente · < 0.40 = boa · < 0.55 = moderada',
    },
    {
      n: 2, label: 'Diversidade de Lógicas', max: 20, score: score2,
      icon: '🧩',
      desc: 'Multi-estratégia e multi-timeframe: tendência + reversão + timeframes distintos operando simultaneamente.',
      detail: typeLabel + (nTF > 0 ? ` · ${nTF} timeframe${nTF>1?'s':''}` : ''),
      ref: '4+ tipos = excelente · tendência+reversão = bom · 1 tipo = fraco',
    },
    {
      n: 3, label: 'Distribuição de Risco (Risk Parity)', max: 20, score: score3,
      icon: '⚖️',
      desc: 'Nenhum robô deve concentrar o risco do portfólio. Alocação matemática equivalente de impacto.',
      detail: `Gini ${g.toFixed(2)} — ${giniLabel} · Maior exposição: ${maxRiskPct.toFixed(0)}%`,
      ref: 'Gini < 0.15 = excelente · < 0.28 = bom · < 0.42 = moderado · > 0.42 = concentrado',
    },
    {
      n: 4, label: 'Qualidade das Estratégias', max: 20, score: score4,
      icon: '📊',
      desc: 'Edge estatístico comprovado. Cada sistema precisa de expectativa matemática positiva e histórico validado.',
      detail: `M.6015 médio: ${avgM6015.toFixed(2)} · FL médio: ${avgPF.toFixed(2)}`,
      ref: 'M.6015 ≥ 5 = excelente · ≥ 3.5 = bom · ≥ 2.5 = moderado',
    },
    {
      n: 5, label: 'Robustez do Conjunto', max: 15, score: score5,
      icon: '🎯',
      desc: '% de estratégias individualmente aprovadas. Portfólio só é forte se os componentes são fortes.',
      detail: `${aprovados} de ${totalRobots} robôs com M.6015 ≥ 3 (${pctAprov.toFixed(0)}% aprovados)`,
      ref: '≥ 90% = excelente · ≥ 70% = bom · ≥ 50% = moderado',
    },
  ]

  const scoreColor = (s, max) => s/max >= 0.8 ? '#34d47e' : s/max >= 0.6 ? '#4f8ef7' : s/max >= 0.4 ? '#f5a623' : '#f06060'

  return (
    <div>
      {/* Score total */}
      <div className="card" style={{ marginBottom:16, display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
        {/* Gauge circular */}
        <div style={{ position:'relative', width:100, height:100, flexShrink:0 }}>
          <svg viewBox="0 0 100 100" width="100" height="100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="10"/>
            <circle cx="50" cy="50" r="42" fill="none" stroke={tier.color} strokeWidth="10"
              strokeDasharray={`${2*Math.PI*42 * total/100} ${2*Math.PI*42 * (1-total/100)}`}
              strokeDashoffset={2*Math.PI*42 * 0.25}
              strokeLinecap="round"
              style={{ transition:'stroke-dasharray .5s' }}/>
          </svg>
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:22, fontWeight:900, color:tier.color, lineHeight:1 }}>{total}</span>
            <span style={{ fontSize:10, color:'var(--text-hint)' }}>/{totalMax}</span>
          </div>
        </div>

        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <span style={{ fontSize:22 }}>{tier.icon}</span>
            <span style={{ fontSize:20, fontWeight:800, color:tier.color }}>{tier.label}</span>
          </div>
          <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:10 }}>
            Score baseado na filosofia de portfólios de Ivan Scherman (Emerge Funds · Campeão Mundial de Trading 2023)
          </div>
          {/* Mini barras por critério */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {criterios.map(c => (
              <div key={c.n} title={`${c.label}: ${c.score}/${c.max}`}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                <div style={{ width:32, height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${c.score/c.max*100}%`, background:scoreColor(c.score,c.max), borderRadius:2 }}/>
                </div>
                <span style={{ fontSize:9, color:'var(--text-hint)' }}>{c.score}/{c.max}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Critérios */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
        {criterios.map(c => (
          <div key={c.n} className="card" style={{ borderLeft:`3px solid ${scoreColor(c.score,c.max)}` }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <span style={{ fontSize:17 }}>{c.icon}</span>
                <span style={{ fontWeight:600, fontSize:13 }}>{c.label}</span>
              </div>
              <div style={{ display:'flex', alignItems:'baseline', gap:3 }}>
                <span style={{ fontSize:20, fontWeight:800, color:scoreColor(c.score,c.max), lineHeight:1 }}>{c.score}</span>
                <span style={{ fontSize:11, color:'var(--text-hint)' }}>/{c.max}</span>
              </div>
            </div>
            {/* Barra */}
            <div style={{ height:4, background:'var(--border)', borderRadius:2, overflow:'hidden', marginBottom:7 }}>
              <div style={{ height:'100%', width:`${c.score/c.max*100}%`, background:scoreColor(c.score,c.max), borderRadius:2, transition:'width .4s' }}/>
            </div>
            <div style={{ fontSize:12, color:'var(--text)' }}>{c.detail}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>{c.desc}</div>
            <div style={{ fontSize:10, color:'var(--text-hint)', marginTop:4, fontStyle:'italic' }}>{c.ref}</div>
          </div>
        ))}
      </div>

      {/* Recomendações */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>
          📋 Recomendações Scherman
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {recs.map((r, i) => (
            <div key={i} style={{ display:'flex', gap:10, padding:'10px 12px', background:'var(--bg)', borderRadius:8, border:'1px solid var(--border)' }}>
              <span style={{ fontSize:18, flexShrink:0 }}>{r.icon}</span>
              <div>
                <div style={{ fontWeight:600, fontSize:13, marginBottom:3 }}>{r.title}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.55 }}>{r.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela por robô */}
      <div className="card">
        <div style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>Por estratégia</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                {['Estratégia','Tipo','M.6015','FL','Risco %','Correlação média','Status Scherman'].map((h,i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selected.map((s, idx) => {
                const rd = robotData[s.robotId]
                const name = rd?.robot?.name || `Robô ${s.robotId}`
                const tipo = rd?.robot?.strategy_type || '—'
                const m6015row = m6015Data.find(m => m.name === name)
                const m6015v = m6015row?.m6015 ?? 0
                const pfv = m6015row?.pf ?? 0
                // Risk %
                const rPct = totalRisk > 0 ? riskValues[idx] / totalRisk * 100 : 0
                // Correlation with rest (avg of row in matrix, excluding self)
                let robotCorr = null
                if (hasCorr) {
                  const rid = String(s.robotId)
                  const ci = corrMatrix.ids.findIndex(id => String(id) === rid)
                  if (ci >= 0) {
                    const row = corrMatrix.matrix[ci]
                    const others = row.filter((_, j) => j !== ci)
                    robotCorr = others.length ? others.reduce((a,b)=>a+Math.abs(b),0)/others.length : 0
                  }
                }
                const status = m6015v >= 3 && rPct <= 30 && (robotCorr == null || robotCorr < 0.55)
                  ? { l:'✓ Aprovado', c:'var(--success)' }
                  : m6015v >= 1.5
                  ? { l:'⚠ Atenção', c:'var(--warning)' }
                  : { l:'✗ Revisar', c:'var(--danger)' }
                return (
                  <tr key={s.robotId}>
                    <td style={{ fontWeight:500 }}>{name}</td>
                    <td style={{ color:'var(--text-muted)', fontSize:11 }}>{tipo}</td>
                    <td className={m6015v>=3?'pos':m6015v>=1.5?'warn':'neg'}>{fmtNum(m6015v)}</td>
                    <td className={pfv>=1.3?'pos':'neg'}>{fmtNum(pfv)}</td>
                    <td className={rPct>35?'neg':rPct>20?'warn':'pos'}>{rPct.toFixed(1)}%</td>
                    <td style={{ color: robotCorr==null?'var(--text-hint)':robotCorr<0.4?'var(--success)':robotCorr<0.6?'var(--warning)':'var(--danger)' }}>
                      {robotCorr != null ? robotCorr.toFixed(2) : '—'}
                    </td>
                    <td style={{ fontWeight:600, color:status.c }}>{status.l}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop:8, fontSize:10, color:'var(--text-hint)', lineHeight:1.5 }}>
          Baseado em: Diversificação por Descorrelação de PNL · Risk Parity · Qualidade individual ·
          Filosofia Ivan Scherman (Emerge Funds — SciTech Investments) · Campeão Mundial de Futuros 2023
        </div>
      </div>
    </div>
  )
}
