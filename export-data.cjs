/**
 * export-data.cjs — Trade Quant Lab
 * Exporta robots.db → public/data/
 *   - robots.json            (estratégias + backtest + conta real)
 *   - portfolios.json        (portfólios do LAB)
 *   - mentorados-portfolios.json  (portfólios recomendados)
 *   - mentorados-ops.json         (operações do My Dash)
 *
 * USO:
 *   node export-data.cjs
 *   node export-data.cjs --db "C:\caminho\para\robots.db"
 *   node export-data.cjs --dry-run
 */

const path = require('path')
const fs   = require('fs')
const os   = require('os')

const args    = process.argv.slice(2)
const getArg  = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i+1] : null }
const hasFlag = (f) => args.includes(f)

const DB_PATH = getArg('--db') || path.join(os.homedir(), 'AppData', 'Roaming', 'Trade Quant Lab', 'robots.db')
const OUT_DIR = path.join(__dirname, 'public', 'data')
const DRY_RUN = hasFlag('--dry-run')

function log(msg) { console.log(`[export] ${msg}`) }

let Database
try { Database = require('better-sqlite3') } catch {
  console.error('\n❌ better-sqlite3 não instalado. Execute: npm install better-sqlite3\n')
  process.exit(1)
}
if (!fs.existsSync(DB_PATH)) {
  console.error(`\n❌ Banco não encontrado: ${DB_PATH}`)
  console.error('   Use: node export-data.cjs --db "C:\\caminho\\para\\robots.db"\n')
  process.exit(1)
}

log(`Abrindo banco: ${DB_PATH}`)
const db = new Database(DB_PATH, { readonly: true })

// ── 1. ROBÔS ──────────────────────────────────────────────────────────────────
log('\n── Robôs ─────────────────────────────────────────')
const robotRows = db.prepare(`SELECT id, name, ativo, tipo, desagio, strategy_type, timeframe, platform, observation FROM robots ORDER BY name`).all()

const stmtOps     = db.prepare(`SELECT num, abertura, fechamento, lado, qtd, res_op, res_op_pct, tempo FROM operations WHERE robot_id = ? ORDER BY abertura`)
const stmtRealOps = db.prepare(`SELECT abertura, fechamento, lado, qtd, res_op FROM real_operations WHERE robot_id = ? ORDER BY abertura`)
const stmtPeriods = db.prepare(`SELECT in_sample_start, in_sample_end, out_sample_start, out_sample_end, paper_start, paper_end, periods_json FROM periods WHERE robot_id = ?`)

const robots = []
for (const r of robotRows) {
  const ops     = stmtOps.all(r.id)
  const realOps = (() => { try { return stmtRealOps.all(r.id) } catch { return [] } })()
  const p       = (() => { try { return stmtPeriods.get(r.id) || {} } catch { return {} } })()
  robots.push({
    id: r.id, name: r.name, ativo: r.ativo,
    platform: r.platform || 'profit',
    strategy_type: r.strategy_type || '',
    timeframe: r.timeframe || '',
    tipo: r.tipo || 'backtest',
    desagio: r.desagio || 0,
    observation: r.observation || '',
    periods: p, operations: ops, realOps,
  })
  log(`  ✓ ${r.name.padEnd(32)} ${ops.length} BT  ${realOps.length} Real`)
}

// ── 2. PORTFÓLIOS DO LAB ───────────────────────────────────────────────────────
log('\n── Portfólios LAB ────────────────────────────────')
let portfolios = []
try {
  portfolios = db.prepare(`SELECT id, name, robots_config FROM portfolios ORDER BY name`).all()
  log(`  ${portfolios.length} portfólios encontrados`)
} catch { log('  Sem tabela portfolios') }

// ── 3. PORTFÓLIOS DE MENTORADOS ───────────────────────────────────────────────
log('\n── Portfólios Mentorados ─────────────────────────')
let mentPortfolios = []
try {
  mentPortfolios = db.prepare(`
    SELECT id, name, robots_json, capital_inicial, cor, logo, config_versions
    FROM mentorados_portfolios ORDER BY name
  `).all()
  log(`  ${mentPortfolios.length} portfólios encontrados`)
  mentPortfolios.forEach(p => log(`  ✓ ${p.name}`))
} catch { log('  Sem tabela mentorados_portfolios') }

// ── 4. OPERAÇÕES DO MY DASH ───────────────────────────────────────────────────
log('\n── Operações My Dash (dash_operations) ───────────')
let dashOps = []
try {
  dashOps = db.prepare(`
    SELECT abertura, fechamento, ativo, lado, qtd, res_op, res_op_pct
    FROM dash_operations
    ORDER BY abertura
  `).all()
  const uniq = new Set(dashOps.map(o => o.ativo)).size
  log(`  ${dashOps.length} operações | ${uniq} estratégias`)
} catch { log('  Sem tabela dash_operations') }

db.close()

// ── Resumo ─────────────────────────────────────────────────────────────────────
const totalOps  = robots.reduce((s, r) => s + r.operations.length, 0)
const totalReal = robots.reduce((s, r) => s + r.realOps.length, 0)
console.log(`\n── Resumo ─────────────────────────────────────────`)
console.log(`   Robôs:                  ${robots.length}`)
console.log(`   Portfólios LAB:         ${portfolios.length}`)
console.log(`   Portfólios Mentorados:  ${mentPortfolios.length}`)
console.log(`   Ops backtest:           ${totalOps.toLocaleString('pt-BR')}`)
console.log(`   Ops conta real:         ${totalReal.toLocaleString('pt-BR')}`)
console.log(`   Ops My Dash:            ${dashOps.length.toLocaleString('pt-BR')}`)
console.log(`───────────────────────────────────────────────────\n`)

if (DRY_RUN) { log('--dry-run: nenhum arquivo gerado.'); process.exit(0) }

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

// Salvar os 4 arquivos
const files = [
  { name: 'robots.json',                data: robots },
  { name: 'portfolios.json',            data: portfolios },
  { name: 'mentorados-portfolios.json', data: mentPortfolios },
  { name: 'mentorados-ops.json',        data: dashOps },
]

for (const f of files) {
  const filePath = path.join(OUT_DIR, f.name)
  fs.writeFileSync(filePath, JSON.stringify(f.data, null, 2))
  const kb = (fs.statSync(filePath).size / 1024).toFixed(0)
  log(`✅ ${f.name.padEnd(35)} → ${filePath} (${kb} KB)`)
}

log(`\nConcluído em: ${new Date().toLocaleString('pt-BR')}`)
console.log('\n📋 Próximo passo: GitHub Desktop → Commit → Push\n')
