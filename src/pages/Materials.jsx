import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { processAndUploadImage, deleteImageFromStorage, validateImageFile } from '../lib/imageUpload'
import { logAction } from '../lib/logging'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEdit, faTrash, faCheck, faXmark, faPlus } from '@fortawesome/free-solid-svg-icons'
import './Materials.css'

export default function Materials() {
  const [materials, setMaterials] = useState([])
  const [filteredMaterials, setFilteredMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filters, setFilters] = useState({
    brand: '',
    color: '',
    material_type: '',
    availability: '',
    sortBy: 'data_decrescente'
  })
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState(null)
  const [selectedBobinaFile, setSelectedBobinaFile] = useState(null)
  const [selectedPrintFile, setSelectedPrintFile] = useState(null)
  const [bobinaPreview, setBobinaPreview] = useState(null)
  const [printPreview, setPrintPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    brand: '',
    purchased_from: '',
    color: '',
    color_hex: '',
    material_type: 'PLA',
    code: '',
    cost_per_kg: '',
    status: 'disponibile',
    bobina_photo_url: '',
    print_example_photo_url: '',
  })

  const applyFilters = (materialsList, filterValues) => {
    let filtered = [...materialsList]

    // Filtro Brand
    if (filterValues.brand) {
      filtered = filtered.filter(m => 
        m.brand?.toLowerCase().includes(filterValues.brand.toLowerCase())
      )
    }

    // Filtro Colore
    if (filterValues.color) {
      filtered = filtered.filter(m => 
        m.color?.toLowerCase().includes(filterValues.color.toLowerCase())
      )
    }

    // Filtro Materiale
    if (filterValues.material_type) {
      filtered = filtered.filter(m => m.material_type === filterValues.material_type)
    }

    // Filtro Disponibilità
    if (filterValues.availability === 'si') {
      filtered = filtered.filter(m => m.status === 'disponibile')
    } else if (filterValues.availability === 'no') {
      filtered = filtered.filter(m => m.status === 'esaurito')
    }

    // Ordinamento
    filtered.sort((a, b) => {
      if (filterValues.sortBy === 'prezzo_crescente') {
        return parseFloat(a.cost_per_kg || 0) - parseFloat(b.cost_per_kg || 0)
      } else if (filterValues.sortBy === 'prezzo_decrescente') {
        return parseFloat(b.cost_per_kg || 0) - parseFloat(a.cost_per_kg || 0)
      } else if (filterValues.sortBy === 'disponibilità') {
        // Prima disponibili, poi esauriti
        if (a.status === 'disponibile' && b.status !== 'disponibile') return -1
        if (a.status !== 'disponibile' && b.status === 'disponibile') return 1
        return 0
      } else if (filterValues.sortBy === 'data_decrescente') {
        // Ordina per data di caricamento decrescente (più recenti prima)
        const dateA = new Date(a.created_at || 0)
        const dateB = new Date(b.created_at || 0)
        return dateB - dateA
      } else {
        // Default: ordina per brand
        return (a.brand || '').localeCompare(b.brand || '')
      }
    })

    setFilteredMaterials(filtered)
  }

  const loadMaterials = async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('brand')

    if (error) {
      console.error('Error loading materials:', error)
    } else {
      setMaterials(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadMaterials()
  }, [])

  useEffect(() => {
    if (materials.length > 0) {
      applyFilters(materials, filters)
    }
  }, [filters, materials])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setUploading(true)

    try {
      const cost = parseFloat(formData.cost_per_kg)
      let bobinaPhotoUrl = formData.bobina_photo_url
      let printPhotoUrl = formData.print_example_photo_url

      // Valida che ci sia almeno la foto della bobina
      if (!selectedBobinaFile && !bobinaPhotoUrl) {
        alert('La foto della bobina è obbligatoria')
        setUploading(false)
        return
      }

      // Carica foto bobina se selezionata
      if (selectedBobinaFile) {
        try {
          // Se stiamo modificando e c'è già un'immagine, elimina quella vecchia
          if (editingMaterial && editingMaterial.bobina_photo_url) {
            if (editingMaterial.bobina_photo_url.includes('supabase.co/storage')) {
              await deleteImageFromStorage(editingMaterial.bobina_photo_url, 'material-photos')
            }
          }
          bobinaPhotoUrl = await processAndUploadImage(selectedBobinaFile, 'material-photos')
        } catch (error) {
          alert(error.message)
          setUploading(false)
          return
        }
      }

      // Carica foto esempio stampa se selezionata
      if (selectedPrintFile) {
        try {
          // Se stiamo modificando e c'è già un'immagine, elimina quella vecchia
          if (editingMaterial && editingMaterial.print_example_photo_url) {
            if (editingMaterial.print_example_photo_url.includes('supabase.co/storage')) {
              await deleteImageFromStorage(editingMaterial.print_example_photo_url, 'material-photos')
            }
          }
          printPhotoUrl = await processAndUploadImage(selectedPrintFile, 'material-photos')
        } catch (error) {
          alert(error.message)
          setUploading(false)
          return
        }
      }

      // Valida codice materiale (deve essere esattamente 4 cifre)
      const code = formData.code.trim()
      if (!/^\d{4}$/.test(code)) {
        alert('Il codice materiale deve essere esattamente 4 cifre (es: 0001, 1234)')
        setUploading(false)
        return
      }

      // Valida formato HEX se fornito
      let colorHex = formData.color_hex.trim().toUpperCase()
      if (colorHex && !/^#[0-9A-F]{6}$/.test(colorHex)) {
        if (/^[0-9A-F]{6}$/.test(colorHex)) {
          colorHex = '#' + colorHex
        } else {
          alert('Il codice HEX deve essere nel formato #RRGGBB (es: #FF0000)')
          setUploading(false)
          return
        }
      }

      const materialData = {
        brand: formData.brand,
        purchased_from: formData.purchased_from,
        color: formData.color,
        color_hex: colorHex || null,
        material_type: formData.material_type,
        code: code,
        cost_per_kg: cost,
        status: formData.status,
        bobina_photo_url: bobinaPhotoUrl,
        print_example_photo_url: printPhotoUrl || null,
      }

      if (editingMaterial) {
        const { data, error } = await supabase
          .from('materials')
          .update(materialData)
          .eq('id', editingMaterial.id)
          .select()
          .single()

        if (error) {
          alert('Errore durante l\'aggiornamento: ' + error.message)
        } else {
          // Log dell'operazione
          await logAction(
            'modifica_materiale',
            'materiale',
            editingMaterial.id,
            `${materialData.brand} - ${materialData.color} (${materialData.code})`,
            { changes: materialData }
          )
          await loadMaterials()
          setShowModal(false)
          resetForm()
        }
      } else {
        const { data, error } = await supabase.from('materials').insert([materialData]).select().single()

        if (error) {
          alert('Errore durante l\'inserimento: ' + error.message)
        } else {
          // Log dell'operazione
          await logAction(
            'aggiunta_materiale',
            'materiale',
            data.id,
            `${materialData.brand} - ${materialData.color} (${materialData.code})`,
            { material_data: materialData }
          )
          await loadMaterials()
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

  const handleEdit = (material) => {
    setEditingMaterial(material)
    setFormData({
      brand: material.brand || '',
      purchased_from: material.purchased_from || '',
      color: material.color || '',
      color_hex: material.color_hex || '',
      material_type: material.material_type || 'PLA',
      code: material.code || '',
      cost_per_kg: material.cost_per_kg,
      status: material.status || 'disponibile',
      bobina_photo_url: material.bobina_photo_url || '',
      print_example_photo_url: material.print_example_photo_url || '',
    })
    setSelectedBobinaFile(null)
    setSelectedPrintFile(null)
    setBobinaPreview(material.bobina_photo_url || null)
    setPrintPreview(material.print_example_photo_url || null)
    setShowModal(true)
  }

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'disponibile' ? 'esaurito' : 'disponibile'
    
    const { error } = await supabase
      .from('materials')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      alert('Errore durante l\'aggiornamento dello stato: ' + error.message)
    } else {
      await loadMaterials()
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questo materiale?')) return

    // Controlla se ci sono prodotti associati a questo materiale
    // Controlla sia in material_id che in multimaterial_mapping
    const { data: productsDirect, error: productsError1 } = await supabase
      .from('products')
      .select('id')
      .eq('material_id', id)
      .limit(1)

    if (productsError1) {
      alert('Errore durante il controllo dei prodotti associati: ' + productsError1.message)
      return
    }

    // Controlla anche nei prodotti multimateriale
    const { data: productsMultimaterial, error: productsError2 } = await supabase
      .from('products')
      .select('id, multimaterial_mapping')
      .not('multimaterial_mapping', 'is', null)

    let hasMultimaterialReference = false
    if (productsMultimaterial && !productsError2) {
      hasMultimaterialReference = productsMultimaterial.some(product => {
        if (product.multimaterial_mapping && Array.isArray(product.multimaterial_mapping)) {
          return product.multimaterial_mapping.some(mapping => mapping.material_id === id)
        }
        return false
      })
    }

    if ((productsDirect && productsDirect.length > 0) || hasMultimaterialReference) {
      // Conta tutti i prodotti associati
      let totalCount = 0
      if (productsDirect) {
        const { count } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('material_id', id)
        totalCount += count || 0
      }
      if (hasMultimaterialReference) {
        // Conta anche quelli nel multimaterial_mapping
        const { data: allMultimaterial } = await supabase
          .from('products')
          .select('multimaterial_mapping')
          .not('multimaterial_mapping', 'is', null)
        if (allMultimaterial) {
          allMultimaterial.forEach(product => {
            if (product.multimaterial_mapping && Array.isArray(product.multimaterial_mapping)) {
              if (product.multimaterial_mapping.some(m => m.material_id === id)) {
                totalCount++
              }
            }
          })
        }
      }
      alert(`Impossibile eliminare il materiale: ci sono ${totalCount} prodotto/i associato/i. Elimina prima i prodotti che utilizzano questo materiale.`)
      return
    }

    // Trova il materiale per eliminare anche le immagini
    const material = materials.find(m => m.id === id)
    const materialName = material ? `${material.brand} - ${material.color} (${material.code})` : 'Materiale sconosciuto'
    
    if (material) {
      if (material.bobina_photo_url && material.bobina_photo_url.includes('supabase.co/storage')) {
        await deleteImageFromStorage(material.bobina_photo_url, 'material-photos')
      }
      if (material.print_example_photo_url && material.print_example_photo_url.includes('supabase.co/storage')) {
        await deleteImageFromStorage(material.print_example_photo_url, 'material-photos')
      }
    }

    const { error } = await supabase.from('materials').delete().eq('id', id)

    if (error) {
      alert('Errore durante l\'eliminazione: ' + error.message)
    } else {
      // Log dell'operazione
      await logAction(
        'eliminazione_materiale',
        'materiale',
        id,
        materialName,
        { material_data: material }
      )
      await loadMaterials()
    }
  }

  const handleBobinaFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) {
      setSelectedBobinaFile(null)
      setBobinaPreview(formData.bobina_photo_url || null)
      return
    }

    const validation = validateImageFile(file)
    if (!validation.valid) {
      alert(validation.error)
      e.target.value = ''
      return
    }

    setSelectedBobinaFile(file)

    const reader = new FileReader()
    reader.onloadend = () => {
      setBobinaPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handlePrintFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) {
      setSelectedPrintFile(null)
      setPrintPreview(formData.print_example_photo_url || null)
      return
    }

    const validation = validateImageFile(file)
    if (!validation.valid) {
      alert(validation.error)
      e.target.value = ''
      return
    }

    setSelectedPrintFile(file)

    const reader = new FileReader()
    reader.onloadend = () => {
      setPrintPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveBobinaImage = () => {
    setSelectedBobinaFile(null)
    setBobinaPreview(null)
    setFormData({ ...formData, bobina_photo_url: '' })
    const fileInput = document.getElementById('bobina-upload')
    if (fileInput) fileInput.value = ''
  }

  const handleRemovePrintImage = () => {
    setSelectedPrintFile(null)
    setPrintPreview(null)
    setFormData({ ...formData, print_example_photo_url: '' })
    const fileInput = document.getElementById('print-upload')
    if (fileInput) fileInput.value = ''
  }

  const resetForm = () => {
    setFormData({
      brand: '',
      purchased_from: '',
      color: '',
      color_hex: '',
      material_type: 'PLA',
      code: '',
      cost_per_kg: '',
      status: 'disponibile',
      bobina_photo_url: '',
      print_example_photo_url: '',
    })
    setEditingMaterial(null)
    setSelectedBobinaFile(null)
    setSelectedPrintFile(null)
    setBobinaPreview(null)
    setPrintPreview(null)
    const bobinaInput = document.getElementById('bobina-upload')
    const printInput = document.getElementById('print-upload')
    if (bobinaInput) bobinaInput.value = ''
    if (printInput) printInput.value = ''
  }

  if (loading) return <div className="loading">Caricamento...</div>

  return (
    <div className="materials-page">
      <div className="page-header">
        <h1>Gestione Materiali</h1>
        <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true) }}>
          <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
          Nuovo Materiale
        </button>
      </div>

      {/* Sezione Filtri */}
      <div className="filters-section" style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        marginBottom: '20px'
      }}>
        <h3 style={{ marginBottom: '15px', color: '#1a1a1a', fontSize: '18px' }}>Filtri</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px'
        }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '14px', marginBottom: '5px', display: 'block' }}>Brand</label>
            <input
              type="text"
              placeholder="Cerca brand..."
              value={filters.brand}
              onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '2px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '14px', marginBottom: '5px', display: 'block' }}>Nome Colore</label>
            <input
              type="text"
              placeholder="Cerca colore..."
              value={filters.color}
              onChange={(e) => setFilters({ ...filters, color: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '2px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '14px', marginBottom: '5px', display: 'block' }}>Materiale</label>
            <select
              value={filters.material_type}
              onChange={(e) => setFilters({ ...filters, material_type: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '2px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '14px',
                background: 'white'
              }}
            >
              <option value="">Tutti</option>
              <option value="PLA">PLA</option>
              <option value="PETG">PETG</option>
              <option value="ABS">ABS</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '14px', marginBottom: '5px', display: 'block' }}>Disponibilità</label>
            <select
              value={filters.availability}
              onChange={(e) => setFilters({ ...filters, availability: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '2px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '14px',
                background: 'white'
              }}
            >
              <option value="">Tutti</option>
              <option value="si">Sì</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '14px', marginBottom: '5px', display: 'block' }}>Ordina per</label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '2px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '14px',
                background: 'white'
              }}
            >
              <option value="brand">Brand</option>
              <option value="prezzo_crescente">Prezzo Crescente</option>
              <option value="prezzo_decrescente">Prezzo Decrescente</option>
              <option value="disponibilità">Disponibilità (Prima disponibili)</option>
              <option value="data_decrescente">Data Caricamento (Più recenti)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="materials-table-container">
        <table className="materials-table">
          <thead>
            <tr>
              <th>Brand</th>
              <th>Materiale</th>
              <th>Colore</th>
              <th>Acquistato da</th>
              <th>Costo al Kg (€)</th>
              <th>Stato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filteredMaterials.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-state">
                  {materials.length === 0 
                    ? 'Nessun materiale trovato. Crea il primo materiale!'
                    : 'Nessun materiale corrisponde ai filtri selezionati.'}
                </td>
              </tr>
            ) : (
              filteredMaterials.map((material) => (
                <tr key={material.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {material.bobina_photo_url && (
                        <img
                          src={material.bobina_photo_url}
                          alt={material.brand}
                          style={{
                            width: '40px',
                            height: '40px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            border: '1px solid #e0e0e0'
                          }}
                        />
                      )}
                      <div>
                        <div><strong>{material.brand}</strong></div>
                        {material.code && (
                          <small style={{ color: '#7f8c8d', fontSize: '12px' }}>Codice: {material.code}</small>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      background: '#e8f4f8', 
                      color: '#1a1a1a',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {material.material_type}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {material.color_hex && (
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: material.color_hex,
                            border: '1px solid #ddd',
                            flexShrink: 0
                          }}
                          title={material.color_hex}
                        />
                      )}
                      <span>{material.color}</span>
                    </div>
                  </td>
                  <td>{material.purchased_from}</td>
                  <td>€{parseFloat(material.cost_per_kg).toFixed(2)}</td>
                  <td>
                    <div className={`status-badge-with-switch ${material.status === 'disponibile' ? 'status-available' : 'status-sold'}`}>
                      <label className="status-switch">
                        <input
                          type="checkbox"
                          checked={material.status === 'disponibile'}
                          onChange={() => handleToggleStatus(material.id, material.status)}
                          title={material.status === 'disponibile' ? 'Imposta come esaurito' : 'Imposta come disponibile'}
                        />
                        <span className="slider"></span>
                      </label>
                      <span className="status-text">
                        {material.status === 'disponibile' ? 'Disponibile' : 'Esaurito'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-edit"
                        onClick={() => handleEdit(material)}
                        title="Modifica"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(material.id)}
                        title="Elimina"
                      >
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
            <h2>{editingMaterial ? 'Modifica Materiale' : 'Nuovo Materiale'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Brand</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    required
                    placeholder="Es: Polymaker, eSUN, Hatchbox..."
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Materiale</label>
                  <select
                    value={formData.material_type}
                    onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
                    required
                  >
                    <option value="PLA">PLA</option>
                    <option value="PETG">PETG</option>
                    <option value="ABS">ABS</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Colore</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    required
                    placeholder="Es: Nero, Bianco, Rosso..."
                    style={{ flex: 1 }}
                  />
                  <div
                    onClick={() => setShowColorPicker(true)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: formData.color_hex || '#CCCCCC',
                      border: '2px solid #ddd',
                      flexShrink: 0,
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    title={formData.color_hex ? `Clicca per cambiare colore (${formData.color_hex})` : 'Clicca per selezionare un colore'}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Acquistato da</label>
                  <input
                    type="text"
                    value={formData.purchased_from}
                    onChange={(e) => setFormData({ ...formData, purchased_from: e.target.value })}
                    required
                    placeholder="Es: Amazon, AliExpress, Negozio locale..."
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Costo al Kg (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost_per_kg}
                    onChange={(e) => setFormData({ ...formData, cost_per_kg: e.target.value })}
                    required
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Codice Materiale (4 cifre)</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => {
                    // Permetti solo numeri e massimo 4 caratteri
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setFormData({ ...formData, code: value })
                  }}
                  required
                  placeholder="0001"
                  maxLength={4}
                  pattern="[0-9]{4}"
                />
                <small>Codice univoco di 4 cifre (es: 0001, 1234)</small>
              </div>
              <div className="form-group">
                <label>Stato</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  required
                >
                  <option value="disponibile">Disponibile</option>
                  <option value="esaurito">Esaurito</option>
                </select>
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <label>Foto Bobina <span style={{ color: 'red' }}>*</span></label>
                    <input
                      id="bobina-upload"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      onChange={handleBobinaFileChange}
                      style={{ display: 'none' }}
                    />
                    <div
                      onClick={() => document.getElementById('bobina-upload')?.click()}
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        border: '2px dashed #ddd',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        background: bobinaPreview ? 'transparent' : '#f8f9fa',
                        transition: 'all 0.2s',
                        marginTop: '8px'
                      }}
                      onMouseEnter={(e) => {
                        if (!bobinaPreview) {
                          e.currentTarget.style.borderColor = '#2d2d2d'
                          e.currentTarget.style.background = '#e8f4f8'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!bobinaPreview) {
                          e.currentTarget.style.borderColor = '#ddd'
                          e.currentTarget.style.background = '#f8f9fa'
                        }
                      }}
                    >
                      {bobinaPreview ? (
                        <>
                          <img
                            src={bobinaPreview}
                            alt="Anteprima bobina"
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
                              handleRemoveBobinaImage()
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
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Esempio Stampa (facoltativo)</label>
                    <input
                      id="print-upload"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      onChange={handlePrintFileChange}
                      style={{ display: 'none' }}
                    />
                    <div
                      onClick={() => document.getElementById('print-upload')?.click()}
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        border: '2px dashed #ddd',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        background: printPreview ? 'transparent' : '#f8f9fa',
                        transition: 'all 0.2s',
                        marginTop: '8px'
                      }}
                      onMouseEnter={(e) => {
                        if (!printPreview) {
                          e.currentTarget.style.borderColor = '#2d2d2d'
                          e.currentTarget.style.background = '#e8f4f8'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!printPreview) {
                          e.currentTarget.style.borderColor = '#ddd'
                          e.currentTarget.style.background = '#f8f9fa'
                        }
                      }}
                    >
                      {printPreview ? (
                        <>
                          <img
                            src={printPreview}
                            alt="Anteprima esempio stampa"
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
                              handleRemovePrintImage()
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
                  </div>
                </div>
                <small style={{ display: 'block', color: '#666', marginTop: '12px' }}>
                  Formati supportati: JPG, PNG, WEBP, GIF. Dimensione massima: 5MB
                </small>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); resetForm() }} disabled={uploading}>
                  Annulla
                </button>
                <button type="submit" className="btn-primary" disabled={uploading}>
                  {uploading ? 'Caricamento...' : (editingMaterial ? 'Salva' : 'Crea')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Selezione Colore */}
      {showColorPicker && (
        <div className="modal-overlay" onClick={() => setShowColorPicker(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2>Seleziona Colore</h2>
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', width: '100%' }}>
                <input
                  type="color"
                  value={formData.color_hex || '#000000'}
                  onChange={(e) => {
                    const hex = e.target.value.toUpperCase()
                    setFormData({ 
                      ...formData, 
                      color_hex: hex
                    })
                  }}
                  style={{
                    width: '200px',
                    height: '200px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  padding: '10px',
                  background: '#f8f9fa',
                  borderRadius: '6px',
                  width: '100%',
                  justifyContent: 'center'
                }}>
                  <div
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      backgroundColor: formData.color_hex || '#CCCCCC',
                      border: '3px solid #ddd',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <input
                      type="text"
                      value={formData.color_hex || ''}
                      onChange={(e) => {
                        let value = e.target.value.toUpperCase().replace(/[^0-9A-F#]/g, '')
                        if (value && !value.startsWith('#')) {
                          value = '#' + value.replace('#', '')
                        }
                        if (value.length > 7) value = value.slice(0, 7)
                        if (/^#[0-9A-F]{6}$/i.test(value) || value === '' || value === '#') {
                          setFormData({ ...formData, color_hex: value })
                        }
                      }}
                      placeholder="#000000"
                      maxLength={7}
                      pattern="#[0-9A-Fa-f]{6}"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '16px',
                        fontFamily: 'monospace',
                        textAlign: 'center',
                        width: '120px'
                      }}
                    />
                    <small style={{ color: '#7f8c8d', fontSize: '12px', textAlign: 'center' }}>
                      Codice HEX
                    </small>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setShowColorPicker(false)}
              >
                Chiudi
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={() => setShowColorPicker(false)}
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
