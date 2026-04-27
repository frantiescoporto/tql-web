import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext.jsx'
import { buildAdjOps, calcMetrics, fmtR, fmtNum } from '../lib/analytics.js'

const WA = 'https://wa.me/5553999793260'

const s = {
  accent: '#00d4aa',
  dark: '#080c12',
  surface: '#0f1520',
  card: '#131b28',
  border: 'rgba(255,255,255,0.07)',
  text: '#e8edf5',
  muted: '#6b7a99',
  hint: '#2a3550',
}

function Section({ children, bg, style = {} }) {
  return (
    <section style={{ background: bg || 'transparent', borderTop: `1px solid ${s.border}`, ...style }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 32px' }}>
        {children}
      </div>
    </section>
  )
}

function Tag({ children, color }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
      borderLeft: `3px solid ${color || s.accent}`, paddingLeft: 12,
      fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
      color: color || s.accent, fontWeight: 600, marginBottom: 24 }}>
      {children}
    </div>
  )
}

function H2({ children, style = {} }) {
  return (
    <h2 style={{ fontSize: 'clamp(28px, 3.5vw, 48px)', fontWeight: 800,
      lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 16,
      color: s.text, ...style }}>
      {children}
    </h2>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { robots, portfolios, loading } = useData()
  const [metrics, setMetrics] = useState({})
  const [wordIndex, setWordIndex] = useState(0)
  const [faqOpen, setFaqOpen] = useState(null)
  const [billing, setBilling] = useState('mensal')

  const rotatingWords = ['achismo.', 'intuição.', 'sorte.', 'promessas.']

  useEffect(() => {
    const t = setInterval(() => setWordIndex(i => (i + 1) % rotatingWords.length), 2000)
    return () => clearInterval(t)
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

  const top3 = robots.filter(r => metrics[r.id])
    .map(r => ({ ...r, m: metrics[r.id] }))
    .sort((a, b) => (b.m.m6015 || 0) - (a.m.m6015 || 0))
    .slice(0, 3)

  const totalOps = robots.reduce((a, r) => a + (r.operations?.length || 0), 0)
  const robotsComReal = robots.filter(r => r.realOps?.length > 0).length
  const avgWR = Object.values(metrics).length
    ? (Object.values(metrics).reduce((a, m) => a + (m.winRate || 0), 0) / Object.values(metrics).length).toFixed(0)
    : 0

  const plans = [
    {
      tag: 'GRATUITO', name: 'Grátis', price: null,
      desc: 'Para conhecer e avaliar',
      color: s.muted, btnLabel: 'Começar grátis', btnStyle: 'outline',
      msg: 'Olá! Quero começar com o plano Grátis do Trade Quant Lab.',
      features: ['5 estratégias', 'Métricas básicas', 'Curva de capital', 'Importar CSV Profit'],
      missing: ['Monte Carlo', 'Validação especialistas', 'Conta real', 'Portfólios', 'PDF'],
    },
    {
      tag: 'PRO', name: 'Pro', popular: true,
      price: billing === 'mensal' ? 99 : 74,
      desc: 'Para análise completa de estratégias',
      color: '#4f8ef7', btnLabel: 'Assinar Pro', btnStyle: 'blue',
      msg: 'Olá! Quero assinar o plano Pro do Trade Quant Lab.',
      features: ['Estratégias ilimitadas', 'Todas as métricas', 'Monte Carlo (1.000 sims)', 'Validação 4 especialistas', 'Conta real CSV', 'Importar MT5 (.xlsx)', 'Exportar PDF'],
      missing: ['Portfólios', 'Auto-alocação', 'Correlação'],
    },
    {
      tag: 'DEV', name: 'Dev', badge: 'COMPLETO',
      price: billing === 'mensal' ? 189 : 142,
      desc: 'Para gestão de portfólios',
      color: '#f5a623', btnLabel: 'Assinar Dev', btnStyle: 'gold',
      msg: 'Olá! Quero assinar o plano Dev do Trade Quant Lab.',
      features: ['Tudo do Pro', 'Portfólios ilimitados', 'Auto-alocação por Sharpe', 'Correlação / diversificação', 'Monte Carlo portfólio', 'Calendário BT vs Real', 'Ranking e IA', 'PDF portfólio completo'],
      missing: [],
    },
  ]

  const faqs = [
    { q: 'Funciona para quem não desenvolve robôs?', a: 'Sim. Você importa o histórico CSV do Profit Chart ou Excel do MetaTrader 5 de qualquer robô — seu ou de terceiros — e a plataforma faz a análise completa automaticamente.' },
    { q: 'O que é o M.6015 e por que importa?', a: 'É uma pontuação proprietária que combina Fator de Lucro e Fator de Recuperação Anual em uma única nota objetiva. Acima de 3: aprovado para conta real. Elimina o "parece bom" da decisão.' },
    { q: 'O software fica no meu computador?', a: 'Sim, 100% offline. Os dados nunca saem da sua máquina. Roda no Windows e não precisa de internet para funcionar.' },
    { q: 'Posso trocar de plano depois?', a: 'Sim. Cada plano é uma camada sobre o anterior — você nunca perde o que já tem. O upgrade é imediato.' },
    { q: 'Qual a diferença entre Pro e Dev?', a: 'O Pro foca em análise individual de estratégias. O Dev adiciona a gestão de portfólios: correlação entre robôs, auto-alocação por Sharpe, Monte Carlo de portfólio e comparação vs CDI/IBOV.' },
  ]

  const features = [
    { icon: '🎯', tag: 'EXCLUSIVO', color: '#f06060', title: 'M.6015 — pontuação objetiva', desc: 'Combina Fator de Lucro e Recuperação Anual. Acima de 3: aprovado. Sem subjetividade.' },
    { icon: '🎲', tag: 'ANÁLISE DE RISCO', color: '#4f8ef7', title: 'Monte Carlo real', desc: '1.000 simulações com embaralhamento das operações. DD P50/P90/P95 e Risco de Ruína.' },
    { icon: '📐', tag: 'METODOLOGIA', color: s.accent, title: 'Validação por 4 especialistas', desc: 'Davey, Williams, Pardo e Aronson. 24+ critérios aplicados automaticamente.' },
    { icon: '💼', tag: 'DEV', color: '#f5a623', title: 'Portfólio com auto-alocação', desc: 'Informe o capital e o algoritmo calcula os lotes por Sharpe respeitando o DD de cada robô.' },
    { icon: '📅', tag: 'CONTA REAL', color: '#34d47e', title: 'Calendário BT vs Conta Real', desc: 'Heatmap mensal lado a lado. Identificação visual de divergências e degradação.' },
    { icon: '🔗', tag: 'DEV', color: '#f5a623', title: 'Correlação e diversificação', desc: 'Matriz de correlação do portfólio. Veja quais robôs realmente diversificam.' },
    { icon: '📉', tag: 'MONITORAMENTO', color: '#9b7cf4', title: 'Estagnação e degradação', desc: 'Detecta períodos de drawdown sem recuperação e queda da EM nos últimos 6 meses.' },
    { icon: '📄', tag: 'RELATÓRIO', color: s.muted, title: 'PDF profissional', desc: 'Relatório completo com métricas, gráficos, Monte Carlo e validação. Ideal para clientes.' },
  ]

  return (
    <div style={{ background: s.dark, color: s.text, minHeight: '100vh' }}>

      {/* ── HERO ── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 32px 80px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 28 }}>
          {['WIN', 'WDO', 'BIT', 'B3', 'PROFIT PRO', 'MT5'].map(t => (
            <span key={t} style={{ fontSize: 11, fontWeight: 700, color: s.muted,
              background: s.card, border: `1px solid ${s.border}`,
              padding: '3px 10px', borderRadius: 99, letterSpacing: '.07em' }}>{t}</span>
          ))}
        </div>

        <h1 style={{ fontSize: 'clamp(44px, 7vw, 88px)', fontWeight: 900,
          lineHeight: 1.0, letterSpacing: '-0.03em', marginBottom: 28, maxWidth: 860 }}>
          Pare de operar no{' '}
          <span style={{ color: s.muted, textDecoration: 'line-through',
            textDecorationColor: 'rgba(255,80,80,0.5)' }}>
            {rotatingWords[wordIndex]}
          </span>
          <br />
          <span style={{ color: s.accent }}>Opere com evidência.</span>
        </h1>

        <p style={{ fontSize: 'clamp(15px, 1.5vw, 19px)', color: s.muted,
          lineHeight: 1.7, maxWidth: 560, marginBottom: 40 }}>
          O Método 6015 transforma o histórico de qualquer robô de trading em certeza matemática —
          não importa se você o desenvolveu ou comprou de terceiros.
        </p>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
          <button onClick={() => navigate('/robots')}
            style={{ background: s.accent, color: '#000', border: 'none',
              padding: '15px 30px', borderRadius: 8, fontSize: 16, fontWeight: 700,
              cursor: 'pointer', transition: 'opacity .15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            Ver as estratégias →
          </button>
          <button onClick={() => document.getElementById('planos').scrollIntoView({ behavior: 'smooth' })}
            style={{ background: 'transparent', color: s.text,
              border: `1px solid ${s.border}`, padding: '15px 30px',
              borderRadius: 8, fontSize: 16, fontWeight: 500, cursor: 'pointer',
              transition: 'border-color .15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = s.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = s.border}>
            Ver planos
          </button>
        </div>

        <p style={{ fontSize: 12, color: s.hint }}>
          100% offline · Windows · dados nunca saem da sua máquina
        </p>

        {!loading && (
          <div style={{ display: 'flex', gap: 48, marginTop: 60,
            paddingTop: 48, borderTop: `1px solid ${s.border}`, flexWrap: 'wrap' }}>
            {[
              { v: robots.length, l: 'Estratégias validadas' },
              { v: totalOps.toLocaleString('pt-BR'), l: 'Operações analisadas' },
              { v: robotsComReal, l: 'Com conta real' },
              { v: avgWR + '%', l: 'Win rate médio' },
              { v: portfolios.length, l: 'Portfólios' },
            ].map((st, i) => (
              <div key={i}>
                <div style={{ fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 800,
                  color: s.accent, lineHeight: 1, marginBottom: 5 }}>{st.v}</div>
                <div style={{ fontSize: 11, color: s.muted, textTransform: 'uppercase',
                  letterSpacing: '.07em' }}>{st.l}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── PARA QUEM É ── */}
      <Section bg={s.surface}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Tag>Para quem é</Tag>
          <H2 style={{ textAlign: 'center' }}>Desenvolvedor ou usuário.<br />Tanto faz.</H2>
          <p style={{ color: s.muted, fontSize: 15, maxWidth: 540, margin: '0 auto' }}>
            A plataforma foi construída para qualquer pessoa que leva trading algorítmico a sério —
            independente de ter escrito uma linha de código.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {[
            { title: 'Você desenvolve robôs', sub: 'e precisa saber se eles realmente funcionam', color: s.accent,
              items: ['Valide se seu backtest é estatisticamente significativo — ou só sorte', 'Monte Carlo com 1.000 simulações: veja o pior cenário antes de operar', 'Critérios de Davey, Williams, Pardo e Aronson aplicados automaticamente', 'Compare versões do mesmo robô lado a lado com métricas completas', 'Exporte relatórios PDF profissionais para clientes ou seu próprio controle'] },
            { title: 'Você usa estratégias de terceiros', sub: 'e precisa saber se vale continuar operando', color: '#f5a623',
              items: ['Importe o histórico CSV do Profit ou Excel do MT5 em segundos', 'Descubra se a estratégia que você comprou tem consistência real', 'Compare seu resultado em conta real com o backtest prometido', 'Saiba quando o robô está em período de estagnação ou degradação', 'Monte portfólios otimizados combinando estratégias de fontes diferentes'] },
          ].map((card, i) => (
            <div key={i} style={{ background: s.card, border: `1px solid ${s.border}`,
              borderRadius: 14, padding: '32px', borderTop: `3px solid ${card.color}` }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{card.title}</div>
              <div style={{ fontSize: 13, color: card.color, marginBottom: 24 }}>{card.sub}</div>
              {card.items.map((item, j) => (
                <div key={j} style={{ display: 'flex', gap: 10, alignItems: 'flex-start',
                  marginBottom: 12, fontSize: 14, color: s.muted, lineHeight: 1.5 }}>
                  <span style={{ color: card.color, fontSize: 12, marginTop: 2, flexShrink: 0 }}>→</span>
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>

      {/* ── O QUE ESTÁ INCLUÍDO ── */}
      <Section>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Tag>O que está incluído</Tag>
          <H2 style={{ textAlign: 'center' }}>Tudo que você precisa<br />para decidir com segurança.</H2>
          <p style={{ color: s.muted, fontSize: 15, maxWidth: 480, margin: '0 auto' }}>
            Cada funcionalidade foi desenhada para responder uma pergunta que todo trader já fez.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 16, marginBottom: 48 }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: s.card, border: `1px solid ${s.border}`,
              borderRadius: 12, padding: '24px',
              transition: 'border-color .2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = f.color + '55'}
              onMouseLeave={e => e.currentTarget.style.borderColor = s.border}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 24 }}>{f.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: f.color,
                  background: f.color + '18', padding: '2px 8px',
                  borderRadius: 99, letterSpacing: '.08em' }}>{f.tag}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: s.muted, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Números */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24,
          paddingTop: 48, borderTop: `1px solid ${s.border}` }}>
          {[
            { v: '24+', l: 'critérios de validação' },
            { v: '1.000', l: 'simulações por análise' },
            { v: '100%', l: 'offline · dados privados' },
            { v: '2', l: 'plataformas suportadas' },
          ].map((st, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: s.accent, marginBottom: 6 }}>{st.v}</div>
              <div style={{ fontSize: 12, color: s.muted, textTransform: 'uppercase', letterSpacing: '.07em' }}>{st.l}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── PROCESSO ── */}
      <Section bg={s.surface}>
        <Tag>Processo</Tag>
        <H2>Seis etapas.<br />Uma estratégia aprovada.</H2>
        <p style={{ color: s.muted, fontSize: 15, maxWidth: 460, marginBottom: 48 }}>
          O Método 6015 é uma sequência obrigatória. Não existe atalho.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16 }}>
          {[
            { n: '01', t: 'Desenvolvimento', d: 'Lógica de mercado primeiro. Zero otimização cega de parâmetros.', c: s.accent },
            { n: '02', t: 'In Sample', d: 'Backtest no período de treinamento. Consistência e significância estatística.', c: '#4f8ef7' },
            { n: '03', t: 'Out of Sample', d: 'Teste em período nunca visto pelo robô. p-valor e distribuição real.', c: '#9b7cf4' },
            { n: '04', t: 'Paper Trading', d: 'Meses em simulador ao vivo. Comparação direta com o backtest.', c: '#f5a623' },
            { n: '05', t: 'Conta Real', d: 'Só após as 4 etapas. Com dados públicos para comparação total.', c: '#34d47e' },
            { n: '06', t: 'Portfólio', d: 'Combinação descorrelacionada. Curva de capital mais suave e consistente.', c: s.accent },
          ].map((step, i) => (
            <div key={i} style={{ background: s.card, border: `1px solid ${s.border}`,
              borderRadius: 12, padding: '28px 24px', borderLeft: `3px solid ${step.c}` }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: s.hint, lineHeight: 1, marginBottom: 14 }}>{step.n}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: s.text }}>{step.t}</div>
              <div style={{ fontSize: 13, color: s.muted, lineHeight: 1.6 }}>{step.d}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── TOP ESTRATÉGIAS ── */}
      <Section>
        <Tag>Resultados reais</Tag>
        <H2>Top estratégias por M.6015.</H2>
        <p style={{ color: s.muted, fontSize: 15, maxWidth: 460, marginBottom: 48 }}>
          Score que pondera retorno, consistência, drawdown e robustez. Dados reais, sem filtro.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 16 }}>
          {top3.map((r, i) => (
            <div key={r.id} onClick={() => navigate(`/robots/${r.id}`)}
              style={{ background: s.card, border: `1px solid ${i === 0 ? s.accent + '44' : s.border}`,
                borderRadius: 12, padding: '28px 24px', cursor: 'pointer',
                transition: 'all .2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = s.accent + '88'; e.currentTarget.style.transform = 'translateY(-3px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = i === 0 ? s.accent + '44' : s.border; e.currentTarget.style.transform = 'translateY(0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: s.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>
                    {['🥇 1º lugar', '🥈 2º lugar', '🥉 3º lugar'][i]}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: s.muted, marginTop: 4 }}>
                    {r.ativo} · {r.strategy_type || '—'} · {r.platform?.toUpperCase()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: s.accent, lineHeight: 1 }}>{fmtNum(r.m.m6015 || 0)}</div>
                  <div style={{ fontSize: 10, color: s.muted, marginTop: 2 }}>M.6015</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { l: 'Win Rate', v: (r.m.winRate||0).toFixed(0)+'%' },
                  { l: 'Payoff', v: fmtNum(r.m.payoff||0) },
                  { l: 'P. Factor', v: fmtNum(Math.min(r.m.profitFactor||0,99)) },
                ].map((st, j) => (
                  <div key={j} style={{ background: s.surface, borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: s.muted, marginBottom: 3 }}>{st.l}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{st.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, fontSize: 13, color: s.accent, fontWeight: 600 }}>Ver análise completa →</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <button onClick={() => navigate('/robots')}
            style={{ background: 'transparent', color: s.text, border: `1px solid ${s.border}`,
              padding: '12px 32px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Ver todas as {robots.length} estratégias →
          </button>
        </div>
      </Section>

      {/* ── 4 ESPECIALISTAS ── */}
      <Section bg={s.surface}>
        <Tag>Validação</Tag>
        <H2>4 especialistas mundiais.<br />1 robô aprovado.</H2>
        <p style={{ color: s.muted, fontSize: 15, maxWidth: 460, marginBottom: 48 }}>
          Cada estratégia passa pelos critérios dos maiores nomes do trading algorítmico mundial.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 16 }}>
          {[
            { name: 'Kevin Davey', tag: 'RISCO', c: '#f06060', desc: 'Campeão mundial de trading. Monte Carlo, risco de ruína e consistência real.' },
            { name: 'Larry Williams', tag: 'CONSISTÊNCIA', c: '#f5a623', desc: 'Critérios de consistência mensal e anual. Resultados que se repetem.' },
            { name: 'Robert Pardo', tag: 'ROBUSTEZ', c: '#4f8ef7', desc: 'In Sample vs Out of Sample. Testes de sensibilidade de parâmetros.' },
            { name: 'David Aronson', tag: 'ESTATÍSTICA', c: s.accent, desc: 'Significância estatística. p-valor e evidências que sustentam a estratégia.' },
          ].map((e, i) => (
            <div key={i} style={{ background: s.card, border: `1px solid ${s.border}`,
              borderTop: `3px solid ${e.c}`, borderRadius: 12, padding: '24px' }}>
              <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, color: e.c,
                background: e.c + '18', padding: '3px 10px', borderRadius: 99, marginBottom: 12 }}>{e.tag}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{e.name}</div>
              <div style={{ fontSize: 13, color: s.muted, lineHeight: 1.6 }}>{e.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── PLANOS ── */}
      <section id="planos" style={{ borderTop: `1px solid ${s.border}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Tag>Pricing</Tag>
            <H2 style={{ textAlign: 'center' }}>Comece pequeno.<br />Cresça sem trocar de ferramenta.</H2>
            <p style={{ color: s.muted, fontSize: 15, marginBottom: 32 }}>
              Cada plano é uma camada sobre o anterior. Você nunca perde o que já tem.
            </p>
            {/* Toggle mensal/anual */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14,
              background: s.card, border: `1px solid ${s.border}`, borderRadius: 99, padding: '6px 20px' }}>
              <span style={{ fontSize: 14, fontWeight: billing === 'mensal' ? 700 : 400,
                color: billing === 'mensal' ? s.text : s.muted, cursor: 'pointer' }}
                onClick={() => setBilling('mensal')}>Mensal</span>
              <div onClick={() => setBilling(b => b === 'mensal' ? 'anual' : 'mensal')}
                style={{ width: 40, height: 22, borderRadius: 11, cursor: 'pointer',
                  background: billing === 'anual' ? s.accent : s.hint,
                  position: 'relative', transition: 'background .2s' }}>
                <div style={{ position: 'absolute', top: 3, left: billing === 'anual' ? 21 : 3,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left .2s' }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: billing === 'anual' ? 700 : 400,
                color: billing === 'anual' ? s.text : s.muted, cursor: 'pointer' }}
                onClick={() => setBilling('anual')}>
                Anual <span style={{ color: s.accent, fontSize: 12, fontWeight: 700 }}>−25%</span>
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 20, alignItems: 'start' }}>
            {plans.map((plan, i) => (
              <div key={i} style={{ background: s.card,
                border: `1px solid ${plan.popular ? plan.color + '66' : s.border}`,
                borderRadius: 14, padding: '32px', position: 'relative',
                transform: plan.popular ? 'scale(1.03)' : 'scale(1)' }}>
                {(plan.popular || plan.badge) && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    background: plan.color, color: plan.popular ? '#fff' : '#000',
                    fontSize: 11, fontWeight: 800, padding: '3px 16px',
                    borderRadius: 99, letterSpacing: '.07em', whiteSpace: 'nowrap' }}>
                    {plan.popular ? 'MAIS POPULAR' : plan.badge}
                  </div>
                )}
                <div style={{ fontSize: 11, color: plan.color, fontWeight: 700,
                  letterSpacing: '.1em', marginBottom: 8 }}>{plan.tag}</div>
                <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>{plan.name}</div>
                {plan.price ? (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 36, fontWeight: 900, color: plan.color }}>
                      R$ {plan.price}
                    </span>
                    <span style={{ fontSize: 14, color: s.muted }}>/mês</span>
                    {billing === 'anual' && (
                      <div style={{ fontSize: 12, color: s.accent, marginTop: 2 }}>
                        cobrado anualmente · R$ {plan.price * 12}/ano
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 28, fontWeight: 900, color: s.muted, marginBottom: 6 }}>Grátis</div>
                )}
                <div style={{ fontSize: 13, color: s.muted, marginBottom: 28 }}>{plan.desc}</div>

                <a href={`${WA}?text=${encodeURIComponent(plan.msg)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', textAlign: 'center', textDecoration: 'none',
                    padding: '13px', borderRadius: 8, fontSize: 15, fontWeight: 700,
                    marginBottom: 28, transition: 'opacity .15s',
                    background: plan.btnStyle === 'blue' ? plan.color : plan.btnStyle === 'gold' ? plan.color : 'transparent',
                    color: plan.btnStyle === 'outline' ? s.text : (plan.btnStyle === 'gold' ? '#000' : '#fff'),
                    border: plan.btnStyle === 'outline' ? `1px solid ${s.border}` : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                  {plan.btnLabel}
                </a>

                {plan.features.map((f, j) => (
                  <div key={j} style={{ display: 'flex', gap: 10, alignItems: 'center',
                    marginBottom: 10, fontSize: 13 }}>
                    <span style={{ color: plan.color, fontSize: 14 }}>✓</span>
                    <span style={{ color: s.text }}>{f}</span>
                  </div>
                ))}
                {plan.missing.map((f, j) => (
                  <div key={j} style={{ display: 'flex', gap: 10, alignItems: 'center',
                    marginBottom: 10, fontSize: 13, opacity: .35 }}>
                    <span style={{ color: s.muted }}>—</span>
                    <span style={{ color: s.muted }}>{f}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <Section bg={s.surface}>
        <Tag>Histórias reais</Tag>
        <H2>Quem usa, decide diferente.</H2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 16, marginTop: 32 }}>
          {[
            { t: 'Comprei um robô por R$ 800. Antes de operar ao vivo rodei no Método 6015 e vi que o Risco de Ruína era 18%. Não operei. Semanas depois o robô zerou a banca de quem ignorou isso.', n: 'Carlos A.', role: 'Usuário de estratégias · WIN' },
            { t: 'Desenvolvo robôs há 4 anos. Nunca tive uma ferramenta que aplicasse os critérios de Davey e Pardo automaticamente. Mudou completamente como eu valido antes de lançar.', n: 'Rodrigo M.', role: 'Desenvolvedor · Profit Pro' },
            { t: 'O portfólio com auto-alocação é surreal. Informei R$ 30.000, ele montou a melhor combinação de lotes por Sharpe respeitando o DD de cada robô. Levou 10 segundos.', n: 'Fernanda L.', role: 'Gestora · MT5' },
          ].map((d, i) => (
            <div key={i} style={{ background: s.card, border: `1px solid ${s.border}`,
              borderRadius: 12, padding: '28px' }}>
              <div style={{ fontSize: 32, color: s.accent, lineHeight: 1, marginBottom: 16, fontFamily: 'serif' }}>"</div>
              <p style={{ fontSize: 14, color: s.muted, lineHeight: 1.7, marginBottom: 24, fontStyle: 'italic' }}>{d.t}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%',
                  background: [s.accent, '#4f8ef7', '#f5a623'][i] + '33',
                  border: `1px solid ${[s.accent, '#4f8ef7', '#f5a623'][i]}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: [s.accent, '#4f8ef7', '#f5a623'][i] }}>
                  {d.n[0]}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{d.n}</div>
                  <div style={{ fontSize: 11, color: s.muted }}>{d.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── FAQ ── */}
      <Section>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Tag>Dúvidas frequentes</Tag>
            <H2 style={{ textAlign: 'center' }}>Ainda com dúvidas?</H2>
          </div>
          {faqs.map((faq, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${s.border}` }}>
              <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '20px 0', color: s.text, fontSize: 15, fontWeight: 600,
                  textAlign: 'left', gap: 16 }}>
                {faq.q}
                <span style={{ color: s.accent, fontSize: 20, flexShrink: 0,
                  transform: faqOpen === i ? 'rotate(45deg)' : 'rotate(0)',
                  transition: 'transform .2s' }}>+</span>
              </button>
              {faqOpen === i && (
                <div style={{ fontSize: 14, color: s.muted, lineHeight: 1.7,
                  paddingBottom: 20 }}>{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ── CTA FINAL ── */}
      <section style={{ background: s.surface, borderTop: `1px solid ${s.border}` }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 900,
            lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 20 }}>
            Pronto para operar<br />
            <span style={{ color: s.accent }}>com mais clareza?</span>
          </h2>
          <p style={{ fontSize: 16, color: s.muted, lineHeight: 1.7, marginBottom: 40 }}>
            Comece agora — ou fale com o Frantiesco diretamente no WhatsApp.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => document.getElementById('planos').scrollIntoView({ behavior: 'smooth' })}
              style={{ background: s.accent, color: '#000', border: 'none',
                padding: '16px 32px', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              Ver planos →
            </button>
            <a href={`${WA}?text=${encodeURIComponent('Olá! Quero saber mais sobre o Trade Quant Lab.')}`}
              target="_blank" rel="noopener noreferrer"
              style={{ background: 'transparent', color: s.text, textDecoration: 'none',
                border: `1px solid ${s.border}`, padding: '16px 32px',
                borderRadius: 8, fontSize: 16, fontWeight: 500,
                display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              💬 Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>

    </div>
  )
}
