/**
 * export-data.cjs — Trade Quant Lab
 * Exporta robots.db → public/data/robots.json + portfolios.json
 *
 * USO:
 *   node export-data.cjs
 *   node export-data.cjs --db "C:\caminho\para\robots.db"
 *   node export-data.cjs --ids 1,2,3
 *   node export-data.cjs --dry-run
 */

const path = require('path')
const fs   = require('fs')
const os   = require('os')

// ── CLI args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null }
const hasFlag = (flag) => args.includes(flag)

const DB_PATH    = getArg('--db') || path.join(os.homedir(), 'AppData', 'Roaming', 'trade-quant-lab', 'robots.db')
const OUT_DIR    = path.join(__dirname, 'public', 'data')
const FILTER_IDS = getArg('--ids') ? getArg('--ids').split(',').map(Number) : null
const DRY_RUN    = hasFlag('--dry-run')

function log(msg) { console.log(`[export] ${msg}`) }

// ── Verificar better-sqlite3 ───────────────────────────────────────────────
let Database
try {
  Database = require('better-sqlite3')
} catch (e) {
  console.error('\n❌ better-sqlite3 não instalado.')
  console.error('   Execute: npm install better-sqlite3')
  console.error('   Depois rode novamente: node export-data.cjs\n')
  process.exit(1)
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`\n❌ Banco não encontrado: ${DB_PATH}`)
  console.error('   Use: node export-data.cjs --db "C:\\caminho\\para\\robots.db"\n')
  process.exit(1)
}

log(`Abrindo banco: ${DB_PATH}`)
const db = new Database(DB_PATH, { readonly: true })

// ── Robôs ──────────────────────────────────────────────────────────────────
let robotRows = db.prepare(`SELECT id, name, ativo, tipo, desagio, strategy_type, timeframe, platform, observation FROM robots ORDER BY name`).all()

if (FILTER_IDS) robotRows = robotRows.filter(r => FILTER_IDS.includes(r.id))

const stmtOps     = db.prepare(`SELECT num, abertura, fechamento, lado, qtd, res_op, res_op_pct, tempo FROM operations WHERE robot_id = ? ORDER BY abertura`)
const stmtRealOps = db.prepare(`SELECT abertura, fechamento, lado, qtd, res_op FROM real_operations WHERE robot_id = ? ORDER BY abertura`)
const stmtPeriods = db.prepare(`SELECT in_sample_start, in_sample_end, out_sample_start, out_sample_end, paper_start, paper_end, periods_json FROM periods WHERE robot_id = ?`)

const robots = []
for (const r of robotRows) {
  const ops     = stmtOps.all(r.id)
  const realOps = (() => { try { return stmtRealOps.all(r.id) } catch { return [] } })()
  const p       = stmtPeriods.get(r.id) || {}
  robots.push({ id: r.id, name: r.name, ativo: r.ativo, platform: r.platform || 'profit',
    strategy_type: r.strategy_type || '', timeframe: r.timeframe || '',
    tipo: r.tipo || 'backtest', desagio: r.desagio || 0, observation: r.observation || '',
    periods: p, operations: ops, realOps: realOps })
  log(`  ✓ ${r.name.padEnd(30)} ${ops.length} ops BT  ${realOps.length} ops Real`)
}

// ── Portfólios ─────────────────────────────────────────────────────────────
let portfolios = []
try {
  portfolios = db.prepare(`SELECT id, name, robots_config FROM portfolios ORDER BY name`).all()
} catch { log('Sem tabela portfolios') }

db.close()

// ── Resumo ─────────────────────────────────────────────────────────────────
const totalOps  = robots.reduce((s, r) => s + r.operations.length, 0)
const totalReal = robots.reduce((s, r) => s + r.realOps.length, 0)
console.log(`\n── Resumo ────────────────────────────────`)
console.log(`   Robôs:         ${robots.length}`)
console.log(`   Portfólios:    ${portfolios.length}`)
console.log(`   Ops BT:        ${totalOps.toLocaleString('pt-BR')}`)
console.log(`   Ops Real:      ${totalReal.toLocaleString('pt-BR')}`)
console.log(`──────────────────────────────────────────\n`)

if (DRY_RUN) { log('--dry-run: nenhum arquivo gerado.'); process.exit(0) }

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

fs.writeFileSync(path.join(OUT_DIR, 'robots.json'),     JSON.stringify(robots, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'portfolios.json'), JSON.stringify(portfolios, null, 2))

log(`✅ robots.json → ${path.join(OUT_DIR, 'robots.json')}`)
log(`✅ portfolios.json → ${path.join(OUT_DIR, 'portfolios.json')}`)
log(`Concluído em: ${new Date().toLocaleString('pt-BR')}`)
console.log('\n📋 Próximo passo: GitHub Desktop → Commit → Push\n')
