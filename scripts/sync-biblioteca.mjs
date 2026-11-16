/**
 * Envia os dados oficiais dos robôs para a Biblioteca TQL (biblioteca.tradequantlab.com.br).
 * Roda sozinho no GitHub Actions a cada push que muda public/data (ver
 * .github/workflows/sync-biblioteca.yml). Sem dependências: só Node 20+.
 *
 * Lê public/data/biblioteca.json e public/data/robots.json, calcula as métricas por
 * 1 contrato (mesmo cálculo do site) e manda para a função sync-robots do Supabase.
 *
 * Variáveis de ambiente:
 *   BIBLIOTECA_SYNC_TOKEN  segredo combinado com a função (obrigatório)
 *   BIBLIOTECA_SYNC_URL    opcional, só para apontar para outro projeto
 *
 * Só conferir, sem enviar nada:  node scripts/sync-biblioteca.mjs --dry
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
const BACKTEST_DESDE = '2026-08-01' // operações a partir desta data vão para a comparação com o cliente
const VALIDADE_PADRAO = '2026-12-31' // usada só quando o robô é novo na Biblioteca
const ATIVOS_VISIVEIS = ['WIN', 'WDO', 'BIT']
const dry = process.argv.includes('--dry')

const bib = JSON.parse(fs.readFileSync(path.join(dataDir, 'biblioteca.json'), 'utf8'))
const all = JSON.parse(fs.readFileSync(path.join(dataDir, 'robots.json'), 'utf8'))
const byId = new Map(all.map(r => [r.id, r]))

const iso = s => {
  const [d, m, y] = String(s || '').split(' ')[0].split('/')
  return y ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : null
}
const r2 = v => Math.round(v * 100) / 100

const robots = []
const backtest = []
for (const it of bib.items) {
  const r = byId.get(it.id)
  if (!r) continue
  // resultado líquido por 1 lote-padrão, com o custo de ida e volta descontado
  const L = r.lote_padrao > 0 ? r.lote_padrao : 1
  const cost = ((r.corretagem || 0) + (r.emolumentos || 0)) * 2 * L
  const ops = (r.operations || [])
    .map(o => ({ data: iso(o.abertura), res: (o.res_op || 0) / (((o.qtd > 0 ? o.qtd : 1) / L) || 1) - cost }))
    .filter(o => o.data)
    .sort((a, b) => a.data.localeCompare(b.data))
  if (!ops.length) continue

  let gain = 0, loss = 0, eq = 0, peak = 0, dd = 0
  for (const o of ops) {
    if (o.res > 0) gain += o.res; else loss -= o.res
    eq += o.res
    if (eq > peak) peak = eq
    if (peak - eq > dd) dd = peak - eq
  }
  const anos = Math.max((new Date(ops.at(-1).data) - new Date(ops[0].data)) / 31557600000, 0.25)
  const pf = loss > 0 ? gain / loss : null
  const fatRecAnual = dd > 0 ? eq / dd / anos : null
  const m6015 = pf != null && fatRecAnual != null ? pf + fatRecAnual : null
  // estimativa inicial: 2x o maior drawdown, arredondado para cima em R$ 50 (só vale para robô novo)
  const capital = Math.max(200, Math.ceil((dd * 2) / 50) * 50)

  robots.push({
    id: it.id,
    nome: it.name,
    ativo: it.ativo,
    tipo: it.motor ?? null,
    modo: it.mode ?? null,
    tempo_grafico: it.timeframe ?? null,
    direcao: it.dir ?? null,
    descricao: it.desc || [],
    desde: it.since ?? null,
    n_ops: ops.length,
    ops_ano: Math.round(ops.length / anos),
    win_rate: it.winRate ?? null,
    pf: pf == null ? null : r2(pf),
    dd_max: Math.round(dd),
    media_mensal: it.avgMonthly ?? null,
    meses_positivos: it.posMonths ?? null,
    m6015: m6015 == null ? null : r2(m6015),
    curva: it.curve || [],
    capital_recomendado: capital,
    risco_contrato: capital,
    validade: VALIDADE_PADRAO,
    visivel: ATIVOS_VISIVEIS.includes(it.ativo),
  })
  for (const o of ops) if (o.data >= BACKTEST_DESDE) backtest.push({ robot_id: it.id, data: o.data, resultado: r2(o.res) })
}

console.log(`${robots.length} robôs, ${backtest.length} operações de backtest desde ${BACKTEST_DESDE}`)
if (!robots.length) { console.error('Nenhum robô encontrado em public/data: nada enviado.'); process.exit(1) }
if (dry) process.exit(0)

// O endereço não é segredo: fica fixo aqui. BIBLIOTECA_SYNC_URL só serve para apontar para outro projeto.
const URL_PADRAO = 'https://nffkrtqleszodqgaenil.supabase.co/functions/v1/sync-robots'
const informado = (process.env.BIBLIOTECA_SYNC_URL || '').trim()
const url = /^https:\/\/\S+$/.test(informado) ? informado : URL_PADRAO
if (informado && url !== informado) console.warn('BIBLIOTECA_SYNC_URL não é um endereço https válido: usando o endereço padrão.')
const token = (process.env.BIBLIOTECA_SYNC_TOKEN || '').trim()
if (!token) { console.error('Falta o segredo BIBLIOTECA_SYNC_TOKEN.'); process.exit(1) }
if (/\s/.test(token)) { console.error('BIBLIOTECA_SYNC_TOKEN tem espaço ou quebra de linha no meio: cole só a sequência do token.'); process.exit(1) }

const post = body => fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-sync-token': token },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(120000),
})

// Confere o token com um envio vazio antes de mandar os dados (um envio grande recusado pode travar).
const teste = await post({})
if (teste.status === 401) { console.error('Token recusado (401): o segredo BIBLIOTECA_SYNC_TOKEN não confere com o do Supabase.'); process.exit(1) }
await teste.text()

const res = await post({ robots, backtest, backtest_desde: BACKTEST_DESDE })
const text = await res.text()
if (!res.ok) { console.error(`Falhou (${res.status}): ${text}`); process.exit(1) }
console.log('Biblioteca atualizada:', text)
