import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext.jsx'
import { buildAdjOps, calcMetrics, fmtR, fmtNum, getValidationStatus } from '../lib/analytics.js'
import PlatformBadge from '../components/PlatformBadge.jsx'

export default function RobotsPage() {
  const navigate = useNavigate()
  const { robots, loading } = useData()
  const [metrics, setMetrics] = useState({})
  const [filterAtivo, setFilterAtivo] = useState('all')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [sortBy, setSortBy] = useState('m6015')

  useEffect(() => {
    if (!robots.length) return
    const m = {}
    for (const r of robots) {
      if (r.operations?.length) {
        const adj = buildAdjOps(r.operations, r.desagio || 0, r.tipo || 'backtest')
        const calc = calcMetrics(adj)
        // Avg monthly
        const monthly = {}
        adj.forEach(o => {
          const pts = o.abertura.split(' ')[0].split('/')
          const key = `${pts[2]}-${pts[1]}`
          monthly[key] = (monthly[key] || 0) + o.resAdj
        })
        const vals = Object.values(monthly)
        calc.avgMonthly = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0

        // Avg monthly real
        if (r.realOps?.length) {
          const rm = {}
          r.realOps.forEach(o => {
            const pts = (o.abertura || '').split(' ')[0].split('/')
            if (pts.length === 3) {
              const key = `${pts[2]}-${pts[1]}`
              rm[key] = (rm[key] || 0) + (o.res_op || 0)
            }
          })
          const rv = Object.values(rm)
          calc.avgMonthlyReal = rv.length ? rv.reduce((a, b) => a + b, 0) / rv.length : null
          calc.nMonthsReal = rv.length
        }
        calc.status = getValidationStatus(calc, r.periods || {})
        m[r.id] = calc
      }
    }
    setMetrics(m)
  }, [robots])

  const ativoOptions = [...new Set(robots.map(r => r.ativo).filter(Boolean))].sort()
  const typeOptions = [...new Set(robots.map(r => r.strategy_type).filter(Boolean))].sort()

  const filtered = [...robots]
    .filter(r => {
      if (filterAtivo !== 'all' && r.ativo !== filterAtivo) return false
      if (filterPlatform !== 'all' && (r.platform || 'profit') !== filterPlatform) return false
      if (filterType !== 'all' && r.strategy_type !== filterType) return false
      return true
    })
    .sort((a, b) => {
      const ma = metrics[a.id] || {}
      const mb = metrics[b.id] || {}
      if (sortBy === 'm6015') return (mb.m6015 || 0) - (ma.m6015 || 0)
      if (sortBy === 'winRate') return (mb.winRate || 0) - (ma.winRate || 0)
      if (sortBy === 'pf') return (mb.profitFactor || 0) - (ma.profitFactor || 0)
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      return 0
    })

  if (loading) {
    return (
      <div className="main-content" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Carregando estratégias...</div>
      </div>
    )
  }

  return (
    <div className="main-content">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Estratégias</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {filtered.length} estratégia{filtered.length !== 1 ? 's' : ''} · Clique para ver análise completa
        </p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterAtivo} onChange={e => setFilterAtivo(e.target.value)}
          style={{ fontSize: 12, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
          <option value="all">Todos os ativos</option>
          {ativoOptions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
          style={{ fontSize: 12, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
          <option value="all">Todas as plataformas</option>
          <option value="profit">Profit</option>
          <option value="mt5">MetaTrader 5</option>
        </select>
        {typeOptions.length > 0 && (
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ fontSize: 12, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
            <option value="all">Todos os tipos</option>
            {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ordenar por:</span>
          {[
            { key: 'm6015', label: 'M.6015' },
            { key: 'winRate', label: 'Win Rate' },
            { key: 'pf', label: 'Profit Factor' },
            { key: 'name', label: 'Nome' },
          ].map(opt => (
            <button key={opt.key} onClick={() => setSortBy(opt.key)}
              style={{
                padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                background: sortBy === opt.key ? 'var(--accent)' : 'transparent',
                color: sortBy === opt.key ? '#fff' : 'var(--text-muted)',
                fontWeight: sortBy === opt.key ? 700 : 400,
                transition: 'all .15s'
              }}>{opt.label}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {filtered.map(r => {
          const m = metrics[r.id]
          return (
            <div key={r.id} className="card"
              style={{ cursor: 'pointer', transition: 'border-color .15s, transform .15s' }}
              onClick={() => navigate(`/robots/${r.id}`)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <PlatformBadge platform={r.platform} size={15} />
                {r.strategy_type && <span className="badge purple" style={{ fontSize: 10 }}>{r.strategy_type}</span>}
                {r.realOps?.length > 0 && <span className="badge green" style={{ fontSize: 10 }}>Real</span>}
                <span style={{ fontSize: 11, color: 'var(--text-hint)', marginLeft: 'auto' }}>{r.ativo}</span>
              </div>

              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: m ? 10 : 6 }}>{r.name}</div>

              {m ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                    {[
                      { label: 'M.6015', value: fmtNum(m.m6015 || 0), color: (m.m6015 || 0) > 3 ? 'var(--success)' : (m.m6015 || 0) > 1 ? 'var(--warning)' : 'var(--danger)' },
                      { label: 'Win Rate', value: (m.winRate || 0).toFixed(0) + '%', color: (m.winRate || 0) >= 55 ? 'var(--success)' : 'var(--warning)' },
                      { label: 'Méd. mensal BT', value: fmtR(m.avgMonthly || 0), color: (m.avgMonthly || 0) >= 0 ? 'var(--success)' : 'var(--danger)' },
                      m.avgMonthlyReal != null
                        ? { label: `Méd. real (${m.nMonthsReal}m)`, value: fmtR(m.avgMonthlyReal), color: m.avgMonthlyReal >= 0 ? 'var(--success)' : 'var(--danger)' }
                        : { label: 'Conta real', value: '—', color: 'var(--text-muted)' },
                    ].map((s, i) => (
                      <div key={i} style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '6px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{s.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  {r.operations?.length || 0} operações
                </div>
              )}

              <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                Ver análise completa →
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          Nenhuma estratégia encontrada com esses filtros.
        </div>
      )}
    </div>
  )
}
