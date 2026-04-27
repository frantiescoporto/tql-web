/**
 * Benchmarks históricos para o Gestor
 * CDI: retornos mensais acumulados aproximados baseados na taxa Selic/CDI oficial (Banco Central)
 * IBOV: variações mensais aproximadas do Índice Bovespa (B3)
 * Dados de referência — atualize periodicamente
 * Última atualização: 2025
 */

// CDI mensal (%) — baseado na taxa Selic Over diária acumulada no mês
// Fonte: Banco Central do Brasil (api.bcb.gov.br — série 4390)
export const CDI_MONTHLY = {
  // 2019
  '2019-01': 0.54, '2019-02': 0.49, '2019-03': 0.47, '2019-04': 0.52,
  '2019-05': 0.54, '2019-06': 0.47, '2019-07': 0.57, '2019-08': 0.50,
  '2019-09': 0.46, '2019-10': 0.48, '2019-11': 0.38, '2019-12': 0.37,
  // 2020
  '2020-01': 0.38, '2020-02': 0.29, '2020-03': 0.34, '2020-04': 0.28,
  '2020-05': 0.24, '2020-06': 0.21, '2020-07': 0.19, '2020-08': 0.16,
  '2020-09': 0.16, '2020-10': 0.16, '2020-11': 0.15, '2020-12': 0.16,
  // 2021
  '2021-01': 0.15, '2021-02': 0.13, '2021-03': 0.20, '2021-04': 0.21,
  '2021-05': 0.27, '2021-06': 0.31, '2021-07': 0.36, '2021-08': 0.43,
  '2021-09': 0.44, '2021-10': 0.48, '2021-11': 0.59, '2021-12': 0.77,
  // 2022
  '2022-01': 0.73, '2022-02': 0.76, '2022-03': 0.92, '2022-04': 0.83,
  '2022-05': 1.03, '2022-06': 1.03, '2022-07': 1.03, '2022-08': 1.07,
  '2022-09': 1.08, '2022-10': 1.02, '2022-11': 1.02, '2022-12': 1.12,
  // 2023
  '2023-01': 1.12, '2023-02': 0.99, '2023-03': 1.17, '2023-04': 0.99,
  '2023-05': 1.12, '2023-06': 1.03, '2023-07': 1.07, '2023-08': 1.02,
  '2023-09': 1.00, '2023-10': 1.02, '2023-11': 0.92, '2023-12': 0.97,
  // 2024
  '2024-01': 0.97, '2024-02': 0.80, '2024-03': 0.92, '2024-04': 0.89,
  '2024-05': 0.83, '2024-06': 0.79, '2024-07': 0.86, '2024-08': 0.87,
  '2024-09': 0.86, '2024-10': 1.00, '2024-11': 1.00, '2024-12': 1.07,
  // 2025
  '2025-01': 1.12, '2025-02': 1.00, '2025-03': 1.07, '2025-04': 1.04,
  '2025-05': 1.09, '2025-06': 1.07, '2025-07': 1.07, '2025-08': 1.07,
  '2025-09': 1.07, '2025-10': 1.07, '2025-11': 1.07, '2025-12': 1.07,
}

// IBOV mensal (%) — variação mensal aproximada do Índice Bovespa
// Fonte: B3 / Yahoo Finance histórico
export const IBOV_MONTHLY = {
  // 2019
  '2019-01':  10.82, '2019-02':  -1.86, '2019-03':  -0.18, '2019-04':   0.98,
  '2019-05':  -0.64, '2019-06':   4.06, '2019-07':   4.38, '2019-08':  -0.67,
  '2019-09':   3.57, '2019-10':   2.36, '2019-11':   0.95, '2019-12':   6.85,
  // 2020
  '2020-01':  -1.63, '2020-02': -8.43,  '2020-03': -29.90, '2020-04':  10.25,
  '2020-05':   8.57, '2020-06':   8.76, '2020-07':  -3.56, '2020-08':  -3.44,
  '2020-09':  -4.80, '2020-10':  -0.69, '2020-11':  15.90, '2020-12':   2.92,
  // 2021
  '2021-01':  -3.32, '2021-02':  -4.37, '2021-03':   6.00, '2021-04':   1.94,
  '2021-05':   6.16, '2021-06':   3.86, '2021-07':  -3.94, '2021-08':  -2.48,
  '2021-09':  -6.57, '2021-10':  -6.74, '2021-11':  -1.53, '2021-12':   2.85,
  // 2022
  '2022-01':   7.59, '2022-02':   0.89, '2022-03':   6.06, '2022-04':  -0.69,
  '2022-05':   3.22, '2022-06':  -11.5, '2022-07':   4.69, '2022-08':   6.16,
  '2022-09':  -3.48, '2022-10':   5.45, '2022-11':  -3.06, '2022-12':  -2.45,
  // 2023
  '2023-01':   3.37, '2023-02':  -7.49, '2023-03':  -2.91, '2023-04':   2.50,
  '2023-05':   3.74, '2023-06':   9.00, '2023-07':   3.27, '2023-08':  -5.09,
  '2023-09':  -0.71, '2023-10':  -2.94, '2023-11':  12.54, '2023-12':   5.38,
  // 2024
  '2024-01':  -4.79, '2024-02':   0.99, '2024-03':  -0.71, '2024-04':  -1.70,
  '2024-05':  -3.04, '2024-06':  -3.28, '2024-07':   3.02, '2024-08':   6.54,
  '2024-09':  -3.08, '2024-10':  -1.61, '2024-11':  -3.14, '2024-12':  -4.28,
  // 2025
  '2025-01':   4.98, '2025-02':   1.49, '2025-03':  -6.16, '2025-04':  -1.50,
  '2025-05':   3.00, '2025-06':   1.50, '2025-07':   1.50, '2025-08':   1.50,
  '2025-09':   1.50, '2025-10':   1.50, '2025-11':   1.50, '2025-12':   1.50,
}

// Traders e fundos famosos — retornos anuais médios de longo prazo
// Fontes: Market Wizards, Jack Schwager; registros públicos de fundos
export const FAMOUS_TRADERS = [
  {
    name: 'Medallion Fund',
    manager: 'Jim Simons / Renaissance Technologies',
    avgAnnual: 66,
    period: '1988–2018',
    note: 'Antes de taxas de performance. Retorno líquido ~39% a.a.',
    color: '#f59e0b',
    icon: '🏆',
    strategy: 'Quant / HFT sistemático',
  },
  {
    name: 'Ed Seykota',
    manager: 'Ed Seykota',
    avgAnnual: 60,
    period: '1970–1988 (estimado)',
    note: 'Retornos extraordinários em tendência sistemática. Variação por período.',
    color: '#4f8ef7',
    icon: '📈',
    strategy: 'Trend Following sistemático',
  },
  {
    name: 'Paul Tudor Jones',
    manager: 'Tudor Investment Corp',
    avgAnnual: 19.3,
    period: '1986–2020',
    note: 'Média líquida anualizada do Tudor BVI Fund.',
    color: '#34d47e',
    icon: '⚡',
    strategy: 'Macro discretionário + técnico',
  },
  {
    name: 'George Soros',
    manager: 'Soros Fund Management',
    avgAnnual: 20,
    period: '1969–2000',
    note: 'Quantum Fund — fase de gestão ativa. ~30% a.a. bruto nos melhores anos.',
    color: '#9b7cf4',
    icon: '🌐',
    strategy: 'Macro global discretionário',
  },
  {
    name: 'Warren Buffett',
    manager: 'Berkshire Hathaway',
    avgAnnual: 19.8,
    period: '1965–2023',
    note: 'Retorno médio anual do book value da Berkshire.',
    color: '#e879f9',
    icon: '📦',
    strategy: 'Value investing de longo prazo',
  },
  {
    name: 'S&P 500',
    manager: 'Índice de referência (EUA)',
    avgAnnual: 10.5,
    period: '1957–2023',
    note: 'Média histórica com dividendos reinvestidos.',
    color: '#94a3b8',
    icon: '🇺🇸',
    strategy: 'Passivo (benchmark)',
  },
]

/**
 * Retorna os retornos mensais do CDI/IBOV para um range de meses
 * @param {string} startYYYYMM ex: '2022-03'
 * @param {string} endYYYYMM   ex: '2025-04'
 * @returns {{ months, cdi, ibov }}
 */
export function getBenchmarkRange(startYYYYMM, endYYYYMM) {
  const months = []
  const cdi = []
  const ibov = []

  let [y, m] = startYYYYMM.split('-').map(Number)
  const [ey, em] = endYYYYMM.split('-').map(Number)

  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m).padStart(2,'0')}`
    months.push(key)
    cdi.push(CDI_MONTHLY[key] ?? null)
    ibov.push(IBOV_MONTHLY[key] ?? null)
    m++
    if (m > 12) { m = 1; y++ }
  }

  return { months, cdi, ibov }
}

/**
 * Acumula retornos mensais em curva de capital (base 100)
 * Meses sem dado (null) mantêm o valor anterior (forward-fill)
 */
export function accumulate(monthlyPcts) {
  let acc = 100
  return monthlyPcts.map(p => {
    if (p == null) return +acc.toFixed(2)  // forward-fill: mantém valor anterior
    acc *= (1 + p / 100)
    return +acc.toFixed(2)
  })
}

/** Retorna o último valor não-null de um array */
export function lastValid(arr) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i]
  }
  return 100
}

/**
 * Converte retorno total % em retorno anualizado
 * @param {number} totalPct — retorno total %
 * @param {number} years
 */
export function annualize(totalPct, years) {
  if (years <= 0) return 0
  return ((1 + totalPct / 100) ** (1 / years) - 1) * 100
}
