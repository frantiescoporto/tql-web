import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext.jsx'
import { buildAdjOps, calcMetrics, fmtR, fmtNum } from '../lib/analytics.js'

export default function LandingPage() {
  const navigate = useNavigate()
  const { robots, portfolios, loading } = useData()
  const [metrics, setMetrics] = useState({})
  const [wordIndex, setWordIndex] = useState(0)

  const rotatingWords = ['achismo.', 'intuição.', 'sorte.', 'promessas.']

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex(i => (i + 1) % rotatingWords.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

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
  const robotsComReal = robots.filter(r => r.realOps?.length > 0).length
  const avgWinRate = Object.values(metrics).length
    ? (Object.values(metrics).reduce((a, m) => a + (m.winRate || 0), 0) / Object.values(metrics).length).toFixed(0)
    : 0

  const s = { // inline styles base
    accent: '#00d4aa',
    dark: '#080c12',
    surface: '#0f1520',
    card: '#131b28',
    border: 'rgba(255,255,255,0.07)',
    text: '#e8edf5',
    muted: '#6b7a99',
    hint: '#3a4560',
  }

  return (
    <div style={{ background: s.dark, color: s.text, minHeight: '100vh' }}>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 32px 80px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
          borderLeft: `3px solid ${s.accent}`, paddingLeft: 12,
          fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
          color: s.accent, fontWeight: 600, marginBottom: 32 }}>
          Para traders algorítmicos brasileiros
        </div>

        <h1 style={{ fontSize: 'clamp(40px, 6vw, 80px)', fontWeight: 900, lineHeight: 1.05,
          letterSpacing: '-0.03em', marginBottom: 32, maxWidth: 800 }}>
          Pare de operar no{' '}
          <span style={{ color: s.muted, textDecoration: 'line-through',
            textDecorationColor: 'rgba(255,100,100,0.5)' }}>
            {rotatingWords[wordIndex]}
          </span>
          <br />
          <span style={{ color: s.accent }}>Opere com evidência.</span>
        </h1>

        <p style={{ fontSize: 'clamp(15px, 1.5vw, 19px)', color: s.muted,
          lineHeight: 1.7, maxWidth: 520, marginBottom: 44 }}>
          99 estratégias algorítmicas validadas com backtest, out-of-sample e conta real.
          Cada número vem de dados reais — não de promessas.
        </p>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/robots')}
            style={{ background: s.accent, color: '#000', border: 'none',
              padding: '14px 28px', borderRadius: 8, fontSize: 15, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              transition: 'opacity .15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            Ver as estratégias →
          </button>
          <button onClick={() => navigate('/sobre')}
            style={{ background: 'transparent', color: s.text,
              border: `1px solid ${s.border}`, padding: '14px 28px',
              borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: 'pointer',
              transition: 'border-color .15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = s.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = s.border}>
            O que é o Método 6015
          </button>
        </div>

        {/* Stats bar */}
        {!loading && (
          <div style={{ display: 'flex', gap: 48, marginTop: 64,
            paddingTop: 48, borderTop: `1px solid ${s.border}`, flexWrap: 'wrap' }}>
            {[
              { value: robots.length, label: 'Estratégias validadas' },
              { value: totalOps.toLocaleString('pt-BR'), label: 'Operações analisadas' },
              { value: robotsComReal, label: 'Com dados de conta real' },
              { value: avgWinRate + '%', label: 'Win rate médio' },
            ].map((st, i) => (
              <div key={i}>
                <div style={{ fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 800,
                  color: s.accent, lineHeight: 1, marginBottom: 6 }}>{st.value}</div>
                <div style={{ fontSize: 12, color: s.muted, textTransform: 'uppercase',
                  letterSpacing: '.07em' }}>{st.label}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── O PROBLEMA ───────────────────────────────────────────────── */}
      <section style={{ background: s.surface, borderTop: `1px solid ${s.border}`,
        borderBottom: `1px solid ${s.border}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 32px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
              borderLeft: `3px solid ${s.accent}`, paddingLeft: 12,
              fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
              color: s.accent, fontWeight: 600, marginBottom: 24 }}>
              O problema
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 48px)', fontWeight: 800,
              lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 24 }}>
              A maioria dos robôs falha porque nunca foi realmente testada.
            </h2>
            <p style={{ fontSize: 15, color: s.muted, lineHeight: 1.7, marginBottom: 32 }}>
              Backtest bonito não é evidência. É otimização. O Método 6015 existe para separar
              o que funciona de verdade do que apenas funcionou nos dados de treino.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { pct: '90%', text: 'dos robôs de trading reprovam em out-of-sample', color: '#f06060' },
                { pct: '0', text: 'relatórios honestos enviados pelo seu broker sobre seu robô', color: '#f5a623' },
                { pct: '1', text: 'metodologia que exige backtest + OOS + paper + conta real', color: s.accent },
              ].map((item, i) => (
                <div key={i} style={{ background: s.card, border: `1px solid ${s.border}`,
                  borderRadius: 10, padding: '20px 24px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: item.color,
                    lineHeight: 1, minWidth: 60 }}>{item.pct}</div>
                  <div style={{ fontSize: 14, color: s.muted, lineHeight: 1.5,
                    paddingTop: 4 }}>{item.text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Painel de métricas exemplo */}
          <div style={{ background: s.card, border: `1px solid ${s.accent}33`,
            borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${s.border}`,
              fontSize: 12, color: s.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.accent,
                boxShadow: `0 0 8px ${s.accent}` }} />
              Trade Quant Lab — análise real
            </div>
            <div style={{ padding: '24px 20px' }}>
              {top3.slice(0, 1).map(r => (
                <div key={r.id}>
                  <div style={{ fontSize: 11, color: s.muted, marginBottom: 16,
                    textTransform: 'uppercase', letterSpacing: '.07em' }}>
                    Estratégia em destaque
                  </div>
                  {[
                    { label: 'Score M.6015', value: fmtNum(r.m.m6015 || 0), color: s.accent },
                    { label: 'Win Rate', value: (r.m.winRate || 0).toFixed(1) + '%', color: '#4f8ef7' },
                    { label: 'Profit Factor', value: fmtNum(Math.min(r.m.profitFactor || 0, 99)), color: s.accent },
                    { label: 'Payoff médio', value: fmtNum(r.m.payoff || 0), color: '#9b7cf4' },
                    { label: 'Ops analisadas', value: (r.operations?.length || 0).toLocaleString('pt-BR'), color: s.text },
                  ].map((row, j) => (
                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', padding: '10px 0',
                      borderBottom: j < 4 ? `1px solid ${s.border}` : 'none' }}>
                      <span style={{ fontSize: 13, color: s.muted }}>{row.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 16, padding: '12px 16px',
                    background: `${s.accent}11`, border: `1px solid ${s.accent}33`,
                    borderRadius: 8, fontSize: 12, color: s.accent, lineHeight: 1.5 }}>
                    ✓ Aprovada — backtest + out-of-sample + paper trading + conta real
                  </div>
                </div>
              ))}
              {top3.length === 0 && (
                <div style={{ color: s.muted, fontSize: 13 }}>Carregando dados...</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── O PROCESSO ───────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 32px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
          borderLeft: `3px solid ${s.accent}`, paddingLeft: 12,
          fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
          color: s.accent, fontWeight: 600, marginBottom: 24 }}>
          Processo
        </div>
        <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 48px)', fontWeight: 800,
          lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 48 }}>
          Seis etapas.<br />Uma estratégia aprovada.
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {[
            { n: '01', title: 'Desenvolvimento', desc: 'Lógica de mercado primeiro. Zero otimização cega de parâmetros.' },
            { n: '02', title: 'In Sample', desc: 'Backtest no período de treinamento. Avaliação de consistência estatística.' },
            { n: '03', title: 'Out of Sample', desc: 'Teste em período nunca visto. p-valor, distribuição e robustez.' },
            { n: '04', title: 'Paper Trading', desc: 'Meses em simulador ao vivo. Comparação direta com o backtest.' },
            { n: '05', title: 'Conta Real', desc: 'Só após as 4 etapas anteriores. Com dados públicos para comparação.' },
            { n: '06', title: 'Portfólio', desc: 'Combinação descorrelacionada. Curva de capital mais suave e consistente.' },
          ].map((step, i) => (
            <div key={i} style={{ background: s.card, border: `1px solid ${s.border}`,
              borderRadius: 12, padding: '28px 24px',
              transition: 'border-color .2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = s.accent + '44'}
              onMouseLeave={e => e.currentTarget.style.borderColor = s.border}>
              <div style={{ fontSize: 36, fontWeight: 900, color: s.hint,
                lineHeight: 1, marginBottom: 16 }}>{step.n}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8,
                color: s.text }}>{step.title}</div>
              <div style={{ fontSize: 13, color: s.muted, lineHeight: 1.6 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TOP ESTRATÉGIAS ──────────────────────────────────────────── */}
      <section style={{ background: s.surface, borderTop: `1px solid ${s.border}`,
        borderBottom: `1px solid ${s.border}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
            borderLeft: `3px solid ${s.accent}`, paddingLeft: 12,
            fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
            color: s.accent, fontWeight: 600, marginBottom: 24 }}>
            Destaque
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 48px)', fontWeight: 800,
            lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 48 }}>
            Top estratégias<br />por M.6015.
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {top3.map((r, i) => (
              <div key={r.id}
                onClick={() => navigate(`/robots/${r.id}`)}
                style={{ background: s.card, border: `1px solid ${i === 0 ? s.accent + '44' : s.border}`,
                  borderRadius: 12, padding: '28px 24px', cursor: 'pointer',
                  transition: 'border-color .2s, transform .2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = s.accent + '88'; e.currentTarget.style.transform = 'translateY(-3px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = i === 0 ? s.accent + '44' : s.border; e.currentTarget.style.transform = 'translateY(0)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: s.muted, textTransform: 'uppercase',
                      letterSpacing: '.07em', marginBottom: 6 }}>
                      {['🥇 1º lugar', '🥈 2º lugar', '🥉 3º lugar'][i]}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: s.muted, marginTop: 4 }}>
                      {r.ativo} · {r.strategy_type || '—'} · {r.platform?.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: s.accent,
                      lineHeight: 1 }}>{fmtNum(r.m.m6015 || 0)}</div>
                    <div style={{ fontSize: 10, color: s.muted, marginTop: 2 }}>M.6015</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {[
                    { l: 'Win Rate', v: (r.m.winRate||0).toFixed(0)+'%' },
                    { l: 'Payoff', v: fmtNum(r.m.payoff||0) },
                    { l: 'P. Factor', v: fmtNum(Math.min(r.m.profitFactor||0,99)) },
                  ].map((s2, j) => (
                    <div key={j} style={{ background: s.surface, borderRadius: 8,
                      padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: s.muted, marginBottom: 3 }}>{s2.l}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: s.text }}>{s2.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, fontSize: 13, color: s.accent, fontWeight: 600 }}>
                  Ver análise completa →
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <button onClick={() => navigate('/robots')}
              style={{ background: 'transparent', color: s.text,
                border: `1px solid ${s.border}`, padding: '12px 32px',
                borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                transition: 'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = s.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = s.border}>
              Ver todas as {robots.length} estratégias →
            </button>
          </div>
        </div>
      </section>

      {/* ── 4 ESPECIALISTAS ──────────────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 32px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
          borderLeft: `3px solid ${s.accent}`, paddingLeft: 12,
          fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
          color: s.accent, fontWeight: 600, marginBottom: 24 }}>
          Validação
        </div>
        <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 48px)', fontWeight: 800,
          lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 12 }}>
          4 especialistas mundiais.<br />1 robô aprovado.
        </h2>
        <p style={{ fontSize: 15, color: s.muted, lineHeight: 1.7,
          maxWidth: 500, marginBottom: 48 }}>
          Cada estratégia passa pelos critérios dos maiores nomes do trading algorítmico mundial.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 16 }}>
          {[
            { name: 'Kevin Davey', tag: 'RISCO', color: '#f06060',
              desc: 'Campeão mundial de trading. Monte Carlo, risco de ruína e consistência real.' },
            { name: 'Larry Williams', tag: 'CONSISTÊNCIA', color: '#f5a623',
              desc: 'Critérios de consistência mensal e anual. Resultados que se repetem.' },
            { name: 'Robert Pardo', tag: 'ROBUSTEZ', color: '#4f8ef7',
              desc: 'In Sample vs Out of Sample. Testes de sensibilidade de parâmetros.' },
            { name: 'David Aronson', tag: 'ESTATÍSTICA', color: s.accent,
              desc: 'Significância estatística. p-valor e evidências que sustentam a estratégia.' },
          ].map((e, i) => (
            <div key={i} style={{ background: s.card,
              borderTop: `3px solid ${e.color}`,
              border: `1px solid ${s.border}`, borderRadius: 12, padding: '24px' }}>
              <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 700,
                color: e.color, letterSpacing: '.1em', marginBottom: 12,
                background: e.color + '18', padding: '3px 10px', borderRadius: 99 }}>
                {e.tag}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{e.name}</div>
              <div style={{ fontSize: 13, color: s.muted, lineHeight: 1.6 }}>{e.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────── */}
      <section style={{ background: s.surface, borderTop: `1px solid ${s.border}` }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '80px 32px',
          textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 900,
            lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 20 }}>
            Pronto para operar<br />
            <span style={{ color: s.accent }}>com vantagem real?</span>
          </h2>
          <p style={{ fontSize: 16, color: s.muted, lineHeight: 1.7, marginBottom: 40 }}>
            Conheça as estratégias, veja os portfólios ou fale diretamente com o Frantiesco.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/robots')}
              style={{ background: s.accent, color: '#000', border: 'none',
                padding: '16px 32px', borderRadius: 8, fontSize: 16, fontWeight: 700,
                cursor: 'pointer', transition: 'opacity .15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              Explorar estratégias →
            </button>
            <a href="https://wa.me/5553999793260" target="_blank" rel="noopener noreferrer"
              style={{ background: 'transparent', color: s.text, textDecoration: 'none',
                border: `1px solid ${s.border}`, padding: '16px 32px',
                borderRadius: 8, fontSize: 16, fontWeight: 500,
                transition: 'border-color .15s', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = s.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = s.border}>
              💬 Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>

    </div>
  )
}
