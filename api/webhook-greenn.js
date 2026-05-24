/**
 * api/webhook-greenn.js — Vercel Serverless Function
 * Recebe pagamento da Greenn → gera chave M6015 → envia email
 */

import crypto from 'crypto'

const SECRET = 'robot-analyzer-secret-2026'
const RESEND_KEY = process.env.RESEND_API_KEY
const ADMIN_EMAIL = 'tradequantlab@gmail.com'
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'tql2026admin'

// ── Mapa de produtos Greenn → tier/plano ───────────────────────────────────
// Configure os IDs dos seus produtos na Greenn como variáveis de ambiente
const PRODUCTS = {
  [process.env.GREENN_FREE]:             { tier:'free',  plan:'free',       label:'Free',            days: 36500 },
  [process.env.GREENN_PRO_MENSAL]:       { tier:'pro',   plan:'monthly',    label:'Pro Mensal',       days: 35   },
  [process.env.GREENN_PRO_TRIMESTRAL]:   { tier:'pro',   plan:'quarterly',  label:'Pro Trimestral',   days: 100  },
  [process.env.GREENN_PRO_SEMESTRAL]:    { tier:'pro',   plan:'semiannual', label:'Pro Semestral',    days: 210  },
  [process.env.GREENN_PRO_ANUAL]:        { tier:'pro',   plan:'annual',     label:'Pro Anual',        days: 395  },
  [process.env.GREENN_DEV_MENSAL]:       { tier:'dev',   plan:'monthly',    label:'Dev Mensal',       days: 35   },
  [process.env.GREENN_DEV_TRIMESTRAL]:   { tier:'dev',   plan:'quarterly',  label:'Dev Trimestral',   days: 100  },
  [process.env.GREENN_DEV_SEMESTRAL]:    { tier:'dev',   plan:'semiannual', label:'Dev Semestral',    days: 210  },
  [process.env.GREENN_DEV_ANUAL]:        { tier:'dev',   plan:'annual',     label:'Dev Anual',        days: 395  },
}

// ── Gera chave M6015 ───────────────────────────────────────────────────────
function generateKey({ client, tier, plan, expiry }) {
  const payload = { client, tier, plan, expiry }
  const p64 = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g,'')
  const sig  = crypto.createHmac('sha256', SECRET).update(p64).digest('hex').slice(0,16).toUpperCase()
  const comb = Buffer.from(`${p64}|${sig}`).toString('base64').replace(/=/g,'')
  return 'M6015-' + (comb.match(/.{1,6}/g)||[comb]).join('-')
}

// ── Calcula data de expiração ──────────────────────────────────────────────
function calcExpiry(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ── Envia email via Resend ─────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Trade Quant Lab <onboarding@resend.dev>', to, subject, html })
  })
  return res.json()
}

// ── Email para o cliente ───────────────────────────────────────────────────
function clientEmailHtml({ name, key, tier, label, expiry }) {
  const tierLabels = { free:'Free', pro:'Pro', dev:'Dev', ultra:'Ultra' }
  const expiryText = expiry ? `Válida até: <strong>${expiry}</strong>` : 'Licença vitalícia'
  return `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#080c12;color:#e8edf5;padding:40px 20px;margin:0">
<div style="max-width:600px;margin:0 auto;background:#0f1520;border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#00d4aa22,#0f1520);padding:40px;text-align:center;border-bottom:1px solid #1e2535">
    <div style="font-size:32px;font-weight:900;letter-spacing:-1px">Trade Quant <span style="color:#00d4aa">Lab</span></div>
    <div style="color:#6b7a99;margin-top:6px;font-size:14px">by Frantiesco Trader · Método 6015</div>
  </div>
  <div style="padding:40px">
    <p style="font-size:18px;font-weight:700;margin:0 0 8px">Olá, ${name}! 👋</p>
    <p style="color:#6b7a99;margin:0 0 32px">Seu acesso ao Trade Quant Lab está pronto. Abaixo estão todas as informações para começar.</p>

    <div style="background:#080c12;border:1px solid #1e2535;border-radius:12px;padding:24px;margin-bottom:24px">
      <div style="font-size:11px;color:#6b7a99;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Plano ativado</div>
      <div style="font-size:22px;font-weight:800;color:#00d4aa">${label}</div>
      <div style="font-size:13px;color:#6b7a99;margin-top:4px">${expiryText}</div>
    </div>

    <div style="background:#080c12;border:1px solid #1e2535;border-radius:12px;padding:24px;margin-bottom:32px">
      <div style="font-size:11px;color:#6b7a99;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Sua chave de licença</div>
      <div style="font-family:monospace;font-size:14px;color:#00d4aa;word-break:break-all;background:#0f1520;padding:16px;border-radius:8px;border:1px solid #00d4aa33">${key}</div>
      <div style="font-size:12px;color:#6b7a99;margin-top:10px">⚠ Guarde esta chave. Ela é única e pessoal.</div>
    </div>

    <div style="background:#080c12;border:1px solid #1e2535;border-radius:12px;padding:24px;margin-bottom:32px">
      <div style="font-size:14px;font-weight:700;margin-bottom:16px">Como ativar em 3 passos</div>
      ${[
        ['1','Baixe o Trade Quant Lab','tradequantlab.com.br/download'],
        ['2','Instale e abra o software','Siga as instruções de instalação'],
        ['3','Cole sua chave em Configurações → Licença','Pronto! Acesso liberado'],
      ].map(([n,t,d])=>`
      <div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:12px">
        <div style="width:28px;height:28px;border-radius:50%;background:#00d4aa22;border:1px solid #00d4aa44;color:#00d4aa;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${n}</div>
        <div><div style="font-weight:600;font-size:14px">${t}</div><div style="color:#6b7a99;font-size:12px;margin-top:2px">${d}</div></div>
      </div>`).join('')}
    </div>

    <div style="text-align:center;margin-bottom:32px">
      <a href="https://www.tradequantlab.com.br/download" style="display:inline-block;background:#00d4aa;color:#000;padding:14px 32px;border-radius:10px;font-weight:800;font-size:16px;text-decoration:none">
        Baixar Trade Quant Lab →
      </a>
    </div>

    <div style="border-top:1px solid #1e2535;padding-top:24px;font-size:13px;color:#6b7a99;text-align:center">
      Dúvidas? Fale conosco pelo WhatsApp:<br>
      <a href="https://wa.me/5553999010262" style="color:#00d4aa;text-decoration:none;font-weight:600">+55 53 99901-0262</a>
    </div>
  </div>
</div>
</body></html>`
}

// ── Handler principal ──────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Rota admin (GET protegido por senha)
  if (req.method === 'GET') {
    const pass = req.headers['x-admin-password'] || req.query.p
    if (pass !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' })
    // Buscar emails enviados no Resend
    const r = await fetch('https://api.resend.com/emails?limit=100', {
      headers: { 'Authorization': `Bearer ${RESEND_KEY}` }
    })
    const data = await r.json()
    return res.status(200).json(data)
  }

  if (req.method !== 'POST') return res.status(405).end()

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    console.log('[webhook-greenn] payload:', JSON.stringify(body))

    // Extrair dados do payload da Greenn
    const event       = body?.event || body?.type || ''
    const buyerName   = body?.customer?.name || body?.data?.buyer?.name || body?.buyer?.name || 'Cliente'
    const buyerEmail  = body?.customer?.email || body?.data?.buyer?.email || body?.buyer?.email || ''
    const buyerCPF    = (body?.customer?.cpf || body?.customer?.document || body?.data?.buyer?.document || '').replace(/\D/g,'')
    const productId   = String(body?.product?.id || body?.data?.product?.id || body?.plan?.id || '')
    const amount      = body?.payment?.amount || body?.data?.payment?.amount || 0

    // Ignorar eventos que não são aprovação
    const isApproved = event.toLowerCase().includes('approv') || event.toLowerCase().includes('paid') || event.toLowerCase().includes('ativo') || event === 'sale_approved' || event === 'purchase.approved'
    if (!isApproved) {
      console.log('[webhook-greenn] evento ignorado:', event)
      return res.status(200).json({ message: `Event '${event}' ignored` })
    }

    if (!buyerEmail) return res.status(400).json({ error: 'Email não encontrado no payload' })

    // Encontrar produto
    const prod = PRODUCTS[productId] || { tier:'pro', plan:'monthly', label:'Pro Mensal', days:35 }
    const expiry = calcExpiry(prod.days)
    const key    = generateKey({ client: buyerName, tier: prod.tier, plan: prod.plan, expiry })

    console.log('[webhook-greenn] gerando chave para:', buyerEmail, '| tier:', prod.tier, '| expiry:', expiry)

    // Email para o cliente
    await sendEmail({
      to: buyerEmail,
      subject: `🎯 Sua licença Trade Quant Lab — ${prod.label}`,
      html: clientEmailHtml({ name: buyerName, key, tier: prod.tier, label: prod.label, expiry })
    })

    // Notificação para o admin
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `[TQL] Novo assinante: ${buyerName} — ${prod.label}`,
      html: `
        <div style="font-family:sans-serif;padding:20px">
          <h2>Novo assinante! 🎉</h2>
          <table style="border-collapse:collapse;width:100%">
            ${[
              ['Nome', buyerName],
              ['Email', buyerEmail],
              ['CPF', buyerCPF || '—'],
              ['Plano', prod.label],
              ['Tier', prod.tier],
              ['Validade', expiry],
              ['Produto ID', productId],
              ['Valor', `R$ ${(amount/100).toFixed(2)}`],
              ['Chave', key],
              ['Data', new Date().toLocaleString('pt-BR')],
            ].map(([l,v])=>`<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;background:#f5f5f5;width:140px">${l}</td><td style="padding:8px;border:1px solid #ddd;font-family:monospace">${v}</td></tr>`).join('')}
          </table>
        </div>
      `
    })

    return res.status(200).json({ success: true, tier: prod.tier, email: buyerEmail })
  } catch(e) {
    console.error('[webhook-greenn] erro:', e)
    return res.status(500).json({ error: e.message })
  }
}
