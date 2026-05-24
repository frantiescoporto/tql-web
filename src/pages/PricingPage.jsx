import React, { useState } from 'react'

// ── URLs de checkout Greenn por plano/período ──────────────────────────────
const GREENN = {
  pro: {
    monthly:    'https://payfast.greenn.com.br/qzqexcx/offer/HW40SK',
    quarterly:  'https://payfast.greenn.com.br/qzqexcx/offer/5XuAIt',
    semiannual: 'https://payfast.greenn.com.br/qzqexcx/offer/k0KxYs',
    annual:     'https://payfast.greenn.com.br/qzqexcx/offer/tUrdL9',
  },
  dev: {
    monthly:    'https://payfast.greenn.com.br/qzqexcx/offer/1dqTzA',
    quarterly:  'https://payfast.greenn.com.br/qzqexcx/offer/BcLdwL',
    semiannual: 'https://payfast.greenn.com.br/qzqexcx/offer/IfOmdk',
    annual:     'https://payfast.greenn.com.br/qzqexcx/offer/BGm67w',
  },
}

const PLANS = [
  {
    name: 'Free',
    tier: 'free',
    price: { monthly: 0 },
    color: '#6b7a99',
    desc: 'Para conhecer a plataforma',
    features: [
      '5 estratégias no Lab',
      'Backtest básico',
      'Análise de métricas',
      'Sem My Dash',
      'Sem portfólios',
    ],
    cta: 'Começar grátis',
    greenn: null,
  },
  {
    name: 'Pro',
    tier: 'pro',
    price: { monthly: 29.90, quarterly: 26.91, semiannual: 23.92, annual: 20.93 },
    color: '#4f8ef7',
    badge: 'Mais popular',
    desc: 'Para traders em evolução',
    features: [
      'Estratégias ilimitadas',
      'My Lab completo',
      'My Dash (conta real)',
      'Portfólios e correlação',
      'Monte Carlo',
      'Score M.6015',
    ],
    cta: 'Assinar Pro',
  },
  {
    name: 'Dev',
    tier: 'dev',
    price: { monthly: 99.90, quarterly: 89.91, semiannual: 79.92, annual: 69.93 },
    color: '#00d4aa',
    badge: 'Acesso total',
    desc: 'Para traders profissionais',
    features: [
      'Tudo do Pro',
      'Importação de CSV',
      'Comparação de portfólios',
      'Períodos IS/OOS avançados',
      'Análise de drawdown detalhada',
      'Suporte prioritário',
    ],
    cta: 'Assinar Dev',
  },
]

const PERIODS = [
  { key: 'monthly',    label: 'Mensal',     disc: 0,  months: 1  },
  { key: 'quarterly',  label: 'Trimestral', disc: 10, months: 3  },
  { key: 'semiannual', label: 'Semestral',  disc: 20, months: 6  },
  { key: 'annual',     label: 'Anual',      disc: 30, months: 12 },
]

const PERIOD_LABEL = {
  quarterly:  'em 3 meses',
  semiannual: 'em 6 meses',
  annual:     'no ano',
}

function fmtPrice(v) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PricingPage() {
  const [period, setPeriod] = useState('monthly')
  const periodMeta = PERIODS.find(p => p.key === period)

  return (
    <div style={{ background: 'var(--bg-primary, #080c12)', minHeight: '100vh',
      color: 'var(--text-primary, #e8edf5)', padding: '60px 32px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 12, color: '#00d4aa', fontWeight: 700,
            letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            Planos e Preços
          </div>
          <h1 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 900,
            lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 16 }}>
            Escolha seu plano
          </h1>
          <p style={{ color: '#6b7a99', fontSize: 16, maxWidth: 480, margin: '0 auto' }}>
            Comece grátis e evolua conforme sua necessidade. Cancele quando quiser.
          </p>
        </div>

        {/* Seletor de período */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 48 }}>
          <div style={{ display: 'flex', gap: 6, background: '#0f1520',
            padding: 6, borderRadius: 12 }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
                  cursor: 'pointer', position: 'relative',
                  background: period === p.key ? '#00d4aa' : 'transparent',
                  color: period === p.key ? '#000' : '#6b7a99',
                  fontWeight: period === p.key ? 700 : 400,
                  fontSize: 13, transition: 'all .15s' }}>
                {p.label}
                {p.disc > 0 && (
                  <span style={{ position: 'absolute', top: -10, right: -6,
                    background: '#f5a623', color: '#000', fontSize: 9,
                    fontWeight: 800, padding: '1px 5px', borderRadius: 99,
                    whiteSpace: 'nowrap' }}>
                    -{p.disc}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
          gap: 20, marginBottom: 48 }}>
          {PLANS.map(plan => {
            const basePrice  = plan.price[period] ?? plan.price.monthly
            const finalPrice = plan.price.monthly === 0 ? 0 : basePrice
            const savings    = plan.price.monthly > 0 && period !== 'monthly'
              ? (plan.price.monthly - finalPrice) * periodMeta.months
              : 0
            const checkoutUrl = plan.greenn === null
              ? null
              : GREENN[plan.tier]?.[period] || GREENN[plan.tier]?.monthly

            return (
              <div key={plan.name}
                style={{ background: '#0f1520', border: `1px solid ${plan.color}44`,
                  borderRadius: 16, padding: '32px 28px', position: 'relative',
                  boxShadow: plan.badge ? `0 0 40px ${plan.color}18` : 'none' }}>

                {plan.badge && (
                  <div style={{ position: 'absolute', top: -12, left: '50%',
                    transform: 'translateX(-50%)', background: plan.color,
                    color: plan.name === 'Dev' ? '#000' : '#fff',
                    fontSize: 11, fontWeight: 800, padding: '4px 14px',
                    borderRadius: 99, whiteSpace: 'nowrap' }}>
                    {plan.badge}
                  </div>
                )}

                {/* Badge do plano */}
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: plan.color,
                    background: `${plan.color}18`, padding: '2px 10px',
                    borderRadius: 99, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {plan.name}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#6b7a99', marginBottom: 24 }}>
                  {plan.desc}
                </div>

                {/* Preço */}
                <div style={{ marginBottom: 28 }}>
                  {finalPrice === 0 ? (
                    <div style={{ fontSize: 40, fontWeight: 900, color: plan.color }}>
                      Grátis
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: 16, color: '#6b7a99', marginBottom: 8 }}>R$</span>
                      <span style={{ fontSize: 40, fontWeight: 900,
                        color: plan.color, lineHeight: 1 }}>
                        {fmtPrice(finalPrice)}
                      </span>
                      <span style={{ fontSize: 13, color: '#6b7a99', marginBottom: 8 }}>/mês</span>
                    </div>
                  )}
                  {savings > 0 && (
                    <div style={{ fontSize: 12, color: '#f5a623', marginTop: 4 }}>
                      Economize R$ {fmtPrice(savings)} {PERIOD_LABEL[period]}
                    </div>
                  )}
                </div>

                {/* Features */}
                <div style={{ marginBottom: 28 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center',
                      gap: 8, fontSize: 13,
                      color: i < 2 ? '#e8edf5' : '#6b7a99',
                      padding: '6px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ color: plan.color, flexShrink: 0 }}>✓</span>
                      {f}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                {plan.greenn === null ? (
                  <a href="https://www.tradequantlab.com.br/download"
                    style={{ display: 'block', textAlign: 'center', padding: '12px',
                      borderRadius: 10, border: `1px solid ${plan.color}44`,
                      color: plan.color, textDecoration: 'none',
                      fontWeight: 700, fontSize: 14, transition: 'all .15s' }}>
                    {plan.cta}
                  </a>
                ) : (
                  <a href={checkoutUrl}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', textAlign: 'center', padding: '12px',
                      borderRadius: 10, background: plan.color,
                      color: plan.name === 'Dev' ? '#000' : '#fff',
                      textDecoration: 'none', fontWeight: 800,
                      fontSize: 14, transition: 'all .15s' }}>
                    {plan.cta} →
                  </a>
                )}
              </div>
            )
          })}
        </div>

        {/* FAQ */}
        <div style={{ background: '#0f1520', border: '1px solid #1e2535',
          borderRadius: 16, padding: 32, marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>
            Dúvidas frequentes
          </h2>
          {[
            ['Como recebo o acesso após o pagamento?',
             'Imediatamente após a confirmação do pagamento você recebe um email com sua chave de licença e o link de download.'],
            ['Posso cancelar quando quiser?',
             'Sim. Cancele pelo painel da Greenn a qualquer momento. Sem multas ou burocracia.'],
            ['A chave funciona em quantos computadores?',
             'A chave é pessoal e pode ser usada em 1 computador por vez.'],
            ['O que acontece quando minha assinatura renova?',
             'Você recebe automaticamente uma nova chave por email no dia da renovação.'],
          ].map(([q, a], i) => (
            <div key={i} style={{ padding: '16px 0',
              borderBottom: i < 3 ? '1px solid #1e2535' : 'none' }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>⚡ {q}</div>
              <div style={{ fontSize: 13, color: '#6b7a99', lineHeight: 1.6 }}>{a}</div>
            </div>
          ))}
        </div>

        {/* WhatsApp CTA */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#6b7a99', marginBottom: 16, fontSize: 14 }}>
            Ainda tem dúvidas? Fale com a gente.
          </p>
          <a href="https://wa.me/5553999010262?text=Ol%C3%A1!%20Tenho%20d%C3%BAvidas%20sobre%20os%20planos%20do%20Trade%20Quant%20Lab."
            target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#25D366', color: '#fff', padding: '12px 28px',
              borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
            💬 Falar no WhatsApp
          </a>
        </div>

      </div>
    </div>
  )
}
