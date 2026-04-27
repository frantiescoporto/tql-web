import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext.jsx'
import { buildAdjOps, calcMetrics, fmtR, fmtNum } from '../lib/analytics.js'
import PlatformBadge from '../components/PlatformBadge.jsx'

export default function LandingPage() {
  const navigate = useNavigate()
  const { robots, portfolios, loading } = useData()
  const [metrics, setMetrics] = useState({})

  useEffect(() => {
    if (!robots.length) return
    const m = {}
    for (const r of robots) {
      if (r.operations?.length) {
        const adj = buildAdjOps(r.operations, r.desagio || 0, r.tipo || 'backtest')
        m[r.id] = calcMetrics(adj)
      }
    }
    setMetrics(m)
  }, [robots])

  const top3 = robots
    .filter(r => metrics[r.id])
    .map(r => ({ ...r, m: metrics[r.id] }))
    .sort((a, b) => (b.m.m6015 || 0) - (a.m.m6015 || 0))
    .slice(0, 3)

  const totalOps = robots.reduce((acc, r) => acc + (r.operations?.length || 0), 0)
  const avgWinRate = Object.values(metrics).length
    ? Object.values(metrics).reduce((a, m) => a + (m.winRate || 0), 0) / Object.values(metrics).length
    : 0

  return (
    <div>
      {/* ── Hero ── */}
      <section className="hero">
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--accent-bg)', border: '1px solid var(--accent)',
          borderRadius: 99, padding: '4px 14px', fontSize: 12,
          color: 'var(--accent)', fontWeight: 600, marginBottom: 20
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          Resultados em tempo real · Método 6015
        </div>

        <h1 className="hero-title">
          Robôs de trading algorítmico<br />
          <span style={{ color: 'var(--accent)' }}>validados por dados reais</span>
        </h1>

        <p className="hero-subtitle">
          Transparência total: veja as métricas completas de cada estratégia — backtest,
          out-of-sample e conta real — antes de decidir. Sem promessas, só evidência.
        </p>

        <div className="hero-cta-group">
          <button className="btn primary" style={{ fontSize: 15, padding: '10px 24px' }}
            onClick={() => navigate('/robots')}>
            Ver estratégias →
          </button>
          <button className="btn" style={{ fontSize: 15, padding: '10px 24px' }}
            onClick={() => navigate('/sobre')}>
            Sobre o Método 6015
          </button>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      {!loading && (
        <section className="stats-bar">
          {[
            { value: robots.length, label: 'Estratégias' },
            { value: portfolios.length, label: 'Portfólios' },
            { value: totalOps.toLocaleString('pt-BR'), label: 'Operações analisadas' },
            { value: avgWinRate.toFixed(0) + '%', label: 'Win rate médio' },
          ].map((s, i) => (
            <div className="stat-item" key={i}>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </section>
      )}

      {/* ── Top estratégias ── */}
      <div className="main-content">
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
            🏆 Top estratégias por M.6015
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Score proprietário que pondera retorno, consistência, drawdown e robustez.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 48 }}>
          {top3.map((r, i) => {
            const medal = ['🥇', '🥈', '🥉'][i]
            const m = r.m
            return (
              <div key={r.id} className="card"
                style={{ cursor: 'pointer', transition: 'border-color .15s, transform .15s' }}
                onClick={() => navigate(`/robots/${r.id}`)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 22 }}>{medal}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 6, marginTop: 2 }}>
                      <PlatformBadge platform={r.platform} size={13} />
                      <span>{r.ativo}</span>
                      {r.strategy_type && <span className="badge purple" style={{ fontSize: 10 }}>{r.strategy_type}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>
                      {fmtNum(m.m6015 || 0)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>M.6015</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { label: 'Win Rate', value: (m.winRate || 0).toFixed(0) + '%', color: 'var(--success)' },
                    { label: 'Payoff', value: fmtNum(m.payoff || 0), color: 'var(--accent)' },
                    { label: 'Profit Factor', value: fmtNum(m.profitFactor || 0), color: 'var(--warning)' },
                  ].map((s, j) => (
                    <div key={j} style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                  Ver análise completa →
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Destaques do método ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 48 }}>
          {[
            { icon: '🔬', title: 'Validação científica', desc: 'Cada robô passa por análise In Sample, Out of Sample e Paper Trading antes de operar dinheiro real.' },
            { icon: '📊', title: 'Score M.6015', desc: 'Pontuação proprietária que avalia retorno, consistência, drawdown e risco de overfitting em uma única métrica.' },
            { icon: '💼', title: 'Portfólios descorrelacionados', desc: 'Estratégias combinadas para maximizar retorno e minimizar drawdown conjunto — matemática aplicada.' },
            { icon: '🔴', title: 'Conta real pública', desc: 'Resultados de conta real disponíveis para comparação direta com o backtest. Transparência total.' },
          ].map((item, i) => (
            <div key={i} className="card">
              <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>

        {/* ── CTA ── */}
        <div className="cta-banner">
          <h2>Pronto para automatizar seu trading?</h2>
          <p>Conheça a metodologia completa e veja como os portfólios são montados para gerar consistência mês a mês.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn primary" style={{ fontSize: 14, padding: '10px 24px' }}
              onClick={() => navigate('/robots')}>
              Explorar estratégias
            </button>
            <button className="btn" style={{ fontSize: 14, padding: '10px 24px' }}
              onClick={() => navigate('/portfolios')}>
              Ver portfólios
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
