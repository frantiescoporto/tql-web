import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '../styles/biblioteca.css'

// ── Planos de aquisição ───────────────────────────────────────────────────────
// Preencha price (ex.: 'R$ 497') e checkout (link Greenn) quando estiverem definidos.
// Sem checkout, o botão abre o WhatsApp já com o plano escolhido.
const WHATSAPP = '5553999010262'
const PLANOS = [
  {
    key: 'p5', qtd: 5, title: 'Seleção 5',
    text: 'Para começar a automatizar com um grupo enxuto e diversificado.',
    perks: ['5 estratégias à sua escolha', 'Arquivo .AUT pronto para importar', 'Configurações já ajustadas'],
    price: null, checkout: null,
  },
  {
    key: 'p20', qtd: 20, title: 'Coleção 20', featured: true,
    text: 'Para montar um portfólio com vários ativos, tempos gráficos e estilos.',
    perks: ['20 estratégias à sua escolha', 'Arquivo .AUT pronto para importar', 'Configurações já ajustadas', 'Mistura de day trade e swing'],
    price: null, checkout: null,
  },
  {
    key: 'all', qtd: null, title: 'Biblioteca completa',
    text: 'Todas as estratégias publicadas na biblioteca, em um único arquivo.',
    perks: ['Todas as estratégias TQL', 'Arquivo .AUT pronto para importar', 'Configurações já ajustadas'],
    price: null, checkout: null,
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const brl = v => (v < 0 ? '-' : '') + 'R$ ' + Math.abs(Math.round(v)).toLocaleString('pt-BR')
const fmtDate = iso => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const fmtMonth = ym => { const [y, m] = ym.split('-'); return `${MESES[+m - 1]}/${y}` }
const dirLabel = d => d === 'long' ? 'Só compra' : d === 'short' ? 'Só venda' : d === 'both' ? 'Compra e venda' : null

function pathFor(values, w, h, pad = 2) {
  if (!values || values.length < 2) return { line: '', area: '', zeroY: null }
  const min = Math.min(0, ...values), max = Math.max(0, ...values)
  const span = max - min || 1
  const x = i => (i / (values.length - 1)) * w
  const y = v => pad + (1 - (v - min) / span) * (h - pad * 2)
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const area = `${line}L${w},${y(min).toFixed(1)}L0,${y(min).toFixed(1)}Z`
  return { line, area, zeroY: y(0) }
}

function Spark({ values }) {
  const { line } = pathFor(values, 128, 30)
  return (
    <svg className="bib-spark" viewBox="0 0 128 30" preserveAspectRatio="none" aria-hidden="true">
      <path d={line} />
    </svg>
  )
}

function InfoTip({ item }) {
  const [open, setOpen] = useState(false)
  const lines = item.desc || []
  const dir = dirLabel(item.dir)
  return (
    <span className={'bib-q' + (open ? ' open' : '')} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={`Sobre a ${item.name}`} onClick={() => setOpen(o => !o)}>?</button>
      <span className="bib-pop" role="tooltip">
        <strong>
          {[item.motor, item.mode === 'swing' ? 'swing trade' : 'day trade'].filter(Boolean).join(', ')}
          {dir ? `. ${dir}` : ''}
        </strong>
        {lines.length > 0
          ? <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          : <span className="bib-mute">Descrição detalhada em breve.</span>}
        <span className="bib-pop-stats">
          <span><b>{item.nOps}</b> operações</span>
          {item.since && <span>desde <b>{item.since}</b></span>}
          {item.posMonths != null && <span><b>{item.posMonths}%</b> meses positivos</span>}
        </span>
      </span>
    </span>
  )
}

function planHref(plan) {
  if (plan.checkout) return plan.checkout
  const msg = `Olá! Quero adquirir o plano ${plan.title} da Biblioteca TQL.`
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function BibliotecaPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [estilo, setEstilo] = useState('all')
  const [ativo, setAtivo] = useState('all')
  const [sort, setSort] = useState('media')

  useEffect(() => {
    fetch('/data/biblioteca.json?cb=' + Date.now())
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setData)
      .catch(() => setError('Não foi possível carregar a biblioteca. Atualize a página para tentar de novo.'))
  }, [])

  const items = data?.items || []
  const ativos = useMemo(() => [...new Set(items.map(i => i.ativo).filter(Boolean))].sort(), [items])

  const rows = useMemo(() => {
    const list = items
      .filter(i => estilo === 'all' || i.mode === estilo)
      .filter(i => ativo === 'all' || i.ativo === ativo)
    const by = {
      media: (a, b) => (b.avgMonthly ?? -1e9) - (a.avgMonthly ?? -1e9),
      acerto: (a, b) => (b.winRate ?? -1) - (a.winRate ?? -1),
      recentes: (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''),
      nome: (a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }),
    }
    return [...list].sort(by[sort])
  }, [items, estilo, ativo, sort])

  const combined = data?.combined || []
  const curve = useMemo(() => pathFor(combined.map(c => c.v), 600, 190, 6), [combined])
  const nDay = items.filter(i => i.mode === 'day').length
  const nSwing = items.length - nDay
  const firstYear = combined[0]?.m.slice(0, 4)

  return (
    <main className="bib">
      <section className="bib-hero">
        <div>
          <h1>Biblioteca de algoritmos TQL</h1>
          <p>
            Estratégias para o Profit criadas no TQL Studio e validadas pelo Método 6015.
            Você escolhe o pacote e recebe um arquivo .AUT com tudo configurado, pronto para ligar.
          </p>
          <div className="bib-hero-actions">
            <a className="bib-btn solid" href="#planos">Ver pacotes</a>
            <a className="bib-btn ghost" href="#estrategias">Explorar estratégias</a>
          </div>
        </div>

        <div className="bib-curve-wrap" aria-label="Curva combinada das estratégias">
          {combined.length > 1 && (
            <>
              <div className="bib-curve-head">
                <span className="bib-curve-total">{brl(combined[combined.length - 1].v)}</span>
                <span className="bib-curve-cap">
                  Resultado acumulado da biblioteca<br />1 contrato por estratégia, em backtest
                </span>
              </div>
              <svg className="bib-curve" viewBox="0 0 600 190" preserveAspectRatio="none" role="img"
                aria-label={`Curva acumulada de ${fmtMonth(combined[0].m)} a ${fmtMonth(combined[combined.length - 1].m)}`}>
                {curve.zeroY != null && <line className="zero" x1="0" x2="600" y1={curve.zeroY} y2={curve.zeroY} />}
                <path className="area" d={curve.area} />
                <path className="line" d={curve.line} />
              </svg>
              <div className="bib-curve-axis">
                <span>{fmtMonth(combined[0].m)}</span>
                <span>{fmtMonth(combined[combined.length - 1].m)}</span>
              </div>
            </>
          )}
        </div>
      </section>

      {items.length > 0 && (
        <section className="bib-facts" aria-label="Resumo">
          <div className="bib-fact"><b>{items.length}</b><span>estratégias publicadas</span></div>
          <div className="bib-fact"><b>{ativos.join(', ')}</b><span>ativos cobertos</span></div>
          <div className="bib-fact">
            <b>{nSwing ? `${nDay} / ${nSwing}` : nDay}</b>
            <span>{nSwing ? 'day trade / swing trade' : 'em day trade'}</span>
          </div>
          <div className="bib-fact"><b>{firstYear ? new Date().getFullYear() - +firstYear : '—'} anos</b><span>de histórico testado</span></div>
        </section>
      )}

      <section className="bib-sec" id="estrategias">
        <div className="bib-sec-head">
          <div>
            <h2>Estratégias</h2>
            <p>Passe o mouse no ? para ver como cada estratégia opera. Valores com 1 contrato.</p>
          </div>
          <div className="bib-controls">
            <div className="bib-seg" role="group" aria-label="Estilo">
              {[['all', 'Todas'], ['day', 'Day trade'], ['swing', 'Swing']].map(([k, l]) => (
                <button key={k} aria-pressed={estilo === k} onClick={() => setEstilo(k)}>{l}</button>
              ))}
            </div>
            {ativos.length > 1 && (
              <div className="bib-seg" role="group" aria-label="Ativo">
                {[['all', 'Todos'], ...ativos.map(a => [a, a])].map(([k, l]) => (
                  <button key={k} aria-pressed={ativo === k} onClick={() => setAtivo(k)}>{l}</button>
                ))}
              </div>
            )}
            <select className="bib-select" value={sort} onChange={e => setSort(e.target.value)} aria-label="Ordenar por">
              <option value="media">Maior média mensal</option>
              <option value="acerto">Maior taxa de acerto</option>
              <option value="recentes">Mais recentes</option>
              <option value="nome">Nome</option>
            </select>
          </div>
        </div>

        <div className="bib-ledger" role="table" aria-label="Estratégias da biblioteca">
          <div className="bib-row head" role="row">
            <span role="columnheader">Estratégia</span>
            <span role="columnheader">Criada em</span>
            <span role="columnheader">Ativo</span>
            <span role="columnheader">Tempo gráfico</span>
            <span role="columnheader">Estilo</span>
            <span role="columnheader" className="bib-r">Acerto</span>
            <span role="columnheader" className="bib-r">Média mensal</span>
            <span role="columnheader" className="bib-c-spark">Curva</span>
            <span role="columnheader" />
          </div>

          {!data && !error && <div className="bib-empty">Carregando estratégias…</div>}
          {error && <div className="bib-empty">{error}</div>}
          {data && rows.length === 0 && (
            <div className="bib-empty">Nenhuma estratégia com esses filtros. Troque o estilo ou o ativo.</div>
          )}

          {rows.map(i => (
            <div className="bib-row" role="row" key={i.id}>
              <span className="bib-c-name bib-name" role="cell">{i.name}<InfoTip item={i} /></span>
              <span className="bib-c-criada bib-mute" role="cell" data-l="Criada em">{fmtDate(i.createdAt)}</span>
              <span className="bib-c-ativo" role="cell" data-l="Ativo">{i.ativo || '—'}</span>
              <span className="bib-c-tf" role="cell" data-l="Tempo gráfico">{i.timeframe || '—'}</span>
              <span className={'bib-c-estilo bib-style ' + i.mode} role="cell" data-l="Estilo">
                <i aria-hidden="true" />{i.mode === 'swing' ? 'Swing trade' : 'Day trade'}
              </span>
              <span className="bib-c-acerto bib-r" role="cell" data-l="Acerto">
                {i.winRate != null ? `${i.winRate.toFixed(0)}%` : '—'}
              </span>
              <span className={'bib-c-media bib-r ' + ((i.avgMonthly ?? 0) >= 0 ? 'bib-pos' : 'bib-neg')} role="cell" data-l="Média mensal">
                {i.avgMonthly != null ? brl(i.avgMonthly) : '—'}
              </span>
              <span className="bib-c-spark" role="cell"><Spark values={i.curve} /></span>
              <span className="bib-c-more" role="cell" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Link className="bib-more" to={`/robots/${i.id}`}>Ver +</Link>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="bib-sec" id="planos">
        <div className="bib-sec-head">
          <div>
            <h2>Escolha o tamanho do seu pacote</h2>
            <p>As estratégias são vendidas em grupos. Quanto maior o pacote, mais diversificado fica o seu portfólio.</p>
          </div>
        </div>
        <div className="bib-plans">
          {PLANOS.map(p => (
            <div key={p.key} className={'bib-plan' + (p.featured ? ' featured' : '')}>
              {p.featured && <span className="bib-tag">Mais escolhido</span>}
              <div className="bib-plan-n">
                {p.qtd ?? items.length}
                <small>estratégias</small>
              </div>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
              <ul>{p.perks.map(k => <li key={k}>{k}</li>)}</ul>
              <div className="bib-plan-price">
                {p.price || 'Valor sob consulta'}
                <span>{p.price ? 'pagamento único' : 'Fale com a gente pelo WhatsApp'}</span>
              </div>
              <a className={'bib-btn ' + (p.featured ? 'solid' : 'ghost')} href={planHref(p)} target="_blank" rel="noreferrer" aria-label={`Quero o pacote ${p.title}`}>
                Quero este pacote
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="bib-sec">
        <div className="bib-sec-head"><div><h2>Como você recebe</h2></div></div>
        <div className="bib-steps">
          <div className="bib-step">
            <h3>Escolha o pacote</h3>
            <p>Selecione 5, 20 ou a biblioteca completa e quais estratégias quer no seu grupo.</p>
          </div>
          <div className="bib-step">
            <h3>Receba o arquivo</h3>
            <p>Você recebe um <span className="bib-file">.AUT</span> com todas as estratégias e configurações já prontas.</p>
          </div>
          <div className="bib-step">
            <h3>Importe no Profit</h3>
            <p>Abra o arquivo no módulo de automação do Profit, defina o número de contratos e ligue.</p>
          </div>
        </div>
      </section>

      <p className="bib-note">
        Resultados obtidos em backtest com 1 contrato, sem custos operacionais. A média mensal considera todos os
        meses do período testado. Resultados passados não garantem resultados futuros. Operar no mercado
        financeiro envolve risco de perda.
      </p>
    </main>
  )
}
