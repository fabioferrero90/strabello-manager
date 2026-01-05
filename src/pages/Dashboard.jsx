import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBox, faClock, faCheck, faDollarSign, faMoneyBill, faLayerGroup, faCube, faShoppingBag, faChartLine } from '@fortawesome/free-solid-svg-icons'
import './Dashboard.css'

export default function Dashboard() {
  const [stats, setStats] = useState({
    warehouseValue: 0,
    inQueue: 0,
    available: 0,
    sold: 0,
    totalRevenue: 0,
  })

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    const [productsRes, salesRes] = await Promise.all([
      supabase.from('products').select('status, production_cost, production_extra_costs, quantity'),
      supabase.from('sales').select('revenue, quantity_sold, sold_at')
    ])

    const products = productsRes.data || []
    const sales = salesRes.data || []

    // Filtra le vendite per l'anno in corso
    const currentYear = new Date().getFullYear()
    const salesCurrentYear = sales.filter(sale => {
      if (!sale.sold_at) return false
      const saleDate = new Date(sale.sold_at)
      return saleDate.getFullYear() === currentYear
    })

    // Calcola il valore del magazzino (solo prodotti disponibili e in coda)
    // Per ogni prodotto: (costo produzione base + costi extra produzione) * quantità disponibile
    const warehouseValue = products
      .filter((p) => p.status === 'in_coda' || p.status === 'disponibile')
      .reduce((sum, p) => {
        const productionCostBase = parseFloat(p.production_cost || 0)
        const extraCosts = p.production_extra_costs || []
        const extraCostsTotal = extraCosts.reduce((extraSum, cost) => {
          return extraSum + (parseFloat(cost?.amount || 0) || 0)
        }, 0)
        const totalCostPerProduct = productionCostBase + extraCostsTotal
        const quantity = parseInt(p.quantity || 0)
        // Moltiplica il costo per prodotto per la quantità disponibile
        return sum + (totalCostPerProduct * quantity)
      }, 0)

    // Calcola le quantità totali per ogni stato
    const inQueue = products
      .filter((p) => p.status === 'in_coda')
      .reduce((sum, p) => sum + parseInt(p.quantity || 0), 0)
    
    const available = products
      .filter((p) => p.status === 'disponibile')
      .reduce((sum, p) => sum + parseInt(p.quantity || 0), 0)
    
    // Per i venduti, somma le quantità dalla tabella sales
    const sold = sales.reduce((sum, s) => sum + parseInt(s.quantity_sold || 0), 0)

    // Fatturato totale dell'anno in corso
    const totalRevenue = salesCurrentYear.reduce((sum, s) => sum + parseFloat(s.revenue || 0), 0)

    const stats = {
      warehouseValue,
      inQueue,
      available,
      sold,
      totalRevenue,
    }
    setStats(stats)
  }

  const currentYear = new Date().getFullYear()
  
  const statCards = [
    { label: 'Valore Magazzino', value: `€${stats.warehouseValue.toFixed(2)}`, icon: faBox, color: '#2d2d2d' },
    { label: 'In Coda', value: stats.inQueue, icon: faClock, color: '#f39c12' },
    { label: 'Disponibili', value: stats.available, icon: faCheck, color: '#27ae60' },
    { label: 'Venduti', value: stats.sold, icon: faDollarSign, color: '#e74c3c' },
    { label: `Fatturato Totale ${currentYear}`, value: `€${stats.totalRevenue.toFixed(2)}`, icon: faMoneyBill, color: '#9b59b6' },
  ]

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <p className="subtitle">Panoramica del magazzino</p>

      <div className="stats-grid">
        {statCards.map((stat, index) => (
          <div key={index} className="stat-card" style={{ borderTopColor: stat.color }}>
            <div className="stat-icon" style={{ color: stat.color }}>
              <FontAwesomeIcon icon={stat.icon} size="1.4x" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="quick-actions">
        <h2>Azioni Rapide</h2>
        <div className="actions-grid">
          <Link to="/materials" className="action-card">
            <span className="action-icon">
              <FontAwesomeIcon icon={faLayerGroup} size="1.4x" />
            </span>
            <h3>Gestisci Materiali</h3>
            <p>Aggiungi o modifica materiali e costi</p>
          </Link>
          <Link to="/models" className="action-card">
            <span className="action-icon">
              <FontAwesomeIcon icon={faCube} size="1.4x" />
            </span>
            <h3>Gestisci Modelli</h3>
            <p>Aggiungi o modifica modelli 3D</p>
          </Link>
          <Link to="/products" className="action-card">
            <span className="action-icon">
              <FontAwesomeIcon icon={faShoppingBag} size="1.4x" />
            </span>
            <h3>Gestisci Prodotti</h3>
            <p>Crea e gestisci prodotti</p>
          </Link>
          <Link to="/reports" className="action-card">
            <span className="action-icon">
              <FontAwesomeIcon icon={faChartLine} size="1.4x" />
            </span>
            <h3>Visualizza Report</h3>
            <p>Analizza vendite e profitti</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
