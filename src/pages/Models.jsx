import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { processAndUploadImage, deleteImageFromStorage, validateImageFile } from '../lib/imageUpload'
import { upload3mfToStorage, delete3mfFromStorage, validate3mfFile } from '../lib/fileUpload'
import { openInBambuStudio } from '../lib/bambuStudio'
import { logAction } from '../lib/logging'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEdit, faTrash, faPlus, faCube } from '@fortawesome/free-solid-svg-icons'
import './Models.css'

export default function Models() {
  const [models, setModels] = useState([])
  const [filteredModels, setFilteredModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    sortBy: 'data_decrescente'
  })
  const [editingModel, setEditingModel] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [selected3mfFile, setSelected3mfFile] = useState(null)
  const [threeMfName, setThreeMfName] = useState('')
  const [remove3mfFile, setRemove3mfFile] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    weight_kg: '',
    dimensions: '',
    photo_url: '',
    model_3mf_url: '',
    is_multimaterial: false,
    color1_weight_g: '',
    color2_weight_g: '',
    color3_weight_g: '',
    color4_weight_g: '',
  })

  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    const { data: modelsData, error: modelsError } = await supabase
      .from('models')
      .select('*')
      .order('name')

    if (modelsError) {
      console.error('Error loading models:', modelsError)
      setLoading(false)
      return
    }

    // Carica i prodotti venduti per ogni modello
    const { data: productsData } = await supabase
      .from('products')
      .select('model_id, status, final_sale_price, sale_price')
      .eq('status', 'venduto')

    // Conta le vendite e calcola il totale economico per ogni modello
    const salesCount = {}
    const salesRevenue = {}
    if (productsData) {
      productsData.forEach((product) => {
        const modelId = product.model_id
        // Conta i pezzi
        salesCount[modelId] = (salesCount[modelId] || 0) + 1
        // Somma i ricavi
        const revenue = parseFloat(product.final_sale_price || product.sale_price || 0)
        salesRevenue[modelId] = (salesRevenue[modelId] || 0) + revenue
      })
    }

    // Aggiungi il conteggio vendite e ricavi a ogni modello
    const modelsWithSales = (modelsData || []).map((model) => ({
      ...model,
      sales_count: salesCount[model.id] || 0,
      sales_revenue: salesRevenue[model.id] || 0,
    }))

    setModels(modelsWithSales)
    applyFilters(modelsWithSales, filters)
    setLoading(false)
  }

  const applyFilters = (modelsList, filterValues) => {
    let filtered = [...modelsList]

    // Filtro ricerca per nome e SKU
    if (filterValues.search) {
      const searchLower = filterValues.search.toLowerCase()
      filtered = filtered.filter(m => 
        m.name?.toLowerCase().includes(searchLower) ||
        m.sku?.toLowerCase().includes(searchLower)
      )
    }

    // Ordinamento
    filtered.sort((a, b) => {
      if (filterValues.sortBy === 'peso_crescente') {
        return parseFloat(a.weight_kg || 0) - parseFloat(b.weight_kg || 0)
      } else if (filterValues.sortBy === 'peso_decrescente') {
        return parseFloat(b.weight_kg || 0) - parseFloat(a.weight_kg || 0)
      } else if (filterValues.sortBy === 'dimensioni_crescente') {
        // Estrai numeri dalle dimensioni per confronto (es: "10 x 5 x 3 cm" -> [10, 5, 3])
        const getDimensions = (dims) => {
          if (!dims) return [0, 0, 0]
          const numbers = dims.match(/\d+/g) || []
          return numbers.map(Number).slice(0, 3)
        }
        const dimsA = getDimensions(a.dimensions)
        const dimsB = getDimensions(b.dimensions)
        // Confronta prima per altezza, poi larghezza, poi profondità
        for (let i = 0; i < 3; i++) {
          if (dimsA[i] !== dimsB[i]) {
            return dimsA[i] - dimsB[i]
          }
        }
        return 0
      } else if (filterValues.sortBy === 'dimensioni_decrescente') {
        const getDimensions = (dims) => {
          if (!dims) return [0, 0, 0]
          const numbers = dims.match(/\d+/g) || []
          return numbers.map(Number).slice(0, 3)
        }
        const dimsA = getDimensions(a.dimensions)
        const dimsB = getDimensions(b.dimensions)
        for (let i = 0; i < 3; i++) {
          if (dimsA[i] !== dimsB[i]) {
            return dimsB[i] - dimsA[i]
          }
        }
        return 0
      } else if (filterValues.sortBy === 'pezzi_venduti_crescente') {
        return (a.sales_count || 0) - (b.sales_count || 0)
      } else if (filterValues.sortBy === 'pezzi_venduti_decrescente') {
        return (b.sales_count || 0) - (a.sales_count || 0)
      } else if (filterValues.sortBy === 'ricavi_crescente') {
        return (a.sales_revenue || 0) - (b.sales_revenue || 0)
      } else if (filterValues.sortBy === 'ricavi_decrescente') {
        return (b.sales_revenue || 0) - (a.sales_revenue || 0)
      } else if (filterValues.sortBy === 'data_decrescente') {
        // Ordina per data di caricamento decrescente (più recenti prima)
        const dateA = new Date(a.created_at || 0)
        const dateB = new Date(b.created_at || 0)
        return dateB - dateA
      } else {
        // Default: ordina per nome
        return (a.name || '').localeCompare(b.name || '')
      }
    })

    setFilteredModels(filtered)
  }

  useEffect(() => {
    if (models.length > 0) {
      applyFilters(models, filters)
    }
  }, [filters, models])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setUploading(true)

    try {
      // Il form accetta grammi, convertiamo in kg per il database
      // Calcola il peso: se multimateriale, somma le grammature dei colori
      let weight
      if (formData.is_multimaterial) {
        const totalGrams = 
          (parseFloat(formData.color1_weight_g) || 0) +
          (parseFloat(formData.color2_weight_g) || 0) +
          (parseFloat(formData.color3_weight_g) || 0) +
          (parseFloat(formData.color4_weight_g) || 0)
        weight = totalGrams / 1000 // Converti in kg
      } else {
        weight = parseFloat(formData.weight_kg)
      }

      let photoUrl = formData.photo_url
      let model3mfUrl = formData.model_3mf_url

      // Se è stato selezionato un nuovo file, caricalo
      if (selectedFile) {
        try {
          // Se stiamo modificando e c'è già un'immagine, elimina quella vecchia
          if (editingModel && editingModel.photo_url) {
            // Verifica se l'immagine vecchia è su Supabase Storage
            if (editingModel.photo_url.includes('supabase.co/storage')) {
              await deleteImageFromStorage(editingModel.photo_url)
            }
          }

          photoUrl = await processAndUploadImage(selectedFile)
        } catch (error) {
          alert(error.message)
          setUploading(false)
          return
        }
      }

      if (selected3mfFile) {
        try {
          if (editingModel && editingModel.model_3mf_url) {
            if (editingModel.model_3mf_url.includes('supabase.co/storage')) {
              await delete3mfFromStorage(editingModel.model_3mf_url)
            }
          }
          model3mfUrl = await upload3mfToStorage(selected3mfFile)
        } catch (error) {
          alert(error.message)
          setUploading(false)
          return
        }
      } else if (remove3mfFile && editingModel?.model_3mf_url) {
        if (editingModel.model_3mf_url.includes('supabase.co/storage')) {
          await delete3mfFromStorage(editingModel.model_3mf_url)
        }
        model3mfUrl = null
      }

      const modelData = {
        name: formData.name,
        description: formData.description || null,
        sku: formData.sku.trim().toUpperCase(),
        weight_kg: weight,
        dimensions: formData.dimensions || null,
        photo_url: photoUrl || null,
        model_3mf_url: model3mfUrl || null,
        is_multimaterial: formData.is_multimaterial || false,
        color1_weight_g: formData.is_multimaterial && formData.color1_weight_g ? parseFloat(formData.color1_weight_g) : null,
        color2_weight_g: formData.is_multimaterial && formData.color2_weight_g ? parseFloat(formData.color2_weight_g) : null,
        color3_weight_g: formData.is_multimaterial && formData.color3_weight_g ? parseFloat(formData.color3_weight_g) : null,
        color4_weight_g: formData.is_multimaterial && formData.color4_weight_g ? parseFloat(formData.color4_weight_g) : null,
      }

      if (editingModel) {
        const { data, error } = await supabase
          .from('models')
          .update(modelData)
          .eq('id', editingModel.id)
          .select()
          .single()

        if (error) {
          alert('Errore durante l\'aggiornamento: ' + error.message)
        } else {
          // Log dell'operazione
          await logAction(
            'modifica_modello',
            'modello',
            editingModel.id,
            `${modelData.name} (${modelData.sku})`,
            { changes: modelData }
          )
          await loadModels()
          setShowModal(false)
          resetForm()
        }
      } else {
        const { data, error } = await supabase.from('models').insert([modelData]).select().single()

        if (error) {
          alert('Errore durante l\'inserimento: ' + error.message)
        } else {
          // Log dell'operazione
          await logAction(
            'aggiunta_modello',
            'modello',
            data.id,
            `${modelData.name} (${modelData.sku})`,
            { model_data: modelData }
          )
          await loadModels()
          setShowModal(false)
          resetForm()
        }
      }
    } catch (error) {
      alert('Errore: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleEdit = (model) => {
    setEditingModel(model)
    setFormData({
      name: model.name || '',
      description: model.description || '',
      sku: model.sku || '',
      weight_kg: model.weight_kg || '', // Memorizzato in kg nel database
      dimensions: model.dimensions || '',
      photo_url: model.photo_url || '',
      model_3mf_url: model.model_3mf_url || '',
      is_multimaterial: model.is_multimaterial || false,
      color1_weight_g: model.color1_weight_g || '',
      color2_weight_g: model.color2_weight_g || '',
      color3_weight_g: model.color3_weight_g || '',
      color4_weight_g: model.color4_weight_g || '',
    })
    setSelectedFile(null)
    setImagePreview(model.photo_url || null)
    setSelected3mfFile(null)
    setThreeMfName(model.model_3mf_url ? model.model_3mf_url.split('/').pop() : '')
    setRemove3mfFile(false)
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questo modello?')) return

    // Controlla se ci sono prodotti associati a questo modello
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id')
      .eq('model_id', id)
      .limit(1)

    if (productsError) {
      alert('Errore durante il controllo dei prodotti associati: ' + productsError.message)
      return
    }

    if (products && products.length > 0) {
      // Conta tutti i prodotti associati per mostrare un messaggio più informativo
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('model_id', id)

      alert(`Impossibile eliminare il modello: ci sono ${count || products.length} prodotto/i associato/i. Elimina prima i prodotti che utilizzano questo modello.`)
      return
    }

    // Trova il modello per eliminare anche l'immagine
    const model = models.find(m => m.id === id)
    if (model && model.photo_url && model.photo_url.includes('supabase.co/storage')) {
      await deleteImageFromStorage(model.photo_url)
    }
    if (model && model.model_3mf_url && model.model_3mf_url.includes('supabase.co/storage')) {
      await delete3mfFromStorage(model.model_3mf_url)
    }

    const { error } = await supabase.from('models').delete().eq('id', id)

    if (error) {
      alert('Errore durante l\'eliminazione: ' + error.message)
    } else {
      await loadModels()
    }
  }

  const handleOpenInBambu = (model3mfUrl) => {
    if (!model3mfUrl) return
    openInBambuStudio(model3mfUrl)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) {
      setSelectedFile(null)
      setImagePreview(formData.photo_url || null)
      return
    }

    // Valida il file
    const validation = validateImageFile(file)
    if (!validation.valid) {
      alert(validation.error)
      e.target.value = '' // Reset input
      return
    }

    setSelectedFile(file)

    // Crea anteprima
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handle3mfChange = (e) => {
    const file = e.target.files[0]
    if (!file) {
      setSelected3mfFile(null)
      setThreeMfName(formData.model_3mf_url ? formData.model_3mf_url.split('/').pop() : '')
      return
    }

    const validation = validate3mfFile(file)
    if (!validation.valid) {
      alert(validation.error)
      e.target.value = ''
      return
    }

    setSelected3mfFile(file)
    setThreeMfName(file.name)
    setRemove3mfFile(false)
  }

  const handleRemoveImage = () => {
    setSelectedFile(null)
    setImagePreview(null)
    // Reset input file
    const fileInput = document.getElementById('photo-upload')
    if (fileInput) fileInput.value = ''
  }

  const handleRemove3mf = () => {
    setSelected3mfFile(null)
    setThreeMfName('')
    setRemove3mfFile(true)
    setFormData({ ...formData, model_3mf_url: '' })
    const fileInput = document.getElementById('model-3mf-upload')
    if (fileInput) fileInput.value = ''
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      sku: '',
      weight_kg: '',
      dimensions: '',
      photo_url: '',
      model_3mf_url: '',
      is_multimaterial: false,
      color1_weight_g: '',
      color2_weight_g: '',
      color3_weight_g: '',
      color4_weight_g: '',
    })
    setEditingModel(null)
    setSelectedFile(null)
    setImagePreview(null)
    setSelected3mfFile(null)
    setThreeMfName('')
    setRemove3mfFile(false)
    // Reset input file
    const fileInput = document.getElementById('photo-upload')
    if (fileInput) fileInput.value = ''
    const modelFileInput = document.getElementById('model-3mf-upload')
    if (modelFileInput) modelFileInput.value = ''
  }

  if (loading) return <div className="loading">Caricamento...</div>

  return (
    <div className="models-page">
      <div className="page-header">
        <h1>Gestione Modelli</h1>
        <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true) }}>
          <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
          Nuovo Modello
        </button>
      </div>

      {/* Barra di ricerca e ordinamento */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label style={{ fontSize: '14px', marginBottom: '8px', display: 'block', color: '#1a1a1a', fontWeight: '500' }}>
              Cerca Modelli
            </label>
            <input
              type="text"
              placeholder="Cerca per nome o SKU..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
            <small style={{ display: 'block', marginTop: '5px', color: '#7f8c8d', fontSize: '12px' }}>
              {filteredModels.length} {filteredModels.length === 1 ? 'modello trovato' : 'modelli trovati'}
              {filters.search && ` per "${filters.search}"`}
            </small>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '0 0 300px', display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '14px', marginBottom: '8px', display: 'block', color: '#1a1a1a', fontWeight: '500' }}>
              Ordina per
            </label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'white',
                marginTop: 'auto'
              }}
            >
              <option value="name">Nome</option>
              <option value="peso_crescente">Peso Crescente</option>
              <option value="peso_decrescente">Peso Decrescente</option>
              <option value="dimensioni_crescente">Dimensioni Crescente</option>
              <option value="dimensioni_decrescente">Dimensioni Decrescente</option>
              <option value="pezzi_venduti_crescente">Pezzi Venduti Crescente</option>
              <option value="pezzi_venduti_decrescente">Pezzi Venduti Decrescente</option>
              <option value="ricavi_crescente">Ricavi Crescente</option>
              <option value="ricavi_decrescente">Ricavi Decrescente</option>
              <option value="data_decrescente">Data Caricamento (Più recenti)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="models-table-container">
        <table className="models-table">
          <thead>
            <tr>
              <th>Immagine</th>
              <th>Nome</th>
              <th>Note</th>
              <th>Peso</th>
              <th>Dimensioni</th>
              <th>Pezzi Venduti</th>
              <th>Ricavi</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filteredModels.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-state">
                  {models.length === 0 
                    ? 'Nessun modello trovato. Crea il primo modello!'
                    : 'Nessun modello corrisponde ai filtri selezionati.'}
                </td>
              </tr>
            ) : (
              filteredModels.map((model) => (
                <tr key={model.id}>
                  <td>
                    {model.photo_url ? (
                      <img
                        src={model.photo_url}
                        alt={model.name}
                        className="model-preview-image"
                      />
                    ) : (
                      <div className="model-preview-placeholder">
                        <span>Nessuna immagine</span>
                      </div>
                    )}
                  </td>
                  <td className="model-name">
                    {model.sku && (
                      <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>
                        {model.sku}
                      </div>
                    )}
                    <strong>{model.name}</strong>
                  </td>
                  <td>
                    {model.description ? (
                      <span style={{ color: '#1a1a1a', fontSize: '14px' }}>{model.description}</span>
                    ) : (
                      <span style={{ color: '#7f8c8d', fontStyle: 'italic' }}>Nessuna nota</span>
                    )}
                  </td>
                  <td>
                    {Math.round(parseFloat(model.weight_kg) * 1000)} g
                  </td>
                  <td>
                    {model.dimensions ? (
                      <span style={{ fontSize: '14px' }}>{model.dimensions} {!model.dimensions.includes('cm') && 'cm'}</span>
                    ) : (
                      <span style={{ color: '#7f8c8d' }}>-</span>
                    )}
                  </td>
                  <td>
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      padding: '4px 12px',
                      background: model.sales_count > 0 ? '#d4edda' : '#f8f9fa',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: model.sales_count > 0 ? '#155724' : '#7f8c8d'
                    }}>
                      <span>{model.sales_count || 0}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      padding: '4px 12px',
                      background: model.sales_revenue > 0 ? '#e8f5e9' : '#f8f9fa',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: model.sales_revenue > 0 ? '#2e7d32' : '#7f8c8d'
                    }}>
                      €{model.sales_revenue ? model.sales_revenue.toFixed(2) : '0.00'}
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={!model.model_3mf_url}
                        onClick={() => handleOpenInBambu(model.model_3mf_url)}
                        style={{
                          background: model.model_3mf_url ? '#00b56a' : undefined,
                          borderColor: model.model_3mf_url ? '#00b56a' : undefined,
                          color: model.model_3mf_url ? '#ffffff' : undefined,
                          opacity: model.model_3mf_url ? 1 : 0.5,
                          cursor: model.model_3mf_url ? 'pointer' : 'not-allowed',
                          width: '36px',
                          height: '36px',
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Apri in Bambu Studio"
                      >
                        <FontAwesomeIcon icon={faCube} />
                      </button>
                      <button className="btn-edit" onClick={() => handleEdit(model)} title="Modifica">
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button className="btn-delete" onClick={() => handleDelete(model.id)} title="Elimina">
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm() }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingModel ? 'Modifica Modello' : 'Nuovo Modello'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nome Modello</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Nome del modello"
                />
              </div>
              <div className="form-group">
                <label>SKU Genitore</label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                  required
                  placeholder="Es: MOD-001"
                  style={{ textTransform: 'uppercase' }}
                />
                <small>SKU univoco del modello (es: MOD-001, VASE-01)</small>
              </div>
              <div className="form-group">
                <label>Note</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Note opzionali"
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_multimaterial}
                    onChange={(e) => setFormData({ ...formData, is_multimaterial: e.target.checked })}
                    style={{ width: 'auto' }}
                  />
                  <span>Modello Multimateriale</span>
                </label>
                <small>Attiva questa opzione se il modello può essere stampato con più materiali/colori</small>
              </div>

              {!formData.is_multimaterial ? (
                <div className="form-group">
                  <label>Peso (g)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.weight_kg ? Math.round(parseFloat(formData.weight_kg) * 1000) : ''}
                    onChange={(e) => {
                      const grams = parseFloat(e.target.value) || 0
                      setFormData({ ...formData, weight_kg: (grams / 1000).toString() })
                    }}
                    required
                    placeholder="0"
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label>Grammature per Colore (g)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '5px', display: 'block' }}>Colore 1</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.color1_weight_g}
                        onChange={(e) => setFormData({ ...formData, color1_weight_g: e.target.value })}
                        required
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '5px', display: 'block' }}>Colore 2</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.color2_weight_g}
                        onChange={(e) => setFormData({ ...formData, color2_weight_g: e.target.value })}
                        required
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '5px', display: 'block' }}>Colore 3 (opzionale)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.color3_weight_g}
                        onChange={(e) => setFormData({ ...formData, color3_weight_g: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '5px', display: 'block' }}>Colore 4 (opzionale)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.color4_weight_g}
                        onChange={(e) => setFormData({ ...formData, color4_weight_g: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <small>Inserisci la grammatura per ogni colore utilizzato (minimo 2 colori). Il peso totale sarà calcolato automaticamente.</small>
                </div>
              )}
              <div className="form-group">
                <label>Dimensioni</label>
                <input
                  type="text"
                  value={formData.dimensions}
                  onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                  placeholder="Es: 10 x 5 x 3 cm (Altezza x Larghezza x Profondità)"
                />
              </div>
              <div className="form-group">
                <label>File 3MF</label>
                <input
                  id="model-3mf-upload"
                  type="file"
                  accept=".3mf"
                  onChange={handle3mfChange}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => document.getElementById('model-3mf-upload')?.click()}
                  >
                    {threeMfName ? 'Sostituisci file' : 'Carica file'}
                  </button>
                  <span style={{ fontSize: '14px', color: threeMfName ? '#1a1a1a' : '#7f8c8d' }}>
                    {threeMfName || 'Nessun file 3MF selezionato'}
                  </span>
                  {(threeMfName || formData.model_3mf_url) && (
                    <button
                      type="button"
                      onClick={handleRemove3mf}
                      style={{
                        border: '1px solid #f5c6cb',
                        background: '#f8d7da',
                        color: '#721c24',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Rimuovi
                    </button>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Foto</label>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <div
                  onClick={() => document.getElementById('photo-upload')?.click()}
                  style={{
                    width: '200px',
                    height: '200px',
                    border: '2px dashed #ddd',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    background: imagePreview ? 'transparent' : '#f8f9fa',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!imagePreview) {
                      e.currentTarget.style.borderColor = '#2d2d2d'
                      e.currentTarget.style.background = '#e8f4f8'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!imagePreview) {
                      e.currentTarget.style.borderColor = '#ddd'
                      e.currentTarget.style.background = '#f8f9fa'
                    }
                  }}
                >
                  {imagePreview ? (
                    <>
                      <img
                        src={imagePreview}
                        alt="Anteprima"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          position: 'absolute',
                          top: 0,
                          left: 0
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'rgba(0, 0, 0, 0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0,
                          transition: 'opacity 0.2s',
                          color: 'white',
                          fontWeight: '600'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                      >
                        Clicca per sostituire
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveImage()
                        }}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: 'rgba(255, 0, 0, 0.8)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '28px',
                          height: '28px',
                          cursor: 'pointer',
                          fontSize: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 10
                        }}
                        title="Rimuovi immagine"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '48px', color: '#ccc', marginBottom: '10px' }}>📷</div>
                      <div style={{ color: '#666', fontSize: '14px', textAlign: 'center', padding: '0 10px' }}>
                        Clicca per caricare
                      </div>
                      <div style={{ color: '#999', fontSize: '12px', marginTop: '5px' }}>
                        Max 5MB
                      </div>
                    </>
                  )}
                </div>
                <small style={{ display: 'block', color: '#666', marginTop: '8px' }}>
                  Formati supportati: JPG, PNG, WEBP, GIF. Dimensione massima: 5MB
                </small>
                {!imagePreview && !selectedFile && (
                  <div style={{ marginTop: '10px', padding: '10px', background: '#f5f5f5', borderRadius: '4px', fontSize: '14px', color: '#666' }}>
                    Oppure inserisci un URL:
                    <input
                      type="url"
                      value={formData.photo_url}
                      onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                      placeholder="https://..."
                      style={{ marginTop: '5px', width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); resetForm() }} disabled={uploading}>
                  Annulla
                </button>
                <button type="submit" className="btn-primary" disabled={uploading}>
                  {uploading ? 'Caricamento...' : (editingModel ? 'Salva' : 'Crea')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
