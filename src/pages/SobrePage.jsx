import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function SobrePage() {
  const navigate = useNavigate()

  return (
    <div className="main-content" style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Sobre o Método 6015</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6 }}>
          Uma metodologia científica para desenvolvimento e validação de robôs de trading algorítmico.
        </p>
      </div>

      {/* Quem sou */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>👋 Frantiesco Trader</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 12 }}>
          Trader algorítmico especializado no desenvolvimento de estratégias quantitativas para o mercado brasileiro.
          Criador do Método 6015 e da plataforma Trade Quant Lab para análise e validação de robôs de trading.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['Clube de Investimento XP', 'Parceiro XP', 'Ontick Top 10', 'Trading 100% automatizado'].map((tag, i) => (
            <span key={i} style={{
              fontSize: 12, padding: '4px 12px',
              background: 'var(--success-bg)', border: '1px solid var(--success)',
              borderRadius: 99, color: 'var(--success)', fontWeight: 600
            }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* O Método */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>📐 O que é o Método 6015?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { step: '01', title: 'Desenvolvimento', desc: 'Criação da estratégia baseada em lógica de mercado, não em otimização cega de parâmetros.' },
            { step: '02', title: 'In Sample', desc: 'Backtest no período de treinamento. Avaliação de consistência e robustez matemática.' },
            { step: '03', title: 'Out of Sample', desc: 'Teste em período nunca visto pelo robô. Validação estatística com p-valor e distribuição.' },
            { step: '04', title: 'Paper Trading', desc: 'Operação em simulador ao vivo por meses. Comparação de execução real vs backtest.' },
            { step: '05', title: 'Conta Real', desc: 'Apenas após aprovação nas 4 etapas anteriores o robô opera com dinheiro real.' },
            { step: '06', title: 'Portfólio', desc: 'Combinação de estratégias descorrelacionadas para suavizar a curva de capital.' },
          ].map((s, i) => (
            <div key={i} style={{ padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>{s.step}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Validação */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>🔬 4 especialistas, 1 robô aprovado</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
          Cada estratégia passa pela metodologia de 4 referências mundiais em trading algorítmico:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {[
            { name: 'Kevin Davey', desc: 'Campeão mundial de trading. Risco de ruína e monte carlo.' },
            { name: 'Larry Williams', desc: 'Critérios de consistência mensal e anual.' },
            { name: 'Robert Pardo', desc: 'Testes de robustez In Sample / Out of Sample.' },
            { name: 'David Aronson', desc: 'Evidências e significância estatística.' },
          ].map((e, i) => (
            <div key={i} style={{ padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius)', borderLeft: '3px solid var(--accent)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{e.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{e.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="cta-banner">
        <h2>Quer acesso aos robôs?</h2>
        <p>Entre em contato para conhecer os planos de assinatura e como integrar ao seu trading.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="https://wa.me/5553999793260" target="_blank" rel="noopener noreferrer"
            className="btn primary" style={{ fontSize: 14, padding: '10px 24px', textDecoration: 'none' }}>
            💬 Falar no WhatsApp
          </a>
          <button className="btn" style={{ fontSize: 14, padding: '10px 24px' }}
            onClick={() => navigate('/robots')}>
            Ver estratégias
          </button>
        </div>
      </div>
    </div>
  )
}
