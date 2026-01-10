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
  const [spools, setSpools] = useState([]) // Bobine per ogni materiale
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showSpoolModal, setShowSpoolModal] = useState(false)
  const [showSpoolsModal, setShowSpoolsModal] = useState(false) // Modale per visualizzare le bobine di un materiale
  const [selectedMaterialForSpools, setSelectedMaterialForSpools] = useState(null) // Materiale selezionato per vedere le bobine
  const [editingSpool, setEditingSpool] = useState(null)
  const [selectedMaterialForSpool, setSelectedMaterialForSpool] = useState(null)
  const [filters, setFilters] = useState({
    brand: '',
    color: '',
    material_type: '',
    availability: 'tutti', // 'tutti', 'disponibile', 'esaurito'
    sortBy: 'data_decrescente'
  })
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState(null)
  const [selectedBobinaFile, setSelectedBobinaFile] = useState(null)
  const [selectedPrintFile, setSelectedPrintFile] = useState(null)
  const [bobinaPreview, setBobinaPreview] = useState(null)
  const [printPreview, setPrintPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [spoolFormData, setSpoolFormData] = useState({
    purchase_account: 'Fabio',
    purchased_from: '',
    remaining_grams: 1000,
    price: '',
    quantity: 1
  })
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

  // Helper per determinare se un materiale è disponibile o esaurito
  const isMaterialAvailable = (materialId) => {
    const materialSpools = getSpoolsForMaterial(materialId)
    if (materialSpools.length === 0) return false
    const totalGrams = materialSpools.reduce((sum, spool) => sum + parseFloat(spool.remaining_grams || 0), 0)
    return totalGrams > 0
  }

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
    if (filterValues.availability === 'disponibile') {
      filtered = filtered.filter(m => isMaterialAvailable(m.id))
    } else if (filterValues.availability === 'esaurito') {
      filtered = filtered.filter(m => !isMaterialAvailable(m.id))
    }

    // Ordinamento
    filtered.sort((a, b) => {
      if (filterValues.sortBy === 'prezzo_crescente') {
        return parseFloat(a.cost_per_kg || 0) - parseFloat(b.cost_per_kg || 0)
      } else if (filterValues.sortBy === 'prezzo_decrescente') {
        return parseFloat(b.cost_per_kg || 0) - parseFloat(a.cost_per_kg || 0)
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

  const loadSpools = async () => {
    const { data, error } = await supabase
      .from('spools')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading spools:', error)
    } else {
      setSpools(data || [])
    }
  }

  const getSpoolsForMaterial = (materialId) => {
    return spools.filter(spool => spool.material_id === materialId)
  }

  const getAveragePriceForMaterial = (materialId) => {
    const materialSpools = getSpoolsForMaterial(materialId)
    if (materialSpools.length === 0) {
      return null
    }
    const totalPrice = materialSpools.reduce((sum, spool) => sum + parseFloat(spool.price || 0), 0)
    return totalPrice / materialSpools.length
  }

  useEffect(() => {
    loadMaterials()
    loadSpools()
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
      // cost_per_kg è ora opzionale (il costo viene dalle bobine)
      const cost = formData.cost_per_kg && formData.cost_per_kg.trim() !== '' 
        ? parseFloat(formData.cost_per_kg) 
        : null
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
        color: formData.color,
        color_hex: colorHex || null,
        material_type: formData.material_type,
        code: code,
        cost_per_kg: cost,
        purchased_from: formData.purchased_from && formData.purchased_from.trim() !== '' 
          ? formData.purchased_from.trim() 
          : null,
        status: 'disponibile', // Manteniamo sempre disponibile per retrocompatibilità
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
      color: material.color || '',
      color_hex: material.color_hex || '',
      material_type: material.material_type || 'PLA',
      code: material.code || '',
      cost_per_kg: material.cost_per_kg,
      bobina_photo_url: material.bobina_photo_url || '',
      print_example_photo_url: material.print_example_photo_url || '',
    })
    setSelectedBobinaFile(null)
    setSelectedPrintFile(null)
    setBobinaPreview(material.bobina_photo_url || null)
    setPrintPreview(material.print_example_photo_url || null)
    setShowModal(true)
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

  const handleMaterialClick = (material) => {
    setSelectedMaterialForSpools(material)
    setShowSpoolsModal(true)
  }

  const handleCreateSpool = async (e) => {
    e.preventDefault()
    
    if (!selectedMaterialForSpool) {
      alert('Seleziona un materiale dalla tabella cliccando "Aggiungi bobina" sulla riga del materiale desiderato')
      return
    }

    const price = parseFloat(spoolFormData.price)
    if (!price || price <= 0) {
      alert('Inserisci un prezzo valido per la bobina')
      return
    }

    const quantity = parseInt(spoolFormData.quantity) || 1
    if (quantity < 1) {
      alert('La quantità deve essere almeno 1')
      return
    }

    if (editingSpool) {
      // Modifica bobina esistente (solo una alla volta)
      const spoolData = {
        purchase_account: spoolFormData.purchase_account,
        purchased_from: spoolFormData.purchased_from,
        remaining_grams: parseFloat(spoolFormData.remaining_grams) || 1000,
        price: price
      }

      const { error } = await supabase
        .from('spools')
        .update(spoolData)
        .eq('id', editingSpool.id)

      if (error) {
        alert('Errore durante l\'aggiornamento: ' + error.message)
      } else {
        await loadSpools()
        setShowSpoolModal(false)
        resetSpoolForm()
        // Se il modale delle bobine era aperto, riaprirlo per mostrare le modifiche
        if (selectedMaterialForSpool) {
          setSelectedMaterialForSpools(selectedMaterialForSpool)
          setShowSpoolsModal(true)
        }
      }
    } else {
      // Crea nuove bobine (può essere più di una)
      const spoolsToInsert = []
      for (let i = 0; i < quantity; i++) {
        spoolsToInsert.push({
          material_id: selectedMaterialForSpool.id,
          purchase_account: spoolFormData.purchase_account,
          purchased_from: spoolFormData.purchased_from,
          remaining_grams: parseFloat(spoolFormData.remaining_grams) || 1000,
          price: price
        })
      }

      const { error } = await supabase.from('spools').insert(spoolsToInsert)

      if (error) {
        alert('Errore durante l\'inserimento: ' + error.message)
      } else {
        await loadSpools()
        setShowSpoolModal(false)
        resetSpoolForm()
        // Se il modale delle bobine era aperto, riaprirlo per mostrare le nuove bobine
        if (selectedMaterialForSpool) {
          setSelectedMaterialForSpools(selectedMaterialForSpool)
          setShowSpoolsModal(true)
        }
      }
    }
  }

  const handleEditSpool = (spool) => {
    setEditingSpool(spool)
    const material = materials.find(m => m.id === spool.material_id)
    setSelectedMaterialForSpool(material)
    setSpoolFormData({
      purchase_account: spool.purchase_account,
      purchased_from: spool.purchased_from || '',
      remaining_grams: spool.remaining_grams,
      price: spool.price || '',
      quantity: 1
    })
    setShowSpoolModal(true)
  }

  const handleDeleteSpool = async (spoolId) => {
    if (!confirm('Sei sicuro di voler eliminare questa bobina?')) return

    // Controlla se ci sono prodotti associati a questa bobina
    const { data: products, error } = await supabase
      .from('products')
      .select('id')
      .eq('spool_id', spoolId)
      .limit(1)

    if (error) {
      alert('Errore durante il controllo dei prodotti associati: ' + error.message)
      return
    }

    if (products && products.length > 0) {
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('spool_id', spoolId)
      alert(`Impossibile eliminare la bobina: ci sono ${count} prodotto/i associato/i.`)
      return
    }

    const { error: deleteError } = await supabase.from('spools').delete().eq('id', spoolId)

    if (deleteError) {
      alert('Errore durante l\'eliminazione: ' + deleteError.message)
    } else {
      await loadSpools()
      // Se il modale delle bobine è aperto, aggiorna il materiale selezionato per aggiornare la visualizzazione
      if (showSpoolsModal && selectedMaterialForSpools) {
        // Il modale si aggiornerà automaticamente quando loadSpools aggiorna lo stato spools
      }
    }
  }

  const resetSpoolForm = () => {
    setSpoolFormData({
      purchase_account: 'Fabio',
      purchased_from: '',
      remaining_grams: 1000,
      price: '',
      quantity: 1
    })
    setEditingSpool(null)
    setSelectedMaterialForSpool(null)
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

  // Calcola il prossimo codice materiale disponibile
  const calculateNextCode = () => {
    if (materials.length === 0) {
      return '0001'
    }
    
    // Estrae tutti i codici numerici e trova il massimo
    const codes = materials
      .map(m => m.code)
      .filter(code => code && /^\d{4}$/.test(code))
      .map(code => parseInt(code, 10))
    
    if (codes.length === 0) {
      return '0001'
    }
    
    const maxCode = Math.max(...codes)
    const nextCode = maxCode + 1
    
    // Formatta come 4 cifre con zeri iniziali
    return nextCode.toString().padStart(4, '0')
  }

  const resetForm = () => {
    const nextCode = calculateNextCode()
    setFormData({
      brand: '',
      color: '',
      color_hex: '',
      material_type: 'PLA',
      code: nextCode,
      cost_per_kg: '',
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
              <option value="TPU">TPU</option>
              <option value="PC">PC</option>
              <option value="ASA">ASA</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '14px', marginBottom: '5px', display: 'block' }}>Disponibilità</label>
            <div style={{
              display: 'flex',
              gap: '4px',
              background: '#f0f0f0',
              borderRadius: '6px',
              padding: '4px',
              border: '2px solid #e0e0e0'
            }}>
              <button
                type="button"
                onClick={() => setFilters({ ...filters, availability: 'tutti' })}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: filters.availability === 'tutti' ? '#1a1a1a' : 'transparent',
                  color: filters.availability === 'tutti' ? 'white' : '#1a1a1a',
                  transition: 'all 0.2s ease'
                }}
              >
                Tutti
              </button>
              <button
                type="button"
                onClick={() => setFilters({ ...filters, availability: 'disponibile' })}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: filters.availability === 'disponibile' ? '#27ae60' : 'transparent',
                  color: filters.availability === 'disponibile' ? 'white' : '#1a1a1a',
                  transition: 'all 0.2s ease'
                }}
              >
                Disponibile
              </button>
              <button
                type="button"
                onClick={() => setFilters({ ...filters, availability: 'esaurito' })}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: filters.availability === 'esaurito' ? '#e74c3c' : 'transparent',
                  color: filters.availability === 'esaurito' ? 'white' : '#1a1a1a',
                  transition: 'all 0.2s ease'
                }}
              >
                Esaurito
              </button>
            </div>
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
              <th style={{ textAlign: 'center' }}>Materiale</th>
              <th style={{ textAlign: 'center' }}>Colore</th>
              <th style={{ textAlign: 'center' }}>Grammi Disponibili</th>
              <th style={{ textAlign: 'center' }}>Costo Medio (€/Kg)</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filteredMaterials.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state">
                  {materials.length === 0 
                    ? 'Nessun materiale trovato. Crea il primo materiale!'
                    : 'Nessun materiale corrisponde ai filtri selezionati.'}
                </td>
              </tr>
            ) : (
              filteredMaterials.map((material) => {
                const materialSpools = getSpoolsForMaterial(material.id)
                
                // Separa bobine complete (>= 1000g) da bobine parziali (< 1000g)
                const fullSpools = materialSpools.filter(spool => parseFloat(spool.remaining_grams || 0) >= 1000)
                const partialSpools = materialSpools.filter(spool => parseFloat(spool.remaining_grams || 0) < 1000)
                
                // Conta le bobine complete
                const fullSpoolsCount = fullSpools.length
                
                // La barra mostra i grammi della prima bobina parziale (se esiste), altrimenti 1000g
                let progressBarValue
                let additionalKgs = 0
                
                if (partialSpools.length > 0) {
                  // Prendi la prima bobina parziale per la barra
                  progressBarValue = parseFloat(partialSpools[0].remaining_grams || 0)
                  // Tutte le bobine complete vanno nel contatore "+Xkg"
                  additionalKgs = fullSpoolsCount
                } else if (fullSpools.length > 0) {
                  // Se non ci sono bobine parziali, mostra 1000g (barra piena per una bobina completa)
                  progressBarValue = 1000
                  // Le bobine complete oltre la prima (quella mostrata nella barra) vanno nel contatore "+Xkg"
                  // Se ho 1 bobina completa: additionalKgs = 0 (non mostro "+Xkg")
                  // Se ho 2+ bobine complete: additionalKgs = fullSpoolsCount - 1
                  additionalKgs = fullSpoolsCount > 1 ? fullSpoolsCount - 1 : 0
                } else {
                  // Nessuna bobina disponibile
                  progressBarValue = 0
                  additionalKgs = 0
                }
                
                return (
                  <tr 
                    key={material.id}
                    onClick={() => handleMaterialClick(material)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
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
                      <td style={{ textAlign: 'center' }}>
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
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
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
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', minWidth: '200px' }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <div
                          style={{
                            width: '100%',
                            height: '20px',
                            backgroundColor: '#e0e0e0',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            position: 'relative'
                          }}
                        >
                          <div
                            style={{
                              width: `${(progressBarValue / 1000) * 100}%`,
                              height: '100%',
                              backgroundColor: progressBarValue >= 1000 ? '#27ae60' : progressBarValue >= 500 ? '#f39c12' : '#e74c3c',
                              transition: 'width 0.3s ease',
                              borderRadius: '10px'
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '2px', textAlign: 'center' }}>
                          {progressBarValue >= 1000 ? '1000g' : `${progressBarValue.toFixed(0)}g`}
                        </div>
                      </div>
                      {additionalKgs > 0 && (
                        <div
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#27ae60',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          +{additionalKgs}kg
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {(() => {
                      const avgPrice = getAveragePriceForMaterial(material.id)
                      if (avgPrice !== null) {
                        return (
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#2d2d2d' }}>
                            €{avgPrice.toFixed(2)}
                          </div>
                        )
                      }
                      return (
                        <div style={{ fontSize: '14px', color: '#999', fontStyle: 'italic' }}>
                          N/A
                        </div>
                      )
                    })()}
                  </td>
                  <td>
                        <div 
                          className="action-buttons" 
                          onClick={(e) => e.stopPropagation()}
                          style={{ 
                            display: 'flex', 
                            gap: '8px', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            width: '100%'
                          }}
                        >
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
                          <button
                            className="btn-edit"
                            onClick={() => {
                              // Resetta solo i campi del form, non il materiale
                              setSpoolFormData({
                                purchase_account: 'Fabio',
                                purchased_from: '',
                                remaining_grams: 1000,
                                price: '',
                                quantity: 1
                              })
                              setEditingSpool(null)
                              setSelectedMaterialForSpool(material)
                              setShowSpoolModal(true)
                            }}
                            title="Aggiungi bobina"
                            style={{ 
                              background: '#3498db'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#2980b9'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#3498db'}
                          >
                            <FontAwesomeIcon icon={faPlus} />
                          </button>
                        </div>
                      </td>
                    </tr>
                )
              })
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
                    <option value="TPU">TPU</option>
                    <option value="PC">PC</option>
                    <option value="ASA">ASA</option>
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

      {/* Modale Bobine Materiale */}
      {showSpoolsModal && selectedMaterialForSpools && (
        <div className="modal-overlay" onClick={() => { setShowSpoolsModal(false); setSelectedMaterialForSpools(null) }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>
                Bobine - {selectedMaterialForSpools.brand} - {selectedMaterialForSpools.material_type} - {selectedMaterialForSpools.color}
              </h2>
              <button
                onClick={() => { setShowSpoolsModal(false); setSelectedMaterialForSpools(null) }}
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
            
            {(() => {
              const materialSpools = getSpoolsForMaterial(selectedMaterialForSpools.id)
              const totalRemaining = materialSpools.reduce((sum, spool) => sum + parseFloat(spool.remaining_grams || 0), 0)
              
              return (
                <>
                  <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Totale Bobine</div>
                        <div style={{ fontSize: '24px', fontWeight: '600', color: '#2d2d2d' }}>{materialSpools.length}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Grammi Totali Disponibili</div>
                        <div style={{ fontSize: '24px', fontWeight: '600', color: '#2d2d2d' }}>{totalRemaining.toFixed(2)}g</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        setShowSpoolsModal(false)
                        setSpoolFormData({
                          purchase_account: 'Fabio',
                          purchased_from: '',
                          remaining_grams: 1000,
                          price: '',
                          quantity: 1
                        })
                        setEditingSpool(null)
                        setSelectedMaterialForSpool(selectedMaterialForSpools)
                        setShowSpoolModal(true)
                      }}
                    >
                      <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
                      Aggiungi Bobina
                    </button>
                  </div>

                  {materialSpools.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                      <div style={{ fontSize: '48px', marginBottom: '10px' }}>📦</div>
                      <div>Nessuna bobina disponibile per questo materiale</div>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                        <thead>
                          <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e0e0e0' }}>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#2d2d2d' }}>Account</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#2d2d2d' }}>Acquistato da</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#2d2d2d' }}>Residuo</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#2d2d2d' }}>Prezzo</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#2d2d2d' }}>Data Creazione</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#2d2d2d' }}>Azioni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {materialSpools.map((spool) => (
                            <tr key={spool.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                              <td style={{ padding: '12px', fontSize: '14px', color: '#2d2d2d', fontWeight: '600' }}>
                                {spool.purchase_account}
                              </td>
                              <td style={{ padding: '12px', fontSize: '14px', color: '#666' }}>
                                {spool.purchased_from || 'N/A'}
                              </td>
                              <td style={{ padding: '12px', fontSize: '14px', color: '#666' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '150px' }}>
                                  <div style={{ flex: 1, position: 'relative' }}>
                                    <div
                                      style={{
                                        width: '100%',
                                        height: '20px',
                                        backgroundColor: '#e0e0e0',
                                        borderRadius: '10px',
                                        overflow: 'hidden',
                                        position: 'relative'
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: `${(parseFloat(spool.remaining_grams || 0) / 1000) * 100}%`,
                                          height: '100%',
                                          backgroundColor: parseFloat(spool.remaining_grams || 0) >= 1000 ? '#27ae60' : parseFloat(spool.remaining_grams || 0) >= 500 ? '#f39c12' : '#e74c3c',
                                          transition: 'width 0.3s ease',
                                          borderRadius: '10px'
                                        }}
                                      />
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#666', marginTop: '2px', textAlign: 'center' }}>
                                      {parseFloat(spool.remaining_grams || 0).toFixed(0)}g / 1000g
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '12px', fontSize: '14px', color: '#2d2d2d', fontWeight: '600' }}>
                                €{parseFloat(spool.price || 0).toFixed(2)}/Kg
                              </td>
                              <td style={{ padding: '12px', fontSize: '13px', color: '#999' }}>
                                {new Date(spool.created_at).toLocaleDateString('it-IT')}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setShowSpoolsModal(false)
                                      handleEditSpool(spool)
                                    }}
                                    style={{
                                      background: '#3498db',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      padding: '6px 12px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: '600'
                                    }}
                                    title="Modifica"
                                  >
                                    <FontAwesomeIcon icon={faEdit} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (confirm('Sei sicuro di voler eliminare questa bobina?')) {
                                        handleDeleteSpool(spool.id)
                                      }
                                    }}
                                    style={{
                                      background: '#e74c3c',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      padding: '6px 12px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: '600'
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
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Modale Bobina */}
      {showSpoolModal && (
        <div className="modal-overlay" onClick={() => { setShowSpoolModal(false); resetSpoolForm() }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2>{editingSpool ? 'Modifica Bobina' : 'Nuova Bobina'}</h2>
            {selectedMaterialForSpool && (
              <div style={{ marginBottom: '20px', padding: '10px', background: '#f8f9fa', borderRadius: '6px' }}>
                <strong>Materiale:</strong> {selectedMaterialForSpool.brand} - {selectedMaterialForSpool.material_type} - {selectedMaterialForSpool.color} ({selectedMaterialForSpool.code})
              </div>
            )}
            <form onSubmit={handleCreateSpool}>
              <div className="form-group">
                <label>Account di Acquisto</label>
                <select
                  value={spoolFormData.purchase_account}
                  onChange={(e) => setSpoolFormData({ ...spoolFormData, purchase_account: e.target.value })}
                  required
                >
                  <option value="Fabio">Fabio</option>
                  <option value="Mesmerized SRLS">Mesmerized SRLS</option>
                </select>
              </div>
              <div className="form-group">
                <label>Acquistato da</label>
                <input
                  type="text"
                  value={spoolFormData.purchased_from}
                  onChange={(e) => setSpoolFormData({ ...spoolFormData, purchased_from: e.target.value })}
                  required
                  placeholder="Es: Amazon, AliExpress, Negozio locale..."
                />
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Prezzo per Bobina (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={spoolFormData.price}
                    onChange={(e) => setSpoolFormData({ ...spoolFormData, price: e.target.value })}
                    required
                    placeholder="0.00"
                    disabled={!!editingSpool}
                  />
                  <small>Prezzo di acquisto per 1Kg</small>
                </div>
                {!editingSpool && (
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Quantità</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={spoolFormData.quantity}
                      onChange={(e) => setSpoolFormData({ ...spoolFormData, quantity: parseInt(e.target.value) || 1 })}
                      required
                      placeholder="1"
                    />
                    <small>Numero di bobine da creare</small>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Grammi Residui</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1000"
                  value={spoolFormData.remaining_grams}
                  onChange={(e) => setSpoolFormData({ ...spoolFormData, remaining_grams: e.target.value })}
                  required
                  placeholder="1000"
                />
                <small>Inserisci i grammi residui (massimo 1000g = 1Kg)</small>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowSpoolModal(false); resetSpoolForm() }}>
                  Annulla
                </button>
                <button type="submit" className="btn-primary">
                  {editingSpool ? 'Salva' : 'Crea'}
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
