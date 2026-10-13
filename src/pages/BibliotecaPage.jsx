import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcMetrics(robot) {
  const ops = robot.operations || []
  if (!ops.length) return { winRate: null, avgMonthly: null, createdAt: null }

  // Data de criação = primeira operação
  const dateKey = s => {
    if (!s) return 0
    const p = s.split(' ')[0].split('/')
    if (p.length < 3) return 0
    return +p[2] * 10000 + +p[1] * 100 + +p[0]
  }
  const sorted = [...ops].sort((a, b) => dateKey(a.abertura) - dateKey(b.abertura))
  const createdAt = sorted[0]?.abertura?.split(' ')[0] || null

  // Taxa de acerto
  const wins = ops.filter(o => (o.res_op || 0) > 0).length
  const winRate = ops.length ? Math.round((wins / ops.length) * 100) : null

  // Resultado médio mensal com 1 contrato
  const byMonth = {}
  for (const op of ops) {
    if (!op.abertura) continue
    const p = op.abertura.split(' ')[0].split('/')
    if (p.length < 3) continue
    const key = `${p[2]}-${p[1]}`
    if (!byMonth[key]) byMonth[key] = 0
    byMonth[key] += (op.res_op || 0)
  }
  const months = Object.values(byMonth)
  const avgMonthly = months.length
    ? Math.round(months.reduce((a, b) => a + b, 0) / months.length)
    : null

  return { winRate, avgMonthly, createdAt }
}

function formatDate(ddmmyyyy) {
  if (!ddmmyyyy) return '—'
  const p = ddmmyyyy.split('/')
  if (p.length < 3) return ddmmyyyy
  return `${p[2].slice(2)}/${p[1]}/${p[0]}`   // YY/MM/DD → e.g. 19/04/02
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function BibliotecaPage() {
  const { robots, loading } = useData()
  const [sort, setSort] = useState('name')
  const [search, setSearch] = useState('')

  // Filtra só TQL_xxx e aplica busca
  const tqlRobots = useMemo(() => {
    return robots
      .filter(r => r.name && r.name.toUpperCase().startsWith('TQL_'))
      .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
  }, [robots, search])

  // Calcula métricas e ordena
  const rows = useMemo(() => {
    const withMetrics = tqlRobots.map(r => ({ ...r, _m: calcMetrics(r) }))
    return withMetrics.sort((a, b) => {
      if (sort === 'name')       return a.name.localeCompare(b.name)
      if (sort === 'winRate')    return (b._m.winRate || 0) - (a._m.winRate || 0)
      if (sort === 'avgMonthly') return (b._m.avgMonthly || 0) - (a._m.avgMonthly || 0)
      if (sort === 'date')       return (a._m.createdAt || '').localeCompare(b._m.createdAt || '')
      return 0
    })
  }, [tqlRobots, sort])

  if (loading) return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: 80 }}>
      <p style={{ color: 'var(--text-secondary)' }}>Carregando biblioteca...</p>
    </div>
  )

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          📚 Biblioteca de Algoritmos
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
          {rows.length} estratégias desenvolvidas pelo Método 6015 — disponíveis para aquisição individual.
        </p>
      </div>

      {/* Controles */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12,
        marginBottom: 24, alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="Buscar estratégia..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--text-primary)',
            fontSize: 14, flex: '1 1 200px', minWidth: 160
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { key: 'name', label: 'Nome' },
            { key: 'winRate', label: 'Acerto' },
            { key: 'avgMonthly', label: 'Resultado' },
            { key: 'date', label: 'Data' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                border: '1px solid var(--border)',
                background: sort === s.key ? 'var(--accent)' : 'var(--surface)',
                color: sort === s.key ? '#fff' : 'var(--text-secondary)',
                fontWeight: sort === s.key ? 600 : 400,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 14
        }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Estratégia', 'Criação', 'Ativo', 'Timeframe', 'Acerto', 'Média Mensal (1 contrato)', ''].map((h, i) => (
                <th key={i} style={{
                  padding: '10px 14px', textAlign: i >= 4 ? 'center' : 'left',
                  color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13,
                  whiteSpace: 'nowrap'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                  Nenhuma estratégia encontrada.
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const { winRate, avgMonthly, createdAt } = r._m
              return (
                <tr key={r.id} style={{
                  borderBottom: '1px solid var(--border)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                  transition: 'background 0.15s'
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'}
                >
                  {/* Nome */}
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {r.name}
                  </td>
                  {/* Data criação */}
                  <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatDate(createdAt)}
                  </td>
                  {/* Ativo */}
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                      background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                      fontSize: 12, fontWeight: 600
                    }}>
                      {r.ativo || '—'}
                    </span>
                  </td>
                  {/* Timeframe */}
                  <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    {r.timeframe || '—'}
                  </td>
                  {/* Taxa de acerto */}
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    {winRate !== null ? (
                      <span style={{
                        fontWeight: 700,
                        color: winRate >= 60 ? '#22c55e' : winRate >= 50 ? '#f59e0b' : '#ef4444'
                      }}>
                        {winRate}%
                      </span>
                    ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                  </td>
                  {/* Resultado médio mensal */}
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    {avgMonthly !== null ? (
                      <span style={{
                        fontWeight: 700,
                        color: avgMonthly >= 0 ? '#22c55e' : '#ef4444'
                      }}>
                        {avgMonthly >= 0 ? '+' : ''}
                        {avgMonthly.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                  </td>
                  {/* Botão */}
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <Link
                      to={`/robots/${r.id}`}
                      style={{
                        display: 'inline-block', padding: '6px 16px', borderRadius: 8,
                        background: 'var(--accent)', color: '#fff',
                        fontSize: 13, fontWeight: 600, textDecoration: 'none',
                        whiteSpace: 'nowrap',
                        transition: 'opacity 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      VER +
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Rodapé informativo */}
      <div style={{
        marginTop: 40, padding: 20, borderRadius: 12,
        background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)'
      }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0, textAlign: 'center' }}>
          📊 Resultados baseados em backtest histórico. Resultados passados não garantem resultados futuros.
          A média mensal é calculada com 1 contrato — resultados escalam proporcionalmente à quantidade de contratos.
        </p>
      </div>
    </div>
  )
}
