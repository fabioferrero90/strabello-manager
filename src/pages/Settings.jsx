import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog, faSave, faPlus, faEdit, faTrash, faTimes, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import ReactCountryFlag from 'react-country-flag'
import './Settings.css'

const CHANNELS = ['Vinted', 'eBay', 'Shopify', 'Negozio Fisico']

// Funzione per ottenere l'URL del logo
const getChannelLogo = (channelName) => {
  // Usa URL pubblici affidabili per i loghi
  switch (channelName) {
    case 'Vinted':
      // Logo Vinted - URL ufficiale o CDN
      return 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Vinted_Logo_2022.svg'
    case 'eBay':
      // Logo eBay - usando il favicon ufficiale (più affidabile)
      return 'https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg'
    case 'Shopify':
      // Logo Shopify - URL ufficiale
      return 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Shopify_logo.svg'
    default:
      return null
  }
}

export default function Settings() {
  const [settings, setSettings] = useState({})
  const [vatRegimes, setVatRegimes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [editingVatRegime, setEditingVatRegime] = useState(null)
  const [showVatRegimeModal, setShowVatRegimeModal] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState({
    channels: true,
    vat: true
  })
  const [vatRegimeForm, setVatRegimeForm] = useState({
    name: '',
    vat_rate: '',
    countries: '',
    country_code: ''
  })

  useEffect(() => {
    loadSettings()
    loadVatRegimes()
  }, [])

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_channels_settings')
        .select('*')
        .order('channel_name')

      if (error) {
        console.error('Error loading settings:', error)
        setMessage({ type: 'error', text: 'Errore nel caricamento delle impostazioni' })
      } else {
        // Inizializza i canali mancanti con valori di default
        const settingsMap = {}
        CHANNELS.forEach((channel) => {
          const existing = data?.find((s) => s.channel_name === channel)
          const baseDefaults = {
            channel_name: channel,
            promotion_cost_per_product: 0,
            promotion_cost_type: 'fixed',
            promotion_cost_percent: 0,
            promotion_cost_percent_base: 'gross',
            packaging_cost: 0,
            administrative_base_cost: 0,
          }
          settingsMap[channel] = existing
            ? { ...baseDefaults, ...existing, channel_name: channel }
            : baseDefaults
        })
        setSettings(settingsMap)
      }
    } catch (err) {
      console.error('Error:', err)
      setMessage({ type: 'error', text: 'Errore nel caricamento delle impostazioni' })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (channel, field, value) => {
    const numericFields = [
      'promotion_cost_per_product',
      'promotion_cost_percent',
      'packaging_cost',
      'administrative_base_cost'
    ]
    setSettings((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [field]: numericFields.includes(field) ? (parseFloat(value) || 0) : value,
      },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

    try {
      const settingsArray = Object.values(settings)

      for (const setting of settingsArray) {
        const {
          id,
          channel_name,
          promotion_cost_per_product,
          promotion_cost_type,
          promotion_cost_percent,
          promotion_cost_percent_base,
          packaging_cost,
          administrative_base_cost
        } = setting

        if (id) {
          // Aggiorna esistente
          const { error } = await supabase
            .from('sales_channels_settings')
            .update({
              promotion_cost_per_product,
              promotion_cost_type,
              promotion_cost_percent,
              promotion_cost_percent_base,
              packaging_cost,
              administrative_base_cost,
            })
            .eq('id', id)

          if (error) throw error
        } else {
          // Inserisci nuovo
          const { error } = await supabase
            .from('sales_channels_settings')
            .insert({
              channel_name,
              promotion_cost_per_product,
              promotion_cost_type,
              promotion_cost_percent,
              promotion_cost_percent_base,
              packaging_cost,
              administrative_base_cost,
            })

          if (error) throw error
        }
      }

      setMessage({ type: 'success', text: 'Impostazioni salvate con successo!' })
      await loadSettings() // Ricarica per ottenere gli ID
    } catch (error) {
      console.error('Error saving settings:', error)
      setMessage({ type: 'error', text: 'Errore nel salvataggio delle impostazioni' })
    } finally {
      setSaving(false)
    }
  }

  const loadVatRegimes = async () => {
    try {
      const { data, error } = await supabase
        .from('vat_regimes')
        .select('*')
        .order('vat_rate')

      if (error) {
        console.error('Error loading VAT regimes:', error)
        setMessage({ type: 'error', text: 'Errore nel caricamento dei regimi IVA' })
      } else {
        setVatRegimes(data || [])
      }
    } catch (err) {
      console.error('Error:', err)
      setMessage({ type: 'error', text: 'Errore nel caricamento dei regimi IVA' })
    }
  }

  const handleOpenVatRegimeModal = (regime = null) => {
    if (regime) {
      setEditingVatRegime(regime)
      setVatRegimeForm({
        name: regime.name || '',
        vat_rate: regime.vat_rate || '',
        countries: regime.countries || '',
        country_code: regime.country_code || ''
      })
    } else {
      setEditingVatRegime(null)
      setVatRegimeForm({
        name: '',
        vat_rate: '',
        countries: '',
        country_code: ''
      })
    }
    setShowVatRegimeModal(true)
  }

  const handleCloseVatRegimeModal = () => {
    setShowVatRegimeModal(false)
    setEditingVatRegime(null)
    setVatRegimeForm({
      name: '',
      vat_rate: '',
      countries: '',
      country_code: ''
    })
  }

  const handleSaveVatRegime = async (e) => {
    e.preventDefault()
    
    if (!vatRegimeForm.name.trim()) {
      setMessage({ type: 'error', text: 'Il nome del regime IVA è obbligatorio' })
      return
    }

    if (!vatRegimeForm.vat_rate || parseFloat(vatRegimeForm.vat_rate) < 0) {
      setMessage({ type: 'error', text: 'La percentuale IVA deve essere un numero valido' })
      return
    }

    try {
      if (editingVatRegime) {
        // Aggiorna esistente
        const { error } = await supabase
          .from('vat_regimes')
          .update({
            name: vatRegimeForm.name.trim(),
            vat_rate: parseFloat(vatRegimeForm.vat_rate),
            countries: vatRegimeForm.countries.trim() || null,
            country_code: vatRegimeForm.country_code.trim().toUpperCase() || null
          })
          .eq('id', editingVatRegime.id)

        if (error) throw error
        setMessage({ type: 'success', text: 'Regime IVA aggiornato con successo!' })
      } else {
        // Inserisci nuovo
        const { error } = await supabase
          .from('vat_regimes')
          .insert({
            name: vatRegimeForm.name.trim(),
            vat_rate: parseFloat(vatRegimeForm.vat_rate),
            countries: vatRegimeForm.countries.trim() || null,
            country_code: vatRegimeForm.country_code.trim().toUpperCase() || null
          })

        if (error) throw error
        setMessage({ type: 'success', text: 'Regime IVA aggiunto con successo!' })
      }

      await loadVatRegimes()
      handleCloseVatRegimeModal()
    } catch (error) {
      console.error('Error saving VAT regime:', error)
      if (error.code === '23505') {
        setMessage({ type: 'error', text: 'Un regime IVA con questo nome esiste già' })
      } else {
        setMessage({ type: 'error', text: 'Errore nel salvataggio del regime IVA' })
      }
    }
  }

  const toggleSection = (sectionKey) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }))
  }

  const handleDeleteVatRegime = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questo regime IVA?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('vat_regimes')
        .delete()
        .eq('id', id)

      if (error) throw error

      setMessage({ type: 'success', text: 'Regime IVA eliminato con successo!' })
      await loadVatRegimes()
    } catch (error) {
      console.error('Error deleting VAT regime:', error)
      setMessage({ type: 'error', text: 'Errore nell\'eliminazione del regime IVA' })
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <FontAwesomeIcon icon={faCog} style={{ marginRight: '10px' }} />
          Impostazioni
        </h1>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="settings-container">
        <div className={`settings-section${collapsedSections.channels ? ' collapsed' : ''}`}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleSection('channels')}
          >
            <div>
              <h2 style={{ marginBottom: '6px' }}>Costi per Canale di Vendita</h2>
              <p className="section-description">
                Configura i costi standard per ogni canale di vendita. Questi valori verranno utilizzati per calcolare i costi totali dei prodotti.
              </p>
            </div>
            <FontAwesomeIcon icon={collapsedSections.channels ? faChevronDown : faChevronUp} />
          </div>

          {!collapsedSections.channels && (
            <>
              <div className="channels-grid">
                {CHANNELS.map((channel) => {
                  const channelSettings = settings[channel] || {}
                  return (
                    <div key={channel} className="channel-card">
                      <div className="channel-header">
                        {getChannelLogo(channel) ? (
                          <div className="channel-logo-container">
                            <img 
                              src={getChannelLogo(channel)} 
                              alt={channel}
                              className="channel-logo"
                              onError={(e) => {
                                // Fallback al testo se il logo non carica
                                const container = e.target.parentElement
                                e.target.style.display = 'none'
                                const fallback = document.createElement('h3')
                                fallback.textContent = channel
                                fallback.className = 'channel-fallback'
                                container.appendChild(fallback)
                              }}
                            />
                          </div>
                        ) : (
                          <h3>{channel}</h3>
                        )}
                      </div>
                      <div className="channel-fields">
                        <div className="form-group">
                          <label>Tipo Costo Sponsorizzazione</label>
                          <select
                            value={channelSettings.promotion_cost_type || 'fixed'}
                            onChange={(e) =>
                              handleInputChange(channel, 'promotion_cost_type', e.target.value)
                            }
                          >
                            <option value="fixed">Valore fisso per prodotto</option>
                            <option value="percent">Percentuale sul prezzo</option>
                          </select>
                          <small>Definisci se il costo è fisso o percentuale</small>
                        </div>

                        {(channelSettings.promotion_cost_type || 'fixed') === 'fixed' ? (
                          <div className="form-group">
                            <label>Costo Sponsorizzazione per Prodotto (€)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={channelSettings.promotion_cost_per_product || 0}
                              onChange={(e) =>
                                handleInputChange(channel, 'promotion_cost_per_product', e.target.value)
                              }
                              placeholder="0.00"
                            />
                            <small>Costo medio di sponsorizzazione per prodotto su questo canale</small>
                          </div>
                        ) : (
                          <>
                            <div className="form-group">
                              <label>Percentuale Sponsorizzazione (%)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={channelSettings.promotion_cost_percent || 0}
                                onChange={(e) =>
                                  handleInputChange(channel, 'promotion_cost_percent', e.target.value)
                                }
                                placeholder="0.00"
                              />
                              <small>Percentuale applicata al prezzo del prodotto</small>
                            </div>
                            <div className="form-group">
                              <label>Base di Calcolo</label>
                              <select
                                value={channelSettings.promotion_cost_percent_base || 'gross'}
                                onChange={(e) =>
                                  handleInputChange(channel, 'promotion_cost_percent_base', e.target.value)
                                }
                              >
                                <option value="gross">Prezzo IVATO</option>
                                <option value="net">Prezzo IVA esclusa</option>
                              </select>
                              <small>Seleziona la base su cui calcolare la percentuale</small>
                            </div>
                          </>
                        )}

                        <div className="form-group">
                          <label>Costo Imballaggio (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={channelSettings.packaging_cost || 0}
                            onChange={(e) => handleInputChange(channel, 'packaging_cost', e.target.value)}
                            placeholder="0.00"
                          />
                          <small>Costo standard di imballaggio per questo canale</small>
                        </div>

                        <div className="form-group">
                          <label>Costo Amministrativo Base (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={channelSettings.administrative_base_cost || 0}
                            onChange={(e) =>
                              handleInputChange(channel, 'administrative_base_cost', e.target.value)
                            }
                            placeholder="0.00"
                          />
                          <small>Costo amministrativo base per questo canale</small>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="settings-actions">
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  <FontAwesomeIcon icon={faSave} style={{ marginRight: '8px' }} />
                  {saving ? 'Salvataggio...' : 'Salva Impostazioni'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className={`settings-section${collapsedSections.vat ? ' collapsed' : ''}`}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggleSection('vat')}
          >
            <div>
              <h2 style={{ marginBottom: '6px' }}>Regimi IVA</h2>
              <p className="section-description">
                Gestisci i regimi IVA disponibili per le vendite. Puoi aggiungere, modificare ed eliminare regimi IVA.
              </p>
            </div>
            <FontAwesomeIcon icon={collapsedSections.vat ? faChevronDown : faChevronUp} />
          </div>

          {!collapsedSections.vat && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button 
                  className="btn-primary" 
                  onClick={() => handleOpenVatRegimeModal()}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Aggiungi Regime IVA
                </button>
              </div>

              <div style={{ 
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                overflow: 'hidden',
                marginTop: '20px'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                      <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Bandiera</th>
                      <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Nome</th>
                      <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>IVA</th>
                      <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Paesi</th>
                      <th style={{ padding: '15px', textAlign: 'right', fontWeight: '600', fontSize: '14px' }}>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vatRegimes.map((regime, index) => (
                      <tr 
                        key={regime.id}
                        style={{ 
                          borderBottom: index < vatRegimes.length - 1 ? '1px solid #e0e0e0' : 'none'
                        }}
                      >
                        <td style={{ padding: '15px' }}>
                          {regime.country_code ? (
                            <ReactCountryFlag
                              countryCode={regime.country_code}
                              svg
                              style={{
                                width: '32px',
                                height: '24px'
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: '24px' }}>📋</span>
                          )}
                        </td>
                        <td style={{ padding: '15px', fontWeight: '500' }}>
                          {regime.name}
                        </td>
                        <td style={{ padding: '15px', color: '#666' }}>
                          {regime.vat_rate}%
                        </td>
                        <td style={{ padding: '15px', color: '#888', fontSize: '14px' }}>
                          {regime.countries || '-'}
                        </td>
                        <td style={{ padding: '15px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleOpenVatRegimeModal(regime)}
                              style={{
                                background: '#2d2d2d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              title="Modifica"
                            >
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                            <button
                              onClick={() => handleDeleteVatRegime(regime.id)}
                              style={{
                                background: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              title="Elimina"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {vatRegimes.length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px', 
                  color: '#888',
                  background: 'white',
                  borderRadius: '12px',
                  marginTop: '20px'
                }}>
                  Nessun regime IVA configurato. Clicca su "Aggiungi Regime IVA" per iniziare.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modale per aggiungere/modificare regime IVA */}
      {showVatRegimeModal && (
        <div 
          className="modal-overlay" 
          onClick={handleCloseVatRegimeModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>
                {editingVatRegime ? 'Modifica Regime IVA' : 'Aggiungi Regime IVA'}
              </h2>
              <button
                onClick={handleCloseVatRegimeModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <form onSubmit={handleSaveVatRegime}>
              <div className="form-group">
                <label>Nome Regime IVA *</label>
                <input
                  type="text"
                  value={vatRegimeForm.name}
                  onChange={(e) => setVatRegimeForm({ ...vatRegimeForm, name: e.target.value })}
                  placeholder="es: Italia - Slovenia (Iva 22%)"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                <small>Nome completo del regime IVA</small>
              </div>

              <div className="form-group">
                <label>Percentuale IVA (%) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={vatRegimeForm.vat_rate}
                  onChange={(e) => setVatRegimeForm({ ...vatRegimeForm, vat_rate: e.target.value })}
                  placeholder="22"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                <small>Percentuale IVA (es: 22 per 22%)</small>
              </div>

              <div className="form-group">
                <label>Paesi (opzionale)</label>
                <input
                  type="text"
                  value={vatRegimeForm.countries}
                  onChange={(e) => setVatRegimeForm({ ...vatRegimeForm, countries: e.target.value })}
                  placeholder="es: Italia, Slovenia"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                <small>Elenco dei paesi associati a questo regime IVA</small>
              </div>

              <div className="form-group">
                <label>Codice Paese (ISO 2 lettere)</label>
                <select
                  value={vatRegimeForm.country_code}
                  onChange={(e) => setVatRegimeForm({ ...vatRegimeForm, country_code: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'white'
                  }}
                >
                  <option value="">Nessun paese (es: Art.17)</option>
                  <option value="IT">🇮🇹 Italia (IT)</option>
                  <option value="DE">🇩🇪 Germania (DE)</option>
                  <option value="FR">🇫🇷 Francia (FR)</option>
                  <option value="ES">🇪🇸 Spagna (ES)</option>
                  <option value="NL">🇳🇱 Paesi Bassi (NL)</option>
                  <option value="BE">🇧🇪 Belgio (BE)</option>
                  <option value="AT">🇦🇹 Austria (AT)</option>
                  <option value="GR">🇬🇷 Grecia (GR)</option>
                  <option value="SE">🇸🇪 Svezia (SE)</option>
                  <option value="HU">🇭🇺 Ungheria (HU)</option>
                  <option value="RO">🇷🇴 Romania (RO)</option>
                  <option value="BG">🇧🇬 Bulgaria (BG)</option>
                  <option value="SI">🇸🇮 Slovenia (SI)</option>
                  <option value="LU">🇱🇺 Lussemburgo (LU)</option>
                  <option value="MT">🇲🇹 Malta (MT)</option>
                </select>
                <small>Seleziona il codice paese ISO a 2 lettere (es: IT per Italia, DE per Germania)</small>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCloseVatRegimeModal}
                  className="btn-secondary"
                >
                  Annulla
                </button>
                <button type="submit" className="btn-primary">
                  <FontAwesomeIcon icon={faSave} style={{ marginRight: '8px' }} />
                  {editingVatRegime ? 'Salva Modifiche' : 'Aggiungi Regime IVA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

