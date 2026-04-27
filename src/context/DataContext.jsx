import React, { createContext, useContext, useEffect, useState } from 'react'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [robots, setRobots] = useState([])
  const [portfolios, setPortfolios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [rRes, pRes] = await Promise.all([
          fetch('/data/robots.json'),
          fetch('/data/portfolios.json'),
        ])
        if (!rRes.ok) throw new Error('Erro ao carregar robots.json')
        if (!pRes.ok) throw new Error('Erro ao carregar portfolios.json')
        const rData = await rRes.json()
        const pData = await pRes.json()
        setRobots(rData)
        setPortfolios(pData)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Simula window.api.robots.get(id) — retorna robô completo com operations/realOps
  const getRobot = (id) => {
    const numId = Number(id)
    return robots.find(r => r.id === numId) || null
  }

  // Simula window.api.portfolios.get(id)
  const getPortfolio = (id) => {
    const numId = Number(id)
    return portfolios.find(p => p.id === numId) || null
  }

  return (
    <DataContext.Provider value={{ robots, portfolios, getRobot, getPortfolio, loading, error }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
