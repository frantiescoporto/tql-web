import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

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
        <a
          href="https://wa.me/5553999793260"
          target="_blank"
          rel="noopener noreferrer"
          className="btn primary"
          style={{ fontSize: 13, padding: '7px 16px', textDecoration: 'none' }}
        >
          Quero saber mais →
        </a>
      </div>
    </nav>
  )
}
