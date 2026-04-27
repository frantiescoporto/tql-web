import React, { useState, useEffect } from 'react'
import { fmtR, fmtPct, fmtNum } from '../lib/analytics'

// Rule-based analysis engine (no API needed - pure logic)
function analyzePortfolio({ metrics, extMetrics, exposureData, rankingData, corrMatrix, selected, robotData }) {
  const recs = []

  // ── 1. Overall health ────────────────────────────────────────────────────
  const m6015 = metrics.m6015 || 0
  const sharpe = metrics.sharpe || 0
  const pctPos = extMetrics.pctPosMonths || 0
  const ddPct = metrics.ddMaxPct || 0
  const winRate = metrics.winRate || 0
  const rentPct = metrics.rentPct || 0
  const nRobots = selected.length

  if (m6015 > 4 && sharpe > 1.5) {
    recs.push({ type: 'success', icon: '✓', title: 'Portfólio robusto', body: `M.6015 de ${fmtNum(m6015)} e Sharpe de ${fmtNum(sharpe)} indicam uma estratégia com boa relação risco/retorno e consistência acima da média.` })
  } else if (m6015 < 2) {
    recs.push({ type: 'danger', icon: '⚠', title: 'M.6015 abaixo do ideal', body: `O índice M.6015 de ${fmtNum(m6015)} está abaixo de 3. Considere substituir estratégias de baixo desempenho ou aumentar o peso das estratégias com maior fator de recuperação.` })
  }

  // ── 2. Diversification ───────────────────────────────────────────────────
  const types = exposureData?.byType || []
  const dominantType = types[0]
  if (dominantType && dominantType.pct > 70) {
    recs.push({ type: 'warning', icon: '↗', title: `Concentração em ${dominantType.label}`, body: `${fmtNum(dominantType.pct, 1)}% do portfólio está exposto a estratégias do tipo ${dominantType.label}. Considere adicionar estratégias de tipos diferentes para reduzir a correlação sistêmica.` })
  } else if (types.length >= 3) {
    recs.push({ type: 'success', icon: '✓', title: 'Boa diversificação por tipo', body: `O portfólio possui ${types.length} tipos de estratégias distintos, o que reduz a concentração de risco em um único estilo operacional.` })
  }

  // ── 3. Correlation ───────────────────────────────────────────────────────
  if (corrMatrix && corrMatrix.matrix.length >= 2) {
    const pairs = []
    for (let i = 0; i < corrMatrix.matrix.length; i++) {
      for (let j = i+1; j < corrMatrix.matrix.length; j++) {
        pairs.push({ a: corrMatrix.names[i], b: corrMatrix.names[j], v: corrMatrix.matrix[i][j] })
      }
    }
    const highCorr = pairs.filter(p => p.v > 0.7)
    const negCorr = pairs.filter(p => p.v < -0.3)

    if (highCorr.length > 0) {
      const worst = highCorr.sort((a,b) => b.v - a.v)[0]
      recs.push({ type: 'warning', icon: '⚡', title: 'Alta correlação detectada', body: `${worst.a} e ${worst.b} têm correlação de ${fmtNum(worst.v, 2)}, acima de 0,70. Em dias adversos, ambas tendem a perder juntas — avalie reduzir o peso de uma delas ou substituir por uma estratégia menos correlacionada.` })
    }
    if (negCorr.length > 0) {
      recs.push({ type: 'success', icon: '✓', title: 'Pares negativamente correlacionados', body: `${negCorr.length} par(es) de estratégias apresentam correlação negativa, o que melhora a estabilidade do portfólio em períodos de stress de mercado.` })
    }
  }

  // ── 4. Drawdown ──────────────────────────────────────────────────────────
  if (ddPct > 40) {
    recs.push({ type: 'danger', icon: '↓', title: 'Drawdown máximo elevado', body: `O drawdown máximo de ${fmtNum(ddPct, 1)}% do capital sugere que o portfólio pode exigir resiliência emocional significativa. Considere aumentar o multiplicador de capital ou reduzir a alavancagem total.` })
  } else if (ddPct < 20) {
    recs.push({ type: 'success', icon: '✓', title: 'Drawdown controlado', body: `Drawdown máximo de ${fmtNum(ddPct, 1)}% sobre o capital é considerado saudável para uma carteira de robôs. O gerenciamento de risco está bem dimensionado.` })
  }

  // ── 5. Win rate & payoff ─────────────────────────────────────────────────
  if (winRate < 40 && (metrics.payoff || 0) < 2) {
    recs.push({ type: 'warning', icon: '⚠', title: 'Baixa taxa de acerto e payoff', body: `Com ${fmtNum(winRate, 1)}% de acerto e payoff de ${fmtNum(metrics.payoff || 0)}, o portfólio precisa de consistência para compensar as perdas. Verifique se as estratégias perdedoras têm stops ajustados.` })
  }

  // ── 6. Number of robots ──────────────────────────────────────────────────
  if (nRobots === 1) {
    recs.push({ type: 'warning', icon: '!', title: 'Portfólio com apenas 1 estratégia', body: 'Um único robô concentra todo o risco operacional. Adicione ao menos 2–3 estratégias com baixa correlação para diversificar os períodos de drawdown.' })
  } else if (nRobots >= 5) {
    recs.push({ type: 'info', icon: 'i', title: `${nRobots} estratégias no portfólio`, body: 'Portfólios com muitas estratégias podem diluir o alpha. Verifique se cada robô tem M.6015 > 3 e se a correlação entre os pares mais novos não está acima de 0,70.' })
  }

  // ── 7. Weak robots ───────────────────────────────────────────────────────
  const weakRobots = rankingData.filter(r => r.score < 2)
  if (weakRobots.length > 0) {
    recs.push({ type: 'warning', icon: '↓', title: `${weakRobots.length} estratégia(s) com score fraco`, body: `${weakRobots.map(r => r.name).join(', ')} ${weakRobots.length === 1 ? 'tem' : 'têm'} score abaixo de 2. Considere substituí-las por estratégias com melhor relação risco/retorno ou revisar os parâmetros.` })
  }

  // ── 8. Monthly consistency ───────────────────────────────────────────────
  if (pctPos >= 75) {
    recs.push({ type: 'success', icon: '✓', title: 'Alta consistência mensal', body: `${fmtNum(pctPos, 1)}% dos meses são positivos — uma consistência excelente que indica estratégias resilientes a diferentes condições de mercado.` })
  } else if (pctPos < 55) {
    recs.push({ type: 'warning', icon: '⚠', title: 'Consistência mensal baixa', body: `Apenas ${fmtNum(pctPos, 1)}% dos meses são positivos. Avalie se há padrões sazonais afetando o desempenho e considere estratégias que performem bem em diferentes regimes de mercado.` })
  }

  // ── 9. Stagnation ────────────────────────────────────────────────────────
  if ((extMetrics.stagWorstDays || 0) > 180) {
    recs.push({ type: 'warning', icon: '⏸', title: 'Longo período de estagnação', body: `O portfólio ficou ${extMetrics.stagWorstDays} dias sem atingir nova máxima no pior período. Estratégias de reversão ou com sazonalidade diferente podem ajudar a encurtar esses períodos.` })
  }

  return recs
}

export default function AIRecommendations({ metrics, extMetrics, exposureData, rankingData, corrMatrix, selected, robotData }) {
  const [recs, setRecs] = useState([])

  useEffect(() => {
    if (!metrics || !Object.keys(metrics).length) return
    const result = analyzePortfolio({ metrics, extMetrics, exposureData, rankingData, corrMatrix, selected, robotData })
    setRecs(result)
  }, [metrics, extMetrics, corrMatrix])

  if (!selected.length) {
    return <div className="empty-state"><p>Adicione robôs na aba Composição para ver as recomendações.</p></div>
  }

  const typeColors = {
    success: { bg: 'var(--success-bg)', border: 'var(--success)', icon: '#16a34a' },
    warning: { bg: 'var(--warning-bg)', border: 'var(--warning)', icon: '#d97706' },
    danger:  { bg: 'var(--danger-bg)',  border: 'var(--danger)',  icon: '#dc2626' },
    info:    { bg: 'var(--accent-bg)',  border: 'var(--accent)',  icon: '#2563eb' },
  }

  const positives = recs.filter(r => r.type === 'success')
  const warnings  = recs.filter(r => r.type === 'warning' || r.type === 'danger')
  const infos     = recs.filter(r => r.type === 'info')

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ background: 'var(--accent-bg)', borderRadius: 'var(--radius)', padding: '6px 12px', fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>
          Análise baseada em regras quantitativas
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{recs.length} observações</span>
      </div>

      {warnings.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Pontos de atenção</div>
          {warnings.map((r, i) => {
            const colors = typeColors[r.type]
            return (
              <div key={i} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 10, display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 18, color: colors.icon, flexShrink: 0, marginTop: 1 }}>{r.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{r.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{r.body}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {positives.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Pontos positivos</div>
          {positives.map((r, i) => {
            const colors = typeColors[r.type]
            return (
              <div key={i} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 10, display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 18, color: colors.icon, flexShrink: 0, marginTop: 1 }}>{r.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{r.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{r.body}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {infos.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {infos.map((r, i) => {
            const colors = typeColors[r.type]
            return (
              <div key={i} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 10, display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 18, color: colors.icon, flexShrink: 0, marginTop: 1 }}>{r.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{r.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{r.body}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, fontSize: 12, color: 'var(--text-hint)', lineHeight: 1.6 }}>
        As recomendações são geradas automaticamente com base nas métricas do portfólio atual. Futuramente este módulo será expandido com uma base de conhecimento personalizada com critérios e regras definidos por você.
      </div>
    </div>
  )
}
