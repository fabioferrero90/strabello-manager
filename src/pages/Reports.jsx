import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDollarSign, faChartBar, faMoneyBill, faIndustry, faUser, faShoppingCart, faXmark } from '@fortawesome/free-solid-svg-icons'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import ReactCountryFlag from 'react-country-flag'
import './Reports.css'

const CHANNEL_COLORS = {
  'Vinted': '#09B1BA',
  'eBay': '#E53238',
  'Shopify': '#96BF48',
  'Negozio Fisico': '#2d2d2d'
}

export default function Reports() {
  const [allSales, setAllSales] = useState([])
  const [filteredSales, setFilteredSales] = useState([])
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [presetPeriod, setPresetPeriod] = useState('last_30_days')
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalCost: 0,
    totalProductionCost: 0,
    totalProfit: 0,
    producerShare: 0,
    sellerShare: 0,
  })
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSale, setSelectedSale] = useState(null)
  const [showSaleDetailModal, setShowSaleDetailModal] = useState(false)
  const [vatRegimes, setVatRegimes] = useState([])

  useEffect(() => {
    loadReports()
    loadVatRegimes()
  }, [])

  useEffect(() => {
    applyDateFilter()
  }, [allSales, dateRange, presetPeriod])

  useEffect(() => {
    if (filteredSales.length > 0) {
      calculateSummary()
      prepareChartData()
    } else {
      setSummary({
        totalSales: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        producerShare: 0,
        sellerShare: 0,
      })
      setChartData([])
    }
  }, [filteredSales])

  const loadReports = async () => {
    const { data: salesData, error } = await supabase
      .from('sales')
      .select('*')
      .order('sold_at', { ascending: true })

    if (error) {
      console.error('Error loading sales:', error)
      setLoading(false)
      return
    }

    setAllSales(salesData || [])
    setLoading(false)
  }

  const loadVatRegimes = async () => {
    const { data, error } = await supabase
      .from('vat_regimes')
      .select('*')
      .order('vat_rate')

    if (error) {
      console.error('Error loading VAT regimes:', error)
      return
    }

    setVatRegimes(data || [])
  }

  const applyDateFilter = () => {
    let startDate, endDate

    if (presetPeriod === 'custom') {
      startDate = dateRange.start ? new Date(dateRange.start) : null
      endDate = dateRange.end ? new Date(dateRange.end) : null
    } else {
      const now = new Date()
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

      switch (presetPeriod) {
        case 'last_7_days':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0)
          break
        case 'last_30_days':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0)
          break
        case 'current_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
          break
        case 'last_month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0)
          endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
          break
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0)
      }
    }

    const filtered = allSales.filter(sale => {
      const saleDate = new Date(sale.sold_at)
      if (startDate && saleDate < startDate) return false
      if (endDate && saleDate > endDate) return false
      return true
    })

    setFilteredSales(filtered)
  }

  const calculateSummary = () => {
    const totals = filteredSales.reduce(
      (acc, sale) => {
        const revenue = parseFloat(sale.revenue || 0)
        const totalCost = parseFloat(sale.total_costs || 0) * (sale.quantity_sold || 1)
        const productionCostBase = parseFloat(sale.production_cost_base || 0) * (sale.quantity_sold || 1)
        const profit = parseFloat(sale.profit || 0)

        return {
          totalSales: acc.totalSales + (sale.quantity_sold || 1),
          totalRevenue: acc.totalRevenue + revenue,
          totalCost: acc.totalCost + totalCost,
          totalProductionCost: acc.totalProductionCost + productionCostBase,
          totalProfit: acc.totalProfit + profit,
        }
      },
      {
        totalSales: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProductionCost: 0,
        totalProfit: 0,
      }
    )

    // Il produttore riceve il 60% del profitto + i costi di produzione base (che ha già sostenuto)
    const producerShare = (totals.totalProfit * 0.6) + totals.totalProductionCost
    const sellerShare = totals.totalProfit * 0.4

    setSummary({
      ...totals,
      producerShare,
      sellerShare,
    })
  }

  const prepareChartData = () => {
    // Raggruppa le vendite per data e canale
    const salesByDate = {}

    filteredSales.forEach(sale => {
      const saleDate = new Date(sale.sold_at)
      const dateKey = saleDate.toISOString().split('T')[0] // YYYY-MM-DD

      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = {
          date: dateKey,
          formattedDate: saleDate.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        }
      }

      const channel = sale.sales_channel || 'Unknown'
      if (!salesByDate[dateKey][`sales_${channel}`]) {
        salesByDate[dateKey][`sales_${channel}`] = 0
        salesByDate[dateKey][`revenue_${channel}`] = 0
      }

      salesByDate[dateKey][`sales_${channel}`] += (sale.quantity_sold || 1)
      salesByDate[dateKey][`revenue_${channel}`] += parseFloat(sale.revenue || 0)
    })

    // Converti in array e ordina per data
    const chartDataArray = Object.values(salesByDate).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    )

    setChartData(chartDataArray)
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('it-IT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getChannels = () => {
    return [...new Set(filteredSales.map(s => s.sales_channel))].filter(Boolean)
  }

  if (loading) return <div className="loading">Caricamento...</div>

  const channels = getChannels()

  return (
    <div className="reports-page">
      <h1>Report Vendite</h1>
      <p className="subtitle">Analisi completa delle vendite e distribuzione profitti</p>

      {/* Filtri Periodo */}
      <div className="period-filters">
        <div className="preset-filters">
          <label>Periodo Rapido:</label>
          <select
            value={presetPeriod}
            onChange={(e) => {
              setPresetPeriod(e.target.value)
              if (e.target.value !== 'custom') {
                setDateRange({ start: '', end: '' })
              }
            }}
            className="period-select"
          >
            <option value="last_7_days">Ultimi 7 giorni</option>
            <option value="last_30_days">Ultimi 30 giorni</option>
            <option value="current_month">Mese in corso</option>
            <option value="last_month">Mese passato</option>
            <option value="custom">Periodo personalizzato</option>
          </select>
        </div>

        {presetPeriod === 'custom' && (
          <div className="custom-date-filters">
            <label>Da:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="date-input"
            />
            <label>A:</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="date-input"
            />
          </div>
        )}

        <div className="revenue-counter">
          <span className="revenue-label">Fatturato Totale:</span>
          <span className="revenue-value">€{summary.totalRevenue.toFixed(2)}</span>
        </div>
      </div>

      {/* Schede Totali */}
      <div className="summary-cards">
        <div className="summary-card sales">
          <div className="card-icon">
            <FontAwesomeIcon icon={faShoppingCart} size="2x" />
          </div>
          <div className="card-content">
            <div className="card-label">Totale Vendite</div>
            <div className="card-value">{summary.totalSales}</div>
          </div>
        </div>

        <div className="summary-card costs">
          <div className="card-icon">
            <FontAwesomeIcon icon={faChartBar} size="2x" />
          </div>
          <div className="card-content">
            <div className="card-label">Costi Totali</div>
            <div className="card-value">€{summary.totalCost.toFixed(2)}</div>
          </div>
        </div>

        <div className="summary-card profit">
          <div className="card-icon">
            <FontAwesomeIcon icon={faMoneyBill} size="2x" />
          </div>
          <div className="card-content">
            <div className="card-label">Profitto Totale</div>
            <div className="card-value">€{summary.totalProfit.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Grafici */}
      <div className="charts-container">
        <div className="chart-card">
          <h3>Numero di Vendite</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="formattedDate" />
              <YAxis />
              <Tooltip />
              <Legend />
              {channels.map(channel => (
                <Line
                  key={`sales_${channel}`}
                  type="monotone"
                  dataKey={`sales_${channel}`}
                  name={channel}
                  stroke={CHANNEL_COLORS[channel] || '#8884d8'}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Ricavato (€)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="formattedDate" />
              <YAxis />
              <Tooltip formatter={(value) => `€${value.toFixed(2)}`} />
              <Legend />
              {channels.map(channel => (
                <Line
                  key={`revenue_${channel}`}
                  type="monotone"
                  dataKey={`revenue_${channel}`}
                  name={channel}
                  stroke={CHANNEL_COLORS[channel] || '#8884d8'}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Schede Profitto Diviso */}
      <div className="profit-split-cards">
        <div className="split-card producer">
          <div className="split-icon">
            <FontAwesomeIcon icon={faIndustry} size="2x" />
          </div>
          <div className="split-content">
            <div className="split-label">Rimborsi Fabio (60% + Costo base di produzione)</div>
            <div className="split-value">€{summary.producerShare.toFixed(2)}</div>
          </div>
        </div>
        <div className="split-card seller">
          <div className="split-icon">
            <FontAwesomeIcon icon={faUser} size="2x" />
          </div>
          <div className="split-content">
            <div className="split-label">Profitto Mesmerized SRLS (40%)</div>
            <div className="split-value">€{summary.sellerShare.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Lista Vendite */}
      <div className="sales-list">
        <h2>Vendite Effettuate ({filteredSales.length})</h2>
        <div className="sales-table-container">
          <table className="sales-table">
            <thead>
              <tr>
                <th>Data Vendita</th>
                <th>Canale</th>
                <th>Modello</th>
                <th>Materiale</th>
                <th>Quantità</th>
                <th>Prezzo Vendita</th>
                <th>Costo Totale</th>
                <th>Regime IVA</th>
                <th>Profitto</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="9" className="empty-state">
                    Nessuna vendita registrata per il periodo selezionato
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const revenue = parseFloat(sale.revenue || 0)
                  const totalCost = parseFloat(sale.total_costs || 0) * (sale.quantity_sold || 1)
                  const profit = parseFloat(sale.profit || 0)
                  
                  // Trova il regime IVA per ottenere il country_code
                  const vatRegime = vatRegimes.find(r => r.name === sale.vat_regime)

                  return (
                    <tr 
                      key={sale.id}
                      onClick={() => {
                        setSelectedSale(sale)
                        setShowSaleDetailModal(true)
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{formatDate(sale.sold_at)}</td>
                      <td>
                        <span
                          className="channel-badge"
                          style={{
                            backgroundColor: CHANNEL_COLORS[sale.sales_channel] || '#8884d8',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          {sale.sales_channel}
                        </span>
                      </td>
                      <td>{sale.model_name || 'N/A'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {sale.material_color_hex && (
                            <span
                              style={{
                                display: 'inline-block',
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                backgroundColor: sale.material_color_hex,
                                border: '1px solid #ddd',
                                flexShrink: 0
                              }}
                            />
                          )}
                          <span>
                            {sale.material_brand || 'N/A'}
                            {sale.material_type && ` - ${sale.material_type}`}
                            {sale.material_color && ` (${sale.material_color})`}
                          </span>
                        </div>
                      </td>
                      <td>{sale.quantity_sold || 1}</td>
                      <td>€{revenue.toFixed(2)}</td>
                      <td>€{totalCost.toFixed(2)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {vatRegime?.country_code ? (
                            <ReactCountryFlag
                              countryCode={vatRegime.country_code}
                              svg
                              style={{
                                width: '24px',
                                height: '18px'
                              }}
                            />
                          ) : null}
                          <span style={{ fontSize: '13px' }}>{sale.vat_regime || 'N/A'}</span>
                        </div>
                      </td>
                      <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                        €{profit.toFixed(2)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modale Dettaglio Vendita */}
      {showSaleDetailModal && selectedSale && (
        <div className="modal-overlay" onClick={() => { setShowSaleDetailModal(false); setSelectedSale(null) }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Dettagli Vendita</h2>
              <button
                onClick={() => { setShowSaleDetailModal(false); setSelectedSale(null) }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#7f8c8d'
                }}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Informazioni Base */}
              <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>Informazioni Vendita</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <strong>Data Vendita:</strong> {formatDate(selectedSale.sold_at)}
                  </div>
                  <div>
                    <strong>SKU:</strong> {selectedSale.sku || 'N/A'}
                  </div>
                  <div>
                    <strong>Modello:</strong> {selectedSale.model_name || 'N/A'}
                  </div>
                  <div>
                    <strong>Quantità Venduta:</strong> {selectedSale.quantity_sold || 1}
                  </div>
                  <div>
                    <strong>Canale di Vendita:</strong>
                    <span
                      className="channel-badge"
                      style={{
                        backgroundColor: CHANNEL_COLORS[selectedSale.sales_channel] || '#8884d8',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        marginLeft: '8px'
                      }}
                    >
                      {selectedSale.sales_channel}
                    </span>
                  </div>
                  <div>
                    <strong>Regime IVA:</strong> {selectedSale.vat_regime || 'N/A'} {selectedSale.vat_rate && `(${selectedSale.vat_rate}%)`}
                  </div>
                </div>
              </div>

              {/* Dettaglio Costi */}
              <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>Dettaglio Costi</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ padding: '8px 0', borderBottom: '1px solid #e0e0e0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span><strong>Costo Produzione Base:</strong></span>
                      <span>€{(parseFloat(selectedSale.production_cost_base || 0) * (selectedSale.quantity_sold || 1)).toFixed(2)}</span>
                    </div>
                    <div style={{ paddingLeft: '15px', fontSize: '14px', color: '#666' }}>
                      <div style={{ marginBottom: '4px' }}>
                        <strong>Materiale:</strong> {selectedSale.material_brand || 'N/A'} - {selectedSale.material_type || 'N/A'}
                        {selectedSale.material_color_hex && (
                          <span
                            style={{
                              display: 'inline-block',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: selectedSale.material_color_hex,
                              border: '1px solid #ddd',
                              marginLeft: '6px',
                              verticalAlign: 'middle'
                            }}
                          />
                        )}
                        {selectedSale.material_color && (
                          <span style={{ marginLeft: '4px' }}>({selectedSale.material_color})</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {selectedSale.production_extra_costs && selectedSale.production_extra_costs.length > 0 && (
                    <div style={{ padding: '8px 0', borderBottom: '1px solid #e0e0e0' }}>
                      <div style={{ marginBottom: '5px' }}><strong>Costi Extra Produzione:</strong></div>
                      {selectedSale.production_extra_costs.map((cost, index) => (
                        <div key={index} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '15px', fontSize: '14px', color: '#666' }}>
                          <span>{cost.note || 'Costo extra'}:</span>
                          <span>€{(parseFloat(cost.amount || 0) * (selectedSale.quantity_sold || 1)).toFixed(2)}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', paddingTop: '5px', borderTop: '1px solid #e0e0e0' }}>
                        <span><strong>Totale Costi Extra Produzione:</strong></span>
                        <span>€{(selectedSale.production_extra_costs.reduce((sum, cost) => sum + (parseFloat(cost.amount || 0) || 0), 0) * (selectedSale.quantity_sold || 1)).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e0e0e0' }}>
                    <span><strong>Costo Totale Produzione:</strong></span>
                    <span>€{(parseFloat(selectedSale.total_production_cost || 0) * (selectedSale.quantity_sold || 1)).toFixed(2)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e0e0e0' }}>
                    <span><strong>Costo Imballaggio:</strong></span>
                    <span>€{(parseFloat(selectedSale.packaging_cost || 0) * (selectedSale.quantity_sold || 1)).toFixed(2)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e0e0e0' }}>
                    <span><strong>Costo Amministrativo:</strong></span>
                    <span>€{(parseFloat(selectedSale.administrative_cost || 0) * (selectedSale.quantity_sold || 1)).toFixed(2)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e0e0e0' }}>
                    <span><strong>Costo Sponsorizzazione:</strong></span>
                    <span>€{(parseFloat(selectedSale.promotion_cost || 0) * (selectedSale.quantity_sold || 1)).toFixed(2)}</span>
                  </div>

                  {selectedSale.extra_costs && selectedSale.extra_costs.length > 0 && (
                    <div style={{ padding: '8px 0', borderBottom: '1px solid #e0e0e0' }}>
                      <div style={{ marginBottom: '5px' }}><strong>Costi Extra Vendita:</strong></div>
                      {selectedSale.extra_costs.map((cost, index) => (
                        <div key={index} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '15px', fontSize: '14px', color: '#666' }}>
                          <span>{cost.note || 'Costo extra'}:</span>
                          <span>€{(parseFloat(cost.amount || 0) * (selectedSale.quantity_sold || 1)).toFixed(2)}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', paddingTop: '5px', borderTop: '1px solid #e0e0e0' }}>
                        <span><strong>Totale Costi Extra Vendita:</strong></span>
                        <span>€{(selectedSale.extra_costs.reduce((sum, cost) => sum + (parseFloat(cost.amount || 0) || 0), 0) * (selectedSale.quantity_sold || 1)).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', marginTop: '10px', borderTop: '2px solid #2d2d2d', fontSize: '16px', fontWeight: 'bold' }}>
                    <span><strong>Costi Totali:</strong></span>
                    <span>€{(parseFloat(selectedSale.total_costs || 0) * (selectedSale.quantity_sold || 1)).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Ricavi e Profitto */}
              <div style={{ background: '#e8f5e9', padding: '15px', borderRadius: '8px', border: '2px solid #27ae60' }}>
                <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>Ricavi e Profitto</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #c8e6c9' }}>
                    <span><strong>Prezzo Unitario:</strong></span>
                    <span>€{parseFloat(selectedSale.sale_price || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #c8e6c9' }}>
                    <span><strong>Quantità:</strong></span>
                    <span>{selectedSale.quantity_sold || 1}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', marginTop: '10px', borderTop: '2px solid #27ae60', fontSize: '18px', fontWeight: 'bold' }}>
                    <span><strong>Incasso Totale:</strong></span>
                    <span>€{parseFloat(selectedSale.revenue || 0).toFixed(2)}</span>
                  </div>
                  {selectedSale.vat_amount && parseFloat(selectedSale.vat_amount) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #c8e6c9', fontSize: '14px' }}>
                      <span><strong>IVA da Versare ({selectedSale.vat_rate || 0}%):</strong></span>
                      <span style={{ color: '#e74c3c' }}>-€{parseFloat(selectedSale.vat_amount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #c8e6c9', fontSize: '14px' }}>
                    <span><strong>Costi Totali:</strong></span>
                    <span style={{ color: '#e74c3c' }}>-€{(parseFloat(selectedSale.total_costs || 0) * (selectedSale.quantity_sold || 1)).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: '20px', fontWeight: 'bold', color: parseFloat(selectedSale.profit || 0) >= 0 ? '#27ae60' : '#e74c3c' }}>
                    <span><strong>Profitto Netto:</strong></span>
                    <span>€{parseFloat(selectedSale.profit || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowSaleDetailModal(false); setSelectedSale(null) }}
                className="btn-secondary"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
