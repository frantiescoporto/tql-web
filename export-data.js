#!/usr/bin/env node
/**
 * export-data.js — Trade Quant Lab
 * Exporta robots.db → public/data/robots.json + portfolios.json
 *
 * USO:
 *   node export-data.js
 *   node export-data.js --db /caminho/customizado/robots.db
 *   node export-data.js --out /caminho/customizado/output/
 *   node export-data.js --ids 1,2,3          (exportar só esses robôs)
 *   node export-data.js --public-only         (só robôs marcados como públicos)
 *   node export-data.js --dry-run             (mostra o que exportaria sem gerar arquivos)
 *
 * INSTALAÇÃO (no projeto desktop):
 *   npm install better-sqlite3
 *   node export-data.js
 *
 * Depois copie os JSONs gerados para a pasta public/data/ do projeto web
 * e faça git push → Vercel atualiza automaticamente.
 */

const path = require('path')
const fs   = require('fs')

// ── CLI args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const getArg = (flag) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : null
}
const hasFlag = (flag) => args.includes(flag)

const DB_PATH   = getArg('--db')  || path.join(process.env.APPDATA || process.env.HOME, 'trade-quant-lab', 'robots.db')
const OUT_DIR   = getArg('--out') || path.join(__dirname, 'public', 'data')
const FILTER_IDS = getArg('--ids') ? getArg('--ids').split(',').map(Number) : null
const PUBLIC_ONLY = hasFlag('--public-only')
const DRY_RUN   = hasFlag('--dry-run')

// ── Helpers ────────────────────────────────────────────────────────────────
function log(msg) { console.log(`[export] ${msg}`) }
function warn(msg) { console.warn(`[WARN]  ${msg}`) }

function safeJSON(val) {
  if (val === null || val === undefined) return null
  if (typeof val === 'object') return val
  try { return JSON.parse(val) } catch { return val }
}

// ── Load DB ────────────────────────────────────────────────────────────────
let Database
try {
  Database = require('better-sqlite3')
} catch (e) {
  console.error('\n❌ better-sqlite3 não instalado.')
  console.error('   Execute: npm install better-sqlite3\n')
  process.exit(1)
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`\n❌ Banco de dados não encontrado: ${DB_PATH}`)
  console.error('   Use --db /caminho/para/robots.db\n')
  process.exit(1)
}

log(`Abrindo banco: ${DB_PATH}`)
const db = new Database(DB_PATH, { readonly: true })

// ── Robots ─────────────────────────────────────────────────────────────────
log('Lendo robôs...')

let robotRows = db.prepare(`
  SELECT id, name, ativo, platform, strategy_type, timeframe, tipo,
         desagio, observation, public as is_public
  FROM robots
  ORDER BY name
`).all()

// Filtrar se necessário
if (FILTER_IDS) {
  robotRows = robotRows.filter(r => FILTER_IDS.includes(r.id))
  log(`Filtrado para ${robotRows.length} robôs: ${FILTER_IDS.join(', ')}`)
}
if (PUBLIC_ONLY) {
  robotRows = robotRows.filter(r => r.is_public)
  log(`Filtrado para robôs públicos: ${robotRows.length}`)
}

// Carregar operações para cada robô
const stmtOps = db.prepare(`
  SELECT num, ativo, abertura, fechamento, lado, qtd, res_op, res_op_pct, tempo
  FROM operations
  WHERE robot_id = ?
  ORDER BY abertura
`)

const stmtRealOps = db.prepare(`
  SELECT num, ativo, abertura, fechamento, lado, qtd, res_op, tempo
  FROM real_operations
  WHERE robot_id = ?
  ORDER BY abertura
`)

// Períodos — tenta coluna periods_json, depois colunas legadas
let stmtPeriods
try {
  db.prepare('SELECT periods_json FROM periods LIMIT 1').get()
  stmtPeriods = db.prepare('SELECT periods_json, paper_start, paper_end, in_sample_start, in_sample_end, out_sample_start, out_sample_end FROM periods WHERE robot_id = ?')
} catch {
  try {
    stmtPeriods = db.prepare('SELECT paper_start, paper_end, in_sample_start, in_sample_end, out_sample_start, out_sample_end FROM periods WHERE robot_id = ?')
  } catch {
    stmtPeriods = null
    warn('Tabela de períodos não encontrada — exportando sem períodos')
  }
}

const robots = []

for (const row of robotRows) {
  const ops     = stmtOps.all(row.id)
  const realOps = (() => { try { return stmtRealOps.all(row.id) } catch { return [] } })()
  const periods = stmtPeriods ? (stmtPeriods.get(row.id) || {}) : {}

  // Normalizar periods_json
  const periodsOut = {
    ...periods,
    periods_json: periods.periods_json
      ? (typeof periods.periods_json === 'string' ? periods.periods_json : JSON.stringify(periods.periods_json))
      : null
  }

  robots.push({
    id:            row.id,
    name:          row.name,
    ativo:         row.ativo,
    platform:      row.platform || 'profit',
    strategy_type: row.strategy_type || '',
    timeframe:     row.timeframe || '',
    tipo:          row.tipo || 'backtest',
    desagio:       row.desagio || 0,
    observation:   row.observation || '',
    periods:       periodsOut,
    operations:    ops.map(o => ({
      num:        o.num,
      ativo:      o.ativo,
      abertura:   o.abertura,
      fechamento: o.fechamento,
      lado:       o.lado,
      qtd:        o.qtd,
      res_op:     o.res_op,
      res_op_pct: o.res_op_pct || 0,
      tempo:      o.tempo || '',
    })),
    realOps: realOps.map(o => ({
      num:        o.num,
      ativo:      o.ativo,
      abertura:   o.abertura,
      fechamento: o.fechamento,
      lado:       o.lado,
      qtd:        o.qtd,
      res_op:     o.res_op,
      tempo:      o.tempo || '',
    })),
  })

  log(`  ✓ ${row.name.padEnd(30)} ${ops.length} ops BT  ${realOps.length} ops Real`)
}

// ── Portfolios ─────────────────────────────────────────────────────────────
log('Lendo portfólios...')

let portfolioRows = []
try {
  portfolioRows = db.prepare(`
    SELECT id, name, robots_config
    FROM portfolios
    ORDER BY name
  `).all()
} catch {
  warn('Tabela portfolios não encontrada — exportando sem portfólios')
}

const portfolios = portfolioRows.map(p => ({
  id:           p.id,
  name:         p.name,
  robots_config: typeof p.robots_config === 'string'
    ? p.robots_config
    : JSON.stringify(p.robots_config || {}),
}))

log(`  ${portfolios.length} portfólios encontrados`)

// ── Estatísticas de export ─────────────────────────────────────────────────
const totalOps     = robots.reduce((s, r) => s + r.operations.length, 0)
const totalRealOps = robots.reduce((s, r) => s + r.realOps.length, 0)

console.log('\n── Resumo do export ──────────────────────────────')
console.log(`   Robôs exportados:    ${robots.length}`)
console.log(`   Portfólios:          ${portfolios.length}`)
console.log(`   Total ops (BT):      ${totalOps.toLocaleString('pt-BR')}`)
console.log(`   Total ops (Real):    ${totalRealOps.toLocaleString('pt-BR')}`)

const robotsJson    = JSON.stringify(robots, null, 2)
const portfoliosJson = JSON.stringify(portfolios, null, 2)

const robotsKB     = (Buffer.byteLength(robotsJson) / 1024).toFixed(1)
const portfoliosKB  = (Buffer.byteLength(portfoliosJson) / 1024).toFixed(1)
console.log(`   robots.json:         ~${robotsKB} KB`)
console.log(`   portfolios.json:     ~${portfoliosKB} KB`)
console.log('──────────────────────────────────────────────────\n')

// ── Escrever arquivos ──────────────────────────────────────────────────────
if (DRY_RUN) {
  log('--dry-run: nenhum arquivo gerado.')
  process.exit(0)
}

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  log(`Criado diretório: ${OUT_DIR}`)
}

const robotsPath    = path.join(OUT_DIR, 'robots.json')
const portfoliosPath = path.join(OUT_DIR, 'portfolios.json')

fs.writeFileSync(robotsPath,    robotsJson)
fs.writeFileSync(portfoliosPath, portfoliosJson)

const now = new Date().toLocaleString('pt-BR')
log(`✅ robots.json     → ${robotsPath}`)
log(`✅ portfolios.json → ${portfoliosPath}`)
log(`Gerado em: ${now}`)

console.log('\n📋 Próximos passos:')
console.log('   1. Copie os JSONs para a pasta public/data/ do projeto web')
console.log('   2. git add public/data/ && git commit -m "update data" && git push')
console.log('   3. Vercel atualiza automaticamente\n')

db.close()
