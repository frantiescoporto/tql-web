import React from 'react'

export default function PlatformBadge({ platform, size = 16 }) {
  const p = platform || 'profit'
  const isFile = typeof window !== 'undefined' && window.location.protocol === 'file:'
  const src = p === 'mt5'
    ? (isFile ? './mt5_logo.png' : 'http://localhost:5173/mt5_logo.png')
    : (isFile ? './profit_logo.png' : 'http://localhost:5173/profit_logo.png')
  const label = p === 'mt5' ? 'MetaTrader 5' : 'Profit'
  return (
    <img src={src} alt={label} title={label}
      style={{ width: size, height: size, objectFit: 'contain', borderRadius: 2, flexShrink: 0 }}
      onError={e => { e.target.style.display = 'none' }} />
  )
}
