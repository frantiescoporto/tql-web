import React from 'react'
import { NavLink, useNavigate, Link } from 'react-router-dom'

export default function Navbar({ theme, toggleTheme }) {
  const navigate = useNavigate()

  return (
    <nav className="navbar">
      <a className="navbar-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <img
          src="/logo.png"
          alt="Trade Quant Lab"
          style={{ height: 32, width: 32, objectFit: 'contain' }}
        />
        Trade Quant <span>Lab</span>
      </a>

      <div className="navbar-links">
        <NavLink to="/" className={({ isActive }) => 'navbar-link' + (isActive ? ' active' : '')} end>
          Início
        </NavLink>
        <NavLink to="/robots" className={({ isActive }) => 'navbar-link' + (isActive ? ' active' : '')}>
          Estratégias
        </NavLink>
        <NavLink to="/portfolios" className={({ isActive }) => 'navbar-link' + (isActive ? ' active' : '')}>
          Portfólios
        </NavLink>
        <NavLink to="/sobre" className={({ isActive }) => 'navbar-link' + (isActive ? ' active' : '')}>
          Sobre o Método
        </NavLink>
        <NavLink to="/planos" className={({ isActive }) => 'navbar-link' + (isActive ? ' active' : '')}
          style={{ color: '#00d4aa', fontWeight: 600 }}>
          Planos
        </NavLink>
        <NavLink to="/portfolios-recomendados" className={({ isActive }) => 'navbar-link' + (isActive ? ' active' : '')}
          style={{ color: 'var(--warning)', fontWeight: 600 }}>
          🎯 Portfólios
        </NavLink>
      </div>

      <div className="navbar-actions">
        <button
          onClick={toggleTheme}
          style={{
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '5px 10px',
            cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)'
          }}
          title="Alternar tema"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <Link
          to="/planos"
          className="btn primary"
          style={{ fontSize: 13, padding: '7px 16px', textDecoration: 'none' }}
        >
          Ver Planos →
        </Link>
      </div>
    </nav>
  )
}
