/**
 * export-biblioteca.cjs — Trade Quant Lab
 * Gera public/data/biblioteca.json (lista leve da Biblioteca TQL) cruzando:
 *   - public/data/robots.json   (gerado pelo export-data.cjs)
 *   - TQL Studio lab.json       (data de criação, day/swing, descrição)
 *
 * Regra: robô TQL_NNN  <->  estratégia do Studio cujo nome começa com "NNN_"
 *
 * USO:
 *   node export-biblioteca.cjs
 *   node export-biblioteca.cjs --studio "C:\Users\PIchau\AppData\Roaming\TQL Studio\lab.json"
 */
const path = require('path')
const fs   = require('fs')
const os   = require('os')

function run(opts = {}) {
  const args   = process.argv.slice(2)
  const getArg = f => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null }
  const OUT_DIR = opts.outDir || path.join(__dirname, 'public', 'data')
  const STUDIO  = opts.studio || getArg('--studio') ||
    path.join(os.homedir(), 'AppData', 'Roaming', 'TQL Studio', 'lab.json')
  const log = m => console.log(`[biblioteca] ${m}`)

  const robots = opts.robots || JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'robots.json'), 'utf8'))

  let library = []
  if (fs.existsSync(STUDIO)) {
    try { library = JSON.parse(fs.readFileSync(STUDIO, 'utf8')).library || [] }
    catch (e) { log(`Aviso: não consegui ler ${STUDIO}: ${e.message}`) }
  } else log(`Aviso: TQL Studio não encontrado em ${STUDIO}`)
  log(`TQL Studio: ${library.length} estratégias`)

  // ── helpers ────────────────────────────────────────────────────────────────
  const dateKey = s => {
    const p = String(s || '').split(' ')[0].split('/')
    return p.length < 3 ? 0 : +p[2] * 10000 + +p[1] * 100 + +p[0]
  }
  const fmtTf = tf => {
    if (tf == null || tf === '') return ''
    const s = String(tf)
    if (/^R\d+$/i.test(s)) return `Renko ${s.slice(1)}R`
    if (s === 'D' || /diario/i.test(s)) return 'Diário'
    if (/^\d+$/.test(s)) return `${s} min`
    return s.replace(/m$/, ' min')
  }
  const MOTOR = {
    TENDENCIA: 'Tendência', REVERSAO: 'Reversão', PULLBACK: 'Pullback',
    MOMENTUM: 'Momentum', GRADE: 'Grade', 'TENDÊNCIA': 'Tendência', 'REVERSÃO': 'Reversão',
    SCALPER: 'Reversão', 'EXAUSTÃO': 'Momentum',
  }
  // Descrição pública: mantém a lógica, remove parâmetros (N=.., K=..) e tags internas
  const hhmm = n => { const v = String(n).padStart(3, '0'); return `${v.slice(0, -2)}h${v.slice(-2)}` }
  const cleanDesc = lines => lines
    .map(l => String(l).trim())
    .filter(l => l && !/^(Plataforma Quant|TQL Studio)$/i.test(l) && !/^Entrada:/i.test(l))
    .map(l => l
      .replace(/\s*\((?:[A-Z]{1,3}=[^)]*)\)/g, '')
      .replace(/\s*\b[A-Z]{1,3}=[\d.,]+/g, '')
      .replace(/\s*\[(FRACO|FORTE|MÉDIO|MEDIO)\]/gi, '')
      .replace(/\s+[—-]\s+(Kaufman|Murphy|Raschke|Bollinger|Granville|Wilder|Connors|Williams)[^|]*/gi, '')
      .replace(/ATR:\s*\d+\s*períodos\s*\|?\s*/i, '')
      .replace(/(\d{3,4})[–-](\d{3,4})/g, (_, a, b) => `${hhmm(a)} às ${hhmm(b)}`)
      .replace(/zeragem:\s*(\d{3,4})/i, (_, a) => `zeragem ${hhmm(a)}`)
      .replace(/\s*\|?\s*Saída por tempo:\s*não/i, '')
      .replace(/\s*\|?\s*Breakeven 1:1:\s*não/i, '')
      .replace(/Breakeven 1:1:\s*sim/i, 'breakeven 1:1')
      .replace(/Saída por tempo:\s*sim/i, 'saída por tempo')
      .replace(/Alvo: Sem alvo \(sai por stop, tempo ou horário\)/i, 'sem alvo fixo')
      .replace(/\s*\|\s*/g, ' · ')
      .replace(/\s+—\s+/g, '. ')
      .replace(/\s{2,}/g, ' ')
      .trim())
    .filter(l => !/^Motor:/i.test(l))
    // não expõe parâmetros: descarta trechos com números (exceto horários das janelas)
    .map(l => /^Janelas/i.test(l) ? l : l.split(' · ')
      .map(f => f.replace(/\s*\([^)]*\d[^)]*\)/g, ''))
      .filter(f => !/\d/.test(f.replace(/^[^:]+:\s*/, '')) || /^\D+:\s*\D*$/.test(f))
      .join(' · '))
    .filter(l => l && !/:\s*$/.test(l))

  // Fallback quando o Studio não tem descrição pronta: monta a partir da configuração
  const TRIG = {
    keyReversal: 'Key reversal (nova mínima/máxima e fechamento de volta)', donchian: 'Rompimento do canal Donchian',
    bbBreak: 'Rompimento da Bollinger', maPullback: 'Toque e rejeição da média a favor da tendência',
    stochTrend: 'Estocástico saindo do extremo a favor da tendência', pctbTrend: 'Bollinger %b dentro da tendência',
    bigBarCont: 'Barra larga fechando na ponta (continuação)', uNDays: 'Rompimento da máxima/mínima dos últimos dias',
    turtleSoup: 'Turtle Soup (falso rompimento)', hammer: 'Martelo / estrela cadente', wrExtreme: 'Williams %R em extremo',
    envFade: 'Fechamento fora do envelope (fade)', thrust: 'Thrust de volatilidade', keltnerBreak: 'Rompimento do Keltner',
    obvBreak: 'OBV em nova máxima', maDistance: 'Distância extrema da média', sarFlip: 'Virada do Parabolic SAR',
    macdCross: 'Cruzamento do MACD', maCross: 'Cruzamento de médias', tripleMA: 'Alinhamento de três médias', orb: 'Rompimento da abertura (ORB)',
  }
  const FIL = {
    volLow: 'Volatilidade baixa', volHigh: 'Volatilidade alta', trendMA: 'Preço a favor da média longa', priorDay: 'Dia anterior a favor',
    trixDir: 'TRIX a favor', adxHigh: 'ADX acima (mercado tendencial)', diDir: 'DI+/DI- a favor', squeeze: 'Squeeze de volatilidade',
    noDow: 'Exclui um dia da semana', uOnlyDow: 'Opera só em dias específicos', counterMA: 'Contra a média longa', kamaSlope: 'Inclinação da KAMA',
  }
  const EXIT = { atr: 'por ATR', pts: 'fixo em pontos', range: 'pelo range', bar: 'no extremo do candle de sinal', dayOpen: 'na abertura do dia', grid: 'de grade', none: 'sem alvo' }
  const descFromSt = st => {
    if (!st) return []
    const L = []
    if (st.trigger) L.push(`Gatilho: ${TRIG[st.trigger.id] || st.trigger.id}`)
    for (const f of st.filters || []) L.push(`Filtro: ${FIL[f.id] || f.id}`)
    const sp = []
    if (st.stop) sp.push(`Stop ${EXIT[st.stop.type] || st.stop.type}`)
    if (st.target) sp.push(st.target.type === 'none' ? 'sem alvo fixo' : `alvo ${EXIT[st.target.type] || st.target.type}`)
    if (st.be) sp.push('breakeven 1:1')
    if (sp.length) L.push(sp.join(' · '))
    if (st.win && st.win.length) L.push(`Janelas: ${st.win.map(w => `${hhmm(w[0])} às ${hhmm(w[1])}`).join(' e ')}`)
    return L
  }

  const out = []
  const allMonths = {}
  // Um item por nome TQL_NNN (se houver duplicado, fica o atualizado por último na plataforma)
  const pick = new Map()
  for (const r of robots) {
    if (!/^TQL_\d+/i.test(r.name || '') || r.arquivado) continue
    const k = r.name.toUpperCase(), cur = pick.get(k)
    const newer = !cur || String(r.updated_at || '') > String(cur.updated_at || '') ||
      (String(r.updated_at || '') === String(cur.updated_at || '') && (r.operations || []).length > (cur.operations || []).length)
    if (newer) pick.set(k, r)
  }
  for (const r of pick.values()) {
    const m = /^TQL_(\d+)/i.exec(r.name || '')
    const num = m[1]
    const st  = library.find(x => x.tqlId === r.id) ||
      library.find(x => String(x.name || '').startsWith(num + '_'))
    // robô "gêmeo" exportado do Studio para a plataforma (tem a descrição completa)
    const twin = robots.find(x => x !== r && String(x.name || '').startsWith(num + '_'))

    const ops = [...(r.operations || [])].sort((a, b) => dateKey(a.abertura) - dateKey(b.abertura))
    // Resultado líquido por 1 lote-padrão: mesmo cálculo da plataforma (custo ida e volta descontado)
    const L = r.lote_padrao > 0 ? r.lote_padrao : 1
    const costPerTrade = ((r.corretagem || 0) + (r.emolumentos || 0)) * 2 * L
    const res = o => (o.res_op || 0) / (((o.qtd > 0 ? o.qtd : 1) / L) || 1) - costPerTrade

    const wins = ops.filter(o => res(o) > 0).length
    const winRate = ops.length ? (wins / ops.length) * 100 : null

    // média mensal: soma por mês, dividida pelos meses do calendário entre 1ª e última op
    const byMonth = {}
    for (const o of ops) {
      const k = Math.floor(dateKey(o.abertura) / 100)
      if (k) byMonth[k] = (byMonth[k] || 0) + res(o)
    }
    for (const k in byMonth) allMonths[k] = (allMonths[k] || 0) + byMonth[k]
    const keys = Object.keys(byMonth).map(Number).sort((a, b) => a - b)
    let nMonths = 0
    if (keys.length) {
      const y0 = Math.floor(keys[0] / 100), m0 = keys[0] % 100
      const y1 = Math.floor(keys[keys.length - 1] / 100), m1 = keys[keys.length - 1] % 100
      nMonths = (y1 - y0) * 12 + (m1 - m0) + 1
    }
    const total = ops.reduce((s, o) => s + res(o), 0)
    const avgMonthly = nMonths ? total / nMonths : null
    const posMonths = keys.length ? keys.filter(k => byMonth[k] > 0).length / nMonths * 100 : null

    // curva de capital reduzida (~48 pontos) para o mini gráfico
    let acc = 0
    const eq = ops.map(o => (acc += res(o)))
    const step = Math.max(1, Math.ceil(eq.length / 48))
    const curve = eq.filter((_, i) => i % step === 0 || i === eq.length - 1).map(v => Math.round(v))

    // Estilo: Studio > descrição > timeframe
    const obs = (r.observation || twin?.observation || '')
    let mode = st?.st?.mode || (/\bSwing\b/i.test(obs) ? 'swing' : /Day trade/i.test(obs) ? 'day' : '')
    const tfRaw = st?.st?.tf ?? r.timeframe ?? twin?.timeframe ?? ''
    if (!mode) mode = /^(D|diario|240)/i.test(String(tfRaw)) ? 'swing' : 'day'

    const descLines = (st?.descricao && st.descricao.length) ? st.descricao
      : obs ? obs.split('\n') : null

    const motorRaw = st?.st?.motor || r.strategy_type || twin?.strategy_type || ''
    out.push({
      id: r.id,
      name: r.name,
      createdAt: st?.createdAt ? st.createdAt.slice(0, 10) : null,
      ativo: (st?.ativo || r.ativo || twin?.ativo || '').replace(/FUT$/i, ''),
      timeframe: fmtTf(tfRaw),
      mode,
      motor: MOTOR[String(motorRaw).toUpperCase()] || motorRaw,
      dir: st?.st?.dir || null,
      desc: descLines ? cleanDesc(descLines) : descFromSt(st?.st),
      studioName: st?.name || twin?.name || null,
      nOps: ops.length,
      costPerTrade: +costPerTrade.toFixed(2),
      totalCosts: Math.round(costPerTrade * ops.length),
      costSource: r.costSource || 'plataforma',
      since: ops.length ? ops[0].abertura.split(' ')[0].split('/')[2] : null,
      winRate: winRate == null ? null : +winRate.toFixed(1),
      avgMonthly: avgMonthly == null ? null : Math.round(avgMonthly),
      posMonths: posMonths == null ? null : +posMonths.toFixed(0),
      curve,
    })
    log(`  ✓ ${r.name.padEnd(10)} ← ${st ? st.name : (twin ? twin.name + ' (plataforma)' : 'sem vínculo no Studio')}`)
  }

  out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }))
  const file = path.join(OUT_DIR, 'biblioteca.json')
  // curva combinada (todas as TQL com 1 contrato), mês a mês
  let cum = 0
  const combined = Object.keys(allMonths).map(Number).sort((a, b) => a - b)
    .map(k => ({ m: `${String(k).slice(0, 4)}-${String(k).slice(4)}`, v: Math.round(cum += allMonths[k]) }))
  fs.writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), combined, items: out }, null, 1))
  log(`✅ biblioteca.json → ${out.length} estratégias TQL`)
  return out
}

module.exports = { run }
if (require.main === module) run()
