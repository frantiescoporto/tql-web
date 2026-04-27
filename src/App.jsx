import React, { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { DataProvider } from './context/DataContext.jsx'
import Navbar from './components/Navbar.jsx'
import LandingPage from './pages/LandingPage.jsx'
import RobotsPage from './pages/RobotsPage.jsx'
import RobotDetail from './pages/RobotDetail.jsx'
import PortfoliosPage from './pages/PortfoliosPage.jsx'
import PortfolioDetail from './pages/PortfolioDetail.jsx'
import SobrePage from './pages/SobrePage.jsx'

export default function App() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('tql-theme')
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.className = 'theme-' + theme
    localStorage.setItem('tql-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <DataProvider>
      <div className="web-layout">
        <Navbar theme={theme} toggleTheme={toggleTheme} />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/robots" element={<RobotsPage />} />
          <Route path="/robots/:id" element={<RobotDetail />} />
          <Route path="/portfolios" element={<PortfoliosPage />} />
          <Route path="/portfolios/:id" element={<PortfolioDetail />} />
          <Route path="/sobre" element={<SobrePage />} />
        </Routes>
        <footer className="footer">
          <div>Trade Quant Lab &middot; By Frantiesco Trader | Método 6015</div>
          <div style={{ marginTop: 6, fontSize: 12 }}>
            Resultados passados não garantem resultados futuros. Trading envolve risco.
          </div>
        </footer>
      </div>
    </DataProvider>
  )
}
