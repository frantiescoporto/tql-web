import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext.jsx'
import { buildAdjOps, calcMetrics, fmtR, fmtNum } from '../lib/analytics.js'
import { buildPortfolioTimeline, calcPortfolioMetrics } from '../lib/portfolio.js'

export default function PortfoliosPage() {
  const navigate = useNavigate()
  const { robots, portfolios, loading } = useData()
  const [portfolioMetrics, setPortfolioMetrics] = useState({})

  useEffect(() => {
    if (!robots.length || !portfolios.length) return
    const pm = {}
    for (const p of portfolios) {
      try {
        const cfg = typeof p.robots_config === 'string' ? JSON.parse(p.robots_config) : (p.robots_config || {})
        const list = Array.isArray(cfg) ? cfg : (cfg.robots || [])
        const multiplier = cfg.multiplier || 1
        const entries = list.map(({ robotId, lots }) => {
          const r = robots.find(rb => rb.id === robotId)
          if (!r || !r.operations?.length) return null
          const adj = buildAdjOps(r.operations, r.desagio || 0, r.tipo || 'backtest')
          return { robot: r, lots, adjOps: adj }
        }).filter(Boolean)
        if (entries.length) {
          const timeline = buildPortfolioTimeline(entries)
          const m = calcPortfolioMetrics(timeline, multiplier)
          pm[p.id] = { ...m, nRobots: entries.length }
        }
      } catch (e) {}
    }
    setPortfolioMetrics(pm)
  }, [robots, portfolios])

  if (loading) {
    return (
      <div className="main-content" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando portfólios...</div>
      </div>
    )
  }

  return (
    <div className="main-content">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Portfólios</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Combinações de estratégias descorrelacionadas para maximizar consistência
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {portfolios.map(p => {
          const m = portfolioMetrics[p.id]
          let robotNames = []
          try {
            const cfg = typeof p.robots_config === 'string' ? JSON.parse(p.robots_config) : {}
            const list = Array.isArray(cfg) ? cfg : (cfg.robots || [])
            robotNames = list.map(({ robotId, lots }) => {
              const r = robots.find(rb => rb.id === robotId)
              return r ? `${r.name} (${lots}L)` : `#${robotId}`
            })
          } catch (e) {}

          return (
            <div key={p.id} className="card"
              style={{ cursor: 'pointer', transition: 'border-color .15s, transform .15s' }}
              onClick={() => navigate(`/portfolios/${p.id}`)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>{p.name}</div>

              {/* Robôs do portfólio */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
                {robotNames.map((n, i) => (
                  <span key={i} style={{
                    fontSize: 11, padding: '2px 8px',
                    background: 'var(--accent-bg)', border: '1px solid var(--accent)',
                    borderRadius: 99, color: 'var(--accent)'
                  }}>{n}</span>
                ))}
              </div>

              {m ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { label: 'Total', value: fmtR(m.totalBruto || 0), color: (m.totalBruto || 0) >= 0 ? 'var(--success)' : 'var(--danger)' },
                    { label: 'Win Rate', value: (m.winRate || 0).toFixed(0) + '%', color: (m.winRate || 0) >= 55 ? 'var(--success)' : 'var(--warning)' },
                    { label: 'Profit Factor', value: fmtNum(Math.min(m.profitFactor || 0, 99)), color: (m.profitFactor || 0) >= 1.5 ? 'var(--success)' : 'var(--warning)' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{m === undefined ? 'Calculando...' : 'Sem dados'}</div>
              )}

              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                Ver análise completa →
              </div>
            </div>
          )
        })}
      </div>

      {portfolios.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          Nenhum portfólio disponível.
        </div>
      )}
    </div>
  )
}
