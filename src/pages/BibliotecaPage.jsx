import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '../styles/biblioteca.css'

// ── Oferta ────────────────────────────────────────────────────────────────────
// Um único plano com todas as estratégias. Quando tiver os links da Greenn, preencha checkout.
// Sem checkout, o botão abre o WhatsApp já com a opção escolhida.
const WHATSAPP = '5553999010262'
const OFERTA = {
  title: 'Biblioteca completa',
  periodo: 'Assinatura trimestral',
  meses: 3,
  garantiaDias: 30,
  opcoes: [
    { key: 'padrao', label: 'Trimestral', price: 997, checkout: null },
    { key: 'avel', label: 'Clientes Avel', price: 697.90, checkout: null, note: '30% de desconto para quem é cliente Avel' },
  ],
}
const PERKS = [
  'Todas as estratégias TQL publicadas na biblioteca',
  'Arquivo .AUT com todas as configurações prontas',
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const brl = v => (v < 0 ? '-' : '') + 'R$ ' + Math.abs(Math.round(v)).toLocaleString('pt-BR')
const brlc = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
        {item.totalCosts > 0 && (
          <span className="bib-pop-cost">
            Custos já descontados: {brl(item.totalCosts)} no período ({brlc(item.costPerTrade)} por operação)
          </span>
        )}
      </span>
    </span>
  )
}

function planHref(op) {
  if (op.checkout) return op.checkout
  const msg = op.key === 'avel'
    ? 'Olá! Sou cliente Avel e quero assinar a Biblioteca TQL (trimestral com 30% de desconto).'
    : 'Olá! Quero assinar a Biblioteca TQL (plano trimestral).'
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
  const costVals = [...new Set(items.map(i => i.costPerTrade).filter(v => v > 0))]
  const costNote = costVals.length === 1
    ? `emolumentos e corretagem de ${brlc(costVals[0])} por operação (ida e volta), descontados em cada trade`
    : 'emolumentos e corretagem descontados em cada trade, conforme o custo cadastrado de cada estratégia'

  return (
    <main className="bib">
      <section className="bib-hero">
        <div>
          <h1>Biblioteca de algoritmos TQL</h1>
          <p>
            Estratégias para o Profit criadas no TQL Studio e validadas pelo Método 6015.
            Você assina e recebe um arquivo .AUT com todas as estratégias configuradas, pronto para ligar.
          </p>
          <div className="bib-hero-actions">
            <a className="bib-btn solid" href="#planos">Ver plano</a>
            <a className="bib-btn ghost" href="#estrategias">Explorar estratégias</a>
          </div>
        </div>

        <div className="bib-curve-wrap" aria-label="Curva combinada das estratégias">
          {combined.length > 1 && (
            <>
              <div className="bib-curve-head">
                <span className="bib-curve-total">{brl(combined[combined.length - 1].v)}</span>
                <span className="bib-curve-cap">
                  Resultado acumulado da biblioteca<br />1 contrato por estratégia, líquido de custos
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
            <p>Passe o mouse no ? para ver como cada estratégia opera. Valores com 1 contrato, já descontados os custos.</p>
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
            <h2>Acesso a todas as estratégias</h2>
            <p>Um plano só, com a biblioteca inteira. Teste por {OFERTA.garantiaDias} dias: se não fizer sentido para você, devolvemos o valor.</p>
          </div>
        </div>
        <div className="bib-offer">
          <div className="bib-offer-info">
            <div className="bib-plan-n">{items.length}<small>estratégias</small></div>
            <h3>{OFERTA.title}</h3>
            <ul>
              {PERKS.map(k => <li key={k}>{k}</li>)}
              {ativos.length > 0 && <li>Day trade e swing trade em {ativos.join(', ')}</li>}
            </ul>
            <div className="bib-guarantee">
              <b>{OFERTA.garantiaDias} dias de garantia</b>
              <span>Use a biblioteca por até {OFERTA.garantiaDias} dias. Se se arrepender, é só pedir e devolvemos 100% do valor.</span>
            </div>
          </div>
          <div className="bib-offer-prices">
            {OFERTA.opcoes.map(op => (
              <div key={op.key} className={'bib-price' + (op.key === 'avel' ? ' avel' : '')}>
                <div className="bib-price-head">
                  <span>{op.label}</span>
                  {op.key === 'avel' && <span className="bib-tag-inline">-30%</span>}
                </div>
                <div className="bib-price-val">
                  {op.key === 'avel' && <s>{brlc(OFERTA.opcoes[0].price)}</s>}
                  {brlc(op.price)}
                </div>
                <div className="bib-price-sub">
                  {OFERTA.periodo}, equivale a {brlc(op.price / OFERTA.meses)} por mês
                  {op.note ? <><br />{op.note}</> : null}
                </div>
                <a className={'bib-btn ' + (op.key === 'avel' ? 'solid' : 'ghost')} href={planHref(op)} target="_blank" rel="noreferrer">
                  {op.key === 'avel' ? 'Assinar como cliente Avel' : 'Assinar o plano trimestral'}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bib-sec">
        <div className="bib-sec-head"><div><h2>Como você recebe</h2></div></div>
        <div className="bib-steps">
          <div className="bib-step">
            <h3>Assine o plano</h3>
            <p>Plano trimestral com todas as estratégias. Clientes Avel pagam 30% a menos.</p>
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
        Resultados de backtest com 1 contrato, líquidos de custos operacionais: {costNote}.
        A média mensal considera todos os meses do período testado. Resultados passados não garantem
        resultados futuros. Operar no mercado financeiro envolve risco de perda.
      </p>
    </main>
  )
}
