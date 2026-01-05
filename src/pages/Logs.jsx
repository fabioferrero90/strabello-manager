import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileAlt, faBox, faCube, faHistory } from '@fortawesome/free-solid-svg-icons'
import './Logs.css'

const ACTION_LABELS = {
  'aggiunta_materiale': 'Aggiunta Materiale',
  'modifica_materiale': 'Modifica Materiale',
  'eliminazione_materiale': 'Eliminazione Materiale',
  'aggiunta_modello': 'Aggiunta Modello',
  'modifica_modello': 'Modifica Modello',
  'eliminazione_modello': 'Eliminazione Modello',
  'aggiunta_prodotto': 'Aggiunta Prodotto',
  'modifica_prodotto': 'Modifica Prodotto',
  'eliminazione_prodotto': 'Eliminazione Prodotto',
}

const ACTION_COLORS = {
  'aggiunta_materiale': '#27ae60',
  'modifica_materiale': '#3498db',
  'eliminazione_materiale': '#e74c3c',
  'aggiunta_modello': '#27ae60',
  'modifica_modello': '#3498db',
  'eliminazione_modello': '#e74c3c',
  'aggiunta_prodotto': '#27ae60',
  'modifica_prodotto': '#3498db',
  'eliminazione_prodotto': '#e74c3c',
}

const ENTITY_ICONS = {
  'materiale': faBox,
  'modello': faCube,
  'prodotto': faFileAlt,
}

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [filteredLogs, setFilteredLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    actionType: '',
    entityType: '',
    userEmail: '',
    search: '',
  })

  useEffect(() => {
    loadLogs()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [filters, logs])

  const loadLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading logs:', error)
        alert('Errore durante il caricamento dei log: ' + error.message)
      } else {
        setLogs(data || [])
      }
    } catch (error) {
      console.error('Error loading logs:', error)
      alert('Errore durante il caricamento dei log')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...logs]

    // Filtro per tipo di azione
    if (filters.actionType) {
      filtered = filtered.filter(log => log.action_type === filters.actionType)
    }

    // Filtro per tipo di entità
    if (filters.entityType) {
      filtered = filtered.filter(log => log.entity_type === filters.entityType)
    }

    // Filtro per email utente
    if (filters.userEmail) {
      filtered = filtered.filter(log => 
        log.user_email?.toLowerCase().includes(filters.userEmail.toLowerCase())
      )
    }

    // Filtro per ricerca generale
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(log =>
        log.entity_name?.toLowerCase().includes(searchLower) ||
        log.user_email?.toLowerCase().includes(searchLower) ||
        ACTION_LABELS[log.action_type]?.toLowerCase().includes(searchLower)
      )
    }

    setFilteredLogs(filtered)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date)
  }

  if (loading) {
    return <div className="loading">Caricamento log...</div>
  }

  return (
    <div className="logs-page">
      <div className="page-header">
        <h1>
          <FontAwesomeIcon icon={faHistory} style={{ marginRight: '10px' }} />
          Log Operazioni
        </h1>
      </div>

      {/* Filtri */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ marginBottom: '8px', display: 'block' }}>Tipo Azione</label>
            <select
              value={filters.actionType}
              onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
            >
              <option value="">Tutte le azioni</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ marginBottom: '8px', display: 'block' }}>Tipo Entità</label>
            <select
              value={filters.entityType}
              onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
            >
              <option value="">Tutte le entità</option>
              <option value="materiale">Materiale</option>
              <option value="modello">Modello</option>
              <option value="prodotto">Prodotto</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ marginBottom: '8px', display: 'block' }}>Email Utente</label>
            <input
              type="text"
              placeholder="Cerca per email..."
              value={filters.userEmail}
              onChange={(e) => setFilters({ ...filters, userEmail: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ marginBottom: '8px', display: 'block' }}>Ricerca Generale</label>
            <input
              type="text"
              placeholder="Cerca nel nome entità..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Tabella Log */}
      <div className="logs-table-container">
        <table className="logs-table">
          <thead>
            <tr>
              <th>Data/Ora</th>
              <th>Utente</th>
              <th>Azione</th>
              <th>Entità</th>
              <th>Nome/SKU</th>
              <th>Dettagli</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state">
                  {logs.length === 0
                    ? 'Nessun log disponibile.'
                    : 'Nessun log corrisponde ai filtri selezionati.'}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                    {formatDate(log.created_at)}
                  </td>
                  <td>
                    <span style={{ color: '#666', fontSize: '14px' }}>{log.user_email}</span>
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: '600',
                        backgroundColor: `${ACTION_COLORS[log.action_type] || '#95a5a6'}20`,
                        color: ACTION_COLORS[log.action_type] || '#95a5a6',
                      }}
                    >
                      {ACTION_LABELS[log.action_type] || log.action_type}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FontAwesomeIcon
                        icon={ENTITY_ICONS[log.entity_type] || faFileAlt}
                        style={{ color: '#2d2d2d', fontSize: '16px' }}
                      />
                      <span style={{ textTransform: 'capitalize' }}>{log.entity_type}</span>
                    </div>
                  </td>
                  <td>
                    <strong style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                      {log.entity_name || 'N/A'}
                    </strong>
                  </td>
                  <td>
                    {log.details && Object.keys(log.details).length > 0 ? (
                      <details style={{ cursor: 'pointer' }}>
                        <summary style={{ fontSize: '13px', color: '#3498db' }}>
                          Mostra dettagli
                        </summary>
                        <pre style={{
                          marginTop: '8px',
                          padding: '8px',
                          background: '#f8f9fa',
                          borderRadius: '4px',
                          fontSize: '12px',
                          overflow: 'auto',
                          maxHeight: '150px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span style={{ color: '#95a5a6', fontStyle: 'italic', fontSize: '13px' }}>
                        Nessun dettaglio
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Statistiche */}
      <div style={{
        marginTop: '20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px'
      }}>
        <div style={{
          background: 'white',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2d2d2d' }}>
            {logs.length}
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
            Totale Log
          </div>
        </div>
        <div style={{
          background: 'white',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2d2d2d' }}>
            {filteredLogs.length}
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
            Log Filtrati
          </div>
        </div>
        <div style={{
          background: 'white',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2d2d2d' }}>
            {new Set(logs.map(l => l.user_email)).size}
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
            Utenti Attivi
          </div>
        </div>
      </div>
    </div>
  )
}

