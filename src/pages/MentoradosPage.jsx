/**
 * MentoradosPage.jsx
 *
 * Logos — coloque as imagens em public/logos/:
 *   logo-6015.png   → Método 6015 (mentoria)
 *   logo-ontick.png → OnTick Invest
 *   logo-avel.png   → Avel
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Chart, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, Filler,
} from 'chart.js'

try { Chart.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Filler) } catch (_) {}

// ─── Logos ─────────────────────────────────────────────────────────────────────
// Resolve o caminho base correto para funcionar tanto no servidor Vite (dev)
// quanto no Electron com loadFile (produção com file://)
function _pubBase() {
  try {
    // Remove o hash (#/rota) e o nome do arquivo (index.html) para obter o diretório
    const href = window.location.href.split('#')[0]
    return href.replace(/[^/\\]*$/, '')   // ex: "file:///C:/dist/" ou "http://localhost:5173/"
  } catch (_) { return '' }
}
const _BASE = _pubBase()

const LOGO_OPTIONS = [
  { id: '6015',       label: 'Método 6015',   src: `${_BASE}logos/logo-6015.png`       },
  { id: 'ontick',     label: 'OnTick Invest',  src: `${_BASE}logos/logo-ontick.png`     },
  { id: 'avel',       label: 'Avel',           src: `${_BASE}logos/logo-avel.png`       },
  { id: 'frantiesco', label: 'Frantiesco',     src: `${_BASE}logos/logo-frantiesco.png` },
  { id: 'liberdade',  label: 'Liberdade',      src: `${_BASE}logos/logo-liberdade.png`  },
]
function getLogoSrc(logoId) { return LOGO_OPTIONS.find(l => l.id === logoId)?.src || null }

// ─── Formatadores ──────────────────────────────────────────────────────────────
function fmt(v, d = 2)  { if (v == null || isNaN(v)) return '—'; return v.toLocaleString('pt-BR', { minimumFractionDigits:d, maximumFractionDigits:d }) }
function fmtPct(v)       { return v == null || isNaN(v) ? '—' : `${fmt(v)}%` }
function fmtBRL(v)       { return v == null || isNaN(v) ? '—' : `R$ ${fmt(v)}` }
function fmtPctSm(v)     { return v == null || isNaN(v) ? '' : `${v >= 0 ? '+' : ''}${fmt(v, 1)}%` }
function colorVal(v)     { return (v || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }
function colorRaw(v)     { return (v || 0) >= 0 ? '#34d47e' : '#f06060' }
const MN = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// ─── Helpers de data ───────────────────────────────────────────────────────────
function opSortKey(d) {
  if (!d) return ''
  if (d.includes('/')) { const p=d.split('/'),y=(p[2]||'').split(' ')[0].padStart(4,'0'); return `${y}${(p[1]||'').padStart(2,'0')}${(p[0]||'').padStart(2,'0')}` }
  return (d.split('T')[0]||'').replace(/-/g,'')
}
function opToMonthKey(d) {
  if (!d) return null
  if (d.includes('/')) { const p=d.split('/'); return `${p[1]}/${((p[2]||'').split(' ')[0]||'').slice(-2)}` }
  const p=d.split('-'); return `${p[1]}/${(p[0]||'').slice(-2)}`
}
function opToYear(d) {
  if (!d) return null
  if (d.includes('/')) return ((d.split('/')[2]||'').split(' ')[0]||'').slice(0,4)
  return (d.split('-')[0]||'').slice(0,4)
}
function opToDate(d) {
  if (!d) return null
  try {
    if (d.includes('/')) {
      // "DD/MM/YYYY HH:MM:SS" → new Date(year, month-1, day) em horário LOCAL
      const p = d.split('/')
      const y = parseInt((p[2]||'').split(' ')[0])
      return new Date(y, parseInt(p[1]||'1')-1, parseInt(p[0]||'1'))
    }
    // "YYYY-MM-DD" → evita UTC usando construtor local
    const parts = d.split('T')[0].split('-')
    return new Date(parseInt(parts[0]), parseInt(parts[1]||'1')-1, parseInt(parts[2]||'1'))
  } catch { return null }
}
function todayStr() { const n=new Date(); return `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()}` }
function todaySortKey() { const n=new Date(); return `${n.getFullYear()}${String(n.getMonth()+1).padStart(2,'0')}${String(n.getDate()).padStart(2,'0')}` }

// ─── Filtros por período ───────────────────────────────────────────────────────
function filterPeriod(ops, period) {
  const now=new Date(), today=new Date(now.getFullYear(),now.getMonth(),now.getDate())
  return ops.filter(o => {
    const d=opToDate(o.abertura); if (!d) return false
    switch(period) {
      case 'Hoje':      return d>=today && d<new Date(today.getTime()+86400000)
      case 'Semana':  { const dow=today.getDay(),mon=new Date(today.getTime()-(dow===0?6:dow-1)*86400000); return d>=mon }
      case 'Mês':       return d>=new Date(today.getFullYear(),today.getMonth(),1)
      case 'Trimestre': return d>=new Date(today.getFullYear(),Math.floor(today.getMonth()/3)*3,1)
      case 'Semestre':  return d>=new Date(today.getFullYear(),today.getMonth()<6?0:6,1)
      case 'Ano':       return d>=new Date(today.getFullYear(),0,1)
      default: return true
    }
  })
}

// ─── Robots config — suporte a versões históricas ─────────────────────────────
function parseRobots(json) {
  try {
    const p=JSON.parse(json||'[]'); if (!p.length) return []
    if (typeof p[0]==='string') return p.map(name=>({name,lotes:1}))
    return p.map(r=>({name:r.name||String(r),lotes:Number(r.lotes)||1}))
  } catch { return [] }
}

// Retorna o array de versões de configuração de um portfólio
// Compatível com portfólios antigos que só têm robots_json
function getConfigVersions(portfolio) {
  try {
    const cv = JSON.parse(portfolio.config_versions || '[]')
    if (cv.length > 0) return cv
  } catch {}
  // fallback: robots_json antigo como versão única desde o início
  return [{ valid_from: null, robots_json: portfolio.robots_json || '[]' }]
}

// Configuração atual (versão mais recente)
function getCurrentRobots(portfolio) {
  const versions = getConfigVersions(portfolio)
  const sorted = [...versions].sort((a,b) => (b.valid_from||'').localeCompare(a.valid_from||''))
  return parseRobots(sorted[0]?.robots_json || '[]')
}

// Todos os nomes de estratégias em todas as versões (para buscar ops)
function getAllStrategyNames(portfolio) {
  const names = new Set()
  getConfigVersions(portfolio).forEach(v => parseRobots(v.robots_json).forEach(r => names.add(r.name)))
  return [...names]
}

// Aplica os lotes corretos por data da operação, respeitando o histórico de versões
function applyLotesVersioned(ops, configVersions) {
  if (!ops.length || !configVersions || !configVersions.length) return ops

  // Versão única "all time" → caminho rápido (sem filtro por data)
  if (configVersions.length === 1 && !configVersions[0].valid_from) {
    const rc  = parseRobots(configVersions[0].robots_json)
    const map = {}; rc.forEach(r => { map[r.name] = r.lotes||1 })
    // Filtra só ops de estratégias que existem nessa versão + aplica lotes
    return ops
      .filter(op => map[op.ativo] !== undefined)
      .map(op => {
        const l = map[op.ativo]
        if (!l || l === 1) return op
        return {...op, res_op:(op.res_op||0)*l, res_op_pct:(op.res_op_pct||0)*l}
      })
  }

  // Multi-versão: para cada op, encontra a versão ativa naquela data
  return ops.filter(op => {
    // Descobre qual versão estava ativa na data da operação
    const opKey = opSortKey(op.abertura)
    const valid = configVersions
      .filter(v => !v.valid_from || v.valid_from <= opKey)
      .sort((a,b) => (b.valid_from||'').localeCompare(a.valid_from||''))
    if (!valid.length) return false  // nenhuma versão ativa → exclui op
    const rc  = parseRobots(valid[0].robots_json)
    const map = {}; rc.forEach(r => { map[r.name] = r.lotes||1 })
    // A estratégia precisa existir na versão ativa para a op ser incluída
    return map[op.ativo] !== undefined
  }).map(op => {
    const opKey = opSortKey(op.abertura)
    const valid = configVersions
      .filter(v => !v.valid_from || v.valid_from <= opKey)
      .sort((a,b) => (b.valid_from||'').localeCompare(a.valid_from||''))
    const rc    = parseRobots(valid[0].robots_json)
    const lotes = rc.find(r => r.name===op.ativo)?.lotes || 1
    if (lotes === 1) return op
    return {...op, res_op:(op.res_op||0)*lotes, res_op_pct:(op.res_op_pct||0)*lotes}
  })
}

// ─── Métricas — DD calculado sobre capital_inicial ────────────────────────────
function calcMetrics(ops, cap = 0) {
  if (!ops || !ops.length) return null
  const total    = ops.reduce((s,o) => s+(o.res_op||0), 0)
  const wins     = ops.filter(o => (o.res_op||0) > 0)
  const losses   = ops.filter(o => (o.res_op||0) < 0)
  const winRate  = (wins.length/ops.length)*100
  const avgWin   = wins.length   ? wins.reduce((s,o)=>s+o.res_op,0)/wins.length   : 0
  const avgLoss  = losses.length ? Math.abs(losses.reduce((s,o)=>s+o.res_op,0)/losses.length) : 0
  const grossW   = wins.reduce((s,o)=>s+o.res_op,0)
  const grossL   = Math.abs(losses.reduce((s,o)=>s+o.res_op,0))
  const pf       = grossL > 0 ? grossW/grossL : wins.length > 0 ? 999 : 0
  const avgTrade = total/ops.length
  const sorted   = [...ops].sort((a,b) => opSortKey(a.abertura).localeCompare(opSortKey(b.abertura)))

  // DD calculado SEMPRE sobre o capital_inicial (não sobre o peak)
  let equity = cap, peak = cap, ddMax = 0, ddAtual = 0
  sorted.forEach(op => {
    equity += op.res_op||0
    if (equity > peak) peak = equity
    const dd = Math.max(0, peak - equity)
    if (dd > ddMax) ddMax = dd
    ddAtual = dd
  })

  // % de DD relativo ao capital_inicial (não ao peak)
  const ddMaxPct  = cap > 0 ? (ddMax  / cap) * 100 : null
  const ddAtualPct = cap > 0 ? (ddAtual / cap) * 100 : null

  const byMonth  = {}
  ops.forEach(op => { const k=opToMonthKey(op.abertura); if(k) byMonth[k]=(byMonth[k]||0)+(op.res_op||0) })
  const mVals    = Object.values(byMonth)
  const avgMonth = mVals.length ? mVals.reduce((a,b)=>a+b,0)/mVals.length : 0
  const nMonths  = mVals.length
  const period   = sorted.length >= 2 ? {from:(sorted[0].abertura||'').slice(0,10),to:(sorted[sorted.length-1].abertura||'').slice(0,10)} : null

  return { total, nOps:ops.length, winRate, avgWin, avgLoss, pf, avgTrade, ddMax, ddMaxPct, ddAtual, ddAtualPct, avgMonth, nMonths, period, cap:cap>0 }
}

function buildMonthly(ops) {
  const map = {}
  ops.forEach(op => { const k=opToMonthKey(op.abertura); if(k) map[k]=(map[k]||0)+(op.res_op||0) })
  const sorted = Object.entries(map).sort((a,b) => {
    const [ma,ya]=a[0].split('/'), [mb,yb]=b[0].split('/')
    return (Number(ya)*12+Number(ma))-(Number(yb)*12+Number(mb))
  })
  return { labels:sorted.map(([k])=>k), data:sorted.map(([,v])=>v) }
}

// ─── ErrorBoundary ─────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state={error:null} }
  static getDerivedStateFromError(e) { return {error:e} }
  render() {
    if (this.state.error) return (
      <div style={{padding:20,background:'rgba(240,96,96,0.08)',border:'1px solid rgba(240,96,96,0.3)',borderRadius:8,color:'var(--danger)',fontSize:13}}>
        <strong>⚠ Erro:</strong> {this.state.error.message}
        <button className="btn sm" style={{marginLeft:12}} onClick={()=>this.setState({error:null})}>Tentar novamente</button>
      </div>
    )
    return this.props.children
  }
}

// ─── MetricCard ────────────────────────────────────────────────────────────────
function MetricCard({label,value,sub,color,accent}) {
  return (
    <div className="card" style={{padding:'16px 20px',borderLeft:accent?`3px solid ${accent}`:undefined}}>
      <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color:color||'var(--text)'}}>{value}</div>
      {sub && <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>{sub}</div>}
    </div>
  )
}

// ─── LogoBadge — exibe o logo do portfólio com fallback de texto ─────────────
function LogoBadge({logo, size=24}) {
  const opt = LOGO_OPTIONS.find(l => l.id === logo)
  const [err, setErr] = React.useState(false)
  if (!opt) return null
  if (opt.src && !err) {
    return (
      <img
        src={opt.src}
        alt={opt.label}
        style={{ height:size, width:'auto', maxWidth: size*4, objectFit:'contain', display:'block' }}
        onError={() => setErr(true)}
      />
    )
  }
  return (
    <span style={{ fontSize:Math.max(9,size*0.45), fontWeight:700, color:'var(--accent)', background:'rgba(79,142,247,0.12)', padding:'1px 7px', borderRadius:4, whiteSpace:'nowrap', border:'1px solid rgba(79,142,247,0.25)' }}>
      {opt.label.slice(0,3).toUpperCase()}
    </span>
  )
}

// ─── StrategyChips — tags de estratégias, usadas FORA dos cards ───────────────
function StrategyChips({robotsConfig, opsWithData, accent}) {
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:'4px 8px',marginTop:10}}>
      {robotsConfig.map((r,i) => (
        <span key={i} style={{
          display:'inline-flex',alignItems:'center',gap:3,
          fontSize:11,padding:'3px 9px',borderRadius:12,
          background:'rgba(255,255,255,0.05)',
          border:`1px solid ${opsWithData&&!opsWithData.has(r.name)?'rgba(245,166,35,0.4)':'rgba(255,255,255,0.1)'}`,
          color: opsWithData&&!opsWithData.has(r.name) ? 'var(--warning)' : 'var(--text-muted)',
        }}>
          {r.name}
          {r.lotes !== 1 && <sup style={{fontSize:9,marginLeft:2,opacity:.7}}>{r.lotes}×</sup>}
        </span>
      ))}
    </div>
  )
}

// ─── Gráfico Mensal ────────────────────────────────────────────────────────────
function MonthlyBarChart({ops}) {
  const ref=useRef(null),chart=useRef(null)
  const years=useMemo(()=>{const s=new Set();ops.forEach(o=>{const y=opToYear(o.abertura);if(y)s.add(Number(y))});return[...s].sort()},[ops])
  const[year,setYear]=useState(()=>new Date().getFullYear())
  useEffect(()=>{if(years.length&&!years.includes(year))setYear(years[years.length-1])},[years])
  const{labels,data}=useMemo(()=>{const{labels:al,data:ad}=buildMonthly(ops);const yy=String(year).slice(2);const r={labels:[],data:[]};al.forEach((l,i)=>{if(l.endsWith(yy)){r.labels.push(l);r.data.push(ad[i])}});return r},[ops,year])
  useEffect(()=>{
    if(!ref.current)return;if(chart.current){chart.current.destroy();chart.current=null};if(!labels.length)return
    chart.current=new Chart(ref.current.getContext('2d'),{type:'bar',data:{labels,datasets:[{data,backgroundColor:data.map(v=>v>=0?'rgba(52,212,126,0.75)':'rgba(240,96,96,0.75)'),borderColor:data.map(v=>v>=0?'#34d47e':'#f06060'),borderWidth:1,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` R$ ${fmt(c.raw)}`}}},scales:{x:{ticks:{color:'#94a3b8'},grid:{color:'rgba(255,255,255,0.04)'}},y:{ticks:{color:'#94a3b8',callback:v=>`R$${fmt(v,0)}`},grid:{color:'rgba(255,255,255,0.06)'}}}}})
    return()=>{if(chart.current){chart.current.destroy();chart.current=null}}
  },[labels,data])
  return(<div>{years.length>1&&<div style={{display:'flex',gap:6,marginBottom:14}}>{years.map(y=><button key={y} className={`btn sm${y===year?' primary':''}`} onClick={()=>setYear(y)}>{y}</button>)}</div>}{!labels.length?<div style={{padding:'32px 0',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>Sem dados para {year}.</div>:<div style={{position:'relative',height:220}}><canvas ref={ref}/></div>}</div>)
}

// ─── Curva de Capital ──────────────────────────────────────────────────────────
function EquityChart({ops,cap}) {
  const ref=useRef(null),chart=useRef(null)
  const{labels,data}=useMemo(()=>{const sorted=[...ops].sort((a,b)=>opSortKey(a.abertura).localeCompare(opSortKey(b.abertura)));let eq=cap||0;return{labels:sorted.map(o=>(o.abertura||'').slice(0,10)),data:sorted.map(o=>{eq+=(o.res_op||0);return eq})}},[ops,cap])
  useEffect(()=>{
    if(!ref.current)return;if(chart.current){chart.current.destroy();chart.current=null};if(!data.length)return
    const last=data[data.length-1],base=cap||0,col=last>=base?'#34d47e':'#f06060',fill=last>=base?'rgba(52,212,126,0.08)':'rgba(240,96,96,0.08)'
    chart.current=new Chart(ref.current.getContext('2d'),{type:'line',data:{labels,datasets:[{data,borderColor:col,backgroundColor:fill,fill:true,tension:0.3,pointRadius:data.length>200?0:2,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${fmtBRL(c.raw)}`}}},scales:{x:{ticks:{color:'#94a3b8',maxTicksLimit:8},grid:{display:false}},y:{ticks:{color:'#94a3b8',callback:v=>`R$${fmt(v,0)}`},grid:{color:'rgba(255,255,255,0.06)'}}}}})
    return()=>{if(chart.current){chart.current.destroy();chart.current=null}}
  },[labels,data])
  if(!data.length)return null
  return<div style={{position:'relative',height:240}}><canvas ref={ref}/></div>
}

// ─── Tabela mensal ─────────────────────────────────────────────────────────────
function MonthlyTable({ops}) {
  const{labels,data}=useMemo(()=>buildMonthly(ops),[ops])
  const years=useMemo(()=>{const s=new Set();ops.forEach(o=>{const y=opToYear(o.abertura);if(y)s.add(y)});return[...s].sort().reverse()},[ops])
  const[year,setYear]=useState(()=>String(new Date().getFullYear()))
  useEffect(()=>{if(years.length&&!years.includes(year))setYear(years[0])},[years])
  let running=0
  const rows=labels.map((l,i)=>{running+=data[i];return{label:l,val:data[i],accum:running}})
  const filtered=rows.filter(r=>r.label.endsWith(year.slice(-2))),yearTotal=filtered.reduce((s,r)=>s+r.val,0)
  return(<div>{years.length>1&&<div style={{display:'flex',gap:6,marginBottom:12}}>{years.map(y=><button key={y} className={`btn sm${y===year?' primary':''}`} onClick={()=>setYear(y)}>{y}</button>)}</div>}<div className="tbl-wrap"><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{color:'var(--text-muted)'}}>{['Mês','Resultado','Acumulado'].map((h,i)=><th key={h} style={{padding:'8px 14px',textAlign:i===0?'left':'right',fontWeight:500,borderBottom:'1px solid var(--border)'}}>{h}</th>)}</tr></thead><tbody>{filtered.map((r,i)=><tr key={i} style={{borderBottom:'1px solid rgba(255,255,255,0.03)'}}><td style={{padding:'7px 14px',color:'var(--text-muted)'}}>{r.label}</td><td style={{padding:'7px 14px',textAlign:'right',fontWeight:600,color:colorVal(r.val)}}>{fmtBRL(r.val)}</td><td style={{padding:'7px 14px',textAlign:'right',color:colorVal(r.accum)}}>{fmtBRL(r.accum)}</td></tr>)}{!filtered.length&&<tr><td colSpan={3} style={{padding:'16px 14px',color:'var(--text-hint)',textAlign:'center',fontSize:13}}>Sem dados para {year}.</td></tr>}</tbody>{filtered.length>0&&<tfoot><tr style={{borderTop:'1px solid var(--border)'}}><td style={{padding:'8px 14px',fontWeight:600,fontSize:12,color:'var(--text-muted)'}}>Total {year}</td><td style={{padding:'8px 14px',textAlign:'right',fontWeight:700,color:colorVal(yearTotal)}}>{fmtBRL(yearTotal)}</td><td/></tr></tfoot>}</table></div></div>)
}

// ─── Breakdown estratégia ──────────────────────────────────────────────────────
function RobotBreakdown({ops,robotsConfig,accent}) {
  const rows=useMemo(()=>robotsConfig.map(rc=>{const rOps=ops.filter(o=>o.ativo===rc.name);const total=rOps.reduce((s,o)=>s+(o.res_op||0),0);const wins=rOps.filter(o=>(o.res_op||0)>0).length;return{name:rc.name,lotes:rc.lotes,total,nOps:rOps.length,wr:rOps.length?(wins/rOps.length)*100:0}}).sort((a,b)=>b.total-a.total),[ops,robotsConfig])
  const grand=ops.reduce((s,o)=>s+(o.res_op||0),0)
  return(<div className="tbl-wrap"><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{color:'var(--text-muted)'}}>{['Estratégia','Lotes','Ops','Win Rate','Resultado','% do Total'].map((h,i)=><th key={h} style={{padding:'8px 14px',textAlign:i<2?'left':'right',fontWeight:500,borderBottom:'1px solid var(--border)'}}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=>{const pct=grand!==0?(r.total/Math.abs(grand))*100:0;return(<tr key={i} style={{borderBottom:'1px solid rgba(255,255,255,0.03)'}}><td style={{padding:'8px 14px'}}><span style={{display:'inline-block',width:8,height:8,borderRadius:2,background:accent,marginRight:8,verticalAlign:'middle'}}/>{r.name}{r.nOps===0&&<span style={{marginLeft:8,fontSize:10,color:'var(--text-hint)',background:'rgba(255,255,255,0.06)',padding:'1px 6px',borderRadius:8}}>sem ops</span>}</td><td style={{padding:'8px 14px',color:'var(--text-muted)',fontSize:12}}>{r.lotes}×</td><td style={{padding:'8px 14px',textAlign:'right',color:'var(--text-muted)'}}>{r.nOps||'—'}</td><td style={{padding:'8px 14px',textAlign:'right'}}>{r.nOps?fmtPct(r.wr):'—'}</td><td style={{padding:'8px 14px',textAlign:'right',fontWeight:600,color:colorVal(r.total)}}>{r.nOps?fmtBRL(r.total):'—'}</td><td style={{padding:'8px 14px',textAlign:'right',color:pct>=0?'var(--success)':'var(--danger)'}}>{r.nOps?`${pct>=0?'+':''}${fmt(pct)}%`:'—'}</td></tr>)})}</tbody></table></div>)
}

// ─── PrintModal ────────────────────────────────────────────────────────────────
function PrintModal({portfolio,ops,onClose}) {
  const cv      = useMemo(()=>getConfigVersions(portfolio),[portfolio])
  const scaled  = useMemo(()=>applyLotesVersioned(ops,cv),[ops,cv])
  const rc      = useMemo(()=>getCurrentRobots(portfolio),[portfolio])
  const metrics = useMemo(()=>calcMetrics(scaled,parseFloat(portfolio.capital_inicial)||0),[scaled,portfolio])
  const accent  = portfolio.cor||'#f5a623'
  const logoSrc = getLogoSrc(portfolio.logo)
  const years   = useMemo(()=>{const s=new Set();scaled.forEach(o=>{const y=opToYear(o.abertura);if(y)s.add(y)});return[...s].sort()},[scaled])
  const monthGrid=useMemo(()=>{
    const map={};scaled.forEach(op=>{const k=opToMonthKey(op.abertura);if(k)map[k]=(map[k]||0)+(op.res_op||0)})
    return years.map(y=>{const months=MN.map((name,mi)=>{const key=`${String(mi+1).padStart(2,'0')}/${y.slice(-2)}`;return{name,val:map[key]!==undefined?map[key]:null}});return{year:y,months,total:months.reduce((s,m)=>s+(m.val||0),0)}})
  },[scaled,years])
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:24,overflowY:'auto'}}>
      <button onClick={onClose} style={{position:'fixed',top:20,right:24,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff',borderRadius:8,padding:'7px 18px',cursor:'pointer',fontSize:13,zIndex:10}}>✕ Fechar</button>
      <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',position:'fixed',top:22,left:24}}>Tire um print desta tela para compartilhar</div>
      <div style={{background:'#0f172a',borderRadius:16,width:740,maxWidth:'100%',overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,0.7)'}}>
        <div style={{background:'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)',borderBottom:`4px solid ${accent}`,padding:'28px 32px'}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                {logoSrc ? <img src={logoSrc} style={{height:28,objectFit:'contain',borderRadius:4}} alt="logo"/> : <span style={{fontSize:18}}>🎯</span>}
                <span style={{color:'rgba(255,255,255,0.4)',fontSize:11,letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700}}>Mentorados · Trade Quant Lab</span>
              </div>
              <div style={{color:'#fff',fontSize:28,fontWeight:900,letterSpacing:'-0.5px',marginBottom:10}}>{portfolio.name}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'3px 8px'}}>
                {rc.map((r,i)=><span key={i} style={{fontSize:11,color:'rgba(255,255,255,0.45)',background:'rgba(255,255,255,0.06)',padding:'2px 8px',borderRadius:10}}>{r.name}{r.lotes!==1&&<sup style={{fontSize:8,opacity:.6,marginLeft:2}}>{r.lotes}×</sup>}</span>)}
              </div>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{color:colorRaw(metrics?.total),fontSize:36,fontWeight:900,letterSpacing:'-1px',lineHeight:1}}>{fmtBRL(metrics?.total)}</div>
              <div style={{color:'rgba(255,255,255,0.35)',fontSize:11,marginTop:4}}>resultado total</div>
              {metrics?.period&&<div style={{color:'rgba(255,255,255,0.3)',fontSize:10,marginTop:2}}>{metrics.period.from} → {metrics.period.to}</div>}
            </div>
          </div>
        </div>
        <div style={{background:'rgba(255,255,255,0.03)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'18px 32px',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
          {[{label:'Média Mensal',value:fmtBRL(metrics?.avgMonth),color:colorRaw(metrics?.avgMonth)},{label:'Win Rate',value:fmtPct(metrics?.winRate),color:'#4f8ef7'},{label:'Profit Factor',value:fmt(metrics?.pf),color:(metrics?.pf||0)>=1.5?'#34d47e':'#f5a623'},{label:'Operações',value:String(metrics?.nOps||0),color:'rgba(255,255,255,0.7)'}].map(m=>(
            <div key={m.label} style={{textAlign:'center',padding:'10px 4px',borderRadius:8,background:'rgba(255,255,255,0.03)'}}><div style={{fontSize:9,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:6}}>{m.label}</div><div style={{fontSize:20,fontWeight:800,color:m.color}}>{m.value}</div></div>
          ))}
        </div>
        <div style={{padding:'20px 32px 24px'}}>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:16}}>Resultado por Mês</div>
          {!monthGrid.length&&<div style={{color:'rgba(255,255,255,0.2)',fontSize:13,textAlign:'center',padding:20}}>Sem operações no My Dash para este portfólio.</div>}
          {monthGrid.map(({year,months,total})=>(
            <div key={year} style={{marginBottom:18}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}><span style={{fontSize:12,fontWeight:800,color:'rgba(255,255,255,0.7)'}}>{year}</span><div style={{flex:1,height:1,background:'rgba(255,255,255,0.08)'}}/><span style={{fontSize:13,fontWeight:800,color:total>=0?'#34d47e':'#f06060'}}>{fmtBRL(total)}</span></div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(12,1fr)',gap:3}}>
                {months.map((m,mi)=>{const has=m.val!==null,pos=has&&m.val>=0;return(<div key={mi} style={{textAlign:'center'}}><div style={{fontSize:8,color:'rgba(255,255,255,0.25)',marginBottom:3}}>{m.name}</div><div style={{fontSize:9,fontWeight:700,padding:'5px 2px',borderRadius:4,background:has?(pos?'rgba(52,212,126,0.15)':'rgba(240,96,96,0.15)'):'rgba(255,255,255,0.03)',color:has?(pos?'#34d47e':'#f06060'):'rgba(255,255,255,0.15)',border:has?`1px solid ${pos?'rgba(52,212,126,0.25)':'rgba(240,96,96,0.25)'}`:'1px solid transparent'}}>{has?(Math.abs(m.val)>=1000?`${pos?'+':'-'}${fmt(Math.abs(m.val)/1000,1)}k`:`${pos?'+':''}${fmt(m.val,0)}`):'·'}</div></div>)})}
              </div>
            </div>
          ))}
        </div>
        <div style={{background:'rgba(255,255,255,0.03)',borderTop:'1px solid rgba(255,255,255,0.06)',padding:'12px 32px',display:'flex',justifyContent:'space-between'}}>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.25)'}}>Conta real verificada · Método 6015 · Trade Quant Lab</div>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.25)'}}>{todayStr()}</div>
        </div>
      </div>
    </div>
  )
}

// ─── PortfolioCard ─────────────────────────────────────────────────────────────
function PortfolioCard({portfolio,ops,onClick}) {
  const cv      = useMemo(()=>getConfigVersions(portfolio),[portfolio])
  const scaled  = useMemo(()=>applyLotesVersioned(ops,cv),[ops,cv])
  const rc      = useMemo(()=>getCurrentRobots(portfolio),[portfolio])
  const metrics = useMemo(()=>calcMetrics(scaled,parseFloat(portfolio.capital_inicial)||0),[scaled,portfolio])
  const accent  = portfolio.cor||'#f5a623'
  const logoSrc = getLogoSrc(portfolio.logo)
  const[hov,setHov]=useState(false)
  return(
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} className="card"
      style={{padding:'18px 20px',cursor:'pointer',transition:'all .18s',transform:hov?'translateY(-3px)':'none',borderLeft:`3px solid ${accent}`,boxShadow:hov?`0 8px 32px rgba(0,0,0,0.25),0 0 0 1px ${accent}30`:'none',display:'flex',flexDirection:'column',gap:12}}>

      {/* Nome + logo + resultado */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0}}>
          {logoSrc && <img src={logoSrc} style={{height:22,objectFit:'contain',flexShrink:0}} alt="logo"/>}
          <div style={{fontWeight:700,fontSize:15,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{portfolio.name}</div>
        </div>
        <div style={{textAlign:'right',flexShrink:0}}>
          <div style={{fontSize:18,fontWeight:800,color:colorVal(metrics?.total)}}>{metrics?fmtBRL(metrics.total):'—'}</div>
          <div style={{fontSize:11,color:'var(--text-hint)'}}>{metrics?.nOps||0} ops</div>
        </div>
      </div>

      {/* Estratégias — fora do bloco principal, wrapped */}
      <div style={{display:'flex',flexWrap:'wrap',gap:'3px 6px'}}>
        {rc.slice(0,8).map((r,i)=>(
          <span key={i} style={{fontSize:10,color:'var(--text-hint)',background:'rgba(255,255,255,0.04)',padding:'2px 7px',borderRadius:8,border:'1px solid rgba(255,255,255,0.07)'}}>
            {r.name}{r.lotes!==1&&<sup style={{fontSize:8,marginLeft:1}}>{r.lotes}×</sup>}
          </span>
        ))}
        {rc.length>8&&<span style={{fontSize:10,color:'var(--text-hint)'}}>+{rc.length-8}</span>}
      </div>

      {/* Métricas */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
        {[
          {label:'Média/mês',value:metrics?fmtBRL(metrics.avgMonth):'—',color:colorVal(metrics?.avgMonth)},
          {label:'Win Rate', value:metrics?fmtPct(metrics.winRate)  :'—',color:'var(--accent)'},
          {label:'P.Factor', value:metrics?fmt(metrics.pf)          :'—',color:(metrics?.pf||0)>=1.5?'var(--success)':'var(--warning)'},
        ].map(m=>(
          <div key={m.label} style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:'7px 10px'}}>
            <div style={{fontSize:10,color:'var(--text-hint)',marginBottom:2}}>{m.label}</div>
            <div style={{fontSize:13,fontWeight:600,color:m.color}}>{m.value}</div>
          </div>
        ))}
      </div>

      {!metrics&&<div style={{fontSize:11,color:'var(--warning)'}}>⚠ Sem ops no My Dash — verifique os nomes das estratégias</div>}
    </div>
  )
}

// ─── Tab: Portfólios ───────────────────────────────────────────────────────────
function PortfoliosTab({portfolios,allOps,onSelect,onGoGerenciar}) {
  const [filter, setFilter] = useState('all')

  if(!portfolios.length) return(<div className="empty-state"><div style={{fontSize:40,marginBottom:14}}>🎯</div><div style={{fontSize:16,color:'var(--text-muted)',marginBottom:8}}>Nenhum portfólio criado ainda.</div><button className="btn primary" onClick={onGoGerenciar}>+ Criar primeiro portfólio</button></div>)

  // Tipos presentes
  const typeCount = {}
  portfolios.forEach(p => { const k = p.logo || 'none'; typeCount[k] = (typeCount[k]||0)+1 })

  const filtered = filter==='all' ? portfolios : portfolios.filter(p => (p.logo||'none')===filter)

  return (
    <div>
      {/* Filtro por tipo */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:18,alignItems:'center'}}>
        <span style={{fontSize:12,color:'var(--text-muted)'}}>Filtrar:</span>
        {[{id:'all',label:'Todos',count:portfolios.length},...LOGO_OPTIONS.filter(o=>typeCount[o.id]).map(o=>({id:o.id,label:o.label,count:typeCount[o.id]})),...(typeCount['none']?[{id:'none',label:'Sem tipo',count:typeCount['none']}]:[])].map(f=>(
          <button key={f.id} onClick={()=>setFilter(f.id)} style={{
            display:'inline-flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:16,fontSize:12,cursor:'pointer',transition:'all .15s',
            background: filter===f.id?'rgba(245,166,35,0.15)':'rgba(255,255,255,0.04)',
            border:`1px solid ${filter===f.id?'rgba(245,166,35,0.5)':'var(--border)'}`,
            color: filter===f.id?'var(--warning)':'var(--text-muted)',
            fontWeight: filter===f.id?700:400,
          }}>
            {f.id!=='all'&&f.id!=='none'&&<LogoBadge logo={f.id} size={14}/>}
            {f.label}
            <span style={{fontSize:10,opacity:.7}}>{f.count}</span>
          </button>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))',gap:16}}>
        {filtered.map(p=><PortfolioCard key={p.id} portfolio={p} ops={allOps[p.id]||[]} onClick={()=>onSelect(p.id)}/>)}
      </div>
    </div>
  )
}

// ─── Tab: Diário ───────────────────────────────────────────────────────────────
function filterByDay(ops, isoDate) {
  if (!isoDate) return []
  const [yyyy, mm, dd] = isoDate.split('-')
  const prefix = `${dd}/${mm}/${yyyy}`
  return ops.filter(op => (op.abertura || '').startsWith(prefix))
}

const DIARIO_GROUPS = [
  { logoId: '6015',       label: 'Portfólios Recomendados Mentoria'           },
  { logoId: 'ontick',     label: 'Portfólios Recomendados OnTick'              },
  { logoId: 'avel',       label: 'Portfólios Recomendados Avel'                },
  { logoId: 'liberdade',  label: 'Portfólios Recomendados Código da Liberdade' },
  { logoId: 'frantiesco', label: 'Portfólios Recomendados Frantiesco'          },
  { logoId: 'none',       label: 'Outros Portfólios'                           },
]

function DiarioTab({ portfolios, allOps }) {
  const todayIso = () => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
  }
  const [date, setDate]         = useState(todayIso)
  const [expanded, setExpanded] = useState(null)

  const dateFormatted = useMemo(() => {
    if (!date) return ''
    const [y,m,d] = date.split('-')
    return `${d}/${m}/${y}`
  }, [date])

  const rows = useMemo(() => portfolios.map(p => {
    const cv        = getConfigVersions(p)
    const scaledOps = applyLotesVersioned(allOps[p.id]||[], cv)
    const rc        = getCurrentRobots(p)
    const dayOps    = filterByDay(scaledOps, date)
    const total     = dayOps.reduce((s,o) => s+(o.res_op||0), 0)
    const robotMap  = {}
    rc.forEach(r => { robotMap[r.name] = { name:r.name, lotes:r.lotes, total:0, nOps:0 } })
    dayOps.forEach(op => {
      const k = op.ativo||'—'
      if (!robotMap[k]) robotMap[k] = { name:k, lotes:1, total:0, nOps:0 }
      robotMap[k].total += op.res_op||0
      robotMap[k].nOps++
    })
    const robots = Object.values(robotMap).filter(r => r.nOps > 0).sort((a,b) => b.total-a.total)
    return { id:p.id, name:p.name, cor:p.cor||'#f5a623', logo:p.logo||'none', total, nOps:dayOps.length, robots }
  }), [portfolios, allOps, date])

  const activeRows = rows.filter(r => r.nOps > 0)
  const dayTotal   = activeRows.reduce((s,r) => s+r.total, 0)
  const totalOps   = activeRows.reduce((s,r) => s+r.nOps, 0)

  const groups = useMemo(() => DIARIO_GROUPS.map(g => ({
    ...g,
    portfolios: activeRows.filter(r => (r.logo||'none') === g.logoId),
  })).filter(g => g.portfolios.length > 0), [activeRows])

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <label style={{ fontSize:13, color:'var(--text-muted)' }}>Data:</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}
          style={{ padding:'7px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:13 }}/>
        <button className="btn sm" onClick={()=>setDate(todayIso())}>Hoje</button>
        {totalOps > 0 && <>
          <span style={{ fontSize:13, color:'var(--text-muted)', marginLeft:8 }}>{totalOps} op{totalOps!==1?'s':''}</span>
          <span style={{ fontSize:16, fontWeight:700, color:colorVal(dayTotal) }}>{fmtBRL(dayTotal)}</span>
        </>}
      </div>

      {!portfolios.length ? (
        <div className="empty-state"><div style={{ fontSize:36,marginBottom:12 }}>📅</div><div style={{ fontSize:15,color:'var(--text-muted)' }}>Nenhum portfólio criado.</div></div>
      ) : totalOps === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize:40,marginBottom:14 }}>📭</div>
          <div style={{ fontSize:16,color:'var(--text-muted)',marginBottom:6 }}>Nenhuma operação em {dateFormatted}.</div>
          <div style={{ fontSize:13,color:'var(--text-hint)' }}>As operações são puxadas do My Dash pelo nome da estratégia.</div>
        </div>
      ) : (
        <div style={{ background:'var(--bg)', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)' }}>

          {/* Cabeçalho */}
          <div style={{ padding:'0 24px', background:'rgba(255,255,255,0.03)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <LogoBadge logo="frantiesco" size={90}/>
              <div>
                <div style={{ fontSize:20, fontWeight:800, letterSpacing:'-.2px' }}>Portfólios Recomendados</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>Resultados do dia {dateFormatted}</div>
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:26, fontWeight:900, color:colorVal(dayTotal), letterSpacing:'-.5px' }}>{fmtBRL(dayTotal)}</div>
              <div style={{ fontSize:11, color:'var(--text-hint)', marginTop:2 }}>{groups.length} grupo{groups.length!==1?'s':''} · {totalOps} op{totalOps!==1?'s':''}</div>
            </div>
          </div>

          {/* Grupos */}
          {groups.map((g, gi) => {
            const groupTotal = g.portfolios.reduce((s,r) => s+r.total, 0)
            // % sobre o capital total dos portfólios do grupo
            const groupCap   = g.portfolios.reduce((s,r) => {
              const p = portfolios.find(x => x.id === r.id)
              return s + (parseFloat(p?.capital_inicial)||0)
            }, 0)
            const groupPct = groupCap > 0 ? (groupTotal / groupCap) * 100 : null
            return (
              <div key={g.logoId} style={{ borderBottom: gi < groups.length-1 ? '1px solid var(--border)' : 'none' }}>
                {/* Header do grupo */}
                <div style={{ padding:'8px 28px', background:'rgba(255,255,255,0.025)', display:'flex', alignItems:'center', gap:12, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  <LogoBadge logo={g.logoId} size={53}/>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', textTransform:'uppercase', letterSpacing:'.06em' }}>{g.label}</span>
                  <div style={{ flex:1, height:1, background:'var(--border)', marginLeft:4 }}/>
                  <div style={{ display:'flex', alignItems:'baseline', gap:7 }}>
                    <span style={{ fontSize:15, fontWeight:800, color:colorVal(groupTotal) }}>{fmtBRL(groupTotal)}</span>
                    {groupPct != null && <span style={{ fontSize:11, color:'rgba(148,163,184,0.7)', fontWeight:400 }}>{fmtPctSm(groupPct)}</span>}
                  </div>
                </div>

                {/* Portfólios */}
                {g.portfolios.map((r, pi) => (
                  <div key={r.id} style={{ borderBottom: pi < g.portfolios.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div onClick={() => setExpanded(expanded===r.id?null:r.id)}
                      style={{ padding:'9px 28px 9px 40px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, cursor:'pointer' }}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        <span style={{ display:'inline-block', width:8, height:8, borderRadius:2, background:r.cor, flexShrink:0 }}/>
                        <span style={{ fontWeight:600, fontSize:14 }}>{r.name}</span>
                        <span style={{ fontSize:11, color:'var(--text-hint)', background:'rgba(255,255,255,0.05)', padding:'1px 7px', borderRadius:8 }}>{r.nOps} op{r.nOps!==1?'s':''}</span>
                        <span style={{ fontSize:10, color:'var(--text-hint)' }}>{expanded===r.id?'▲':'▼'}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'baseline', gap:7 }}>
                        <span style={{ fontWeight:700, fontSize:15, color:colorVal(r.total) }}>{fmtBRL(r.total)}</span>
                        {(() => { const p=portfolios.find(x=>x.id===r.id); const cap=parseFloat(p?.capital_inicial)||0; return cap>0?<span style={{ fontSize:11, color:'rgba(148,163,184,0.7)', fontWeight:400 }}>{fmtPctSm((r.total/cap)*100)}</span>:null })()}
                      </div>
                    </div>

                    {expanded === r.id && (
                      <div style={{ marginLeft:52, marginRight:24, marginBottom:10, borderRadius:8, overflow:'hidden', border:'1px solid var(--border)' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                          <thead>
                            <tr style={{ background:'rgba(255,255,255,0.03)', color:'var(--text-muted)' }}>
                              {['Estratégia','Lotes','Ops','Resultado'].map((h,i) => (
                                <th key={h} style={{ padding:'6px 14px', textAlign:i<2?'left':'right', fontWeight:500, borderBottom:'1px solid var(--border)' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {r.robots.map((rb,i) => (
                              <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ padding:'6px 14px' }}><span style={{ display:'inline-block', width:6, height:6, borderRadius:2, background:r.cor, marginRight:8, verticalAlign:'middle' }}/>{rb.name}</td>
                                <td style={{ padding:'6px 14px', color:'var(--text-hint)', fontSize:11 }}>{rb.lotes}×</td>
                                <td style={{ padding:'6px 14px', textAlign:'right', color:'var(--text-muted)' }}>{rb.nOps}</td>
                                <td style={{ padding:'6px 14px', textAlign:'right', fontWeight:600, color:colorVal(rb.total) }}>{fmtBRL(rb.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop:'1px solid var(--border)', background:'rgba(255,255,255,0.02)' }}>
                              <td colSpan={3} style={{ padding:'6px 14px', fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>Total {r.name}</td>
                              <td style={{ padding:'6px 14px', textAlign:'right', fontWeight:700, color:colorVal(r.total) }}>{fmtBRL(r.total)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })}

          {/* Rodapé */}
          <div style={{ padding:'10px 24px', background:'rgba(255,255,255,0.02)', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, color:'var(--text-hint)' }}>Conta real verificada · Trade Quant Lab</span>
            <span style={{ fontSize:11, color:'var(--text-hint)' }}>{dateFormatted}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Calendário — constantes e helpers ────────────────────────────────────────
const WEEK_DAYS         = ['SEG','TER','QUA','QUI','SEX','SÁB','DOM']
const MONTH_NAMES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function dayColor(value, maxAbs) {
  if (!value || maxAbs === 0) return null
  const t = Math.min(Math.abs(value) / maxAbs, 1)
  const dark   = [22, 18, 55]
  const target = value > 0 ? [22, 163, 74]   : [185, 28, 28]
  const bright = value > 0 ? [16, 185, 129]  : [239, 68, 68]
  let r, g, b
  if (t < 0.5) {
    const u = t * 2
    r = Math.round(dark[0] + (target[0]-dark[0])*u)
    g = Math.round(dark[1] + (target[1]-dark[1])*u)
    b = Math.round(dark[2] + (target[2]-dark[2])*u)
  } else {
    const u = (t-0.5)*2
    r = Math.round(target[0] + (bright[0]-target[0])*u)
    g = Math.round(target[1] + (bright[1]-target[1])*u)
    b = Math.round(target[2] + (bright[2]-target[2])*u)
  }
  const lum = (0.299*r + 0.587*g + 0.114*b) / 255
  return {
    bg:        `rgb(${r},${g},${b})`,
    textColor: lum > 0.55 ? 'rgba(0,0,0,0.85)' : '#ffffff',
    shadow:    '0 1px 3px rgba(0,0,0,0.45)',
    numColor:  lum > 0.55 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.65)',
  }
}

// ─── Curva de capital do mês ──────────────────────────────────────────────────
function MonthEquityChart({ dayMap, daysInMonth }) {
  const ref = useRef(null); const chart = useRef(null)
  const { labels, data } = useMemo(() => {
    const labels = [], data = []
    let running = 0
    for (let d = 1; d <= daysInMonth; d++) {
      if (dayMap[d]) {
        running += dayMap[d].total
        labels.push(String(d))
        data.push(parseFloat(running.toFixed(2)))
      }
    }
    return { labels, data }
  }, [dayMap, daysInMonth])

  useEffect(() => {
    if (!ref.current) return
    if (chart.current) { chart.current.destroy(); chart.current = null }
    if (!data.length) return
    const last = data[data.length-1]
    const col  = last >= 0 ? '#34d47e' : '#f06060'
    const fill = last >= 0 ? 'rgba(52,212,126,0.08)' : 'rgba(240,96,96,0.08)'
    chart.current = new Chart(ref.current.getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [{ data, borderColor:col, backgroundColor:fill, fill:true, tension:0.3, pointRadius:3, pointBackgroundColor:col, borderWidth:2 }] },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins: { legend:{ display:false }, tooltip:{ callbacks:{ label: c => ` ${fmtBRL(c.raw)}` } } },
        scales: {
          x: { ticks:{ color:'#94a3b8', font:{ size:11 } }, grid:{ color:'rgba(255,255,255,0.04)' } },
          y: { ticks:{ color:'#94a3b8', callback: v => `R$${fmt(v,0)}` }, grid:{ color:'rgba(255,255,255,0.06)' } },
        },
      },
    })
    return () => { if (chart.current) { chart.current.destroy(); chart.current = null } }
  }, [labels, data])

  if (!data.length) return null
  return (
    <div className="card" style={{ padding:'14px 20px', marginTop:16 }}>
      <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Curva de Capital — Mês</div>
      <div style={{ position:'relative', height:150 }}><canvas ref={ref}/></div>
    </div>
  )
}

// ─── DashCalendario (portado do MyDash) ───────────────────────────────────────
function PortCalendario({ ops, metrics, capitalInicial }) {
  const cap = capitalInicial || 0

  const availableMonths = useMemo(() => {
    const set = new Set()
    ops.forEach(op => { const k = opToMonthKey(op.abertura); if (k) set.add(k) })
    return [...set].sort((a,b) => {
      const [ma,ya]=a.split('/'), [mb,yb]=b.split('/')
      return (Number(ya)*12+Number(ma)) - (Number(yb)*12+Number(mb))
    })
  }, [ops])

  const [currentKey, setCurrentKey] = useState(() => {
    if (!availableMonths.length) {
      const n = new Date()
      return `${String(n.getMonth()+1).padStart(2,'0')}/${String(n.getFullYear()).slice(2)}`
    }
    return availableMonths[availableMonths.length-1]
  })

  useEffect(() => {
    if (availableMonths.length && !availableMonths.includes(currentKey))
      setCurrentKey(availableMonths[availableMonths.length-1])
  }, [availableMonths])

  const [mmStr, yyStr] = currentKey.split('/')
  const year  = 2000 + Number(yyStr)
  const month = Number(mmStr) - 1

  const monthOps = useMemo(() =>
    ops.filter(op => opToMonthKey(op.abertura) === currentKey),
    [ops, currentKey]
  )

  const dayMap = useMemo(() => {
    const map = {}
    monthOps.forEach(op => {
      const d = op.abertura || ''
      let day = 0
      if (d.includes('/'))    day = parseInt(d.split('/')[0])
      else if (d.includes('-')) day = parseInt((d.split('-')[2]||'').slice(0,2))
      if (!day || isNaN(day)) return
      if (!map[day]) map[day] = { total:0, nOps:0 }
      map[day].total += op.res_op||0
      map[day].nOps++
    })
    return map
  }, [monthOps])

  const maxAbs = useMemo(() => {
    const vals = Object.values(dayMap).map(d => Math.abs(d.total))
    return vals.length ? Math.max(...vals) : 1
  }, [dayMap])

  const stats = useMemo(() => {
    const total    = monthOps.reduce((s,o) => s+(o.res_op||0), 0)
    const days     = Object.keys(dayMap).length
    const nOps     = monthOps.length
    const avgDaily = days > 0 ? total/days : 0
    const avgTrade = nOps > 0 ? total/nOps : 0
    const sortedDays = Object.entries(dayMap).sort((a,b) => Number(a[0])-Number(b[0]))
    let running=0, bestMoment=0, worstMoment=0
    sortedDays.forEach(([,v]) => {
      running += v.total
      if (running > bestMoment)  bestMoment  = running
      if (running < worstMoment) worstMoment = running
    })
    const globalAvgMonthly  = metrics?.avgMonth || 0
    const diffVsGlobal      = total - globalAvgMonthly
    const diffVsGlobalPct   = globalAvgMonthly !== 0 ? ((total-globalAvgMonthly)/Math.abs(globalAvgMonthly))*100 : null
    const monthStartKey     = `${String(year).padStart(4,'0')}${mmStr.padStart(2,'0')}01`
    const prevOpsTotal      = ops.filter(op => opSortKey(op.abertura).slice(0,8) < monthStartKey).reduce((s,o) => s+(o.res_op||0), 0)
    const startMonthBalance = cap + prevOpsTotal
    const ddMesPct          = startMonthBalance > 0 && worstMoment < 0 ? (Math.abs(worstMoment)/startMonthBalance)*100 : null
    const ddAtual           = metrics?.ddAtual    || 0
    const ddAtualPct        = metrics?.ddAtualPct ?? null
    return { total, days, nOps, avgDaily, avgTrade, globalAvgMonthly, diffVsGlobal, diffVsGlobalPct, bestMoment, worstMoment, ddMesPct, startMonthBalance, ddAtual, ddAtualPct }
  }, [monthOps, dayMap, metrics, ops, cap, mmStr, year])

  const curIdx  = availableMonths.indexOf(currentKey)
  const hasPrev = curIdx > 0
  const hasNext = curIdx < availableMonths.length-1
  const daysInMonth = new Date(year, month+1, 0).getDate()
  const firstDow    = new Date(year, month, 1).getDay()
  const offset      = (firstDow+6) % 7
  const totalCells  = Math.ceil((daysInMonth+offset)/7)*7

  return (
    <div>
      {/* Navegação */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button className="btn sm" onClick={()=>setCurrentKey(availableMonths[curIdx-1])} disabled={!hasPrev} style={{ opacity:hasPrev?1:0.3, minWidth:32 }}>‹</button>
          <div style={{ fontSize:18, fontWeight:700, minWidth:200, textAlign:'center' }}>{MONTH_NAMES_FULL[month]} {year}</div>
          <button className="btn sm" onClick={()=>setCurrentKey(availableMonths[curIdx+1])} disabled={!hasNext} style={{ opacity:hasNext?1:0.3, minWidth:32 }}>›</button>
        </div>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', maxWidth:400, justifyContent:'flex-end' }}>
          {availableMonths.slice(-24).map(k=>(
            <div key={k} title={k} onClick={()=>setCurrentKey(k)} style={{ width:8, height:8, borderRadius:'50%', cursor:'pointer', background:k===currentKey?'var(--success)':'var(--border)', transition:'background .15s' }}/>
          ))}
        </div>
      </div>

      {/* Stats */}
      {stats.nOps > 0 ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:10, marginBottom:20 }}>
          {[
            { label:'Total do mês',        value:fmtBRL(stats.total),                                                                                           sub:`${stats.nOps} operações`,                                                                                                                                         color:colorVal(stats.total) },
            { label:'Média diária',         value:fmtBRL(stats.avgDaily),                                                                                        sub:`${stats.days} dias operados`,                                                                                                                                     color:colorVal(stats.avgDaily) },
            { label:'Resultado por trade',  value:fmtBRL(stats.avgTrade),                                                                                        sub:`${stats.nOps} trades`,                                                                                                                                            color:colorVal(stats.avgTrade) },
            { label:'Mês vs Média geral',   value:`${stats.diffVsGlobal>=0?'+':''}${fmtBRL(stats.diffVsGlobal)}`,                                               sub:stats.diffVsGlobalPct!=null?`${stats.diffVsGlobalPct>=0?'+':''}${fmt(stats.diffVsGlobalPct)}% vs média ${fmtBRL(stats.globalAvgMonthly)}`:`Média: ${fmtBRL(stats.globalAvgMonthly)}`, color:colorVal(stats.diffVsGlobal) },
            { label:'Melhor momento',       value:fmtBRL(stats.bestMoment),                                                                                      sub:'Acumulado máximo no mês',                                                                                                                                         color:'var(--success)' },
            { label:'Pior momento',         value:fmtBRL(stats.worstMoment),                                                                                     sub:stats.ddMesPct!=null?`${fmt(stats.ddMesPct)}% do saldo início do mês`:stats.worstMoment<0?'Acumulado mínimo no mês':'Sem queda acumulada',                      color:stats.worstMoment<0?'var(--danger)':'var(--text-muted)' },
            { label:'DD atual (histórico)', value:stats.ddAtualPct!=null?fmtPct(stats.ddAtualPct):fmtBRL(stats.ddAtual),                                        sub:stats.ddAtualPct!=null?`${fmtBRL(stats.ddAtual)} sobre capital`:'configure capital para ver %',                                                                    color:stats.ddAtual>0?'var(--danger)':'var(--success)' },
          ].map((c,i)=>(
            <div key={i} className="card" style={{ padding:'10px 14px' }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>{c.label}</div>
              <div style={{ fontSize:16, fontWeight:700, color:c.color }}>{c.value}</div>
              <div style={{ fontSize:11, color:'var(--text-hint)', marginTop:3 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding:'14px 0 20px', color:'var(--text-hint)', fontSize:13 }}>Sem operações em {MONTH_NAMES_FULL[month]} {year}.</div>
      )}

      {/* Grade do calendário */}
      <div style={{ background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid var(--border)' }}>
          {WEEK_DAYS.map(d=>(
            <div key={d} style={{ padding:'10px 0', textAlign:'center', fontSize:11, fontWeight:600, color:'var(--text-muted)', letterSpacing:'.06em', borderRight:d!=='DOM'?'1px solid var(--border)':'none' }}>{d}</div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
          {Array.from({ length:totalCells }).map((_,idx)=>{
            const dayNum   = idx - offset + 1
            const valid    = dayNum >= 1 && dayNum <= daysInMonth
            const entry    = valid ? dayMap[dayNum] : null
            const colorObj = entry ? dayColor(entry.total, maxAbs) : null
            const col       = idx % 7
            const isWeekend = col >= 5
            const isLastRow = idx >= totalCells-7
            return (
              <div key={idx} style={{ minHeight:68, padding:'6px 8px', background:colorObj?.bg||(isWeekend&&valid?'rgba(255,255,255,0.012)':'transparent'), borderRight:col<6?'1px solid var(--border)':'none', borderBottom:!isLastRow?'1px solid var(--border)':'none', transition:'background .2s' }}>
                {valid&&(
                  <>
                    <div style={{ fontSize:12, fontWeight:colorObj?700:400, color:colorObj?colorObj.numColor:'var(--text-hint)', marginBottom:colorObj?5:0 }}>{dayNum}</div>
                    {entry&&colorObj&&(
                      <>
                        <div style={{ fontSize:13, fontWeight:700, color:colorObj.textColor, textShadow:colorObj.shadow, lineHeight:1.2 }}>{entry.total>=0?'+':''}{fmtBRL(entry.total)}</div>
                        {entry.nOps>1&&<div style={{ fontSize:10, color:colorObj.textColor, opacity:.7, marginTop:3 }}>{entry.nOps} trades</div>}
                      </>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display:'flex', alignItems:'center', gap:20, marginTop:14, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:80, height:10, borderRadius:5, background:'linear-gradient(to right, rgb(22,18,55), rgb(16,185,129))' }}/>
          <span style={{ fontSize:11, color:'var(--text-muted)' }}>Lucro (roxo escuro → verde vivo)</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:80, height:10, borderRadius:5, background:'linear-gradient(to right, rgb(22,18,55), rgb(239,68,68))' }}/>
          <span style={{ fontSize:11, color:'var(--text-muted)' }}>Prejuízo (roxo escuro → vermelho vivo)</span>
        </div>
      </div>

      {/* Curva de capital do mês */}
      <MonthEquityChart dayMap={dayMap} daysInMonth={daysInMonth} />
    </div>
  )
}

// ─── Tab: Calendário ───────────────────────────────────────────────────────────
function CalendarioTab({ portfolios, allOps }) {
  const [typeFilter,  setTypeFilter]  = useState('all')
  const [selectedId,  setSelectedId]  = useState(() => portfolios[0]?.id || null)

  // Portfólios filtrados por tipo
  const filtered = useMemo(() =>
    typeFilter === 'all' ? portfolios : portfolios.filter(p => (p.logo||'none') === typeFilter)
  , [portfolios, typeFilter])

  // Quando o filtro muda, seleciona o primeiro do grupo
  useEffect(() => {
    if (filtered.length) setSelectedId(filtered[0].id)
    else setSelectedId(null)
  }, [typeFilter])

  // Se não houver selecionado no grupo atual, ajusta
  useEffect(() => {
    if (!filtered.find(p => p.id === selectedId) && filtered.length)
      setSelectedId(filtered[0].id)
  }, [filtered, selectedId])

  const portfolio = portfolios.find(p => p.id === selectedId) || null
  const cv        = useMemo(() => portfolio ? getConfigVersions(portfolio) : [], [portfolio])
  const ops       = useMemo(() => applyLotesVersioned(allOps[selectedId]||[], cv), [allOps, selectedId, cv])
  const cap       = parseFloat(portfolio?.capital_inicial) || 0
  const metrics   = useMemo(() => calcMetrics(ops, cap), [ops, cap])

  // Tipos presentes
  const typeCount = useMemo(() => {
    const m = {}
    portfolios.forEach(p => { const k = p.logo||'none'; m[k] = (m[k]||0)+1 })
    return m
  }, [portfolios])

  if (!portfolios.length) return (
    <div className="empty-state"><div style={{ fontSize:36,marginBottom:12 }}>📅</div><div style={{ fontSize:15,color:'var(--text-muted)' }}>Nenhum portfólio criado ainda.</div></div>
  )

  return (
    <div>
      {/* Filtro por tipo */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14, alignItems:'center' }}>
        <span style={{ fontSize:12, color:'var(--text-muted)' }}>Tipo:</span>
        {[{id:'all',label:'Todos',count:portfolios.length},
          ...LOGO_OPTIONS.filter(o => typeCount[o.id]).map(o => ({id:o.id, label:o.label, count:typeCount[o.id]})),
          ...(typeCount['none'] ? [{id:'none', label:'Sem tipo', count:typeCount['none']}] : [])
        ].map(f => (
          <button key={f.id} onClick={() => setTypeFilter(f.id)} style={{
            display:'inline-flex', alignItems:'center', gap:5, padding:'4px 11px', borderRadius:14, fontSize:11, cursor:'pointer', transition:'all .15s',
            background: typeFilter===f.id ? 'rgba(245,166,35,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${typeFilter===f.id ? 'rgba(245,166,35,0.5)' : 'var(--border)'}`,
            color: typeFilter===f.id ? 'var(--warning)' : 'var(--text-muted)',
            fontWeight: typeFilter===f.id ? 700 : 400,
          }}>
            {f.id!=='all' && f.id!=='none' && <LogoBadge logo={f.id} size={12}/>}
            {f.label} <span style={{ fontSize:10, opacity:.6 }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Seletor de portfólio (filtrado) */}
      {filtered.length > 0 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:20, alignItems:'center' }}>
          <span style={{ fontSize:12, color:'var(--text-muted)' }}>Portfólio:</span>
          {filtered.map(p => (
            <button key={p.id} onClick={() => setSelectedId(p.id)} style={{
              display:'inline-flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:16, fontSize:12, cursor:'pointer', transition:'all .15s',
              fontWeight: selectedId===p.id ? 700 : 400,
              background: selectedId===p.id ? `${p.cor||'#f5a623'}18` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${selectedId===p.id ? (p.cor||'#f5a623')+'60' : 'var(--border)'}`,
              color: selectedId===p.id ? (p.cor||'#f5a623') : 'var(--text-muted)',
            }}>
              <LogoBadge logo={p.logo} size={13}/>
              {p.name}
            </button>
          ))}
          {portfolio && cap > 0 && <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-hint)' }}>Capital ref.: {fmtBRL(cap)}</span>}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="empty-state" style={{ padding:'40px 0' }}>
          <div style={{ fontSize:15, color:'var(--text-muted)' }}>Nenhum portfólio deste tipo.</div>
        </div>
      )}

      {portfolio && cap === 0 && (
        <div style={{ marginBottom:14, padding:'8px 14px', background:'rgba(245,166,35,0.08)', border:'1px solid rgba(245,166,35,0.25)', borderRadius:8, fontSize:12, color:'var(--warning)' }}>
          ⚠ Configure o <strong>Capital de Referência</strong> em Gerenciar para ver % de drawdown.
        </div>
      )}

      {!ops.length && portfolio ? (
        <div className="empty-state" style={{ padding:'40px 0' }}>
          <div style={{ fontSize:15, color:'var(--text-muted)' }}>Sem operações para {portfolio.name}.</div>
        </div>
      ) : portfolio ? (
        <ErrorBoundary>
          <PortCalendario ops={ops} metrics={metrics} capitalInicial={cap}/>
        </ErrorBoundary>
      ) : null}
    </div>
  )
}


const PERIODS=['Hoje','Semana','Mês','Trimestre','Semestre','Ano']

function PeriodosTab({portfolios,allOps}) {
  if(!portfolios.length) return(<div className="empty-state"><div style={{fontSize:36,marginBottom:12}}>📅</div><div style={{fontSize:15,color:'var(--text-muted)'}}>Nenhum portfólio criado ainda.</div></div>)
  const rows=useMemo(()=>portfolios.map(p=>{
    const cv=getConfigVersions(p), cap=parseFloat(p.capital_inicial)||0
    const ops=applyLotesVersioned(allOps[p.id]||[],cv)
    const allTotal=ops.reduce((s,o)=>s+(o.res_op||0),0)
    const byPer={}; PERIODS.forEach(per=>{const f=filterPeriod(ops,per);byPer[per]={total:f.reduce((s,o)=>s+(o.res_op||0),0),nOps:f.length}})
    return{id:p.id,name:p.name,cor:p.cor||'#f5a623',logo:p.logo,byPer,allTotal,nOps:ops.length,cap}
  }),[portfolios,allOps])
  const totals=useMemo(()=>{const t={};PERIODS.forEach(per=>{t[per]=rows.reduce((s,r)=>s+r.byPer[per].total,0)});return t},[rows])
  const totalCap=portfolios.reduce((s,p)=>s+(parseFloat(p.capital_inicial)||0),0)
  const allTimeTotal=rows.reduce((s,r)=>s+r.allTotal,0)
  function cardPct(v){if(totalCap>0)return(v/totalCap)*100;if(allTimeTotal!==0)return(v/Math.abs(allTimeTotal))*100;return null}
  function cellPct(v,r){if(r.cap>0)return(v/r.cap)*100;if(r.allTotal!==0)return(v/Math.abs(r.allTotal))*100;return null}
  return(
    <div>
      <div style={{marginBottom:16,fontSize:13,color:'var(--text-muted)'}}>Resultados acumulados por período — lotes aplicados.</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))',gap:12,marginBottom:24}}>
        {PERIODS.map(per=>{const v=totals[per],pct=cardPct(v);return(
          <div key={per} className="card" style={{padding:'12px 16px'}}>
            <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:5}}>{per}</div>
            <div style={{fontSize:18,fontWeight:700,color:colorVal(v)}}>{fmtBRL(v)}</div>
            {pct!=null&&<div style={{fontSize:12,fontWeight:600,color:colorVal(v),marginTop:3}}>{fmtPctSm(pct)}</div>}
            <div style={{fontSize:11,color:'var(--text-hint)',marginTop:2}}>todos portfólios</div>
          </div>
        )})}
      </div>
      <div className="card" style={{padding:0}}>
        <div style={{padding:'12px 20px',borderBottom:'1px solid var(--border)',fontSize:13,fontWeight:600,color:'var(--text-muted)',letterSpacing:'.04em'}}>BREAKDOWN POR PORTFÓLIO</div>
        <div className="tbl-wrap">
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{color:'var(--text-muted)'}}><th style={{padding:'9px 16px',textAlign:'left',fontWeight:500,borderBottom:'1px solid var(--border)'}}>Portfólio</th>{PERIODS.map(p=><th key={p} style={{padding:'9px 14px',textAlign:'right',fontWeight:500,borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>{p}</th>)}<th style={{padding:'9px 14px',textAlign:'right',fontWeight:500,borderBottom:'1px solid var(--border)'}}>Total</th></tr></thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id} style={{borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                  <td style={{padding:'9px 16px',fontWeight:600}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      {getLogoSrc(r.logo)&&<img src={getLogoSrc(r.logo)} style={{height:16,objectFit:'contain'}} alt=""/>}
                      <span style={{display:'inline-block',width:8,height:8,borderRadius:2,background:r.cor,flexShrink:0}}/>
                      {r.name}
                    </div>
                  </td>
                  {PERIODS.map(per=>{const{total,nOps}=r.byPer[per],pct=nOps?cellPct(total,r):null;return(
                    <td key={per} style={{padding:'9px 14px',textAlign:'right'}}>
                      {nOps?(<span style={{display:'flex',alignItems:'baseline',justifyContent:'flex-end',gap:5}}><span style={{fontWeight:600,color:colorVal(total)}}>{fmtBRL(total)}</span>{pct!=null&&<span style={{fontSize:10,color:'rgba(148,163,184,0.65)',fontWeight:400}}>{fmtPctSm(pct)}</span>}</span>):(<span style={{color:'var(--text-hint)'}}>—</span>)}
                    </td>
                  )})}
                  <td style={{padding:'9px 14px',textAlign:'right'}}>
                    {r.nOps?(<span style={{display:'flex',alignItems:'baseline',justifyContent:'flex-end',gap:5}}><span style={{fontWeight:700,color:colorVal(r.allTotal)}}>{fmtBRL(r.allTotal)}</span>{r.cap>0&&<span style={{fontSize:10,color:'rgba(148,163,184,0.65)',fontWeight:400}}>{fmtPctSm((r.allTotal/r.cap)*100)}</span>}</span>):(<span style={{color:'var(--text-hint)'}}>—</span>)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{borderTop:'2px solid var(--border)',background:'rgba(255,255,255,0.02)'}}>
                <td style={{padding:'10px 16px',fontWeight:700,fontSize:12,color:'var(--text-muted)'}}>TOTAL CONSOLIDADO</td>
                {PERIODS.map(per=>{const v=totals[per],pct=cardPct(v);return(<td key={per} style={{padding:'10px 14px',textAlign:'right'}}><span style={{display:'flex',alignItems:'baseline',justifyContent:'flex-end',gap:5}}><span style={{fontWeight:700,color:colorVal(v)}}>{fmtBRL(v)}</span>{pct!=null&&<span style={{fontSize:10,color:'rgba(148,163,184,0.65)',fontWeight:400}}>{fmtPctSm(pct)}</span>}</span></td>)})}
                <td style={{padding:'10px 14px',textAlign:'right'}}><span style={{display:'flex',alignItems:'baseline',justifyContent:'flex-end',gap:5}}><span style={{fontWeight:700,color:colorVal(allTimeTotal)}}>{fmtBRL(allTimeTotal)}</span>{totalCap>0&&<span style={{fontSize:10,color:'rgba(148,163,184,0.65)',fontWeight:400}}>{fmtPctSm((allTimeTotal/totalCap)*100)}</span>}</span></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Comparativo ──────────────────────────────────────────────────────────
function buildPctSeries(ops,cap) {
  if(!ops.length)return[]
  const sorted=[...ops].sort((a,b)=>opSortKey(a.abertura).localeCompare(opSortKey(b.abertura)))
  const base=cap>0?cap:Math.abs(sorted.reduce((s,o)=>s+(o.res_op||0),0))||1
  const dayMap={}
  sorted.forEach(op=>{const day=opSortKey(op.abertura).slice(0,8);dayMap[day]=(dayMap[day]||0)+(op.res_op||0)})
  let cum=0
  return Object.entries(dayMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([day,pnl])=>{cum+=pnl;return{sortKey:day,pct:(cum/base)*100}})
}

function ComparativoTab({portfolios,allOps}) {
  const[selected,setSelected]=useState(()=>new Set(portfolios.slice(0,5).map(p=>p.id)))
  const ref=useRef(null),chart=useRef(null)
  const series=useMemo(()=>portfolios.map(p=>{const cv=getConfigVersions(p),cap=parseFloat(p.capital_inicial)||0,ops=applyLotesVersioned(allOps[p.id]||[],cv);return{id:p.id,name:p.name,color:p.cor||'#4f8ef7',cap,points:buildPctSeries(ops,cap),hasOps:ops.length>0}}),[portfolios,allOps])
  const selSeries=useMemo(()=>series.filter(s=>selected.has(s.id)),[series,selected])
  const{labels,datasets}=useMemo(()=>{
    if(!selSeries.length)return{labels:[],datasets:[]}
    const allKeys=[...new Set(selSeries.flatMap(s=>s.points.map(p=>p.sortKey)))].sort()
    if(!allKeys.length)return{labels:[],datasets:[]}
    const lbls=allKeys.map(k=>`${k.slice(6,8)}/${k.slice(4,6)}/${k.slice(0,4)}`)
    const dsets=selSeries.map(s=>{let last=0;const data=allKeys.map(key=>{const pt=s.points.find(p=>p.sortKey===key);if(pt)last=pt.pct;return last});return{label:s.name,data,borderColor:s.color,backgroundColor:'transparent',tension:0.2,pointRadius:0,borderWidth:2.5,fill:false}})
    return{labels:lbls,datasets:dsets}
  },[selSeries])
  useEffect(()=>{
    if(!ref.current)return;if(chart.current){chart.current.destroy();chart.current=null};if(!datasets.length||!labels.length)return
    chart.current=new Chart(ref.current.getContext('2d'),{type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:true,position:'top',labels:{color:'#94a3b8',boxWidth:12,padding:16,font:{size:12}}},tooltip:{callbacks:{label:c=>{const v=c.raw;return ` ${c.dataset.label}: ${v>=0?'+':''}${fmt(v,2)}%`}}}},scales:{x:{ticks:{color:'#94a3b8',maxTicksLimit:10},grid:{color:'rgba(255,255,255,0.04)'}},y:{ticks:{color:'#94a3b8',callback:v=>`${v>=0?'+':''}${fmt(v,1)}%`},grid:{color:'rgba(255,255,255,0.06)'},title:{display:true,text:'% sobre capital inicial',color:'#64748b',font:{size:11}}}}}})
    return()=>{if(chart.current){chart.current.destroy();chart.current=null}}
  },[labels,datasets])
  function toggle(id){setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})}
  if(!portfolios.length)return(<div className="empty-state"><div style={{fontSize:36,marginBottom:12}}>📈</div><div style={{fontSize:15,color:'var(--text-muted)'}}>Nenhum portfólio criado ainda.</div></div>)
  return(
    <div>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:20,alignItems:'center'}}>
        <span style={{fontSize:12,color:'var(--text-muted)',marginRight:4}}>Portfólios:</span>
        {portfolios.map(p=>{const isOn=selected.has(p.id),s=series.find(x=>x.id===p.id);return(
          <button key={p.id} onClick={()=>toggle(p.id)} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:isOn?700:400,cursor:'pointer',transition:'all .15s',background:isOn?`${p.cor||'#4f8ef7'}18`:'rgba(255,255,255,0.04)',border:`1px solid ${isOn?(p.cor||'#4f8ef7')+'60':'var(--border)'}`,color:isOn?(p.cor||'#4f8ef7'):'var(--text-muted)',opacity:!s?.hasOps?0.4:1}} title={!s?.hasOps?'Sem operações no My Dash':undefined}>
            {getLogoSrc(p.logo)?<img src={getLogoSrc(p.logo)} style={{height:14,objectFit:'contain'}} alt=""/>:<span style={{display:'inline-block',width:8,height:8,borderRadius:50,background:isOn?(p.cor||'#4f8ef7'):'var(--text-hint)'}}/>}
            {p.name}
          </button>
        )})}
        <button className="btn sm" onClick={()=>setSelected(selected.size?new Set():new Set(portfolios.map(p=>p.id)))} style={{fontSize:11,marginLeft:'auto'}}>{selected.size?'Limpar':'Todos'}</button>
      </div>
      {selSeries.some(s=>s.cap===0&&s.hasOps)&&<div style={{marginBottom:16,padding:'10px 14px',background:'rgba(245,166,35,0.08)',border:'1px solid rgba(245,166,35,0.25)',borderRadius:8,fontSize:12,color:'var(--warning)'}}>⚠ Portfólios sem capital configurado usam resultado total como base. Configure em Gerenciar para % correto.</div>}
      {selected.size===0?(<div className="empty-state" style={{padding:'60px 0'}}><div style={{fontSize:36,marginBottom:12}}>📈</div><div style={{fontSize:15,color:'var(--text-muted)'}}>Selecione ao menos um portfólio.</div></div>):!labels.length?(<div className="empty-state" style={{padding:'60px 0'}}><div style={{fontSize:36,marginBottom:12}}>📭</div><div style={{fontSize:15,color:'var(--text-muted)'}}>Nenhum dado nos portfólios selecionados.</div></div>):(
        <div className="card" style={{padding:'20px 20px 16px'}}>
          <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:16}}>Curva de Lucro Comparativa — % sobre capital inicial</div>
          <div style={{position:'relative',height:420}}><canvas ref={ref}/></div>
          <div style={{marginTop:12,fontSize:11,color:'var(--text-hint)'}}>Y = lucro acumulado como % do capital de referência. Cada ponto representa um dia com operações.</div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Detalhe ──────────────────────────────────────────────────────────────
function DetalheTab({portfolios,selectedId,onSelectId,allOps,onShowPrint}) {
  const portfolio=portfolios.find(p=>p.id===selectedId)||null
  const cv=useMemo(()=>portfolio?getConfigVersions(portfolio):[]  ,[portfolio])
  const rc=useMemo(()=>portfolio?getCurrentRobots(portfolio):[]   ,[portfolio])
  const rawOps=portfolio?(allOps[selectedId]||[]):[]
  const ops=useMemo(()=>applyLotesVersioned(rawOps,cv),[rawOps,cv])
  const cap=parseFloat(portfolio?.capital_inicial)||0
  const metrics=useMemo(()=>calcMetrics(ops,cap),[ops,cap])
  const accent=portfolio?.cor||'#f5a623'
  const logoSrc=getLogoSrc(portfolio?.logo)
  const[sub,setSub]=useState('Resumo')
  const opsWithData=useMemo(()=>new Set(ops.map(o=>o.ativo)),[ops])
  return(
    <div>
      <div style={{marginBottom:20,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <select value={selectedId||''} onChange={e=>{onSelectId(e.target.value?Number(e.target.value):null);setSub('Resumo')}}
          style={{padding:'7px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontSize:13,minWidth:240}}>
          <option value="">Selecionar portfólio...</option>
          {portfolios.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {portfolio&&<button className="btn sm" onClick={onShowPrint} style={{marginLeft:'auto'}}>🖨 Print / Screenshot</button>}
      </div>
      {!portfolio?(
        <div className="empty-state"><div style={{fontSize:40,marginBottom:14}}>📊</div><div style={{fontSize:16,color:'var(--text-muted)'}}>Selecione um portfólio para ver a análise.</div></div>
      ):(
        <>
          {/* Card do portfólio — só nome, logo, período, botão */}
          <div className="card" style={{padding:'16px 22px',marginBottom:0,borderLeft:`3px solid ${accent}`}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                {logoSrc&&<img src={logoSrc} style={{height:28,objectFit:'contain'}} alt="logo"/>}
                <div>
                  <div style={{fontSize:18,fontWeight:700}}>{portfolio.name}</div>
                  {metrics?.period&&<div style={{fontSize:11,color:'var(--text-hint)',marginTop:2}}>Período: {metrics.period.from} → {metrics.period.to} · {metrics.nMonths} meses</div>}
                </div>
              </div>
              <button className="btn sm" onClick={onShowPrint}>🖨 Print</button>
            </div>
          </div>

          {/* Estratégias — FORA do card, em chips */}
          <StrategyChips robotsConfig={rc} opsWithData={opsWithData} accent={accent}/>

          <div style={{height:20}}/>

          <div style={{display:'flex',gap:2,borderBottom:'1px solid var(--border)',marginBottom:24}}>
            {['Resumo','Gráficos','Mensal','Estratégias'].map(t=><button key={t} onClick={()=>setSub(t)} style={{background:'none',border:'none',padding:'8px 16px',fontSize:13,fontWeight:sub===t?700:400,color:sub===t?accent:'var(--text-muted)',borderBottom:sub===t?`2px solid ${accent}`:'2px solid transparent',cursor:'pointer',marginBottom:-1}}>{t}</button>)}
          </div>

          {!ops.length&&<div style={{marginBottom:20,padding:'12px 16px',background:'rgba(245,166,35,0.08)',border:'1px solid rgba(245,166,35,0.25)',borderRadius:8,fontSize:13,color:'var(--warning)'}}>⚠ Nenhuma op do My Dash corresponde às estratégias. Os nomes precisam ser exatamente iguais ao campo Estratégia.</div>}

          {sub==='Resumo'&&<div className="metrics-grid">
            <MetricCard label="Resultado Total"       value={fmtBRL(metrics?.total)} sub={cap?fmtPct(((metrics?.total||0)/cap)*100):`${metrics?.nOps||0} ops`} color={colorVal(metrics?.total)} accent={accent}/>
            <MetricCard label="Média Mensal"          value={fmtBRL(metrics?.avgMonth)} sub={`${metrics?.nMonths||0} meses`} color={colorVal(metrics?.avgMonth)}/>
            <MetricCard label="Trades / Mês"          value={metrics?.nMonths ? fmt(metrics.nOps/metrics.nMonths,1) : '—'} sub={`${metrics?.nOps||0} ops em ${metrics?.nMonths||0} meses`} color="var(--text)"/>
            <MetricCard label="Win Rate"              value={fmtPct(metrics?.winRate)} sub={`${metrics?.nOps||0} ops`} color="var(--accent)"/>
            <MetricCard label="Profit Factor"         value={fmt(metrics?.pf)} sub={`Méd. trade: ${fmtBRL(metrics?.avgTrade)}`} color={(metrics?.pf||0)>=1.5?'var(--success)':'var(--warning)'}/>
            <MetricCard label="DD Máximo"             value={metrics?.ddMaxPct!=null?fmtPct(metrics.ddMaxPct):fmtBRL(metrics?.ddMax)} sub={cap?`${fmtBRL(metrics?.ddMax)} sobre capital ${fmtBRL(cap)}`:'configure capital'} color="var(--danger)"/>
            <MetricCard label="Estratégias"           value={`${opsWithData.size}/${rc.length}`} sub={opsWithData.size<rc.length?`${rc.length-opsWithData.size} sem ops`:'todas com ops'} color={opsWithData.size<rc.length?'var(--warning)':'var(--success)'}/>
          </div>}
          {sub==='Gráficos'&&<ErrorBoundary><div style={{display:'flex',flexDirection:'column',gap:20}}><div className="card" style={{padding:'16px 20px'}}><div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:14}}>Resultado Mensal</div>{ops.length?<MonthlyBarChart ops={ops}/>:<div style={{color:'var(--text-hint)',fontSize:13}}>Sem dados.</div>}</div><div className="card" style={{padding:'16px 20px'}}><div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:14}}>Curva de Capital</div>{ops.length?<EquityChart ops={ops} cap={cap}/>:<div style={{color:'var(--text-hint)',fontSize:13}}>Sem dados.</div>}</div></div></ErrorBoundary>}
          {sub==='Mensal'&&<div className="card" style={{padding:'16px 20px'}}><div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:14}}>Histórico Mensal</div>{ops.length?<MonthlyTable ops={ops}/>:<div style={{color:'var(--text-hint)',fontSize:13}}>Sem dados.</div>}</div>}
          {sub==='Estratégias'&&<div className="card" style={{padding:'16px 20px'}}><div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:14}}>Contribuição por Estratégia</div>{ops.length?<RobotBreakdown ops={ops} robotsConfig={rc} accent={accent}/>:<div style={{color:'var(--text-hint)',fontSize:13}}>Sem dados.</div>}</div>}
        </>
      )}
    </div>
  )
}

// ─── Modal de confirmação — histórico de composição ───────────────────────────
function HistoryConfirmModal({portfolioName, onFromNow, onRecalculate, onCancel}) {
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div className="card" style={{padding:28,maxWidth:460,width:'100%'}}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Alterar composição de <span style={{color:'var(--accent)'}}>{portfolioName}</span></div>
        <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>
          Você alterou as estratégias ou lotes. Como aplicar as mudanças?
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
          <button onClick={onFromNow} className="card" style={{padding:'14px 18px',cursor:'pointer',border:'1px solid var(--border)',textAlign:'left',borderRadius:10,color:'inherit'}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:4,color:'var(--text)'}}>📅 Apenas daqui para frente</div>
            <div style={{fontSize:12,color:'var(--text-muted)'}}>Mantém o histórico fiel ao que foi recomendado. Novas operações usam a composição atual.</div>
          </button>
          <button onClick={onRecalculate} className="card" style={{padding:'14px 18px',cursor:'pointer',border:'1px solid var(--border)',textAlign:'left',borderRadius:10,color:'inherit'}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:4,color:'var(--text)'}}>🔄 Recalcular todo o histórico</div>
            <div style={{fontSize:12,color:'var(--text-muted)'}}>Aplica a nova composição a todas as operações desde o início do portfólio.</div>
          </button>
        </div>
        <button className="btn sm" onClick={onCancel} style={{color:'var(--text-muted)'}}>Cancelar</button>
      </div>
    </div>
  )
}

// ─── Tab: Gerenciar ────────────────────────────────────────────────────────────
const PALETTE=['#f5a623','#4f8ef7','#34d47e','#f06060','#a855f7','#06b6d4','#ec4899','#ffd700']

function GerenciarTab({portfolios,strategies,stratOps,labPortfolios,onSave,onDelete}) {
  const[mode,setMode]=useState('list')
  const[form,setForm]=useState({})
  const[saving,setSaving]=useState(false)
  const[confirmDel,setConfirmDel]=useState(null)
  const[showHistoryConfirm,setShowHistoryConfirm]=useState(false)
  const[pendingSaveData,setPendingSaveData]=useState(null)
  const[composition,setComp]=useState([])
  const[search,setSearch]=useState('')
  const[showLab,setShowLab]=useState(false)
  const[customVal,setCustom]=useState('')
  // Refs para guardar a composição ORIGINAL ao abrir o editor (não reativa)
  const _originalRobotsRef   = useRef('')
  const _originalVersionsRef = useRef([])

  function openCreate() { setForm({name:'',capital_inicial:'',cor:PALETTE[portfolios.length%PALETTE.length],logo:''}); setComp([]); setSearch(''); setMode('create') }
  function openEdit(p)  {
    setForm({...p, capital_inicial:p.capital_inicial||''})
    setComp(getCurrentRobots(p))
    setSearch('')
    setMode('edit')
    // Guarda a composição original e as versões originais para usar no doSave
    // NÃO usa form para isso pois form.robots_json vai ser sobrescrito pelo buildSaveData
    _originalRobotsRef.current = JSON.stringify(getCurrentRobots(p))
    _originalVersionsRef.current = getConfigVersions(p)
  }

  function buildSaveData() {
    return {
      ...form,
      robots_json: JSON.stringify(composition),
      capital_inicial: parseFloat(String(form.capital_inicial).replace(',','.'))||0,
    }
  }

  function compositionChanged() {
    if (mode !== 'edit') return false
    return JSON.stringify(composition) !== _originalRobotsRef.current
  }

  async function doSave(data, historyMode) {
    setSaving(true)
    let configVersions
    if (historyMode === 'from_now') {
      // Versões anteriores (com a composição ORIGINAL intacta) + nova versão daqui para frente
      const existing = _originalVersionsRef.current || [{ valid_from: null, robots_json: JSON.stringify(JSON.parse(_originalRobotsRef.current||'[]')) }]
      configVersions = [...existing, { valid_from: todaySortKey(), robots_json: data.robots_json }]
    } else {
      // Recalcula tudo: uma versão única desde o início com a nova composição
      configVersions = [{ valid_from: null, robots_json: data.robots_json }]
    }
    await onSave({ ...data, config_versions: JSON.stringify(configVersions) })
    setSaving(false); setShowHistoryConfirm(false); setMode('list')
  }

  async function handleSave() {
    if (!form.name?.trim() || !composition.length) return
    const data = buildSaveData()
    if (compositionChanged()) {
      setPendingSaveData(data)
      setShowHistoryConfirm(true)
    } else {
      // Criar novo ou editar sem mudar composição — recalcula tudo
      await doSave(data, 'recalculate')
    }
  }

  function addStrat(name) { if(composition.find(r=>r.name===name))return; setComp(c=>[...c,{name,lotes:1}]) }
  function removeStrat(name) { setComp(c=>c.filter(r=>r.name!==name)) }
  function setLotes(name,val) {
    const n = Math.max(1, Math.round(parseFloat(val)||1))  // sempre inteiro >= 1
    setComp(c=>c.map(r=>r.name===name?{...r,lotes:n}:r))
  }
  function addCustom() { const v=customVal.trim();if(!v)return;addStrat(v);setCustom('') }
  function importLab(p) {
    // Adiciona tudo de uma vez em um único setComp para evitar problema de batching
    if (p.robotNames?.length) {
      setComp(prev => {
        const novos = p.robotNames.filter(n => !prev.find(r => r.name===n)).map(n => ({name:n,lotes:1}))
        return novos.length ? [...prev,...novos] : prev
      })
    }
    setShowLab(false)
  }

  // Ordenação ALFABÉTICA
  const filtered=useMemo(()=>
    strategies
      .filter(s=>!search||s.toLowerCase().includes(search.toLowerCase()))
      .sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}))
  ,[strategies,search])

  if (mode!=='list') return(
    <>
      {showHistoryConfirm && pendingSaveData && (
        <HistoryConfirmModal
          portfolioName={form.name}
          onFromNow={()=>doSave(pendingSaveData,'from_now')}
          onRecalculate={()=>doSave(pendingSaveData,'recalculate')}
          onCancel={()=>{setShowHistoryConfirm(false);setPendingSaveData(null)}}
        />
      )}
      <div>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
          <button className="btn sm" onClick={()=>setMode('list')}>← Voltar</button>
          <h3 style={{margin:0,fontSize:16}}>{mode==='create'?'Novo Portfólio Recomendado':`Editar: ${form.name}`}</h3>
        </div>

        {/* Nome + capital + logo + cor */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 160px',gap:14,marginBottom:14}}>
          <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:5}}>Nome *</label><input value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ex: Gold Standard" style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontSize:13,boxSizing:'border-box'}}/></div>
          <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:5}}>Capital ref. (R$)</label><input type="number" value={form.capital_inicial||''} onChange={e=>setForm(f=>({...f,capital_inicial:e.target.value}))} placeholder="50000" style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontSize:13,boxSizing:'border-box'}}/></div>
        </div>

        {/* Logo + cor */}
        <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:20,marginBottom:20,alignItems:'start'}}>
          <div>
            <label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:8}}>Logo do portfólio</label>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <button onClick={()=>setForm(f=>({...f,logo:''}))} style={{padding:'6px 14px',borderRadius:8,border:`1px solid ${!form.logo?'var(--accent)':'var(--border)'}`,background:!form.logo?'rgba(79,142,247,0.1)':'var(--surface)',cursor:'pointer',fontSize:12,color:!form.logo?'var(--accent)':'var(--text-muted)'}}>Sem logo</button>
              {LOGO_OPTIONS.map(lo=>(
                <button key={lo.id} onClick={()=>setForm(f=>({...f,logo:lo.id}))} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${form.logo===lo.id?'var(--accent)':'var(--border)'}`,background:form.logo===lo.id?'rgba(79,142,247,0.1)':'var(--surface)',cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
                  <LogoBadge logo={lo.id} size={18}/>
                  <span style={{fontSize:11,color:form.logo===lo.id?'var(--accent)':'var(--text-muted)'}}>{lo.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:8}}>Cor</label>
            <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{PALETTE.map(c=><button key={c} onClick={()=>setForm(f=>({...f,cor:c}))} style={{width:28,height:28,borderRadius:6,background:c,border:form.cor===c?'2px solid white':'2px solid transparent',cursor:'pointer',transition:'transform .1s',transform:form.cor===c?'scale(1.2)':'none'}}/>)}</div>
          </div>
        </div>

        {/* Dois painéis: estratégias + composição */}
        <div style={{display:'flex',gap:16,height:460,marginBottom:20}}>
          {/* Esquerdo — disponíveis */}
          <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:600}}>Estratégias disponíveis <span style={{fontWeight:400,color:'var(--text-hint)',fontSize:11}}>(A→Z)</span></div>
              <div style={{display:'flex',gap:8}}>
                {labPortfolios?.length>0&&<button className="btn sm" onClick={()=>setShowLab(!showLab)} style={{fontSize:11}}>📦 Do LAB</button>}
              </div>
            </div>
            {showLab&&<div style={{marginBottom:10,padding:'10px 12px',background:'rgba(79,142,247,0.06)',border:'1px solid rgba(79,142,247,0.2)',borderRadius:8}}>
              <div style={{fontSize:11,color:'var(--accent)',marginBottom:8,fontWeight:600}}>Importar estratégias do portfólio do LAB:</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>{labPortfolios.map(p=><button key={p.id} className="btn sm" onClick={()=>importLab(p)} style={{fontSize:11}}>{p.name} {p.robotNames?.length?`(${p.robotNames.length} robôs)`:''}</button>)}</div>
              <div style={{fontSize:11,color:'var(--text-hint)',marginTop:8}}>⚠ Os nomes precisam coincidir com o campo Estratégia no My Dash.</div>
            </div>}
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filtrar por nome..." style={{padding:'7px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontSize:13,marginBottom:8,outline:'none'}}/>
            <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:6}}>
              {!strategies.length&&<div style={{padding:'14px',background:'rgba(245,166,35,0.06)',border:'1px solid rgba(245,166,35,0.2)',borderRadius:8,fontSize:12,color:'var(--warning)'}}>⚠ Sem estratégias no My Dash. Adicione manualmente abaixo.</div>}
              {filtered.map(s=>{
                const sOps=stratOps[s]||[],total=sOps.reduce((a,o)=>a+(o.res_op||0),0),wins=sOps.filter(o=>(o.res_op||0)>0).length,wr=sOps.length?(wins/sOps.length)*100:0,inComp=composition.some(r=>r.name===s)
                return(
                  <div key={s} style={{padding:'10px 14px',borderRadius:8,border:`1px solid ${inComp?`${form.cor||PALETTE[0]}40`:'var(--border)'}`,background:inComp?`${form.cor||PALETTE[0]}0a`:'var(--surface)',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{s}</div>
                      <div style={{fontSize:11,color:'var(--text-hint)',display:'flex',gap:10}}>
                        <span>{sOps.length} ops</span>
                        {sOps.length>0&&<><span style={{color:colorVal(total)}}>{fmtBRL(total)}</span><span>WR {fmtPct(wr)}</span></>}
                        {!sOps.length&&<span style={{color:'var(--warning)'}}>sem dados no Dash</span>}
                      </div>
                    </div>
                    {inComp?<span style={{fontSize:12,color:'var(--success)',whiteSpace:'nowrap'}}>✓ Adicionado</span>:<button className="btn sm primary" onClick={()=>addStrat(s)} style={{whiteSpace:'nowrap',flexShrink:0}}>+ Adicionar</button>}
                  </div>
                )
              })}
              <div style={{display:'flex',gap:6,paddingTop:4}}>
                <input value={customVal} onChange={e=>setCustom(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCustom()} placeholder="Adicionar nome manualmente..." style={{flex:1,padding:'6px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontSize:12}}/>
                <button className="btn sm" onClick={addCustom}>+</button>
              </div>
            </div>
          </div>

          {/* Direito — composição */}
          <div style={{width:260,flexShrink:0,display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:600}}>Composição</div>
              <div style={{fontSize:12,color:'var(--text-hint)'}}>{composition.length} estratégia{composition.length!==1?'s':''}</div>
            </div>
            {!composition.length?(
              <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',border:'1px dashed var(--border)',borderRadius:8,color:'var(--text-hint)',fontSize:13,textAlign:'center',padding:16}}>Adicione estratégias<br/>no painel ao lado</div>
            ):(
              <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:6}}>
                {composition.map(r=>(
                  <div key={r.name} style={{padding:'10px 12px',borderRadius:8,background:'var(--surface)',border:`1px solid ${form.cor||PALETTE[0]}30`,display:'flex',alignItems:'center',gap:8}}>
                    <span style={{display:'inline-block',width:8,height:8,borderRadius:2,background:form.cor||PALETTE[0],flexShrink:0}}/>
                    <span style={{flex:1,fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.name}</span>
                    <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                      <input type="number" min="1" step="1" value={r.lotes} onChange={e=>setLotes(r.name,e.target.value)} onFocus={e=>e.target.select()} style={{width:48,padding:'3px 6px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg)',color:'var(--text)',fontSize:12,textAlign:'center'}}/>
                      <span style={{fontSize:11,color:'var(--text-hint)'}}>lotes</span>
                    </div>
                    <button onClick={()=>removeStrat(r.name)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-hint)',fontSize:16,lineHeight:1,padding:0,flexShrink:0}}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <button className="btn primary" onClick={handleSave} disabled={!form.name?.trim()||!composition.length||saving}>{saving?'Salvando...':(mode==='create'?'Criar Portfólio':'Salvar Alterações')}</button>
          <button className="btn" onClick={()=>setMode('list')}>Cancelar</button>
          {!composition.length&&form.name?.trim()&&<span style={{fontSize:12,color:'var(--warning)'}}>⚠ Adicione ao menos 1 estratégia</span>}
        </div>
      </div>
    </>
  )

  // ─── Lista ───
  return(
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <span style={{fontSize:14,color:'var(--text-muted)'}}>{portfolios.length} portfólio{portfolios.length!==1?'s':''}</span>
        <button className="btn primary" onClick={openCreate}>+ Novo Portfólio</button>
      </div>
      {confirmDel&&<div style={{marginBottom:16,padding:'12px 16px',background:'rgba(240,96,96,0.08)',border:'1px solid rgba(240,96,96,0.25)',borderRadius:8}}><div style={{color:'var(--danger)',fontSize:13}}>Excluir <strong>{confirmDel.name}</strong>? As ops no My Dash não serão afetadas.</div><div style={{display:'flex',gap:8,marginTop:10}}><button className="btn sm danger" onClick={async()=>{await onDelete(confirmDel.id);setConfirmDel(null)}}>Excluir</button><button className="btn sm" onClick={()=>setConfirmDel(null)}>Cancelar</button></div></div>}
      {!portfolios.length?(
        <div className="empty-state"><div style={{fontSize:36,marginBottom:12}}>🗂</div><div style={{fontSize:15,color:'var(--text-muted)',marginBottom:12}}>Nenhum portfólio criado.</div><button className="btn primary" onClick={openCreate}>+ Novo Portfólio</button></div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {portfolios.map(p=>{
            const rc=getCurrentRobots(p), cv=getConfigVersions(p), logoSrc=getLogoSrc(p.logo)
            return(
              <div key={p.id} className="card" style={{padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',borderLeft:`3px solid ${p.cor||'#f5a623'}`}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    {logoSrc&&<img src={logoSrc} style={{height:18,objectFit:'contain'}} alt="logo"/>}
                    <div style={{fontWeight:600,fontSize:14}}>{p.name}</div>
                    {cv.length>1&&<span style={{fontSize:10,color:'var(--accent)',background:'rgba(79,142,247,0.1)',padding:'1px 7px',borderRadius:8}}>{cv.length} versões</span>}
                  </div>
                  <div style={{fontSize:11,color:'var(--text-hint)'}}>{rc.map((r,i)=><span key={i}>{i>0&&' · '}{r.name}{r.lotes!==1&&<sup style={{fontSize:9,marginLeft:1}}>{r.lotes}×</sup>}</span>)}</div>
                  {p.capital_inicial>0&&<div style={{fontSize:11,color:'var(--text-hint)',marginTop:2}}>Capital ref.: {fmtBRL(p.capital_inicial)}</div>}
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn sm" onClick={()=>openEdit(p)}>✏ Editar</button>
                  <button className="btn sm danger" onClick={()=>setConfirmDel(p)}>✕ Excluir</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
// ─── calcBlockScore ── (portado do MyDash) ────────────────────────────────────
function calcBlockScore(ops) {
  if (!ops.length) return 0
  const wins   = ops.filter(o => (o.res_op||0) > 0)
  const losses = ops.filter(o => (o.res_op||0) < 0)
  const wr     = ops.length ? wins.length/ops.length*100 : 0
  const avgW   = wins.length   ? wins.reduce((s,o)=>s+o.res_op,0)/wins.length   : 0
  const avgL   = losses.length ? Math.abs(losses.reduce((s,o)=>s+o.res_op,0)/losses.length) : 0
  const payoff = avgL > 0 ? avgW/avgL : avgW > 0 ? 3 : 0
  const grossW = wins.reduce((s,o)=>s+o.res_op,0)
  const grossL = Math.abs(losses.reduce((s,o)=>s+o.res_op,0))
  const pf     = grossL > 0 ? grossW/grossL : wins.length > 0 ? 3 : 0
  let equity=0, peak=0, ddTrades=0
  ops.forEach(op => {
    equity += op.res_op||0
    if (equity > peak) peak = equity
    if (peak - equity > 0.01) ddTrades++
  })
  const ddFrac   = ops.length ? ddTrades/ops.length : 0
  const wrScore  = Math.min(40, Math.max(0, (wr-25)/45*40))
  const pyScore  = Math.min(30, Math.max(0, payoff/2.5*30))
  const pfScore  = Math.min(20, Math.max(0, (pf-1)/2*20))
  const ddScore  = Math.max(0, (1-ddFrac)*10)
  return Math.round(wrScore + pyScore + pfScore + ddScore)
}
function scoreLabel(s) {
  if (s >= 80) return { label:'Excelente', color:'#34d47e' }
  if (s >= 65) return { label:'Bom',       color:'#4f8ef7' }
  if (s >= 50) return { label:'Regular',   color:'#f5a623' }
  if (s >= 35) return { label:'Fraco',     color:'#f06060' }
  return              { label:'Crítico',   color:'#9f1239' }
}

// ─── calcAnalise — métricas completas da aba Análise ─────────────────────────
function calcAnalise(ops, capitalInicial) {
  if (!ops || !ops.length) return null
  const cap     = capitalInicial || 0
  const sorted  = [...ops].sort((a,b)=>opSortKey(a.abertura).localeCompare(opSortKey(b.abertura)))
  const total   = ops.reduce((s,o)=>s+(o.res_op||0),0)
  const wins    = ops.filter(o=>(o.res_op||0)>0)
  const losses  = ops.filter(o=>(o.res_op||0)<0)
  const winRate = ops.length ? wins.length/ops.length*100 : 0
  const avgW    = wins.length   ? wins.reduce((s,o)=>s+o.res_op,0)/wins.length   : 0
  const avgL    = losses.length ? Math.abs(losses.reduce((s,o)=>s+o.res_op,0)/losses.length) : 0
  const grossW  = wins.reduce((s,o)=>s+o.res_op,0)
  const grossL  = Math.abs(losses.reduce((s,o)=>s+o.res_op,0))
  const pf      = grossL > 0 ? grossW/grossL : wins.length > 0 ? 999 : 0
  const payoff  = avgL > 0 ? avgW/avgL : avgW > 0 ? 3 : 0

  // Drawdown sobre capital
  let equity=cap, peak=cap, ddMax=0, ddAtual=0
  const equityArr=[], ddArr=[]
  sorted.forEach(op => {
    equity += op.res_op||0
    equityArr.push(equity)
    if (equity > peak) peak = equity
    const dd = Math.max(0, peak-equity)
    if (dd > ddMax) ddMax = dd
    ddAtual = dd
    ddArr.push(cap > 0 ? (dd/cap)*100 : (peak > 0 ? (dd/peak)*100 : 0))
  })
  const ddMaxPct  = cap > 0 ? (ddMax/cap)*100  : (peak > 0 ? (ddMax/peak)*100  : null)
  const ddAtualPct = cap > 0 ? (ddAtual/cap)*100 : (peak > 0 ? (ddAtual/peak)*100 : null)

  // Capital Necessário = DD Máximo (margem mínima recomendada)
  // Capital Mínimo Estimado = DD Máximo × 1.5 (buffer de segurança)
  const capitalNecessario = ddMax * 1.5

  // Rentabilidade total
  const rentTotal = cap > 0 ? (total/cap)*100 : null

  // Meses positivos
  const byMonth = {}
  ops.forEach(op => { const k=opToMonthKey(op.abertura); if(k) byMonth[k]=(byMonth[k]||0)+(op.res_op||0) })
  const monthVals    = Object.values(byMonth)
  const nMonths      = monthVals.length
  const mesesPos     = monthVals.filter(v=>v>0).length
  const mesesNeg     = monthVals.filter(v=>v<0).length
  const avgMonth     = nMonths ? monthVals.reduce((a,b)=>a+b,0)/nMonths : 0

  // Sharpe estimado (mensal, rf=0)
  const monthStd = nMonths > 1
    ? Math.sqrt(monthVals.map(v=>Math.pow(v-avgMonth,2)).reduce((a,b)=>a+b,0)/(nMonths-1))
    : 0
  const sharpe = monthStd > 0 ? avgMonth/monthStd : null

  // M.6015 = Fator de Lucro + Fator de Recuperação Anualizado
  // Fator de Recuperação = total / ddMax
  // Anualizado = FatorRecup * sqrt(12 / nMonths) para normalizar para 12 meses
  const fatorRecup = ddMax > 0 ? total / ddMax : (total > 0 ? 999 : 0)
  const fatorRecupAnual = nMonths > 0 ? fatorRecup * Math.sqrt(12 / nMonths) : fatorRecup
  const score6015 = pf + Math.max(0, fatorRecupAnual)   // PF + FR Anualizado
  const scoreLbl  = (() => {
    if (score6015 >= 6)  return { label:'Excelente', color:'#34d47e' }
    if (score6015 >= 4)  return { label:'Bom',       color:'#4f8ef7' }
    if (score6015 >= 2.5)return { label:'Regular',   color:'#f5a623' }
    if (score6015 >= 1.5)return { label:'Fraco',     color:'#f06060' }
    return                      { label:'Crítico',   color:'#9f1239' }
  })()

  // Contratos por mês (média de qtd por mês)
  const qtdByMonth = {}
  ops.forEach(op => { const k=opToMonthKey(op.abertura); if(k) qtdByMonth[k]=(qtdByMonth[k]||0)+(op.qtd||1) })
  const qtdVals      = Object.values(qtdByMonth)
  const avgContratosMes = qtdVals.length ? qtdVals.reduce((a,b)=>a+b,0)/qtdVals.length : 0
  const totalContratos  = qtdVals.reduce((a,b)=>a+b,0)

  // ── DD Events: detecta cada DD completo (do eixo zero ao fundo e recuperação ao pico)
  // Um DD começa quando equity cai abaixo do pico anterior e termina quando volta ao pico.
  // A profundidade é medida como (pico - fundo) / capital_inicial (ou pico se não tiver capital).
  const ddEvents = []
  {
    let peak2 = cap > 0 ? cap : 0  // pico dinâmico
    let inDD2 = false
    let ddDepth = 0  // profundidade máxima do DD atual
    const base = cap > 0 ? cap : 1  // denominador para %
    let eq2 = cap > 0 ? cap : 0

    sorted.forEach(op => {
      eq2 += op.res_op || 0
      if (!inDD2) {
        if (eq2 > peak2) {
          peak2 = eq2  // novo pico — não está em DD
        } else if (eq2 < peak2) {
          inDD2 = true  // entrou em DD
          ddDepth = (peak2 - eq2) / base
        }
      } else {
        // Atualiza profundidade máxima do DD em curso
        const depth = (peak2 - eq2) / base
        if (depth > ddDepth) ddDepth = depth
        if (eq2 >= peak2) {
          // Recuperou: voltou ao pico anterior — DD terminado
          ddEvents.push({ recovered: true, pct: ddDepth })
          inDD2 = false
          ddDepth = 0
          peak2 = eq2
        }
      }
    })
    // Se ainda está em DD ao final, registra como não recuperado
    if (inDD2 && ddDepth > 0) {
      ddEvents.push({ recovered: false, pct: ddDepth })
    }
  }
  const ddsRecuperados   = ddEvents.filter(d=>d.recovered).length
  const ddsTotal         = ddEvents.length
  const ddAtivoNaoRecup  = ddEvents.length > 0 && !ddEvents[ddEvents.length-1].recovered

  // DDs >= ddAtual (em profundidade) que foram recuperados
  const curDDpct         = ddAtualPct != null ? ddAtualPct/100 : ddMax/Math.max(cap,1)
  const ddsGtAtual       = ddEvents.filter(d=>d.recovered && d.pct >= curDDpct).length
  const ddsGtAtualTotal  = ddEvents.filter(d=>d.pct >= curDDpct).length

  // Série temporal para gráficos
  const chartLabels = sorted.map(o=>(o.abertura||'').slice(0,10))

  return {
    total, winRate, avgW, avgL, pf, payoff, nMonths, avgMonth, mesesPos, mesesNeg,
    ddMax, ddMaxPct, ddAtual, ddAtualPct, capitalNecessario, rentTotal,
    sharpe, score6015, scoreLbl, fatorRecup, fatorRecupAnual,
    avgContratosMes, totalContratos,
    ddsRecuperados, ddsTotal, ddAtivoNaoRecup,
    ddsGtAtual, ddsGtAtualTotal, ddAtualPct,
    ddEvents,
    nOps: ops.length, cap,
    equityArr, ddArr, chartLabels,
    monthlyLabels: Object.keys(byMonth).sort((a,b)=>{const[ma,ya]=a.split('/'),[ mb,yb]=b.split('/');return(Number(ya)*12+Number(ma))-(Number(yb)*12+Number(mb))}),
    monthlyData: (() => { const ks=Object.keys(byMonth).sort((a,b)=>{const[ma,ya]=a.split('/'),[ mb,yb]=b.split('/');return(Number(ya)*12+Number(ma))-(Number(yb)*12+Number(mb))}); return ks.map(k=>byMonth[k]) })(),
  }
}

// ─── Charts para Análise ──────────────────────────────────────────────────────
function AnaliseEquityChart({ data, labels, cap }) {
  const ref=useRef(null),chart=useRef(null)
  useEffect(()=>{
    if(!ref.current)return;if(chart.current){chart.current.destroy();chart.current=null};if(!data.length)return
    const last=data[data.length-1],base=cap||0,col=last>=base?'#34d47e':'#f06060',fill=last>=base?'rgba(52,212,126,0.08)':'rgba(240,96,96,0.08)'
    chart.current=new Chart(ref.current.getContext('2d'),{type:'line',data:{labels,datasets:[{data,borderColor:col,backgroundColor:fill,fill:true,tension:0.3,pointRadius:0,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${fmtBRL(c.raw)}`}}},scales:{x:{ticks:{color:'#94a3b8',maxTicksLimit:8},grid:{display:false}},y:{ticks:{color:'#94a3b8',callback:v=>`R$${fmt(v,0)}`},grid:{color:'rgba(255,255,255,0.06)'}}}}})
    return()=>{if(chart.current){chart.current.destroy();chart.current=null}}
  },[data,labels])
  return<div style={{position:'relative',height:220}}><canvas ref={ref}/></div>
}

function AnaliseDDChart({ data, labels }) {
  const ref=useRef(null),chart=useRef(null)
  // Converte para negativo: DD vai de 0 para baixo
  const negData = useMemo(()=>data.map(v=>-Math.abs(v)),[data])
  useEffect(()=>{
    if(!ref.current)return;if(chart.current){chart.current.destroy();chart.current=null};if(!negData.length)return
    chart.current=new Chart(ref.current.getContext('2d'),{
      type:'line',
      data:{labels,datasets:[{data:negData,borderColor:'#f06060',backgroundColor:'rgba(240,96,96,0.15)',fill:true,tension:0.3,pointRadius:0,borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
        plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`DD: ${fmt(Math.abs(c.raw),2)}%`}}},
        scales:{
          x:{ticks:{color:'#94a3b8',maxTicksLimit:8},grid:{display:false}},
          y:{max:0,ticks:{color:'#94a3b8',callback:v=>`${fmt(Math.abs(v),1)}%`},grid:{color:'rgba(255,255,255,0.06)'}}
        }}})
    return()=>{if(chart.current){chart.current.destroy();chart.current=null}}
  },[negData,labels])
  return<div style={{position:'relative',height:180}}><canvas ref={ref}/></div>
}

function AnaliseMonthlyChart({ labels, data }) {
  const ref=useRef(null),chart=useRef(null)
  const years = useMemo(()=>{
    const s=new Set(['Todos'])
    labels.forEach(l=>{ const yy=l.split('/')[1]; if(yy) s.add('20'+yy) })
    return [...s]
  },[labels])
  const [year,setYear] = useState('Todos')
  const { fl, fd } = useMemo(()=>{
    if (year==='Todos') return { fl:labels, fd:data }
    const yy = year.slice(-2)
    const fl=[],fd=[]
    labels.forEach((l,i)=>{ if(l.endsWith(yy)){fl.push(l);fd.push(data[i])} })
    return { fl, fd }
  },[labels,data,year])
  useEffect(()=>{
    if(!ref.current)return;if(chart.current){chart.current.destroy();chart.current=null};if(!fl.length)return
    chart.current=new Chart(ref.current.getContext('2d'),{type:'bar',data:{labels:fl,datasets:[{data:fd,backgroundColor:fd.map(v=>v>=0?'rgba(52,212,126,0.75)':'rgba(240,96,96,0.75)'),borderColor:fd.map(v=>v>=0?'#34d47e':'#f06060'),borderWidth:1,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` R$ ${fmt(c.raw)}`}}},scales:{x:{ticks:{color:'#94a3b8'},grid:{color:'rgba(255,255,255,0.03)'}},y:{ticks:{color:'#94a3b8',callback:v=>`R$${fmt(v,0)}`},grid:{color:'rgba(255,255,255,0.06)'}}}}})
    return()=>{if(chart.current){chart.current.destroy();chart.current=null}}
  },[fl,fd])
  return(
    <div>
      {years.length>2&&<div style={{display:'flex',gap:5,marginBottom:10,flexWrap:'wrap'}}>
        {years.map(y=><button key={y} className={`btn sm${y===year?' primary':''}`} onClick={()=>setYear(y)} style={{fontSize:11}}>{y}</button>)}
      </div>}
      {!fl.length?<div style={{color:'var(--text-hint)',fontSize:13,padding:'20px 0',textAlign:'center'}}>Sem dados para {year}.</div>
        :<div style={{position:'relative',height:200}}><canvas ref={ref}/></div>}
    </div>
  )
}

function AnaliseRobotChart({ ops, rc, accent }) {
  const ref=useRef(null),chart=useRef(null)
  const {labels,data,colors}=useMemo(()=>{
    const rows=rc.map(r=>{
      const rOps=ops.filter(o=>o.ativo===r.name)
      return{name:r.name,total:rOps.reduce((s,o)=>s+(o.res_op||0),0),nOps:rOps.length}
    }).filter(r=>r.nOps>0).sort((a,b)=>b.total-a.total)
    return{labels:rows.map(r=>r.name),data:rows.map(r=>r.total),colors:rows.map(r=>r.total>=0?'rgba(52,212,126,0.75)':'rgba(240,96,96,0.75)')}
  },[ops,rc])
  useEffect(()=>{
    if(!ref.current)return;if(chart.current){chart.current.destroy();chart.current=null};if(!labels.length)return
    chart.current=new Chart(ref.current.getContext('2d'),{type:'bar',data:{labels,datasets:[{data,backgroundColor:colors,borderColor:data.map(v=>v>=0?'#34d47e':'#f06060'),borderWidth:1,borderRadius:4}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` R$ ${fmt(c.raw)}`}}},scales:{x:{ticks:{color:'#94a3b8',callback:v=>`R$${fmt(v,0)}`},grid:{color:'rgba(255,255,255,0.06)'}},y:{ticks:{color:'#94a3b8',font:{size:11}},grid:{display:false}}}}})
    return()=>{if(chart.current){chart.current.destroy();chart.current=null}}
  },[labels,data,colors])
  if(!labels.length) return<div style={{color:'var(--text-hint)',fontSize:13}}>Sem dados.</div>
  return<div style={{position:'relative',height:Math.max(180,labels.length*32)}}><canvas ref={ref}/></div>
}

// Pearson correlation entre dois arrays de mesma dimensão
function pearson(a, b) {
  const n = a.length
  if (n < 2) return 0
  const ma = a.reduce((s,v)=>s+v,0)/n, mb = b.reduce((s,v)=>s+v,0)/n
  let num=0, da=0, db=0
  for (let i=0;i<n;i++) { num+=(a[i]-ma)*(b[i]-mb); da+=(a[i]-ma)**2; db+=(b[i]-mb)**2 }
  const denom = Math.sqrt(da)*Math.sqrt(db)
  return denom > 0 ? num/denom : 0
}

function AnaliseCorrelacaoChart({ ops, rc }) {
  // Monta série mensal por estratégia
  const { names, matrix, months } = useMemo(() => {
    const active = rc.filter(r => ops.some(o=>o.ativo===r.name))
    if (active.length < 2) return { names:[], matrix:[], months:[] }

    // Todos os meses presentes
    const allMonths = [...new Set(ops.map(o=>opToMonthKey(o.abertura)).filter(Boolean))].sort((a,b)=>{
      const [ma,ya]=a.split('/'), [mb,yb]=b.split('/')
      return (Number(ya)*12+Number(ma))-(Number(yb)*12+Number(mb))
    })

    // Série mensal por estratégia
    const series = {}
    active.forEach(r => {
      const map = {}
      ops.filter(o=>o.ativo===r.name).forEach(o=>{const k=opToMonthKey(o.abertura);if(k)map[k]=(map[k]||0)+(o.res_op||0)})
      series[r.name] = allMonths.map(m => map[m]||0)
    })

    // Matriz de correlação N×N
    const names = active.map(r=>r.name)
    const matrix = names.map(a => names.map(b => pearson(series[a], series[b])))
    return { names, matrix, months: allMonths }
  }, [ops, rc])

  if (names.length < 2) return (
    <div style={{color:'var(--text-hint)',fontSize:13,padding:'20px 0',textAlign:'center'}}>
      Necessário ≥ 2 estratégias com operações para calcular correlação.
    </div>
  )

  // Cor da célula: azul = +1, branco = 0, vermelho = -1
  function cellBg(v) {
    if (v >= 0) { const t=v; return `rgba(52,212,126,${0.1+t*0.7})` }
    else { const t=Math.abs(v); return `rgba(240,96,96,${0.1+t*0.7})` }
  }
  function cellText(v) { return Math.abs(v) > 0.5 ? '#fff' : 'var(--text-muted)' }
  const cellSize = Math.max(36, Math.min(60, Math.floor(480/names.length)))

  return (
    <div style={{overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse',fontSize:11}}>
        <thead>
          <tr>
            <th style={{width:cellSize,padding:'4px'}}/>
            {names.map(n=>(
              <th key={n} style={{padding:'4px 6px',color:'var(--text-muted)',fontWeight:500,maxWidth:cellSize,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:10}}
                title={n}>{n.length>6?n.slice(0,5)+'…':n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {names.map((rowN,ri)=>(
            <tr key={rowN}>
              <td style={{padding:'3px 6px',color:'var(--text-muted)',fontWeight:500,fontSize:10,whiteSpace:'nowrap',maxWidth:cellSize,overflow:'hidden',textOverflow:'ellipsis'}} title={rowN}>
                {rowN.length>6?rowN.slice(0,5)+'…':rowN}
              </td>
              {matrix[ri].map((v,ci)=>(
                <td key={ci} style={{width:cellSize,height:cellSize,textAlign:'center',background:cellBg(v),color:cellText(v),fontWeight:700,fontSize:10,borderRadius:3,border:'1px solid rgba(0,0,0,0.15)',cursor:'default'}} title={`${rowN} × ${names[ci]}: ${fmt(v,2)}`}>
                  {ri===ci ? '—' : fmt(v,2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{marginTop:10,display:'flex',alignItems:'center',gap:8}}>
        <div style={{width:80,height:8,borderRadius:4,background:'linear-gradient(to right,rgba(240,96,96,0.8),rgba(255,255,255,0.1),rgba(52,212,126,0.8))'}}/>
        <span style={{fontSize:10,color:'var(--text-hint)'}}>-1 (descorrelacionado) → +1 (correlacionado)</span>
      </div>
    </div>
  )
}

// ─── Análise helpers (fora do componente para evitar re-criação) ─────────────
function AnACard({label, value, sub, color, leftColor}) {
  return (
    <div className="card" style={{padding:'14px 18px', borderLeft:leftColor?`3px solid ${leftColor}`:undefined}}>
      <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:5}}>{label}</div>
      <div style={{fontSize:20,fontWeight:700,color:color||'var(--text)'}}>{value}</div>
      {sub && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>{sub}</div>}
    </div>
  )
}
function AnChartCard({title, children, span}) {
  return (
    <div className="card" style={{padding:'16px 20px', gridColumn:span?`span ${span}`:undefined}}>
      <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:14}}>{title}</div>
      {children}
    </div>
  )
}

// ─── Tab: Análise ─────────────────────────────────────────────────────────────
function AnaliseTab({ portfolios, allOps, initialId }) {
  const [typeFilter, setTypeFilter] = useState('all')
  const [selId, setSelId] = useState(()=> initialId || portfolios[0]?.id || null)
  const [ddThreshold, setDdThreshold] = useState(10) // % slider para DDs

  useEffect(()=>{ if(initialId) setSelId(initialId) }, [initialId])

  // Portfólios filtrados por tipo
  const filtered = useMemo(()=>
    typeFilter==='all' ? portfolios : portfolios.filter(p=>(p.logo||'none')===typeFilter)
  , [portfolios, typeFilter])

  // Ajusta seleção quando filtro muda
  useEffect(()=>{
    if(filtered.length && !filtered.find(p=>p.id===selId)) setSelId(filtered[0].id)
  }, [filtered])

  const portfolio = portfolios.find(p => p.id === selId) || null
  const cv   = useMemo(()=> portfolio ? getConfigVersions(portfolio) : [], [portfolio])
  const rc   = useMemo(()=> portfolio ? getCurrentRobots(portfolio)  : [], [portfolio])
  const raw  = portfolio ? (allOps[selId]||[]) : []
  const ops  = useMemo(()=> applyLotesVersioned(raw, cv), [raw, cv])
  const cap  = parseFloat(portfolio?.capital_inicial) || 0
  const acc  = portfolio?.cor || '#f5a623'
  const an   = useMemo(()=> calcAnalise(ops, cap), [ops, cap])

  // DDs dinâmicos pelo threshold do slider
  const ddsByThreshold = useMemo(()=>{
    if (!an?.ddEvents) return { ddsRecup:0, ddsTotal:0, ddAtivo:false }
    const threshold = ddThreshold/100
    const events = an.ddEvents.filter(d => d.pct >= threshold)
    return {
      ddsRecup:  events.filter(d=>d.recovered).length,
      ddsTotal:  events.length,
      ddAtivo:   an.ddAtivoNaoRecup && an.ddEvents[an.ddEvents.length-1]?.pct >= threshold,
    }
  }, [an, ddThreshold])

  // Tipos presentes
  const typeCount = useMemo(()=>{
    const m={}; portfolios.forEach(p=>{const k=p.logo||'none';m[k]=(m[k]||0)+1}); return m
  }, [portfolios])

  if (!portfolios.length) return (
    <div className="empty-state">
      <div style={{fontSize:40,marginBottom:14}}>📊</div>
      <div style={{fontSize:16,color:'var(--text-muted)'}}>Nenhum portfólio criado.</div>
    </div>
  )

  return (
    <div>
      {/* Filtro por tipo */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10,alignItems:'center'}}>
        <span style={{fontSize:12,color:'var(--text-muted)'}}>Tipo:</span>
        {[{id:'all',label:'Todos',count:portfolios.length},
          ...LOGO_OPTIONS.filter(o=>typeCount[o.id]).map(o=>({id:o.id,label:o.label,count:typeCount[o.id]})),
          ...(typeCount['none']?[{id:'none',label:'Sem tipo',count:typeCount['none']}]:[])
        ].map(f=>(
          <button key={f.id} onClick={()=>setTypeFilter(f.id)} style={{
            display:'inline-flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:14,fontSize:11,cursor:'pointer',
            background:typeFilter===f.id?'rgba(245,166,35,0.15)':'rgba(255,255,255,0.04)',
            border:`1px solid ${typeFilter===f.id?'rgba(245,166,35,0.5)':'var(--border)'}`,
            color:typeFilter===f.id?'var(--warning)':'var(--text-muted)',fontWeight:typeFilter===f.id?700:400,
          }}>
            {f.id!=='all'&&f.id!=='none'&&<LogoBadge logo={f.id} size={12}/>}
            {f.label} <span style={{fontSize:10,opacity:.6}}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Seletor de portfólio */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:20,alignItems:'center'}}>
        <span style={{fontSize:12,color:'var(--text-muted)'}}>Portfólio:</span>
        {filtered.map(p => (
          <button key={p.id} onClick={()=>setSelId(p.id)} style={{
            display:'inline-flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:16,fontSize:12,cursor:'pointer',
            fontWeight:selId===p.id?700:400,
            background:selId===p.id?`${p.cor||'#f5a623'}18`:'rgba(255,255,255,0.04)',
            border:`1px solid ${selId===p.id?(p.cor||'#f5a623')+'60':'var(--border)'}`,
            color:selId===p.id?(p.cor||'#f5a623'):'var(--text-muted)',
          }}>
            <LogoBadge logo={p.logo} size={13}/>{p.name}
          </button>
        ))}
      </div>

      {!portfolio ? null : !an ? (
        <div className="empty-state">
          <div style={{fontSize:36,marginBottom:12}}>📭</div>
          <div style={{fontSize:15,color:'var(--text-muted)'}}>Sem operações para {portfolio.name}.</div>
          <div style={{fontSize:13,color:'var(--text-hint)',marginTop:6}}>As operações são puxadas do My Dash pelo nome da estratégia.</div>
        </div>
      ) : (
        <>
          {/* ── Cards — grid 4 colunas, destaques em span 2 ── */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:12,marginBottom:20}}>

            {/* Resultado Total — destaque, span 2, fonte maior */}
            <div className="card" style={{gridColumn:'span 2',padding:'18px 22px',borderLeft:`4px solid ${acc}`}}>
              <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>Resultado Total</div>
              <div style={{fontSize:32,fontWeight:900,color:colorVal(an.total),letterSpacing:'-.5px'}}>{fmtBRL(an.total)}</div>
              <div style={{display:'flex',gap:16,marginTop:6,flexWrap:'wrap'}}>
                {an.rentTotal!=null&&<span style={{fontSize:13,color:colorVal(an.total),fontWeight:600}}>{fmtPct(an.rentTotal)}</span>}
                <span style={{fontSize:12,color:'var(--text-muted)'}}>{an.nOps} operações · {an.nMonths} meses</span>
                {cap>0&&<span style={{fontSize:12,color:'var(--text-muted)'}}>Capital: {fmtBRL(cap)}</span>}
              </div>
            </div>

            {/* Ganho Médio Mensal */}
            <AnACard label="Ganho Médio Mensal" value={fmtBRL(an.avgMonth)} sub={`${an.mesesPos} meses positivos de ${an.nMonths}`} color={colorVal(an.avgMonth)}/>
            {/* Meses Positivos */}
            <AnACard label="Meses Positivos" value={`${an.mesesPos} / ${an.nMonths}`} sub={`${an.mesesNeg} negativos`} color={an.mesesPos>an.mesesNeg?'var(--success)':'var(--warning)'}/>

            {/* DD Atual — destaque, span 2, fonte maior */}
            <div className="card" style={{gridColumn:'span 2',padding:'18px 22px',borderLeft:'4px solid var(--danger)'}}>
              <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>DD Atual</div>
              <div style={{fontSize:32,fontWeight:900,color:an.ddAtual>0?'var(--danger)':'var(--success)',letterSpacing:'-.5px'}}>
                {an.ddAtualPct!=null ? fmtPct(an.ddAtualPct) : fmtBRL(an.ddAtual)}
              </div>
              <div style={{display:'flex',gap:16,marginTop:6,flexWrap:'wrap'}}>
                <span style={{fontSize:12,color:'var(--text-muted)'}}>Em reais: {fmtBRL(an.ddAtual)}</span>
                <span style={{fontSize:12,color:'var(--danger)'}}>DD Máx: {an.ddMaxPct!=null?fmtPct(an.ddMaxPct):fmtBRL(an.ddMax)} ({fmtBRL(an.ddMax)})</span>
              </div>
            </div>

            {/* Taxa de Acerto */}
            <AnACard label="Taxa de Acerto" value={fmtPct(an.winRate)} sub={`${an.nOps} operações`} color="var(--accent)"/>
            {/* Fator de Lucro */}
            <AnACard label="Fator de Lucro" value={fmt(an.pf)} sub={`Méd. ganho: ${fmtBRL(an.avgW)}`} color={an.pf>=1.5?'var(--success)':'var(--warning)'}/>

            {/* Payoff */}
            <AnACard label="Payoff Médio" value={`${fmt(an.payoff)}x`} sub={`${fmtBRL(an.avgW)} / ${fmtBRL(an.avgL)}`} color={an.payoff>=1?'var(--success)':'var(--danger)'}/>
            {/* M.6015 */}
            <AnACard label="M.6015 (PF + FR Anual.)" value={fmt(an.score6015,2)} sub={`${an.scoreLbl.label} · PF ${fmt(an.pf,2)} + FR ${fmt(Math.max(0,an.fatorRecupAnual),2)}`} color={an.scoreLbl.color}/>
            {/* Sharpe */}
            <AnACard label="Sharpe (Est.)" value={an.sharpe!=null?fmt(an.sharpe,2):'—'} sub="base mensal, rf=0" color={an.sharpe!=null?(an.sharpe>=1?'var(--success)':an.sharpe>=0?'var(--warning)':'var(--danger)'):'var(--text-muted)'}/>
            {/* Contratos/mês */}
            <AnACard label="Contratos / Mês" value={fmt(an.avgContratosMes,0)} sub={`${fmt(an.totalContratos,0)} total · ${an.nMonths} meses`} color="var(--text)"/>

            {/* DD slider — span 2 para caber o slider confortavelmente */}
            <div className="card" style={{gridColumn:'span 2',padding:'14px 18px'}}>
              <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8}}>
                DDs ≥ <strong style={{color:'var(--accent)'}}>{ddThreshold}%</strong> — Recuperados
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                <span style={{fontSize:24,fontWeight:800,color:ddsByThreshold.ddsRecup===ddsByThreshold.ddsTotal&&ddsByThreshold.ddsTotal>0?'var(--success)':'var(--warning)'}}>{ddsByThreshold.ddsRecup}</span>
                <span style={{fontSize:14,color:'var(--text-muted)'}}>/ {ddsByThreshold.ddsTotal}</span>
                <span style={{fontSize:11,color:ddsByThreshold.ddAtivo?'var(--warning)':'var(--text-muted)',marginLeft:'auto'}}>
                  {ddsByThreshold.ddAtivo?'⚠ DD ativo':'✓ Todos recuperados'}
                </span>
              </div>
              <div style={{height:5,background:'rgba(255,255,255,0.07)',borderRadius:3,marginBottom:8,overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:3,background:ddsByThreshold.ddsRecup===ddsByThreshold.ddsTotal&&ddsByThreshold.ddsTotal>0?'var(--success)':'var(--warning)',width:`${ddsByThreshold.ddsTotal>0?(ddsByThreshold.ddsRecup/ddsByThreshold.ddsTotal)*100:0}%`}}/>
              </div>
              <input type="range" min={1} max={50} step={1} value={ddThreshold} onChange={e=>setDdThreshold(Number(e.target.value))}
                style={{width:'100%',cursor:'pointer',accentColor:'var(--accent)'}}/>
              <div style={{fontSize:10,color:'var(--text-hint)',display:'flex',justifyContent:'space-between',marginTop:2}}>
                <span>1%</span><span>50%</span>
              </div>
            </div>

            {/* DDs ≥ Atual */}
            <div className="card" style={{gridColumn:'span 2',padding:'14px 18px'}}>
              <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8}}>
                DDs ≥ DD Atual {an.ddAtualPct!=null?`(${fmt(an.ddAtualPct,1)}%)`:''}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                <span style={{fontSize:24,fontWeight:800,color:'var(--success)'}}>{an.ddsGtAtual}</span>
                <span style={{fontSize:14,color:'var(--text-muted)'}}>/ {an.ddsGtAtualTotal}</span>
                <span style={{fontSize:11,color:'var(--text-muted)',marginLeft:'auto'}}>{an.ddsGtAtual} já se recuperaram</span>
              </div>
              <div style={{height:5,background:'rgba(255,255,255,0.07)',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:3,background:'var(--success)',width:`${an.ddsGtAtualTotal>0?(an.ddsGtAtual/an.ddsGtAtualTotal)*100:0}%`}}/>
              </div>
            </div>

          </div>

          {/* ── Gráficos ── */}
          <ErrorBoundary>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <AnChartCard title="Curva de Capital" span={2}>
                <AnaliseEquityChart data={an.equityArr} labels={an.chartLabels} cap={cap}/>
              </AnChartCard>
              <AnChartCard title="Curva de Drawdown">
                <AnaliseDDChart data={an.ddArr} labels={an.chartLabels}/>
              </AnChartCard>
              <AnChartCard title="Resultados Mensais">
                <AnaliseMonthlyChart labels={an.monthlyLabels} data={an.monthlyData}/>
              </AnChartCard>
              <AnChartCard title="Correlação Win Rate × Resultado">
                <AnaliseCorrelacaoChart ops={ops} rc={rc}/>
              </AnChartCard>
              <AnChartCard title="Contribuição por Robô">
                <AnaliseRobotChart ops={ops} rc={rc} accent={acc}/>
              </AnChartCard>
            </div>
          </ErrorBoundary>
        </>
      )}
    </div>
  )
}



// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMonthOps(ops, monthKey) {
  // monthKey = "MM/YY"
  return ops.filter(op => opToMonthKey(op.abertura) === monthKey)
}

function getMonthsAvailable(portfolios, allOps) {
  const set = new Set()
  portfolios.forEach(p => {
    const cv  = getConfigVersions(p)
    const ops = applyLotesVersioned(allOps[p.id]||[], cv)
    ops.forEach(op => { const k = opToMonthKey(op.abertura); if (k) set.add(k) })
  })
  return [...set].sort((a,b)=>{
    const [ma,ya]=a.split('/'), [mb,yb]=b.split('/')
    return (Number(yb)*12+Number(mb)) - (Number(ya)*12+Number(ma))
  })
}

function calcPeriodForPort(ops, capital, period) {
  const filtered = filterPeriod(ops, period)
  const total    = filtered.reduce((s,o)=>s+(o.res_op||0),0)
  const pct      = capital > 0 ? (total/capital)*100 : null
  return { total, pct }
}

// ─── Card Instagram — visão da plataforma (todos portfólios do tipo) ──────────
const INSTA_SIZE = 600  // px quadrado

function InstaCardPlataforma({ group, portfolios, allOps, monthKey }) {
  const logoSrc = getLogoSrc(group.logoId)
  const accent  = '#f5a623'

  const rows = useMemo(() => portfolios.map(p => {
    const cv  = getConfigVersions(p)
    const ops = applyLotesVersioned(allOps[p.id]||[], cv)
    const cap = parseFloat(p.capital_inicial)||0
    const mOps = getMonthOps(ops, monthKey)
    const total = mOps.reduce((s,o)=>s+(o.res_op||0),0)
    const pct   = cap > 0 ? (total/cap)*100 : null
    return { id:p.id, name:p.name, cor:p.cor||'#f5a623', total, pct, nOps:mOps.length, cap }
  }).filter(r => r.nOps > 0).sort((a,b)=>b.total-a.total), [portfolios, allOps, monthKey])

  const groupTotal = rows.reduce((s,r)=>s+r.total,0)
  const groupCap   = rows.reduce((s,r)=>s+r.cap,0)
  const groupPct   = groupCap > 0 ? (groupTotal/groupCap)*100 : null

  const [mm, yy] = monthKey.split('/')
  const monthLabel = `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][Number(mm)-1]} 20${yy}`

  if (!rows.length) return null

  return (
    <div style={{
      width: INSTA_SIZE, height: INSTA_SIZE, flexShrink:0,
      background: 'linear-gradient(160deg, #0f172a 0%, #1a1f35 60%, #0f172a 100%)',
      borderRadius: 16, overflow: 'hidden', position: 'relative',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Linha de brilho */}
      <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${accent},transparent)`}}/>

      {/* Header */}
      <div style={{padding:'22px 28px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {logoSrc
            ? <img src={logoSrc} style={{height:32,objectFit:'contain'}} alt="logo"/>
            : <span style={{fontSize:11,fontWeight:700,color:accent,background:`${accent}22`,padding:'3px 10px',borderRadius:6}}>{group.label.slice(0,6).toUpperCase()}</span>
          }
          <div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',letterSpacing:'.1em',textTransform:'uppercase',fontWeight:600}}>Portfólios Recomendados</div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.7)',fontWeight:600,marginTop:1}}>{group.label}</div>
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',letterSpacing:'.06em',textTransform:'uppercase'}}>Resultado</div>
          <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',fontWeight:600}}>{monthLabel}</div>
        </div>
      </div>

      {/* Total do grupo */}
      <div style={{padding:'0 28px 18px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'baseline',gap:12}}>
          <span style={{fontSize:38,fontWeight:900,color:groupTotal>=0?'#34d47e':'#f06060',letterSpacing:'-1px',lineHeight:1}}>
            {fmtBRL(groupTotal)}
          </span>
          {groupPct!=null&&<span style={{fontSize:16,fontWeight:600,color:groupTotal>=0?'rgba(52,212,126,0.7)':'rgba(240,96,96,0.7)'}}>
            {groupPct>=0?'+':''}{fmt(groupPct,1)}%
          </span>}
        </div>
        <div style={{height:1,background:'rgba(255,255,255,0.07)',marginTop:14}}/>
      </div>

      {/* Lista de portfólios */}
      <div style={{flex:1,padding:'0 28px',overflowY:'hidden',display:'flex',flexDirection:'column',gap:10,justifyContent:'center'}}>
        {rows.map(r => (
          <div key={r.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
            <div style={{display:'flex',alignItems:'center',gap:9}}>
              <span style={{display:'inline-block',width:8,height:8,borderRadius:2,background:r.cor,flexShrink:0}}/>
              <span style={{fontSize:14,fontWeight:600,color:'rgba(255,255,255,0.85)'}}>{r.name}</span>
              <span style={{fontSize:11,color:'rgba(255,255,255,0.3)'}}>{r.nOps} op{r.nOps!==1?'s':''}</span>
            </div>
            <div style={{display:'flex',alignItems:'baseline',gap:8,flexShrink:0}}>
              <span style={{fontSize:15,fontWeight:700,color:r.total>=0?'#34d47e':'#f06060'}}>{fmtBRL(r.total)}</span>
              {r.pct!=null&&<span style={{fontSize:11,color:'rgba(148,163,184,0.7)',fontWeight:500}}>{r.pct>=0?'+':''}{fmt(r.pct,1)}%</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{padding:'14px 28px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <img src={getLogoSrc('frantiesco')} style={{height:18,objectFit:'contain',opacity:.7}} alt="" onError={e=>e.target.style.display='none'}/>
          <span style={{fontSize:10,color:'rgba(255,255,255,0.25)',letterSpacing:'.05em'}}>CONTA REAL VERIFICADA</span>
        </div>
        <span style={{fontSize:10,color:'rgba(255,255,255,0.2)'}}>{monthLabel}</span>
      </div>
    </div>
  )
}

// ─── Card Instagram — portfólio individual ────────────────────────────────────
function InstaCardPortfolio({ portfolio, allOps, monthKey }) {
  const cv      = useMemo(()=>getConfigVersions(portfolio),[portfolio])
  const ops     = useMemo(()=>applyLotesVersioned(allOps[portfolio.id]||[], cv),[allOps, portfolio, cv])
  const cap     = parseFloat(portfolio.capital_inicial)||0
  const accent  = portfolio.cor||'#f5a623'
  const logoSrc = getLogoSrc(portfolio.logo)

  const [mm, yy] = monthKey.split('/')
  const monthLabel = `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][Number(mm)-1]} 20${yy}`

  const mOps    = useMemo(()=>getMonthOps(ops, monthKey),[ops,monthKey])
  const mTotal  = mOps.reduce((s,o)=>s+(o.res_op||0),0)
  const mPct    = cap>0?(mTotal/cap)*100:null

  const periodos = useMemo(()=>[
    { label:'Trimestre', period:'Trimestre' },
    { label:'Semestre',  period:'Semestre'  },
    { label:'Ano',       period:'Ano'       },
    { label:'Acumulado', period:'all'       },
  ].map(p=>{
    const filtered = p.period==='all' ? ops : filterPeriod(ops, p.period)
    const total    = filtered.reduce((s,o)=>s+(o.res_op||0),0)
    const pct      = cap>0?(total/cap)*100:null
    return {...p, total, pct}
  }),[ops,cap])

  const rc = useMemo(()=>getCurrentRobots(portfolio),[portfolio])

  if (!mOps.length) return null

  return (
    <div style={{
      width: INSTA_SIZE, height: INSTA_SIZE, flexShrink:0,
      background: `linear-gradient(160deg, #0f172a 0%, #111827 50%, #0f172a 100%)`,
      borderRadius: 16, overflow: 'hidden', position: 'relative',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Brilho na cor do portfólio */}
      <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,transparent,${accent},transparent)`}}/>
      <div style={{position:'absolute',top:0,left:0,bottom:0,width:3,background:`linear-gradient(180deg,${accent},transparent)`}}/>

      {/* Header */}
      <div style={{padding:'22px 28px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {logoSrc && <img src={logoSrc} style={{height:24,objectFit:'contain'}} alt="" onError={e=>e.target.style.display='none'}/>}
          <div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'.1em'}}>Portfólio Recomendado</div>
            <div style={{fontSize:16,fontWeight:800,color:'rgba(255,255,255,0.9)',letterSpacing:'-.2px'}}>{portfolio.name}</div>
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'.06em'}}>Resultado</div>
          <div style={{fontSize:12,color:accent,fontWeight:700}}>{monthLabel}</div>
        </div>
      </div>

      {/* Resultado mensal — destaque central */}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0 28px 10px'}}>
        {/* Valor por contrato / total */}
        <div style={{textAlign:'center',marginBottom:8}}>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'.12em',marginBottom:6}}>No mês</div>
          <div style={{fontSize:64,fontWeight:900,color:mTotal>=0?'#34d47e':'#f06060',letterSpacing:'-2px',lineHeight:1}}>
            {fmtBRL(mTotal)}
          </div>
          {mPct!=null&&(
            <div style={{fontSize:20,fontWeight:700,color:mTotal>=0?'rgba(52,212,126,0.7)':'rgba(240,96,96,0.7)',marginTop:6,letterSpacing:'-.3px'}}>
              {mPct>=0?'+':''}{fmt(mPct,2)}%
            </div>
          )}
          <div style={{fontSize:11,color:'rgba(255,255,255,0.2)',marginTop:6}}>{mOps.length} operação{mOps.length!==1?'s':''}</div>
        </div>

        {/* Divisor */}
        <div style={{width:'60%',height:1,background:`linear-gradient(90deg,transparent,${accent}60,transparent)`,margin:'10px 0'}}/>

        {/* Grid de períodos */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,width:'100%'}}>
          {periodos.map(p=>(
            <div key={p.label} style={{textAlign:'center',padding:'8px 4px',borderRadius:8,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}>
              <div style={{fontSize:9,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>{p.label}</div>
              <div style={{fontSize:13,fontWeight:700,color:p.total>=0?'#34d47e':'#f06060',letterSpacing:'-.2px'}}>{fmtBRL(p.total)}</div>
              {p.pct!=null&&<div style={{fontSize:10,color:'rgba(148,163,184,0.6)',marginTop:2}}>{p.pct>=0?'+':''}{fmt(p.pct,1)}%</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Estratégias */}
      <div style={{padding:'8px 28px',flexShrink:0}}>
        <div style={{display:'flex',flexWrap:'wrap',gap:'3px 8px',justifyContent:'center'}}>
          {rc.slice(0,10).map((r,i)=>(
            <span key={i} style={{fontSize:9,color:'rgba(255,255,255,0.3)',background:'rgba(255,255,255,0.04)',padding:'2px 7px',borderRadius:6}}>
              {r.name}{r.lotes!==1&&<sup style={{fontSize:7,marginLeft:1}}>{r.lotes}×</sup>}
            </span>
          ))}
          {rc.length>10&&<span style={{fontSize:9,color:'rgba(255,255,255,0.2)'}}>+{rc.length-10}</span>}
        </div>
      </div>

      {/* Footer */}
      <div style={{padding:'10px 28px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <img src={getLogoSrc('frantiesco')} style={{height:16,objectFit:'contain',opacity:.6}} alt="" onError={e=>e.target.style.display='none'}/>
          <span style={{fontSize:9,color:'rgba(255,255,255,0.2)',letterSpacing:'.05em'}}>CONTA REAL VERIFICADA · MÉTODO 6015</span>
        </div>
        <span style={{fontSize:9,color:'rgba(255,255,255,0.15)'}}>{monthLabel}</span>
      </div>
    </div>
  )
}

// ─── Tab: Mensal ───────────────────────────────────────────────────────────────
function MensalTab({ portfolios, allOps }) {
  // Mês selecionado
  const months = useMemo(()=>getMonthsAvailable(portfolios, allOps),[portfolios,allOps])
  const [monthKey,  setMonthKey]  = useState(()=>months[0]||'')
  const [typeFilter,setTypeFilter]= useState('all')
  const [selected,  setSelected]  = useState(null) // null = visão geral | portfolio.id = individual

  useEffect(()=>{ if(months.length && !months.includes(monthKey)) setMonthKey(months[0]) },[months])

  // Tipos disponíveis
  const typeCount = useMemo(()=>{const m={};portfolios.forEach(p=>{const k=p.logo||'none';m[k]=(m[k]||0)+1});return m},[portfolios])

  // Portfólios filtrados
  const filteredPortfolios = useMemo(()=>
    typeFilter==='all' ? portfolios : portfolios.filter(p=>(p.logo||'none')===typeFilter)
  ,[portfolios,typeFilter])

  // Grupos para visão geral
  const groups = useMemo(()=>DIARIO_GROUPS.map(g=>({
    ...g,
    portfolios: filteredPortfolios.filter(p=>(p.logo||'none')===g.logoId),
  })).filter(g=>{
    // só grupos que têm ops no mês
    return g.portfolios.some(p=>{
      const cv  = getConfigVersions(p)
      const ops = applyLotesVersioned(allOps[p.id]||[], cv)
      return getMonthOps(ops,monthKey).length > 0
    })
  }),[filteredPortfolios,allOps,monthKey])

  const selectedPortfolio = portfolios.find(p=>p.id===selected)||null

  if (!portfolios.length) return (
    <div className="empty-state"><div style={{fontSize:40,marginBottom:14}}>📸</div><div style={{fontSize:16,color:'var(--text-muted)'}}>Nenhum portfólio criado ainda.</div></div>
  )

  return (
    <div>
      {/* Toolbar */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20,flexWrap:'wrap'}}>

        {/* Seletor de mês */}
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <label style={{fontSize:12,color:'var(--text-muted)'}}>Mês:</label>
          <select value={monthKey} onChange={e=>{setMonthKey(e.target.value);setSelected(null)}}
            style={{padding:'6px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontSize:13}}>
            {months.map(m=>{
              const [mm,yy]=m.split('/')
              const label=`${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][Number(mm)-1]} 20${yy}`
              return <option key={m} value={m}>{label}</option>
            })}
          </select>
        </div>

        {/* Filtro por tipo */}
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontSize:12,color:'var(--text-muted)'}}>Plataforma:</span>
          {[{id:'all',label:'Todas',count:portfolios.length},
            ...LOGO_OPTIONS.filter(o=>typeCount[o.id]).map(o=>({id:o.id,label:o.label,count:typeCount[o.id]})),
            ...(typeCount['none']?[{id:'none',label:'Sem tipo',count:typeCount['none']}]:[])
          ].map(f=>(
            <button key={f.id} onClick={()=>{setTypeFilter(f.id);setSelected(null)}} style={{
              display:'inline-flex',alignItems:'center',gap:5,padding:'4px 11px',borderRadius:14,fontSize:11,cursor:'pointer',
              background:typeFilter===f.id?'rgba(245,166,35,0.15)':'rgba(255,255,255,0.04)',
              border:`1px solid ${typeFilter===f.id?'rgba(245,166,35,0.5)':'var(--border)'}`,
              color:typeFilter===f.id?'var(--warning)':'var(--text-muted)',
              fontWeight:typeFilter===f.id?700:400,
            }}>
              {f.id!=='all'&&f.id!=='none'&&<LogoBadge logo={f.id} size={12}/>}
              {f.label}
            </button>
          ))}
        </div>

        {/* Voltar ao geral */}
        {selected && (
          <button className="btn sm" onClick={()=>setSelected(null)} style={{marginLeft:'auto'}}>
            ← Voltar à visão geral
          </button>
        )}

        <div style={{marginLeft: selected?0:'auto',fontSize:11,color:'var(--text-hint)'}}>
          {INSTA_SIZE}×{INSTA_SIZE}px · formato Instagram
        </div>
      </div>

      {/* Instrução */}
      {!selected && (
        <div style={{marginBottom:16,fontSize:12,color:'var(--text-hint)',padding:'8px 12px',background:'rgba(255,255,255,0.02)',borderRadius:8,border:'1px solid var(--border)'}}>
          💡 Clique em um portfólio na lista abaixo para ver o card individual. Use <kbd style={{background:'rgba(255,255,255,0.08)',padding:'1px 6px',borderRadius:4,fontSize:11}}>Print Screen</kbd> ou a ferramenta de captura do sistema.
        </div>
      )}

      {/* ═══ VISÃO GERAL ═══ */}
      {!selected && !monthKey && (
        <div className="empty-state"><div style={{fontSize:36}}>📅</div><div style={{color:'var(--text-muted)',marginTop:12}}>Selecione um mês.</div></div>
      )}

      {!selected && monthKey && groups.length === 0 && (
        <div className="empty-state"><div style={{fontSize:36}}>📭</div><div style={{color:'var(--text-muted)',marginTop:12}}>Sem operações neste mês para os filtros selecionados.</div></div>
      )}

      {!selected && monthKey && groups.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:40}}>
          {groups.map(g => {
            const gPorts = g.portfolios.filter(p=>{
              const cv=getConfigVersions(p), ops=applyLotesVersioned(allOps[p.id]||[],cv)
              return getMonthOps(ops,monthKey).length>0
            })
            if (!gPorts.length) return null
            return (
              <div key={g.logoId}>
                <div style={{display:'flex',gap:32,alignItems:'flex-start',flexWrap:'wrap'}}>
                  {/* Card de print */}
                  <div style={{flexShrink:0}}>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
                      <LogoBadge logo={g.logoId} size={16}/>
                      <span style={{textTransform:'uppercase',letterSpacing:'.06em',fontWeight:600}}>{g.label}</span>
                    </div>
                    <InstaCardPlataforma group={g} portfolios={gPorts} allOps={allOps} monthKey={monthKey}/>
                  </div>

                  {/* Lista clicável dos portfólios */}
                  <div style={{flex:1,minWidth:240,display:'flex',flexDirection:'column',gap:8,paddingTop:34}}>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4}}>Clique para ver o card individual:</div>
                    {gPorts.map(p=>{
                      const cv  = getConfigVersions(p)
                      const ops = applyLotesVersioned(allOps[p.id]||[],cv)
                      const cap = parseFloat(p.capital_inicial)||0
                      const mOps = getMonthOps(ops,monthKey)
                      const total = mOps.reduce((s,o)=>s+(o.res_op||0),0)
                      const pct   = cap>0?(total/cap)*100:null
                      return (
                        <div key={p.id} onClick={()=>setSelected(p.id)}
                          className="card"
                          style={{padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',borderLeft:`3px solid ${p.cor||'#f5a623'}`,transition:'all .15s'}}
                          onMouseEnter={e=>{e.currentTarget.style.transform='translateX(3px)'}}
                          onMouseLeave={e=>{e.currentTarget.style.transform=''}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:13,fontWeight:600}}>{p.name}</span>
                            <span style={{fontSize:11,color:'var(--text-hint)',background:'rgba(255,255,255,0.05)',padding:'1px 7px',borderRadius:8}}>{mOps.length} ops</span>
                          </div>
                          <div style={{display:'flex',alignItems:'baseline',gap:7}}>
                            <span style={{fontSize:15,fontWeight:700,color:colorVal(total)}}>{fmtBRL(total)}</span>
                            {pct!=null&&<span style={{fontSize:11,color:'rgba(148,163,184,0.6)'}}>{pct>=0?'+':''}{fmt(pct,1)}%</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ INDIVIDUAL ═══ */}
      {selected && selectedPortfolio && (
        <div style={{display:'flex',gap:32,alignItems:'flex-start',flexWrap:'wrap'}}>
          <div style={{flexShrink:0}}>
            <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
              <LogoBadge logo={selectedPortfolio.logo} size={16}/>
              <span style={{textTransform:'uppercase',letterSpacing:'.06em',fontWeight:600}}>{selectedPortfolio.name}</span>
            </div>
            <InstaCardPortfolio portfolio={selectedPortfolio} allOps={allOps} monthKey={monthKey}/>
          </div>
          {/* Dica de print */}
          <div style={{paddingTop:34,maxWidth:260}}>
            <div className="card" style={{padding:'16px 18px'}}>
              <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>📸 Como fazer o print</div>
              <div style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.6}}>
                O card tem exatamente <strong>{INSTA_SIZE}×{INSTA_SIZE}px</strong> — formato quadrado ideal para feed do Instagram.<br/><br/>
                Use a ferramenta de recorte do Windows (<kbd style={{background:'rgba(255,255,255,0.08)',padding:'1px 6px',borderRadius:4,fontSize:11}}>Win+Shift+S</kbd>) e selecione apenas o card.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const TABS=['Portfólios','Diário','Mensal','Períodos','Calendário','Comparativo','Análise','Detalhes']

export default function MentoradosPage() {
  const[tab,setTab]=useState('Portfólios')
  const[portfolios,setPortfolios]=useState([])
  const[allOps,setAllOps]=useState({})
  const[strategies,setStrategies]=useState([])
  const[stratOps,setStratOps]=useState({})
  const[labPortfolios,setLabPortfolios]=useState([])
  const[loading,setLoading]=useState(true)
  const[apiError,setApiError]=useState(false)
  const[selectedId,setSelectedId]=useState(null)
  const[printPort,setPrintPort]=useState(null)
  const[analiseId,setAnaliseId]=useState(null)

  useEffect(()=>{loadAll()},[])

  async function loadAll() {
    setLoading(true); setApiError(false)
    try {
      const [pRes, oRes] = await Promise.all([
        fetch('/data/mentorados-portfolios.json'),
        fetch('/data/mentorados-ops.json'),
      ])
      const pList = await pRes.json()
      const allOpsList = await oRes.json()

      // Indexa ops por nome da estratégia (ativo)
      const opsByName = {}
      allOpsList.forEach(op => {
        const k = op.ativo
        if (!opsByName[k]) opsByName[k] = []
        opsByName[k].push(op)
      })

      const strats = [...new Set(allOpsList.map(o => o.ativo))].sort()
      setPortfolios(pList || [])
      setStrategies(strats)

      // Ops por portfólio
      const opsMap = {}
      for (const p of (pList || [])) {
        const names = getAllStrategyNames(p)
        const ops = names.flatMap(n => opsByName[n] || [])
          .sort((a,b) => opSortKey(b.abertura).localeCompare(opSortKey(a.abertura)))
        opsMap[p.id] = ops
      }
      setAllOps(opsMap)

      // Ops por estratégia
      const sMap = {}; strats.forEach(s => sMap[s] = opsByName[s] || [])
      setStratOps(sMap)
    } catch(e){ console.error('[MentoradosPage]', e); setApiError(true) }
    finally { setLoading(false) }
  }

  async function handleSave(data){ /* web: read-only */ }
  async function handleDelete(id){ /* web: read-only */ }
  function handleSelect(id){setSelectedId(id);setAnaliseId(id);setTab('Análise')}

  return(
    <div style={{padding:'24px 28px',maxWidth:1200,margin:'0 auto'}}>
      <div className="page-header" style={{marginBottom:24}}>
        <h1 style={{margin:0,fontSize:22,fontWeight:700}}>Mentorados<span style={{fontSize:13,fontWeight:400,color:'var(--text-muted)',marginLeft:12}}>Portfólios Recomendados · Método 6015</span></h1>
        {!loading&&!apiError&&portfolios.length>0&&<div style={{color:'var(--text-muted)',fontSize:13,marginTop:4}}>{portfolios.length} portfólio{portfolios.length!==1?'s':''} · {Object.values(allOps).reduce((s,o)=>s+o.length,0)} ops mapeadas</div>}
      </div>

      <div style={{display:'flex',gap:2,borderBottom:'1px solid var(--border)',marginBottom:28}}>
        {TABS.map(t=><button key={t} onClick={()=>setTab(t)} style={{background:'none',border:'none',padding:'9px 16px',fontSize:13,fontWeight:tab===t?700:400,color:tab===t?'var(--warning)':'var(--text-muted)',borderBottom:tab===t?'2px solid var(--warning)':'2px solid transparent',cursor:'pointer',marginBottom:-1,transition:'color .15s'}}>{t}</button>)}
      </div>

      {apiError&&<div style={{padding:'20px 24px',background:'rgba(240,96,96,0.08)',border:'1px solid rgba(240,96,96,0.25)',borderRadius:10}}><div style={{fontWeight:700,color:'var(--danger)',marginBottom:8}}>⚠ Erro ao carregar dados</div><div style={{fontSize:13,color:'var(--text-muted)',marginBottom:12}}>Verifique se os arquivos <strong>mentorados-portfolios.json</strong> e <strong>mentorados-ops.json</strong> estão em <strong>public/data/</strong>.</div><button className="btn sm primary" onClick={loadAll}>Tentar novamente</button></div>}
      {loading&&!apiError&&<div style={{textAlign:'center',padding:40,color:'var(--text-muted)',fontSize:14}}>Carregando portfólios...</div>}

      {!loading&&!apiError&&(
        <>
          {tab==='Portfólios'  &&<ErrorBoundary><PortfoliosTab  portfolios={portfolios} allOps={allOps} onSelect={handleSelect} onGoGerenciar={()=>setTab('Gerenciar')}/></ErrorBoundary>}
          {tab==='Diário'      &&<ErrorBoundary><DiarioTab      portfolios={portfolios} allOps={allOps}/></ErrorBoundary>}
          {tab==='Mensal'      &&<ErrorBoundary><MensalTab      portfolios={portfolios} allOps={allOps}/></ErrorBoundary>}
          {tab==='Períodos'    &&<ErrorBoundary><PeriodosTab    portfolios={portfolios} allOps={allOps}/></ErrorBoundary>}
          {tab==='Calendário'  &&<ErrorBoundary><CalendarioTab  portfolios={portfolios} allOps={allOps}/></ErrorBoundary>}
          {tab==='Comparativo' &&<ErrorBoundary><ComparativoTab portfolios={portfolios} allOps={allOps}/></ErrorBoundary>}
          {tab==='Análise'     &&<ErrorBoundary><AnaliseTab     portfolios={portfolios} allOps={allOps} initialId={analiseId}/></ErrorBoundary>}
          {tab==='Detalhes'     &&<ErrorBoundary><DetalheTab     portfolios={portfolios} selectedId={selectedId} onSelectId={id=>{setSelectedId(id);setAnaliseId(id)}} allOps={allOps} onShowPrint={()=>{const p=portfolios.find(x=>x.id===selectedId);if(p)setPrintPort(p)}}/></ErrorBoundary>}

        </>
      )}

      {printPort&&<PrintModal portfolio={printPort} ops={allOps[printPort.id]||[]} onClose={()=>setPrintPort(null)}/>}
    </div>
  )
}
