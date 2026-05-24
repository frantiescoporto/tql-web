/**
 * api/admin.js — Painel de assinantes protegido por senha
 * Acesso: GET /api/admin?p=SENHA
 */

const RESEND_KEY   = process.env.RESEND_API_KEY
const ADMIN_PASS   = process.env.ADMIN_PASSWORD || 'tql2026admin'

export default async function handler(req, res) {
  // Verificar senha
  const pass = req.headers['x-admin-password'] || req.query.p
  if (pass !== ADMIN_PASS) {
    return res.status(401).send(`
      <html><body style="font-family:sans-serif;background:#080c12;color:#e8edf5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
        <form method="GET" style="background:#0f1520;padding:40px;border-radius:16px;border:1px solid #1e2535;min-width:320px">
          <h2 style="margin:0 0 24px;color:#00d4aa">Trade Quant Lab</h2>
          <h3 style="margin:0 0 20px;font-weight:400;color:#6b7a99">Painel de Assinantes</h3>
          <input name="p" type="password" placeholder="Senha de acesso"
            style="width:100%;padding:10px;border-radius:8px;border:1px solid #1e2535;background:#080c12;color:#e8edf5;font-size:14px;margin-bottom:12px;box-sizing:border-box"/>
          <button type="submit" style="width:100%;padding:12px;background:#00d4aa;color:#000;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer">
            Entrar
          </button>
        </form>
      </body></html>
    `)
  }

  // Buscar emails enviados via Resend
  const r = await fetch('https://api.resend.com/emails?limit=100', {
    headers: { 'Authorization': `Bearer ${RESEND_KEY}` }
  })
  const data = await r.json()
  const emails = (data?.data || [])
    .filter(e => e.subject?.includes('Sua licença'))
    .map(e => ({
      data:    new Date(e.created_at).toLocaleString('pt-BR'),
      email:   Array.isArray(e.to) ? e.to[0] : e.to,
      plano:   e.subject?.replace('🎯 Sua licença Trade Quant Lab — ','') || '—',
      status:  e.last_event || '—',
      id:      e.id,
    }))
    .sort((a,b) => new Date(b.data) - new Date(a.data))

  res.setHeader('Content-Type', 'text/html')
  return res.status(200).send(`
<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>TQL Admin</title>
<style>
* { box-sizing:border-box; margin:0; padding:0 }
body { font-family:-apple-system,sans-serif; background:#080c12; color:#e8edf5; padding:32px }
h1 { font-size:22px; font-weight:800; margin-bottom:4px }
.sub { color:#6b7a99; font-size:14px; margin-bottom:32px }
.card { background:#0f1520; border:1px solid #1e2535; border-radius:12px; overflow:hidden }
table { width:100%; border-collapse:collapse; font-size:13px }
th { background:#131b28; padding:10px 16px; text-align:left; font-size:11px; color:#6b7a99; text-transform:uppercase; letter-spacing:.05em }
td { padding:12px 16px; border-bottom:1px solid #1e2535 }
tr:last-child td { border-bottom:none }
tr:hover td { background:#0d1520 }
.badge { display:inline-block; padding:2px 10px; border-radius:99px; font-size:11px; font-weight:700 }
.sent { background:rgba(52,212,126,0.15); color:#34d47e }
.stat { background:#131b28; border-radius:10px; padding:20px 24px; display:inline-block; margin-right:12px; margin-bottom:24px }
.stat-v { font-size:28px; font-weight:900; color:#00d4aa }
.stat-l { font-size:12px; color:#6b7a99; margin-top:2px }
</style></head><body>
<div style="max-width:1100px;margin:0 auto">
  <div style="margin-bottom:32px">
    <h1>Trade Quant Lab <span style="color:#00d4aa">Admin</span></h1>
    <div class="sub">Painel de assinantes · ${emails.length} licenças emitidas</div>
    <div>
      <div class="stat"><div class="stat-v">${emails.length}</div><div class="stat-l">Total de licenças</div></div>
      <div class="stat"><div class="stat-v" style="color:#4f8ef7">${emails.filter(e=>e.plano.includes('Pro')).length}</div><div class="stat-l">Plano Pro</div></div>
      <div class="stat"><div class="stat-v" style="color:#00d4aa">${emails.filter(e=>e.plano.includes('Dev')).length}</div><div class="stat-l">Plano Dev</div></div>
    </div>
  </div>
  <div class="card">
    <table>
      <thead><tr><th>#</th><th>Data</th><th>Email</th><th>Plano</th><th>Status</th></tr></thead>
      <tbody>
        ${emails.length === 0
          ? '<tr><td colspan="5" style="text-align:center;color:#6b7a99;padding:40px">Nenhuma licença emitida ainda</td></tr>'
          : emails.map((e,i) => `
          <tr>
            <td style="color:#6b7a99">${i+1}</td>
            <td>${e.data}</td>
            <td style="font-family:monospace">${e.email}</td>
            <td><span class="badge" style="background:rgba(79,142,247,0.15);color:#4f8ef7">${e.plano}</span></td>
            <td><span class="badge sent">${e.status}</span></td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
  <div style="margin-top:16px;font-size:12px;color:#6b7a99;text-align:right">
    Atualizado em: ${new Date().toLocaleString('pt-BR')} · 
    <a href="?p=${pass}" style="color:#00d4aa">Atualizar</a>
  </div>
</div>
</body></html>
  `)
}
