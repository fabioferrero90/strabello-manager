import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBox, faClock, faCheck, faDollarSign, faMoneyBill, faLayerGroup, faCube, faShoppingBag, faChartLine, faPrint } from '@fortawesome/free-solid-svg-icons'
import './Dashboard.css'

export default function Dashboard() {
  const [stats, setStats] = useState({
    warehouseValue: 0,
    warehouseSaleValue: 0,
    revenueLast30Days: 0,
    inQueue: 0,
    available: 0,
    sold: 0,
    totalRevenue: 0,
  })
  const [queueSummary, setQueueSummary] = useState({
    inQueueQty: 0,
    inPrintQty: 0,
    totalQty: 0
  })
  const [queueModels, setQueueModels] = useState([])
  const [recentSales, setRecentSales] = useState([])

  const getReadableTextColor = (hexColor) => {
    if (!hexColor || typeof hexColor !== 'string') return '#1a1a1a'
    const cleaned = hexColor.replace('#', '')
    if (cleaned.length !== 6) return '#1a1a1a'
    const r = parseInt(cleaned.slice(0, 2), 16)
    const g = parseInt(cleaned.slice(2, 4), 16)
    const b = parseInt(cleaned.slice(4, 6), 16)
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#1a1a1a'
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.6 ? '#1a1a1a' : '#ffffff'
  }

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    const [productsRes, queueProductsRes, materialsRes, salesRes, recentSalesRes] = await Promise.all([
      supabase.from('products').select('status, production_cost, production_extra_costs, quantity, sale_price'),
      supabase
        .from('products')
        .select('quantity, status, queue_order, material_id, multimaterial_mapping, models(name, photo_url), materials(color, color_hex)')
        .in('status', ['in_coda', 'in_stampa'])
        .order('queue_order', { ascending: true, nullsFirst: false }),
      supabase.from('materials').select('id, color, color_hex'),
      supabase.from('sales').select('revenue, quantity_sold, sold_at'),
      supabase
        .from('sales')
        .select('model_name, sku, revenue, quantity_sold, sold_at, sales_channel, products(models(photo_url, name))')
        .order('sold_at', { ascending: false })
        .limit(6)
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

    // Valore di vendita dei prodotti disponibili in magazzino
    const warehouseSaleValue = products
      .filter((p) => p.status === 'disponibile')
      .reduce((sum, p) => {
        const salePrice = parseFloat(p.sale_price || 0)
        const quantity = parseInt(p.quantity || 0)
        return sum + (salePrice * quantity)
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

    // Fatturato ultimi 30 giorni
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const revenueLast30Days = sales.reduce((sum, s) => {
      if (!s.sold_at) return sum
      const saleDate = new Date(s.sold_at)
      if (saleDate < thirtyDaysAgo) return sum
      return sum + parseFloat(s.revenue || 0)
    }, 0)

    const stats = {
      warehouseValue,
      warehouseSaleValue,
      revenueLast30Days,
      inQueue,
      available,
      sold,
      totalRevenue,
    }
    setStats(stats)
    setQueueSummary({
      inQueueQty: inQueue,
      inPrintQty: products
        .filter((p) => p.status === 'in_stampa')
        .reduce((sum, p) => sum + parseInt(p.quantity || 0), 0),
      totalQty: inQueue + products
        .filter((p) => p.status === 'in_stampa')
        .reduce((sum, p) => sum + parseInt(p.quantity || 0), 0)
    })
    const materialsMap = new Map((materialsRes.data || []).map((material) => [material.id, material]))
    const queueItems = (queueProductsRes.data || []).map((item) => {
      const mapping = Array.isArray(item.multimaterial_mapping) ? item.multimaterial_mapping : []
      const colors = mapping.length > 0
        ? mapping
            .slice()
            .sort((a, b) => (a.color || 0) - (b.color || 0))
            .map((mapItem) => materialsMap.get(mapItem.material_id))
            .filter(Boolean)
        : (item.materials ? [item.materials] : (materialsMap.get(item.material_id) ? [materialsMap.get(item.material_id)] : []))

      return {
        name: item.models?.name || 'Modello sconosciuto',
        photo_url: item.models?.photo_url || '',
        status: item.status,
        colors
      }
    })
    setQueueModels(queueItems)
    setRecentSales(recentSalesRes.data || [])
  }

  const statCards = [
    { label: 'Costo produzione magazzino', value: `€${stats.warehouseValue.toFixed(2)}`, icon: faBox, color: '#2d2d2d' },
    { label: 'Valore di vendita magazzino', value: `€${stats.warehouseSaleValue.toFixed(2)}`, icon: faChartLine, color: '#16a085' },
    { label: 'In Coda', value: stats.inQueue, icon: faClock, color: '#f39c12' },
    { label: 'Prodotti Disponibili', value: stats.available, icon: faCheck, color: '#27ae60' },
    { label: 'Prodotti Venduti', value: stats.sold, icon: faDollarSign, color: '#e74c3c' },
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

      <div className="dashboard-secondary-grid">
        <div className="dashboard-secondary-card">
          <div className="secondary-card-header">
            <h3>Riepilogo Coda di Stampa</h3>
            <Link to="/print-queue" className="secondary-card-link">Apri coda</Link>
          </div>
          <div className="queue-models">
            {queueModels.length === 0 ? (
              <div className="secondary-empty">Nessun prodotto in coda.</div>
            ) : (
              <ul className="queue-models-list">
                {queueModels.slice(0, 4).map((model, index) => (
                  <li
                    key={`${model.name}-${index}`}
                    className={`queue-models-item${model.status === 'in_stampa' ? ' in-print' : ''}`}
                  >
                    {model.photo_url ? (
                      <img src={model.photo_url} alt={model.name} className="queue-models-photo" />
                    ) : (
                      <div className="queue-models-photo placeholder" />
                    )}
                    <div className="queue-models-info">
                      <div className="queue-models-name">{model.name}</div>
                      <div className="queue-models-colors">
                        {model.colors.map((color, colorIndex) => (
                          <span
                            key={`${model.name}-color-${colorIndex}`}
                            className="queue-color-pill"
                            style={{
                              backgroundColor: color?.color_hex || '#f3f4f6',
                              color: getReadableTextColor(color?.color_hex)
                            }}
                          >
                            <span>{color?.color || 'Colore'}</span>
                          </span>
                        ))}
                        {model.colors.length === 0 && (
                          <span className="queue-color-pill empty">Nessun colore</span>
                        )}
                      </div>
                    </div>
                    {model.status === 'in_stampa' && (
                      <span className="queue-models-status" title="In stampa">
                        <FontAwesomeIcon icon={faPrint} />
                        <span>In stampa</span>
                      </span>
                    )}
                  </li>
                ))}
                {queueModels.length > 4 && (
                  <li className="queue-models-more">
                    +{queueModels.length - 4} prodotti in coda
                  </li>
                )}
              </ul>
            )}
          </div>
          <div className="queue-summary queue-summary-bottom">
            <div className="queue-summary-item">
              <span className="queue-summary-label">In coda</span>
              <span className="queue-summary-value">{queueSummary.inQueueQty}</span>
            </div>
            <div className="queue-summary-item">
              <span className="queue-summary-label">In stampa</span>
              <span className="queue-summary-value">{queueSummary.inPrintQty}</span>
            </div>
            <div className="queue-summary-item">
              <span className="queue-summary-label">Totale</span>
              <span className="queue-summary-value">{queueSummary.totalQty}</span>
            </div>
          </div>
        </div>

        <div className="dashboard-secondary-card">
          <div className="secondary-card-header">
            <h3>Ultime Vendite</h3>
            <Link to="/reports" className="secondary-card-link">Vai ai report</Link>
          </div>
          {recentSales.length === 0 ? (
            <div className="secondary-empty">Nessuna vendita recente.</div>
          ) : (
            <ul className="recent-sales-list">
              {recentSales.map((sale, index) => (
                <li key={`${sale.sku || 'sale'}-${sale.sold_at}-${index}`} className="recent-sales-item">
                  <div className="recent-sales-left">
                    {sale.products?.models?.photo_url ? (
                      <img
                        src={sale.products.models.photo_url}
                        alt={sale.products.models.name || sale.model_name || sale.sku}
                        className="recent-sales-photo"
                      />
                    ) : (
                      <div className="recent-sales-photo placeholder" />
                    )}
                    <div>
                      <div className="recent-sales-title">
                        {sale.model_name || sale.products?.models?.name || sale.sku || 'Vendita'}
                      </div>
                      <div className="recent-sales-meta">
                        {new Date(sale.sold_at).toLocaleDateString('it-IT')}
                        {sale.sales_channel && (
                          <span
                            className={`sales-channel-pill sales-channel-${sale.sales_channel.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            {sale.sales_channel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="recent-sales-amount">€{parseFloat(sale.revenue || 0).toFixed(2)}</div>
                </li>
              ))}
            </ul>
          )}
          <div className="recent-sales-metrics recent-sales-metrics-bottom">
            <div className="recent-sales-metric">
              <div className="recent-sales-metric-label">Fatturato ultimi 30gg</div>
              <div className="recent-sales-metric-value">€{stats.revenueLast30Days.toFixed(2)}</div>
            </div>
            <div className="recent-sales-metric">
              <div className="recent-sales-metric-label">Fatturato anno in corso</div>
              <div className="recent-sales-metric-value">€{stats.totalRevenue.toFixed(2)}</div>
            </div>
          </div>
        </div>
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
