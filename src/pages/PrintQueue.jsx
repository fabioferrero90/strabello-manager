import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/logging'
import { openInBambuStudio } from '../lib/bambuStudio'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faTrash, faEdit, faPlus, faTimes, faMinus, faPrint, faGripVertical, faCube } from '@fortawesome/free-solid-svg-icons'
import './Products.css'

export default function PrintQueue() {
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [materials, setMaterials] = useState([])
  const [accessories, setAccessories] = useState([])
  const [accessoryPieces, setAccessoryPieces] = useState([])
  const [models, setModels] = useState([])
  const [spools, setSpools] = useState([])
  const [availableSpools, setAvailableSpools] = useState([]) // Bobine disponibili per il materiale selezionato
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('priorita')
  const [showModal, setShowModal] = useState(false) // Modal per creazione prodotto
  const [showEditModal, setShowEditModal] = useState(false)
  const [showEditInfoModal, setShowEditInfoModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [detailProduct, setDetailProduct] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [restoreProduct, setRestoreProduct] = useState(null)
  const [restoreSelections, setRestoreSelections] = useState({})
  const [editFormData, setEditFormData] = useState({
    material_id: '',
    spool_id: '',
  })
  const [editInfoForm, setEditInfoForm] = useState({
    sale_price: '',
    storage_location: ''
  })
  const [editAvailableSpools, setEditAvailableSpools] = useState([])
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false)
  const [materialSearch, setMaterialSearch] = useState('')
  const [hoveredMaterial, setHoveredMaterial] = useState(null)
  const [hoveredMaterialCard, setHoveredMaterialCard] = useState(null)
  const [hoveredModelCard, setHoveredModelCard] = useState(null)
  const [hoveredModel, setHoveredModel] = useState(null)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [dragItemId, setDragItemId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [formData, setFormData] = useState({
    model_id: '',
    material_id: '',
    spool_id: '',
    sale_price: '',
  })
  const [accessoryUsages, setAccessoryUsages] = useState([])
  const [multimaterialMapping, setMultimaterialMapping] = useState({
    color1: '',
    color2: '',
    color3: '',
    color4: '',
  })
  const [multimaterialSpools, setMultimaterialSpools] = useState({
    color1: '',
    color2: '',
    color3: '',
    color4: '',
  })
  const [multimaterialAvailableSpools, setMultimaterialAvailableSpools] = useState({
    color1: [],
    color2: [],
    color3: [],
    color4: [],
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (products.length > 0) {
      applySearchFilter(products, searchQuery, sortBy)
    }
  }, [searchQuery, sortBy, products])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showModelDropdown || showMaterialDropdown) {
        const target = event.target
        if (!target.closest('.form-group')) {
          setShowModelDropdown(false)
          setShowMaterialDropdown(false)
        }
      }
    }

    if (showModelDropdown || showMaterialDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showModelDropdown, showMaterialDropdown])

  // Carica le bobine disponibili quando cambia il materiale selezionato o il modello
  useEffect(() => {
    if (formData.material_id && formData.model_id) {
      const selectedModel = models.find(m => m.id === formData.model_id)
      if (selectedModel && !selectedModel.is_multimaterial) {
        // Calcola il peso necessario in grammi
        const requiredGrams = parseFloat(selectedModel.weight_kg) * 1000
        
        // Filtra le bobine che hanno grammi sufficienti
        const materialSpools = spools.filter(
          spool => spool.material_id === formData.material_id && 
                   parseFloat(spool.remaining_grams) >= requiredGrams
        )
        setAvailableSpools(materialSpools)
        
        // Seleziona di default una bobina già consumata se presente, altrimenti la prima disponibile
        if (materialSpools.length > 0 && !formData.spool_id) {
          // Cerca prima una bobina già consumata (remaining_grams < 1000)
          const consumedSpool = materialSpools.find(s => parseFloat(s.remaining_grams) < 1000)
          const defaultSpoolId = consumedSpool ? consumedSpool.id : materialSpools[0].id
          setFormData({ ...formData, spool_id: defaultSpoolId })
        }
        
        // Reset spool_id se non è più disponibile
        if (formData.spool_id && !materialSpools.find(s => s.id === formData.spool_id)) {
          // Seleziona di default una bobina già consumata se presente, altrimenti la prima disponibile
          if (materialSpools.length > 0) {
            const consumedSpool = materialSpools.find(s => parseFloat(s.remaining_grams) < 1000)
            const defaultSpoolId = consumedSpool ? consumedSpool.id : materialSpools[0].id
            setFormData({ ...formData, spool_id: defaultSpoolId })
          } else {
            setFormData({ ...formData, spool_id: '' })
          }
        }
      } else {
        // Per modelli multimateriale o senza modello, mostra tutte le bobine con grammi > 0
        const materialSpools = spools.filter(
          spool => spool.material_id === formData.material_id && parseFloat(spool.remaining_grams) > 0
        )
        setAvailableSpools(materialSpools)
      }
    } else {
      setAvailableSpools([])
      setFormData({ ...formData, spool_id: '' })
    }
  }, [formData.material_id, formData.model_id, spools, models])

  // Reset multimaterial mapping quando cambia il modello selezionato
  useEffect(() => {
    const selectedModel = models.find((m) => m.id === formData.model_id)
    if (!selectedModel || !selectedModel.is_multimaterial) {
      setMultimaterialMapping({
        color1: '',
        color2: '',
        color3: '',
        color4: '',
      })
      setMultimaterialSpools({
        color1: '',
        color2: '',
        color3: '',
        color4: '',
      })
      setMultimaterialAvailableSpools({
        color1: [],
        color2: [],
        color3: [],
        color4: [],
      })
    }
  }, [formData.model_id, models])

  // Carica le bobine disponibili per ogni materiale multimateriale selezionato
  useEffect(() => {
    const selectedModel = models.find((m) => m.id === formData.model_id)
    if (!selectedModel?.is_multimaterial) return

    const colorKeys = ['color1', 'color2', 'color3', 'color4']
    const newAvailableSpools = { ...multimaterialAvailableSpools }

    colorKeys.forEach((colorKey) => {
      const materialId = multimaterialMapping[colorKey]
      if (materialId) {
        const weightGrams = parseFloat(selectedModel[`${colorKey}_weight_g`] || 0)
        const materialSpools = spools.filter(
          spool => spool.material_id === materialId && 
                   parseFloat(spool.remaining_grams) >= weightGrams
        )
        newAvailableSpools[colorKey] = materialSpools

        // Seleziona di default una bobina già consumata se presente
        if (materialSpools.length > 0 && !multimaterialSpools[colorKey]) {
          const consumedSpool = materialSpools.find(s => parseFloat(s.remaining_grams) < 1000)
          const defaultSpoolId = consumedSpool ? consumedSpool.id : materialSpools[0].id
          setMultimaterialSpools(prev => ({ ...prev, [colorKey]: defaultSpoolId }))
        }
      } else {
        newAvailableSpools[colorKey] = []
      }
    })

    setMultimaterialAvailableSpools(newAvailableSpools)
  }, [multimaterialMapping, formData.model_id, models, spools])

  // Carica le bobine disponibili quando si modifica un prodotto
  useEffect(() => {
    if (editFormData.material_id && editingProduct) {
      const productModel = models.find(m => m.id === editingProduct.model_id)
      if (productModel && !productModel.is_multimaterial) {
        const requiredGrams = parseFloat(productModel.weight_kg) * 1000
        const materialSpools = spools.filter(
          spool => spool.material_id === editFormData.material_id && 
                   parseFloat(spool.remaining_grams) >= requiredGrams
        )
        setEditAvailableSpools(materialSpools)
        if (materialSpools.length > 0 && !editFormData.spool_id) {
          const consumedSpool = materialSpools.find(s => parseFloat(s.remaining_grams) < 1000)
          const defaultSpoolId = consumedSpool ? consumedSpool.id : materialSpools[0].id
          setEditFormData({ ...editFormData, spool_id: defaultSpoolId })
        }
      } else {
        const materialSpools = spools.filter(
          spool => spool.material_id === editFormData.material_id && parseFloat(spool.remaining_grams) > 0
        )
        setEditAvailableSpools(materialSpools)
      }
    } else {
      setEditAvailableSpools([])
    }
  }, [editFormData.material_id, editingProduct, spools, models])

  const loadData = async () => {
    const [materialsRes, accessoriesRes, accessoryPiecesRes, modelsRes, productsRes, spoolsRes] = await Promise.all([
      supabase.from('materials').select('*').order('brand'),
      supabase.from('accessories').select('*').order('name'),
      supabase.from('accessory_pieces').select('*').order('created_at'),
      supabase.from('models').select('*').order('name'),
      supabase
        .from('products')
        .select(`
          *,
          models(name, weight_kg, photo_url, description, dimensions, sku, model_3mf_url, is_multimaterial, color1_weight_g, color2_weight_g, color3_weight_g, color4_weight_g),
          materials(brand, material_type, color, color_hex, purchased_from, cost_per_kg, bobina_photo_url, print_example_photo_url, code, status)
        `)
        .order('created_at', { ascending: false }),
      supabase.from('spools').select('*').order('created_at', { ascending: false }),
    ])

    setMaterials(materialsRes.data || [])
    setAccessories(accessoriesRes.data || [])
    setAccessoryPieces(accessoryPiecesRes.data || [])
    setModels(modelsRes.data || [])
    setProducts(productsRes.data || [])
    setSpools(spoolsRes.data || [])
    applySearchFilter(productsRes.data || [], searchQuery, sortBy)
    setLoading(false)
  }

  const applySearchFilter = (productsList, query, sortValue) => {
    // Mostra solo prodotti con stato "in_coda" o "in_stampa"
    let filtered = productsList.filter(product => ['in_coda', 'in_stampa'].includes(product.status))

    // Filtro ricerca
    if (query.trim()) {
      const queryLower = query.toLowerCase()
      filtered = filtered.filter((product) => {
        if (product.sku?.toLowerCase().includes(queryLower)) return true
        if (product.models?.name?.toLowerCase().includes(queryLower)) return true
        if (product.materials?.brand?.toLowerCase().includes(queryLower)) return true
        if (product.materials?.material_type?.toLowerCase().includes(queryLower)) return true
        if (product.materials?.color?.toLowerCase().includes(queryLower)) return true
        return false
      })
    }

    // Ordinamento
    filtered.sort((a, b) => {
      if (sortValue === 'priorita') {
        // Prima i "Prodotto venduto" (priorità maggiore), poi per queue_order/data
        const soldA = a.is_sold_order ? 0 : 1
        const soldB = b.is_sold_order ? 0 : 1
        if (soldA !== soldB) return soldA - soldB
        const orderA = parseInt(a.queue_order ?? 0, 10)
        const orderB = parseInt(b.queue_order ?? 0, 10)
        if (orderA && orderB) return orderA - orderB
        const dateA = new Date(a.created_at || 0)
        const dateB = new Date(b.created_at || 0)
        return dateA - dateB
      } else if (sortValue === 'nome_crescente') {
        return (a.models?.name || '').localeCompare(b.models?.name || '')
      } else if (sortValue === 'nome_decrescente') {
        return (b.models?.name || '').localeCompare(a.models?.name || '')
      } else if (sortValue === 'materiale_crescente') {
        return (a.materials?.material_type || '').localeCompare(b.materials?.material_type || '')
      } else if (sortValue === 'materiale_decrescente') {
        return (b.materials?.material_type || '').localeCompare(a.materials?.material_type || '')
      } else if (sortValue === 'prezzo_crescente') {
        return parseFloat(a.sale_price || 0) - parseFloat(b.sale_price || 0)
      } else if (sortValue === 'prezzo_decrescente') {
        return parseFloat(b.sale_price || 0) - parseFloat(a.sale_price || 0)
      } else {
        const dateA = new Date(a.created_at || 0)
        const dateB = new Date(b.created_at || 0)
        return dateB - dateA
      }
    })

    setFilteredProducts(filtered)
  }

  const calculateProductionCost = (modelId, materialId, multimaterialMap = null, multimaterialSpoolsMap = null) => {
    const model = models.find((m) => m.id === modelId)
    if (!model) return '0.00'

    // Se il modello è multimateriale, calcola il costo usando i prezzi delle bobine
    if (model.is_multimaterial && multimaterialMap) {
      let totalCost = 0
      
      // Colore 1
      if (model.color1_weight_g && multimaterialMap.color1) {
        const weightKg1 = parseFloat(model.color1_weight_g) / 1000
        if (multimaterialSpoolsMap?.color1) {
          const spool1 = spools.find(s => s.id === multimaterialSpoolsMap.color1)
          if (spool1) {
            totalCost += weightKg1 * parseFloat(spool1.price || 0)
          }
        } else {
          // Fallback al costo del materiale se bobina non selezionata
          const material1 = materials.find((m) => m.id === multimaterialMap.color1)
          if (material1) {
            totalCost += weightKg1 * parseFloat(material1.cost_per_kg || 0)
          }
        }
      }
      
      // Colore 2
      if (model.color2_weight_g && multimaterialMap.color2) {
        const weightKg2 = parseFloat(model.color2_weight_g) / 1000
        if (multimaterialSpoolsMap?.color2) {
          const spool2 = spools.find(s => s.id === multimaterialSpoolsMap.color2)
          if (spool2) {
            totalCost += weightKg2 * parseFloat(spool2.price || 0)
          }
        } else {
          const material2 = materials.find((m) => m.id === multimaterialMap.color2)
          if (material2) {
            totalCost += weightKg2 * parseFloat(material2.cost_per_kg || 0)
          }
        }
      }
      
      // Colore 3
      if (model.color3_weight_g && multimaterialMap.color3) {
        const weightKg3 = parseFloat(model.color3_weight_g) / 1000
        if (multimaterialSpoolsMap?.color3) {
          const spool3 = spools.find(s => s.id === multimaterialSpoolsMap.color3)
          if (spool3) {
            totalCost += weightKg3 * parseFloat(spool3.price || 0)
          }
        } else {
          const material3 = materials.find((m) => m.id === multimaterialMap.color3)
          if (material3) {
            totalCost += weightKg3 * parseFloat(material3.cost_per_kg || 0)
          }
        }
      }
      
      // Colore 4
      if (model.color4_weight_g && multimaterialMap.color4) {
        const weightKg4 = parseFloat(model.color4_weight_g) / 1000
        if (multimaterialSpoolsMap?.color4) {
          const spool4 = spools.find(s => s.id === multimaterialSpoolsMap.color4)
          if (spool4) {
            totalCost += weightKg4 * parseFloat(spool4.price || 0)
          }
        } else {
          const material4 = materials.find((m) => m.id === multimaterialMap.color4)
          if (material4) {
            totalCost += weightKg4 * parseFloat(material4.cost_per_kg || 0)
          }
        }
      }
      
      return totalCost.toFixed(2)
    }
    
    // Calcolo normale per modelli non multimateriale
    const material = materials.find((m) => m.id === materialId)
    if (model && material) {
      return (parseFloat(model.weight_kg) * parseFloat(material.cost_per_kg || 0)).toFixed(2)
    }
    return '0.00'
  }

  const calculateAccessoryCost = (usages) => {
    const allocation = allocateAccessoryPieces(usages, accessoryPieces, true)
    return allocation.costTotal
  }

  const getAccessoryAvailableQty = (accessoryId) => {
    return accessoryPieces
      .filter((piece) => piece.accessory_id === accessoryId)
      .reduce((sum, piece) => sum + (parseInt(piece.remaining_qty, 10) || 0), 0)
  }

  const allocateAccessoryPieces = (usages, pieces, simulateOnly = false) => {
    const updates = []
    const rows = []
    let costTotal = 0
    const piecesCopy = pieces.map((piece) => ({ ...piece }))

    for (const usage of usages) {
      const qtyNeeded = parseInt(usage.quantity, 10) || 0
      if (!usage.accessory_id || qtyNeeded <= 0) continue

      const availablePieces = piecesCopy
        .filter((piece) => piece.accessory_id === usage.accessory_id && (parseInt(piece.remaining_qty, 10) || 0) > 0)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

      let remaining = qtyNeeded
      for (const piece of availablePieces) {
        if (remaining <= 0) break
        const pieceQty = parseInt(piece.remaining_qty, 10) || 0
        const usedQty = Math.min(pieceQty, remaining)
        if (usedQty <= 0) continue

        const oldQty = pieceQty
        const newQty = pieceQty - usedQty
        piece.remaining_qty = newQty

        updates.push({ pieceId: piece.id, oldQty, newQty })
        rows.push({
          accessory_id: piece.accessory_id,
          accessory_piece_id: piece.id,
          quantity_used: usedQty,
          unit_cost: parseFloat(piece.unit_cost || 0),
          purchase_account: piece.purchase_account
        })
        costTotal += usedQty * parseFloat(piece.unit_cost || 0)
        remaining -= usedQty
      }

      if (remaining > 0) {
        return { ok: false, updates: [], rows: [], costTotal: 0 }
      }
    }

    if (simulateOnly) {
      return { ok: true, updates: [], rows: [], costTotal }
    }

    return { ok: true, updates, rows, costTotal }
  }

  const resetForm = () => {
    setFormData({
      model_id: '',
      material_id: '',
      spool_id: '',
      sale_price: '',
    })
    setAccessoryUsages([])
    setAvailableSpools([])
    setMultimaterialMapping({
      color1: '',
      color2: '',
      color3: '',
      color4: '',
    })
    setMultimaterialSpools({
      color1: '',
      color2: '',
      color3: '',
      color4: '',
    })
    setMultimaterialAvailableSpools({
      color1: [],
      color2: [],
      color3: [],
      color4: [],
    })
  }

  const handleCreateProduct = async (e) => {
    e.preventDefault()
    const model = models.find((m) => m.id === formData.model_id)

    if (!model) {
      alert('Seleziona un modello')
      return
    }

    if (!model.sku) {
      alert('Il modello selezionato non ha uno SKU genitore. Aggiungi uno SKU al modello prima di creare il prodotto.')
      return
    }

    let productionCost = 0
    let productSku = ''
    let materialId = null
    let mappingForDb = null
    let spoolUpdates = []
    let accessoryUpdates = []
    let accessoryRows = []

    if (model.is_multimaterial) {
      // Validazione per modelli multimateriale
      if (!multimaterialMapping.color1 || !multimaterialMapping.color2) {
        alert('Seleziona almeno i materiali per Colore 1 e Colore 2')
        return
      }

      // Verifica che tutti i materiali selezionati abbiano un codice
      const selectedMaterials = [
        { color: 1, id: multimaterialMapping.color1 },
        { color: 2, id: multimaterialMapping.color2 },
        ...(multimaterialMapping.color3 ? [{ color: 3, id: multimaterialMapping.color3 }] : []),
        ...(multimaterialMapping.color4 ? [{ color: 4, id: multimaterialMapping.color4 }] : []),
      ]

      for (const { color, id } of selectedMaterials) {
        const material = materials.find((m) => m.id === id)
        if (!material) {
          alert(`Materiale per Colore ${color} non trovato`)
          return
        }
        if (!material.code) {
          alert(`Il materiale per Colore ${color} non ha un codice. Aggiungi un codice al materiale prima di creare il prodotto.`)
          return
        }
      }

      // Validazione bobine per prodotti multimateriale
      for (const { color } of selectedMaterials) {
        const colorKey = `color${color}`
        if (!multimaterialSpools[colorKey]) {
          alert(`Seleziona una bobina per Colore ${color}`)
          return
        }
        const selectedSpool = spools.find(s => s.id === multimaterialSpools[colorKey])
        if (!selectedSpool) {
          alert(`Bobina per Colore ${color} non trovata`)
          return
        }
        const weightGrams = parseFloat(model[`${colorKey}_weight_g`] || 0)
        const remainingGrams = parseFloat(selectedSpool.remaining_grams)
        if (weightGrams > remainingGrams) {
          alert(`La bobina per Colore ${color} ha solo ${remainingGrams.toFixed(2)}g disponibili, ma richiede ${weightGrams.toFixed(2)}g`)
          return
        }
      }

      // Crea il mapping per il database includendo le bobine
      mappingForDb = selectedMaterials.map(({ color, id }) => ({
        color,
        material_id: id,
        spool_id: multimaterialSpools[`color${color}`] || null,
      }))

      // Calcola il costo di produzione usando i prezzi delle bobine
      productionCost = parseFloat(calculateProductionCost(formData.model_id, null, multimaterialMapping, multimaterialSpools))

      // Genera SKU: SKU modello + codici materiali separati da "-"
      const materialCodes = selectedMaterials
        .map(({ id }) => materials.find((m) => m.id === id)?.code)
        .filter(Boolean)
        .join('-')
      productSku = `${model.sku}-${materialCodes}`

      // Usa il primo materiale come material_id principale (per retrocompatibilità)
      materialId = mappingForDb[0].material_id

      // Memorizza i dati delle bobine per eventuale rollback
      const spoolUpdates = []
      
      // Scala i grammi da ogni bobina utilizzata
      for (const { color } of selectedMaterials) {
        const colorKey = `color${color}`
        const selectedSpoolId = multimaterialSpools[colorKey]
        const selectedSpool = spools.find(s => s.id === selectedSpoolId)
        if (selectedSpool) {
          const weightGrams = parseFloat(model[`${colorKey}_weight_g`] || 0)
          const remainingGrams = parseFloat(selectedSpool.remaining_grams)
          const newRemainingGrams = remainingGrams - weightGrams
          
          // Memorizza per eventuale rollback
          spoolUpdates.push({
            spoolId: selectedSpoolId,
            oldGrams: remainingGrams,
            newGrams: newRemainingGrams,
            weightGrams: weightGrams
          })
          
          const { error: spoolError } = await supabase
            .from('spools')
            .update({ remaining_grams: newRemainingGrams })
            .eq('id', selectedSpoolId)

          if (spoolError) {
            alert(`Errore durante l'aggiornamento della bobina per Colore ${color}: ` + spoolError.message)
            // Ripristina le bobine già aggiornate
            for (const update of spoolUpdates) {
              await supabase
                .from('spools')
                .update({ remaining_grams: update.oldGrams })
                .eq('id', update.spoolId)
            }
            return
          }
          
          // Aggiorna lo stato locale per riflettere immediatamente il cambiamento
          setSpools(prevSpools => prevSpools.map(spool => 
            spool.id === selectedSpoolId 
              ? { ...spool, remaining_grams: newRemainingGrams }
              : spool
          ))
        }
      }
    } else {
      // Logica normale per modelli non multimateriale
      const material = materials.find((m) => m.id === formData.material_id)

      if (!material) {
        alert('Seleziona un materiale')
        return
      }

      if (!material.code) {
        alert('Il materiale selezionato non ha un codice. Aggiungi un codice al materiale prima di creare il prodotto.')
        return
      }

      materialId = formData.material_id
      productSku = `${model.sku}-${material.code}`
    }

    // Validazione bobina per prodotti non multimateriale
    let selectedSpoolId = null
    let spoolPrice = null
    let spoolUpdate = null
    if (!model.is_multimaterial) {
      if (!formData.spool_id) {
        alert('Seleziona una bobina per questo materiale')
        return
      }

      const selectedSpool = spools.find(s => s.id === formData.spool_id)
      if (!selectedSpool) {
        alert('Bobina selezionata non trovata')
        return
      }

      // Calcola il peso in grammi del prodotto
      const weightGrams = parseFloat(model.weight_kg) * 1000
      const remainingGrams = parseFloat(selectedSpool.remaining_grams)

      if (weightGrams > remainingGrams) {
        alert(`La bobina selezionata ha solo ${remainingGrams.toFixed(2)}g disponibili, ma il prodotto richiede ${weightGrams.toFixed(2)}g`)
        return
      }

      selectedSpoolId = formData.spool_id
      spoolPrice = parseFloat(selectedSpool.price || 0)

      // Calcola il costo di produzione usando il prezzo della bobina
      productionCost = parseFloat(model.weight_kg) * spoolPrice

      // Scala i grammi dalla bobina
      const newRemainingGrams = remainingGrams - weightGrams
      const { error: spoolError } = await supabase
        .from('spools')
        .update({ remaining_grams: newRemainingGrams })
        .eq('id', selectedSpoolId)

      if (spoolError) {
        alert('Errore durante l\'aggiornamento della bobina: ' + spoolError.message)
        return
      }
      
      // Memorizza per eventuale rollback
      spoolUpdate = {
        spoolId: selectedSpoolId,
        oldGrams: remainingGrams,
        newGrams: newRemainingGrams,
        weightGrams: weightGrams
      }
      
      // Aggiorna lo stato locale per riflettere immediatamente il cambiamento
      const updatedSpools = spools.map(spool => 
        spool.id === selectedSpoolId 
          ? { ...spool, remaining_grams: newRemainingGrams }
          : spool
      )
      setSpools(updatedSpools)
    }

    // Accessori: validazione e scarico quantità
    const cleanedAccessoryUsages = accessoryUsages
      .filter((usage) => usage.accessory_id && parseInt(usage.quantity, 10) > 0)
      .map((usage) => ({
        accessory_id: usage.accessory_id,
        quantity: parseInt(usage.quantity, 10)
      }))

    if (cleanedAccessoryUsages.length > 0) {
      const allocation = allocateAccessoryPieces(cleanedAccessoryUsages, accessoryPieces)
      if (!allocation.ok) {
        alert('Quantità accessori insufficiente')
        return
      }

      for (const update of allocation.updates) {
        const { error: accessoryError } = await supabase
          .from('accessory_pieces')
          .update({ remaining_qty: update.newQty })
          .eq('id', update.pieceId)

        if (accessoryError) {
          for (const rollback of accessoryUpdates) {
            await supabase
              .from('accessory_pieces')
              .update({ remaining_qty: rollback.oldQty })
              .eq('id', rollback.pieceId)
          }
          alert('Errore durante l\'aggiornamento accessorio: ' + accessoryError.message)
          return
        }

        accessoryUpdates.push({
          pieceId: update.pieceId,
          oldQty: update.oldQty
        })
      }

      accessoryRows = allocation.rows
      productionCost += allocation.costTotal
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const queueProducts = products.filter(p => ['in_coda', 'in_stampa'].includes(p.status))
    const maxQueueOrder = queueProducts.reduce((max, item) => {
      const value = parseInt(item.queue_order ?? 0, 10)
      return value > max ? value : max
    }, 0)
    const nextQueueOrder = maxQueueOrder + 1

    const { data, error } = await supabase.from('products').insert([
      {
        model_id: formData.model_id,
        material_id: materialId,
        spool_id: model.is_multimaterial ? null : selectedSpoolId, // Per multimateriale, le bobine sono nel mapping
        sku: productSku,
        sale_price: parseFloat(formData.sale_price),
        production_cost: productionCost,
        packaging_cost: 0,
        administrative_cost: 0,
        status: 'in_coda',
        queue_order: nextQueueOrder,
        is_sold_order: false,
        quantity: 1, // Prodotti sempre unici
        multimaterial_mapping: mappingForDb,
        created_by: user?.id,
      },
    ]).select().single()

    if (error) {
      // Ripristina i grammi se l'inserimento del prodotto fallisce
      if (model.is_multimaterial && spoolUpdates) {
        for (const update of spoolUpdates) {
          await supabase
            .from('spools')
            .update({ remaining_grams: update.oldGrams })
            .eq('id', update.spoolId)
        }
      } else if (!model.is_multimaterial && spoolUpdate) {
        await supabase
          .from('spools')
          .update({ remaining_grams: spoolUpdate.oldGrams })
          .eq('id', spoolUpdate.spoolId)
      }
      for (const update of accessoryUpdates) {
        await supabase
          .from('accessory_pieces')
          .update({ remaining_qty: update.oldQty })
          .eq('id', update.pieceId)
      }
      alert('Errore durante la creazione: ' + error.message)
    } else {
      if (accessoryRows.length > 0) {
        const rows = accessoryRows.map((row) => ({
          ...row,
          product_id: data.id
        }))
        const { error: accessoryInsertError } = await supabase
          .from('product_accessories')
          .insert(rows)

        if (accessoryInsertError) {
          for (const update of accessoryUpdates) {
            await supabase
              .from('accessory_pieces')
              .update({ remaining_qty: update.oldQty })
              .eq('id', update.pieceId)
          }
          if (model.is_multimaterial && spoolUpdates) {
            for (const update of spoolUpdates) {
              await supabase
                .from('spools')
                .update({ remaining_grams: update.oldGrams })
                .eq('id', update.spoolId)
            }
          } else if (!model.is_multimaterial && spoolUpdate) {
            await supabase
              .from('spools')
              .update({ remaining_grams: spoolUpdate.oldGrams })
              .eq('id', spoolUpdate.spoolId)
          }
          await supabase.from('products').delete().eq('id', data.id)
          alert('Errore durante il salvataggio accessori: ' + accessoryInsertError.message)
          return
        }
      }

      // Log dell'operazione
      await logAction(
        'aggiunta_prodotto',
        'prodotto',
        data.id,
        productSku,
        { product_data: { sku: productSku, model_id: formData.model_id, material_id: materialId, spool_id: selectedSpoolId } }
      )
      await loadData()
      setShowModal(false)
      resetForm()
    }
  }

  const handleStatusChange = async (id, newStatus) => {
    try {
      const updateData = { status: newStatus }

      if (newStatus === 'disponibile') {
        updateData.storage_location = 'Mesmerized SRLS'
      }

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id)

      if (error) throw error

      const product = products.find((p) => p.id === id)
      await logAction(
        'modifica_prodotto',
        'prodotto',
        id,
        product?.sku || 'Prodotto sconosciuto',
        { status_change: { from: product?.status, to: newStatus } }
      )

      await loadData()
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Errore durante l\'aggiornamento dello stato')
    }
  }

  const handleToggleSoldOrder = async (id, currentValue) => {
    try {
      const newValue = !currentValue
      const { error } = await supabase
        .from('products')
        .update({ is_sold_order: newValue })
        .eq('id', id)

      if (error) throw error

      const product = products.find((p) => p.id === id)
      await logAction(
        'modifica_prodotto',
        'prodotto',
        id,
        product?.sku || 'Prodotto sconosciuto',
        { is_sold_order: { from: currentValue, to: newValue } }
      )

      await loadData()
    } catch (error) {
      console.error('Error toggling sold order:', error)
      alert('Errore durante l\'aggiornamento della priorità')
    }
  }

  const handleUpdateProductInfo = async (e) => {
    e.preventDefault()
    if (!editingProduct) return

    const salePrice = parseFloat(editInfoForm.sale_price)
    if (Number.isNaN(salePrice) || salePrice < 0) {
      alert('Inserisci un prezzo valido')
      return
    }

    const updateData = {
      sale_price: salePrice,
      storage_location: editInfoForm.storage_location || null
    }

    const { error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', editingProduct.id)

    if (error) {
      alert('Errore durante l\'aggiornamento: ' + error.message)
      return
    }

    await logAction(
      'modifica_prodotto',
      'prodotto',
      editingProduct.id,
      editingProduct.sku || 'Prodotto sconosciuto',
      { changes: updateData }
    )

    await loadData()
    setShowEditInfoModal(false)
    setEditingProduct(null)
  }

  const handleReorderQueue = async (draggedId, targetId) => {
    if (!draggedId || !targetId || draggedId === targetId) return

    if (sortBy !== 'priorita') {
      setSortBy('priorita')
    }

    const currentList = [...filteredProducts]
    const fromIndex = currentList.findIndex((item) => item.id === draggedId)
    const toIndex = currentList.findIndex((item) => item.id === targetId)
    if (fromIndex === -1 || toIndex === -1) return

    const [movedItem] = currentList.splice(fromIndex, 1)
    currentList.splice(toIndex, 0, movedItem)

    try {
      const updates = currentList.map((item, index) => ({
        id: item.id,
        queue_order: index + 1
      }))

      const updateResults = await Promise.all(
        updates.map((update) =>
          supabase.from('products').update({ queue_order: update.queue_order }).eq('id', update.id)
        )
      )

      const updateError = updateResults.find((result) => result.error)?.error
      if (updateError) throw updateError

      await logAction(
        'modifica_prodotto',
        'prodotto',
        movedItem.id,
        movedItem.sku || 'Prodotto sconosciuto',
        { queue_order_reorder: { from: fromIndex + 1, to: toIndex + 1 } }
      )

      await loadData()
    } catch (error) {
      console.error('Error reordering queue:', error)
      alert('Errore durante il riordino della coda')
    } finally {
      setDragItemId(null)
      setDragOverId(null)
    }
  }

  const handleEditProduct = (product) => {
    const productModel = models.find(m => m.id === product.model_id)
    if (productModel?.is_multimaterial) {
      alert('La modifica del materiale non è disponibile per prodotti multimateriale')
      return
    }

    setEditingProduct(product)
    setEditFormData({
      material_id: product.material_id || '',
      spool_id: product.spool_id || '',
    })
    setShowEditModal(true)
  }

  const handleUpdateProduct = async (e) => {
    e.preventDefault()
    
    if (!editingProduct) return
    
    if (!editFormData.material_id) {
      alert('Seleziona un materiale')
      return
    }
    
    if (!editFormData.spool_id) {
      alert('Seleziona una bobina')
      return
    }

    try {
      const selectedSpool = spools.find(s => s.id === editFormData.spool_id)
      if (!selectedSpool) {
        alert('Bobina non trovata')
        return
      }

      const productModel = models.find(m => m.id === editingProduct.model_id)
      if (!productModel) {
        alert('Modello non trovato')
        return
      }

      const spoolPrice = parseFloat(selectedSpool.price || 0)
      const newProductionCost = parseFloat(productModel.weight_kg) * spoolPrice

      const { error: updateError } = await supabase
        .from('products')
        .update({
          material_id: editFormData.material_id,
          spool_id: editFormData.spool_id,
          production_cost: newProductionCost,
        })
        .eq('id', editingProduct.id)

      if (updateError) {
        throw new Error('Errore durante l\'aggiornamento: ' + updateError.message)
      }

      const material = materials.find(m => m.id === editFormData.material_id)
      await logAction(
        'modifica_prodotto',
        'prodotto',
        editingProduct.id,
        `${editingProduct.sku} - Materiale aggiornato: ${material?.brand || 'N/A'}`,
        { 
          old_material_id: editingProduct.material_id,
          new_material_id: editFormData.material_id,
          old_spool_id: editingProduct.spool_id,
          new_spool_id: editFormData.spool_id,
          old_production_cost: editingProduct.production_cost,
          new_production_cost: newProductionCost
        }
      )

      await loadData()
      setShowEditModal(false)
      setEditingProduct(null)
      setEditFormData({ material_id: '', spool_id: '' })
      alert('Prodotto aggiornato con successo!')
    } catch (error) {
      console.error('Error:', error)
      alert('Errore durante l\'aggiornamento: ' + error.message)
    }
  }

  const openRestoreModal = (product) => {
    if (product && !['in_coda', 'in_stampa'].includes(product.status)) {
      alert('Puoi eliminare solo prodotti in coda o in stampa.')
      return
    }
    const productModelId = product?.model_id || product?.models?.id
    const model = models.find((m) => m.id === productModelId)
    if (!model) {
      alert('Modello non trovato: impossibile ripristinare le bobine.')
      return
    }

    const mapping = Array.isArray(product?.multimaterial_mapping) ? product.multimaterial_mapping : []
    const sortedMapping = [...mapping].sort((a, b) => (a.color || 0) - (b.color || 0))
    const initialSelections = {}

    if (sortedMapping.length > 0) {
      for (const item of sortedMapping) {
        initialSelections[`color${item.color}`] = item.spool_id || ''
      }
    } else {
      initialSelections.single = product?.spool_id || ''
    }

    setRestoreSelections(initialSelections)
    setRestoreProduct(product)
    setShowRestoreModal(true)
  }

  const handleRestoreAndDelete = async () => {
    if (!restoreProduct) return

    const productModelId = restoreProduct?.model_id || restoreProduct?.models?.id
    const model = models.find((m) => m.id === productModelId)
    if (!model) {
      alert('Modello non trovato: impossibile ripristinare le bobine.')
      return
    }

    const mapping = Array.isArray(restoreProduct?.multimaterial_mapping) ? restoreProduct.multimaterial_mapping : []
    const sortedMapping = [...mapping].sort((a, b) => (a.color || 0) - (b.color || 0))

    const spoolIncrements = new Map()
    if (sortedMapping.length > 0) {
      for (const item of sortedMapping) {
        const spoolId = restoreSelections[`color${item.color}`]
        if (!spoolId) {
          alert(`Seleziona una bobina per Colore ${item.color}`)
          return
        }
        const weightGrams = parseFloat(model[`color${item.color}_weight_g`] || 0)
        if (!weightGrams || weightGrams <= 0) {
          alert('Peso del colore non valido: impossibile ripristinare le bobine.')
          return
        }
        spoolIncrements.set(spoolId, (spoolIncrements.get(spoolId) || 0) + weightGrams)
      }
    } else {
      const spoolId = restoreSelections.single
      if (!spoolId) {
        alert('Seleziona una bobina per il materiale')
        return
      }
      const weightGrams = parseFloat(model.weight_kg || 0) * 1000
      if (!weightGrams || weightGrams <= 0) {
        alert('Peso del modello non valido: impossibile ripristinare le bobine.')
        return
      }
      spoolIncrements.set(spoolId, (spoolIncrements.get(spoolId) || 0) + weightGrams)
    }

    const spoolRollback = []
    for (const [spoolId, gramsToAdd] of spoolIncrements.entries()) {
      const { data: spoolData, error: spoolSelectError } = await supabase
        .from('spools')
        .select('remaining_grams')
        .eq('id', spoolId)
        .single()

      if (spoolSelectError) {
        alert('Errore durante il recupero della bobina: ' + spoolSelectError.message)
        return
      }

      const currentGrams = parseFloat(spoolData?.remaining_grams || 0)
      const newRemainingGrams = currentGrams + gramsToAdd

      const { error: spoolUpdateError } = await supabase
        .from('spools')
        .update({ remaining_grams: newRemainingGrams })
        .eq('id', spoolId)

      if (spoolUpdateError) {
        alert('Errore durante il ripristino della bobina: ' + spoolUpdateError.message)
        return
      }

      spoolRollback.push({ spoolId, oldGrams: currentGrams })
      setSpools(prev => prev.map(spool => (
        spool.id === spoolId ? { ...spool, remaining_grams: newRemainingGrams } : spool
      )))
    }

    const { error } = await supabase.from('products').delete().eq('id', restoreProduct.id)

    if (error) {
      for (const rollback of spoolRollback) {
        await supabase
          .from('spools')
          .update({ remaining_grams: rollback.oldGrams })
          .eq('id', rollback.spoolId)
      }
      setSpools(prev => prev.map(spool => {
        const rollback = spoolRollback.find((item) => item.spoolId === spool.id)
        return rollback ? { ...spool, remaining_grams: rollback.oldGrams } : spool
      }))
      alert('Errore durante l\'eliminazione: ' + error.message)
      return
    }

    const productSku = restoreProduct?.sku || 'Prodotto sconosciuto'
    await logAction(
      'eliminazione_prodotto',
      'prodotto',
      restoreProduct.id,
      productSku,
      { product_data: restoreProduct }
    )
    setShowRestoreModal(false)
    setRestoreProduct(null)
    setRestoreSelections({})
    await loadData()
  }

  const handleProductClick = (product) => {
    setDetailProduct(product)
    setShowDetailModal(true)
  }

  const getMaterialLabel = (materialId) => {
    const material = materials.find((m) => m.id === materialId)
    return material ? `${material.brand} - ${material.material_type} - ${material.color}` : 'Materiale'
  }

  const handleOpenInBambu = (model3mfUrl) => {
    if (!model3mfUrl) return
    openInBambuStudio(model3mfUrl)
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getMultimaterialDetails = (product) => {
    const mapping = Array.isArray(product?.multimaterial_mapping) ? product.multimaterial_mapping : []
    if (mapping.length <= 1) return []

    const sortedMapping = [...mapping].sort((a, b) => (a.color || 0) - (b.color || 0))
    return sortedMapping.map((item) => ({
      colorIndex: item.color,
      material: materials.find((m) => m.id === item.material_id)
    }))
  }

  const getHoverCardStyle = (rect, width = 240, offset = 8) => {
    if (!rect) return {}
    const safeLeft = Math.min(
      Math.max(rect.left, offset),
      window.innerWidth - width - offset
    )
    const placeAbove = rect.top > 260
    const top = placeAbove ? rect.top - offset : rect.bottom + offset

    return {
      position: 'fixed',
      left: safeLeft,
      top,
      transform: placeAbove ? 'translateY(-100%)' : 'none',
      background: 'white',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '10px 12px',
      boxShadow: '0 6px 18px rgba(0, 0, 0, 0.12)',
      zIndex: 2000
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      in_coda: { label: 'In Coda', class: 'status-queue' },
      in_stampa: { label: 'In Stampa', class: 'status-printing' },
      disponibile: { label: 'Disponibile', class: 'status-available' },
      venduto: { label: 'Venduto', class: 'status-sold' },
    }
    return badges[status] || badges.in_coda
  }

  if (loading) return <div className="loading">Caricamento...</div>

  const selectedModel = models.find((m) => m.id === formData.model_id)

  return (
    <div className="products-page">
      <div className="page-header">
        <h1>Coda di Stampa</h1>
        <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true) }}>
          <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
          Nuovo Prodotto
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
              Cerca Prodotti
            </label>
            <input
              type="text"
              placeholder="Cerca per SKU, modello, brand, materiale o colore..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
            <small style={{ display: 'block', marginTop: '5px', color: '#7f8c8d', fontSize: '12px' }}>
              {filteredProducts.length} {filteredProducts.length === 1 ? 'prodotto trovato' : 'prodotti trovati'}
              {searchQuery && ` per "${searchQuery}"`}
            </small>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '0 0 300px', display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '14px', marginBottom: '8px', display: 'block', color: '#1a1a1a', fontWeight: '500' }}>
              Ordina per
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
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
              <option value="priorita">Priorità (Coda)</option>
              <option value="created_at">Data Caricamento (Più recenti)</option>
              <option value="nome_crescente">Nome Crescente</option>
              <option value="nome_decrescente">Nome Decrescente</option>
              <option value="materiale_crescente">Materiale Crescente</option>
              <option value="materiale_decrescente">Materiale Decrescente</option>
              <option value="prezzo_crescente">Prezzo Vendita Crescente</option>
              <option value="prezzo_decrescente">Prezzo Vendita Decrescente</option>
            </select>
          </div>
        </div>
      </div>

      <div className="products-table-container">
        <table className="products-table">
          <thead>
            <tr>
              <th></th>
              <th>SKU</th>
              <th>Modello</th>
              <th>Peso</th>
              <th>Materiale</th>
              <th>Stato</th>
              <th>Priorità</th>
              <th>Costo</th>
              <th>Prezzo</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
                  {searchQuery
                    ? 'Nessun prodotto corrisponde alla ricerca.'
                    : 'Nessun prodotto in coda di stampa.'}
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => {
                const statusBadge = getStatusBadge(product.status)
                return (
                  <tr
                    key={product.id}
                    className="product-row"
                    draggable={false}
                    onClick={(e) => {
                      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                        return
                      }
                      handleProductClick(product)
                    }}
                    onDragOver={(e) => {
                      if (sortBy !== 'priorita') return
                      e.preventDefault()
                      setDragOverId(product.id)
                    }}
                    style={{
                      ...(dragOverId === product.id ? { background: '#f1f5f9' } : {})
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      handleReorderQueue(dragItemId, product.id)
                    }}
                  >
                    <td>
                      <button
                        className="drag-handle"
                        title="Trascina per riordinare"
                        draggable={sortBy === 'priorita'}
                        onClick={(e) => e.stopPropagation()}
                        onDragStart={(e) => {
                          e.stopPropagation()
                          if (sortBy !== 'priorita') {
                            setSortBy('priorita')
                          }
                          setDragItemId(product.id)
                          e.dataTransfer.setData('text/plain', product.id)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragEnd={() => {
                          setDragItemId(null)
                          setDragOverId(null)
                        }}
                      >
                        <FontAwesomeIcon icon={faGripVertical} />
                      </button>
                    </td>
                    <td>
                      <strong style={{ whiteSpace: 'nowrap' }}>{product.sku || 'N/A'}</strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{ position: 'relative' }}
                          onMouseEnter={(e) => {
                            setHoveredModelCard({
                              id: product.id,
                              rect: e.currentTarget.getBoundingClientRect(),
                              photoUrl: product.models?.photo_url,
                              name: product.models?.name
                            })
                          }}
                          onMouseLeave={() => setHoveredModelCard(null)}
                        >
                          {product.models?.photo_url && (
                            <img
                              src={product.models.photo_url}
                              alt={product.models.name}
                              style={{
                                width: '40px',
                                height: '40px',
                                objectFit: 'cover',
                                borderRadius: '4px',
                                border: '1px solid #e0e0e0'
                              }}
                            />
                          )}
                          {hoveredModelCard?.id === product.id && hoveredModelCard?.photoUrl && (
                            <div style={{ ...getHoverCardStyle(hoveredModelCard.rect, 220), padding: '8px' }}>
                              <img
                                src={hoveredModelCard.photoUrl}
                                alt={hoveredModelCard.name || 'Prodotto'}
                                style={{
                                  width: '200px',
                                  height: '200px',
                                  objectFit: 'cover',
                                  borderRadius: '6px',
                                  display: 'block'
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <span>{product.models?.name || 'N/A'}</span>
                      </div>
                    </td>
                    <td>
                      {(() => {
                        const model = product.models
                        if (!model) return 'N/A'
                        const isMultimaterial = model.is_multimaterial
                        const totalWeightGrams = isMultimaterial
                          ? (
                            (parseFloat(model.color1_weight_g) || 0) +
                            (parseFloat(model.color2_weight_g) || 0) +
                            (parseFloat(model.color3_weight_g) || 0) +
                            (parseFloat(model.color4_weight_g) || 0)
                          )
                          : (parseFloat(model.weight_kg) || 0) * 1000

                        return totalWeightGrams > 0 ? `${Math.round(totalWeightGrams)} g` : 'N/A'
                      })()}
                    </td>
                    <td>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}
                        onMouseEnter={(e) => {
                          setHoveredMaterialCard({
                            id: product.id,
                            rect: e.currentTarget.getBoundingClientRect()
                          })
                        }}
                        onMouseLeave={() => setHoveredMaterialCard(null)}
                      >
                        {product.materials?.bobina_photo_url && (
                          <img
                            src={product.materials.bobina_photo_url}
                            alt={product.materials.brand}
                            style={{
                              width: '40px',
                              height: '40px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #e0e0e0'
                            }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <strong>{product.materials?.brand || 'N/A'}</strong>
                            {product.materials?.material_type && (
                              <span style={{ fontSize: '12px', color: '#7f8c8d' }}>
                                {product.materials.material_type}
                              </span>
                            )}
                            {product.multimaterial_mapping && Array.isArray(product.multimaterial_mapping) && product.multimaterial_mapping.length > 1 && (
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: '#2d2d2d',
                                  color: 'white',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  lineHeight: '1.2'
                                }}
                              >
                                +{product.multimaterial_mapping.length - 1}
                              </span>
                            )}
                          </div>
                          <div style={{ color: '#7f8c8d', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                              {product.materials?.color_hex && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    backgroundColor: product.materials.color_hex,
                                    border: '1px solid #ddd'
                                  }}
                                />
                              )}
                              {product.materials?.color || ''}
                            </span>
                          </div>
                        </div>
                        {(() => {
                          const details = getMultimaterialDetails(product)
                          if (details.length <= 1 || hoveredMaterialCard?.id !== product.id) return null

                          return (
                            <div
                              style={{ ...getHoverCardStyle(hoveredMaterialCard?.rect, 260), minWidth: '220px' }}
                            >
                              <div style={{ fontSize: '12px', fontWeight: '600', color: '#1a1a1a', marginBottom: '6px' }}>
                                Materiali usati
                              </div>
                              {details.map((item) => {
                                if (!item.material) {
                                  return (
                                    <div key={`mm-${item.colorIndex}`} style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '4px' }}>
                                      Colore {item.colorIndex || ''}: N/A
                                    </div>
                                  )
                                }

                                return (
                                  <div key={`mm-${item.colorIndex}`} style={{ marginBottom: '6px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#1a1a1a' }}>
                                      Colore {item.colorIndex}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#7f8c8d' }}>
                                      <span style={{ color: '#1a1a1a' }}>{item.material.brand}</span>
                                      {item.material.material_type && (
                                        <span>{item.material.material_type}</span>
                                      )}
                                      {item.material.color && (
                                        <>
                                          {item.material.color_hex && (
                                            <span
                                              style={{
                                                display: 'inline-block',
                                                width: '10px',
                                                height: '10px',
                                                borderRadius: '50%',
                                                backgroundColor: item.material.color_hex,
                                                border: '1px solid #ddd'
                                              }}
                                            />
                                          )}
                                          <span>{item.material.color}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${statusBadge.class}`}>
                        {statusBadge.label}
                      </span>
                    </td>
                    <td>
                      {product.status === 'in_coda' ? (
                        <label
                          className="priority-toggle"
                          title={product.is_sold_order ? 'Rimuovi priorità "Prodotto venduto"' : 'Segna come Prodotto venduto (priorità maggiore)'}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={!!product.is_sold_order}
                            onChange={() => handleToggleSoldOrder(product.id, product.is_sold_order)}
                          />
                          <span className="priority-toggle-slider" />
                          <span className="priority-toggle-label">
                            {product.is_sold_order ? 'Venduto' : 'Normale'}
                          </span>
                        </label>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                          {product.is_sold_order ? 'Prodotto venduto' : '—'}
                        </span>
                      )}
                    </td>
                    <td>
                      €{(() => {
                        const baseCost = parseFloat(product.production_cost || 0)
                        const extraCosts = product.production_extra_costs || []
                        const extraTotal = extraCosts.reduce((sum, cost) => sum + (parseFloat(cost?.amount || 0) || 0), 0)
                        return (baseCost + extraTotal).toFixed(2)
                      })()}
                    </td>
                    <td>€{parseFloat(product.sale_price).toFixed(2)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={!product.models?.model_3mf_url}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenInBambu(product.models?.model_3mf_url)
                          }}
                          style={{
                            background: product.models?.model_3mf_url ? '#00b56a' : undefined,
                            borderColor: product.models?.model_3mf_url ? '#00b56a' : undefined,
                            color: product.models?.model_3mf_url ? '#ffffff' : undefined,
                            opacity: product.models?.model_3mf_url ? 1 : 0.5,
                            cursor: product.models?.model_3mf_url ? 'pointer' : 'not-allowed',
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
                        {product.status === 'in_stampa' ? (
                          <button
                            className="btn-queue"
                            onClick={() => handleStatusChange(product.id, 'in_coda')}
                            title="Rimetti in coda"
                          >
                            <FontAwesomeIcon icon={faMinus} />
                          </button>
                        ) : (
                          <button
                            className="btn-printing"
                            onClick={() => handleStatusChange(product.id, 'in_stampa')}
                            title="Imposta in stampa"
                          >
                            <FontAwesomeIcon icon={faPrint} />
                          </button>
                        )}
                        {product.status === 'in_stampa' && (
                          <button
                            className="btn-status"
                            onClick={() => handleStatusChange(product.id, 'disponibile')}
                            title="Imposta come disponibile"
                          >
                            <FontAwesomeIcon icon={faCheck} />
                          </button>
                        )}
                        {product.status === 'in_coda' && (
                          <>
                            <button 
                              className="btn-edit" 
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditProduct(product)
                              }} 
                              title="Modifica materiale/bobina"
                            >
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                            <button
                              className="btn-delete"
                              onClick={(e) => {
                                e.stopPropagation()
                                openRestoreModal(product)
                              }}
                              title="Elimina dalla coda"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modale di modifica materiale/bobina - identica a Products.jsx */}
      {showEditModal && editingProduct && (
        <div className="modal-overlay" onClick={() => { setShowEditModal(false); setEditingProduct(null); setEditFormData({ material_id: '', spool_id: '' }) }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2>Modifica Materiale/Bobina</h2>
            <form onSubmit={handleUpdateProduct}>
              <div className="form-group">
                <label>Prodotto</label>
                <div style={{ padding: '10px', background: '#f8f9fa', borderRadius: '4px', fontSize: '14px' }}>
                  <strong>{editingProduct.sku}</strong> - {editingProduct.models?.name || 'N/A'}
                </div>
              </div>

              <div className="form-group" style={{ position: 'relative' }}>
                <label>Materiale</label>
                <div style={{ position: 'relative' }}>
                  <div
                    onClick={() => {
                      setShowMaterialDropdown(showMaterialDropdown === 'edit' ? false : 'edit')
                      if (showMaterialDropdown !== 'edit') {
                        setMaterialSearch('')
                      }
                    }}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                      background: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ color: editFormData.material_id ? '#1a1a1a' : '#6c757d' }}>
                      {editFormData.material_id
                        ? (() => {
                            const material = materials.find((m) => m.id === editFormData.material_id)
                            return material
                              ? `${material.brand} - ${material.material_type} - ${material.color}`
                              : 'Seleziona materiale...'
                          })()
                        : 'Seleziona materiale...'}
                    </span>
                    <span style={{ color: '#6c757d' }}>▼</span>
                  </div>
                  {showMaterialDropdown === 'edit' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        marginTop: '4px',
                        background: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        maxHeight: '400px',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <div style={{ padding: '10px', borderBottom: '1px solid #f0f0f0' }}>
                        <input
                          type="text"
                          placeholder="Cerca materiale..."
                          value={materialSearch}
                          onChange={(e) => {
                            setMaterialSearch(e.target.value)
                            setHoveredMaterial(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                          autoFocus
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', maxHeight: '300px' }}>
                        {materials
                          .filter((material) => {
                            const materialSpools = spools.filter(
                              spool => spool.material_id === material.id && parseFloat(spool.remaining_grams) > 0
                            )
                            return materialSpools.length > 0
                          })
                          .filter((material) => {
                            if (!materialSearch) return true
                            const search = materialSearch.toLowerCase()
                            return (
                              material.brand.toLowerCase().includes(search) ||
                              material.material_type.toLowerCase().includes(search) ||
                              material.color.toLowerCase().includes(search) ||
                              material.code?.toLowerCase().includes(search)
                            )
                          })
                          .map((material) => (
                            <div
                              key={material.id}
                              onClick={() => {
                                setEditFormData({ ...editFormData, material_id: material.id, spool_id: '' })
                                setShowMaterialDropdown(false)
                                setMaterialSearch('')
                              }}
                              style={{
                                padding: '10px 12px',
                                cursor: 'pointer',
                                background: editFormData.material_id === material.id ? '#e8f4f8' : 'white',
                                borderBottom: '1px solid #f0f0f0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                              }}
                            >
                              {material.bobina_photo_url && (
                                <img
                                  src={material.bobina_photo_url}
                                  alt={material.brand}
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    objectFit: 'cover',
                                    borderRadius: '4px',
                                    flexShrink: 0
                                  }}
                                />
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: '600', color: '#1a1a1a' }}>{material.brand}</div>
                                <div style={{ fontSize: '12px', color: '#7f8c8d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {material.material_type} -{' '}
                                  {material.color_hex && (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        backgroundColor: material.color_hex,
                                        border: '1px solid #ddd',
                                        flexShrink: 0
                                      }}
                                    />
                                  )}
                                  {material.color}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {editFormData.material_id && (
                <div className="form-group">
                  <label>Bobina</label>
                  {editAvailableSpools.length === 0 ? (
                    <div style={{ padding: '10px', background: '#fff3cd', borderRadius: '4px', color: '#856404', fontSize: '14px' }}>
                      Nessuna bobina disponibile per questo materiale.
                    </div>
                  ) : (
                    <select
                      value={editFormData.spool_id}
                      onChange={(e) => setEditFormData({ ...editFormData, spool_id: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        background: 'white',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">Seleziona una bobina...</option>
                      {editAvailableSpools.map((spool) => {
                        const pricePerKg = parseFloat(spool.price || 0)
                        return (
                          <option key={spool.id} value={spool.id}>
                            {spool.purchase_account} - €{pricePerKg.toFixed(2)}/kg - {parseFloat(spool.remaining_grams).toFixed(2)}g residui
                          </option>
                        )
                      })}
                    </select>
                  )}
                </div>
              )}
              <div className="form-group">
                <label>Accessori usati</label>
                {accessoryUsages.length === 0 ? (
                  <small style={{ color: '#7f8c8d', display: 'block', marginBottom: '8px' }}>
                    Nessun accessorio selezionato
                  </small>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                    {accessoryUsages.map((usage, index) => (
                      <div key={`acc-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: '8px', alignItems: 'center' }}>
                        <select
                          value={usage.accessory_id}
                          onChange={(e) => {
                            const updated = [...accessoryUsages]
                            updated[index] = { ...updated[index], accessory_id: e.target.value }
                            setAccessoryUsages(updated)
                          }}
                        >
                          <option value="">Seleziona accessorio</option>
                          {accessories.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} (disp. {getAccessoryAvailableQty(acc.id)})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={usage.quantity}
                          onChange={(e) => {
                            const updated = [...accessoryUsages]
                            updated[index] = { ...updated[index], quantity: e.target.value }
                            setAccessoryUsages(updated)
                          }}
                          placeholder="Qtà"
                        />
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            const updated = accessoryUsages.filter((_, i) => i !== index)
                            setAccessoryUsages(updated)
                          }}
                        >
                          Rimuovi
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setAccessoryUsages([...accessoryUsages, { accessory_id: '', quantity: 1 }])}
                >
                  + Aggiungi accessorio
                </button>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => { 
                    setShowEditModal(false)
                    setEditingProduct(null)
                    setEditFormData({ material_id: '', spool_id: '' })
                  }}
                >
                  Annulla
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={!editFormData.material_id || !editFormData.spool_id}
                >
                  Salva Modifiche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRestoreModal && restoreProduct && (
        <div className="modal-overlay" onClick={() => { setShowRestoreModal(false); setRestoreProduct(null); setRestoreSelections({}) }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h2>Ripristina materiale alle bobine</h2>
            <div style={{ marginBottom: '16px', padding: '10px', background: '#f8f9fa', borderRadius: '6px' }}>
              <strong>{restoreProduct.sku}</strong> - {restoreProduct.models?.name || 'N/A'}
            </div>

            {(() => {
              const mapping = Array.isArray(restoreProduct?.multimaterial_mapping)
                ? restoreProduct.multimaterial_mapping
                : []
              const sortedMapping = [...mapping].sort((a, b) => (a.color || 0) - (b.color || 0))

              if (sortedMapping.length > 0) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {sortedMapping.map((item) => {
                      const materialLabel = getMaterialLabel(item.material_id)
                      const availableSpools = spools.filter((spool) => spool.material_id === item.material_id)
                      return (
                        <div key={`restore-color-${item.color}`} className="form-group">
                          <label>Colore {item.color} - {materialLabel}</label>
                          <select
                            value={restoreSelections[`color${item.color}`] || ''}
                            onChange={(e) => setRestoreSelections(prev => ({ ...prev, [`color${item.color}`]: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: '1px solid #ced4da',
                              borderRadius: '4px',
                              background: 'white'
                            }}
                          >
                            <option value="">Seleziona bobina...</option>
                            {availableSpools.map((spool) => (
                              <option key={spool.id} value={spool.id}>
                                {getMaterialLabel(spool.material_id)} — {parseFloat(spool.remaining_grams || 0).toFixed(0)}g
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                )
              }

              const materialLabel = getMaterialLabel(restoreProduct.material_id)
              const availableSpools = spools.filter((spool) => spool.material_id === restoreProduct.material_id)
              return (
                <div className="form-group">
                  <label>Bobina - {materialLabel}</label>
                  <select
                    value={restoreSelections.single || ''}
                    onChange={(e) => setRestoreSelections(prev => ({ ...prev, single: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                      background: 'white'
                    }}
                  >
                    <option value="">Seleziona bobina...</option>
                    {availableSpools.map((spool) => (
                      <option key={spool.id} value={spool.id}>
                        {getMaterialLabel(spool.material_id)} — {parseFloat(spool.remaining_grams || 0).toFixed(0)}g
                      </option>
                    ))}
                  </select>
                </div>
              )
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setShowRestoreModal(false); setRestoreProduct(null); setRestoreSelections({}) }}
              >
                Annulla
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleRestoreAndDelete}
              >
                Ripristina ed elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditInfoModal && editingProduct && (
        <div className="modal-overlay" onClick={() => { setShowEditInfoModal(false); setEditingProduct(null) }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <h2>Modifica Magazzino / Prezzo</h2>
            <form onSubmit={handleUpdateProductInfo}>
              <div className="form-group">
                <label>Prezzo di Vendita (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editInfoForm.sale_price}
                  onChange={(e) => setEditInfoForm({ ...editInfoForm, sale_price: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Magazzino</label>
                <select
                  value={editInfoForm.storage_location}
                  onChange={(e) => setEditInfoForm({ ...editInfoForm, storage_location: e.target.value })}
                >
                  <option value="">N/A</option>
                  <option value="Mesmerized SRLS">Mesmerized SRLS</option>
                  <option value="Robe di Robertaebasta">Robe di Robertaebasta</option>
                </select>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setShowEditInfoModal(false); setEditingProduct(null) }}
                >
                  Annulla
                </button>
                <button type="submit" className="btn-primary">
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale dettaglio prodotto - semplificata */}
      {showDetailModal && detailProduct && (
        <div className="modal-overlay" onClick={() => { setShowDetailModal(false); setDetailProduct(null) }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>Dettagli Prodotto</h2>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '10px' }}>
                <strong>SKU:</strong> {detailProduct.sku}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Modello:</strong> {detailProduct.models?.name || 'N/A'}
              </div>
              <div style={{ marginBottom: '10px' }}>
                {(() => {
                  const details = getMultimaterialDetails(detailProduct)
                  if (details.length > 1) {
                    return (
                      <div>
                        <strong>Materiali:</strong>
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {details.map((item) => (
                            <div key={`detail-mm-${item.colorIndex}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                              <span style={{ fontWeight: 600 }}>Colore {item.colorIndex}</span>
                              <span style={{ color: '#7f8c8d' }}>-</span>
                              <span>{item.material?.brand || 'N/A'}</span>
                              {item.material?.material_type && (
                                <span style={{ color: '#7f8c8d' }}>{item.material.material_type}</span>
                              )}
                              {item.material?.color && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7f8c8d' }}>
                                  {item.material.color_hex && (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        backgroundColor: item.material.color_hex,
                                        border: '1px solid #ddd'
                                      }}
                                    />
                                  )}
                                  {item.material.color}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <strong>Materiale:</strong>
                      <span>{detailProduct.materials?.brand || 'N/A'}</span>
                      <span>-</span>
                      <span>{detailProduct.materials?.material_type || 'N/A'}</span>
                      <span>-</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7f8c8d' }}>
                        {detailProduct.materials?.color_hex && (
                          <span
                            style={{
                              display: 'inline-block',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: detailProduct.materials.color_hex,
                              border: '1px solid #ddd'
                            }}
                          />
                        )}
                        {detailProduct.materials?.color || 'N/A'}
                      </span>
                    </div>
                  )
                })()}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Costo Produzione:</strong> €{parseFloat(detailProduct.production_cost || 0).toFixed(2)}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Prezzo Vendita:</strong> €{parseFloat(detailProduct.sale_price || 0).toFixed(2)}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Magazzino:</strong> {detailProduct.storage_location || 'N/A'}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Creato il:</strong> {formatDate(detailProduct.created_at)}
              </div>
            </div>
            <div className="modal-actions">
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => { setShowDetailModal(false); setDetailProduct(null) }}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal creazione prodotto */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm() }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Nuovo Prodotto</h2>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
              <div
                style={{
                  flex: 1,
                  aspectRatio: '1',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#f8f9fa',
                  minHeight: '150px'
                }}
              >
                {formData.model_id ? (
                  (() => {
                    const selectedModel = models.find((m) => m.id === formData.model_id)
                    return selectedModel?.photo_url ? (
                      <img
                        src={selectedModel.photo_url}
                        alt={selectedModel.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: '6px'
                        }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#7f8c8d', padding: '20px' }}>
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>📦</div>
                        <div style={{ fontSize: '14px', fontWeight: '600' }}>{selectedModel?.name || 'Modello'}</div>
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>Nessuna immagine</div>
                      </div>
                    )
                  })()
                ) : (
                  <div style={{ textAlign: 'center', color: '#7f8c8d' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>Seleziona un modello</div>
                  </div>
                )}
              </div>
              <div
                style={{
                  flex: 1,
                  aspectRatio: '1',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#f8f9fa',
                  minHeight: '150px'
                }}
              >
                {formData.material_id ? (
                  (() => {
                    const selectedMaterial = materials.find((m) => m.id === formData.material_id)
                    return selectedMaterial?.bobina_photo_url ? (
                      <img
                        src={selectedMaterial.bobina_photo_url}
                        alt={selectedMaterial.brand}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: '6px'
                        }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#7f8c8d', padding: '20px' }}>
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>🧱</div>
                        <div style={{ fontSize: '14px', fontWeight: '600' }}>{selectedMaterial?.brand || 'Materiale'}</div>
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>Nessuna immagine</div>
                      </div>
                    )
                  })()
                ) : (
                  <div style={{ textAlign: 'center', color: '#7f8c8d' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧱</div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>Seleziona un materiale</div>
                  </div>
                )}
              </div>
            </div>
            <form onSubmit={handleCreateProduct}>
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Modello</label>
                <div style={{ position: 'relative' }}>
                  <div
                    onClick={() => {
                      setShowModelDropdown(!showModelDropdown)
                      setShowMaterialDropdown(false)
                      if (!showModelDropdown) {
                        setModelSearch('')
                      }
                    }}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                      background: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ color: formData.model_id ? '#1a1a1a' : '#6c757d' }}>
                      {formData.model_id
                        ? models.find((m) => m.id === formData.model_id)?.name || 'Seleziona modello...'
                        : 'Seleziona modello...'}
                    </span>
                    <span style={{ color: '#6c757d' }}>▼</span>
                  </div>
                  {showModelDropdown && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        marginTop: '4px',
                        background: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        maxHeight: '400px',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <div style={{ padding: '10px', borderBottom: '1px solid #f0f0f0' }}>
                        <input
                          type="text"
                          placeholder="Cerca modello..."
                          value={modelSearch}
                          onChange={(e) => {
                            setModelSearch(e.target.value)
                            setHoveredModel(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                          autoFocus
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', maxHeight: '300px', display: 'flex' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {models
                            .filter((model) => {
                              if (!modelSearch) return true
                              const search = modelSearch.toLowerCase()
                              return (
                                model.name.toLowerCase().includes(search) ||
                                model.sku?.toLowerCase().includes(search) ||
                                model.description?.toLowerCase().includes(search)
                              )
                            })
                            .map((model) => (
                              <div
                                key={model.id}
                                onClick={() => {
                                  setFormData({ ...formData, model_id: model.id, material_id: '' })
                                  setMultimaterialMapping({
                                    color1: '',
                                    color2: '',
                                    color3: '',
                                    color4: '',
                                  })
                                  setShowModelDropdown(false)
                                  setHoveredModel(null)
                                  setModelSearch('')
                                }}
                                onMouseEnter={() => setHoveredModel(model)}
                                onMouseLeave={() => setHoveredModel(null)}
                                style={{
                                  padding: '10px 12px',
                                  cursor: 'pointer',
                                  background: formData.model_id === model.id ? '#e8f4f8' : 'white',
                                  borderBottom: '1px solid #f0f0f0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px'
                                }}
                              >
                                {model.photo_url && (
                                  <img
                                    src={model.photo_url}
                                    alt={model.name}
                                    style={{
                                      width: '40px',
                                      height: '40px',
                                      objectFit: 'cover',
                                      borderRadius: '4px',
                                      flexShrink: 0
                                    }}
                                  />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: '600', color: '#1a1a1a' }}>{model.name}</div>
                                  <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                                    {Math.round(parseFloat(model.weight_kg) * 1000)} g
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                        {hoveredModel && hoveredModel.photo_url && (
                          <div
                            style={{
                              width: '250px',
                              padding: '15px',
                              borderLeft: '1px solid #f0f0f0',
                              background: '#f8f9fa',
                              position: 'sticky',
                              top: 0,
                              alignSelf: 'flex-start'
                            }}
                            onMouseEnter={() => setHoveredModel(hoveredModel)}
                            onMouseLeave={() => setHoveredModel(null)}
                          >
                            <img
                              src={hoveredModel.photo_url}
                              alt={hoveredModel.name}
                              style={{
                                width: '100%',
                                aspectRatio: '1',
                                objectFit: 'cover',
                                borderRadius: '8px',
                                marginBottom: '10px'
                              }}
                            />
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' }}>
                              {hoveredModel.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                              Peso: {Math.round(parseFloat(hoveredModel.weight_kg) * 1000)} g
                            </div>
                            {hoveredModel.dimensions && (
                              <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>
                                {hoveredModel.dimensions} {!hoveredModel.dimensions.includes('cm') && 'cm'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {selectedModel?.is_multimaterial ? (
                <div className="form-group">
                  <label>Materiali per Colore</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
                    {[
                      { key: 'color1', label: 'Colore 1', required: true, weight: selectedModel.color1_weight_g },
                      { key: 'color2', label: 'Colore 2', required: true, weight: selectedModel.color2_weight_g },
                      ...(selectedModel.color3_weight_g ? [{ key: 'color3', label: 'Colore 3', required: false, weight: selectedModel.color3_weight_g }] : []),
                      ...(selectedModel.color4_weight_g ? [{ key: 'color4', label: 'Colore 4', required: false, weight: selectedModel.color4_weight_g }] : []),
                    ].map(({ key, label, required, weight }) => (
                      <div key={key} style={{ position: 'relative' }}>
                        <label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '5px', display: 'block' }}>
                          {label} {weight && `(${weight}g)`} {required && '*'}
                        </label>
                        <div
                          onClick={() => {
                            setShowMaterialDropdown(showMaterialDropdown === key ? false : key)
                            setShowModelDropdown(false)
                            if (showMaterialDropdown !== key) {
                              setMaterialSearch('')
                            }
                          }}
                          style={{
                            padding: '10px 12px',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            background: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ color: multimaterialMapping[key] ? '#1a1a1a' : '#6c757d', fontSize: '14px' }}>
                            {multimaterialMapping[key]
                              ? (() => {
                                  const material = materials.find((m) => m.id === multimaterialMapping[key])
                                  return material
                                    ? `${material.brand} - ${material.material_type} - ${material.color}`
                                    : 'Seleziona materiale...'
                                })()
                              : 'Seleziona materiale...'}
                          </span>
                          <span style={{ color: '#6c757d' }}>▼</span>
                        </div>
                        {multimaterialMapping[key] && (
                          <div className="form-group" style={{ marginTop: '10px' }}>
                            <label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '5px', display: 'block' }}>
                              Bobina per {label}
                            </label>
                            {multimaterialAvailableSpools[key]?.length === 0 ? (
                              <div style={{ padding: '10px', background: '#fff3cd', borderRadius: '4px', color: '#856404', fontSize: '14px' }}>
                                Nessuna bobina disponibile per questo materiale.
                              </div>
                            ) : (
                              <select
                                value={multimaterialSpools[key] || ''}
                                onChange={(e) => setMultimaterialSpools({ ...multimaterialSpools, [key]: e.target.value })}
                                required
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  border: '1px solid #ced4da',
                                  borderRadius: '4px',
                                  background: 'white',
                                  fontSize: '14px'
                                }}
                              >
                                <option value="">Seleziona una bobina...</option>
                                {multimaterialAvailableSpools[key]?.map((spool) => {
                                  const pricePerKg = parseFloat(spool.price || 0)
                                  return (
                                    <option key={spool.id} value={spool.id}>
                                      {spool.purchase_account} - €{pricePerKg.toFixed(2)}/kg - {parseFloat(spool.remaining_grams).toFixed(2)}g residui
                                    </option>
                                  )
                                })}
                              </select>
                            )}
                          </div>
                        )}
                        {showMaterialDropdown === key && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              zIndex: 1000,
                              marginTop: '4px',
                              background: 'white',
                              border: '1px solid #ddd',
                              borderRadius: '8px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                              maxHeight: '300px',
                              overflowY: 'auto'
                            }}
                          >
                            <div style={{ padding: '10px', borderBottom: '1px solid #f0f0f0' }}>
                              <input
                                type="text"
                                placeholder="Cerca materiale..."
                                value={materialSearch}
                                onChange={(e) => setMaterialSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '14px'
                                }}
                                autoFocus
                              />
                            </div>
                            <div>
                              {materials
                                .filter((material) => {
                                  const materialSpools = spools.filter(
                                    spool => spool.material_id === material.id && parseFloat(spool.remaining_grams) > 0
                                  )
                                  return materialSpools.length > 0
                                })
                                .filter((material) => {
                                  if (!materialSearch) return true
                                  const search = materialSearch.toLowerCase()
                                  return (
                                    material.brand.toLowerCase().includes(search) ||
                                    material.material_type.toLowerCase().includes(search) ||
                                    material.color.toLowerCase().includes(search) ||
                                    material.code?.toLowerCase().includes(search)
                                  )
                                })
                                .map((material) => (
                                  <div
                                    key={material.id}
                                    onClick={() => {
                                      setMultimaterialMapping({ ...multimaterialMapping, [key]: material.id })
                                      setMultimaterialSpools({ ...multimaterialSpools, [key]: '' })
                                      setShowMaterialDropdown(false)
                                      setMaterialSearch('')
                                    }}
                                    style={{
                                      padding: '10px 12px',
                                      cursor: 'pointer',
                                      background: multimaterialMapping[key] === material.id ? '#e8f4f8' : 'white',
                                      borderBottom: '1px solid #f0f0f0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '10px'
                                    }}
                                  >
                                    {material.bobina_photo_url && (
                                      <img
                                        src={material.bobina_photo_url}
                                        alt={material.brand}
                                        style={{
                                          width: '30px',
                                          height: '30px',
                                          objectFit: 'cover',
                                          borderRadius: '4px',
                                          flexShrink: 0
                                        }}
                                      />
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: '600', color: '#1a1a1a', fontSize: '14px' }}>{material.brand}</div>
                                      <div style={{ fontSize: '12px', color: '#7f8c8d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {material.material_type} -{' '}
                                        {material.color_hex && (
                                          <span
                                            style={{
                                              display: 'inline-block',
                                              width: '10px',
                                              height: '10px',
                                              borderRadius: '50%',
                                              backgroundColor: material.color_hex,
                                              border: '1px solid #ddd',
                                              flexShrink: 0
                                            }}
                                          />
                                        )}
                                        {material.color}{material.cost_per_kg ? ` - €${parseFloat(material.cost_per_kg).toFixed(2)}/kg` : ''}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <small>Seleziona un materiale per ogni colore utilizzato nel modello</small>
                </div>
              ) : (
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Materiale</label>
                  <div style={{ position: 'relative' }}>
                    <div
                      onClick={() => {
                        setShowMaterialDropdown(showMaterialDropdown === true ? false : true)
                        setShowModelDropdown(false)
                        if (showMaterialDropdown !== true) {
                          setMaterialSearch('')
                        }
                      }}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ color: formData.material_id ? '#1a1a1a' : '#6c757d' }}>
                        {formData.material_id
                          ? (() => {
                              const material = materials.find((m) => m.id === formData.material_id)
                              return material
                                ? `${material.brand} - ${material.material_type} - ${material.color}`
                                : 'Seleziona materiale...'
                            })()
                          : 'Seleziona materiale...'}
                      </span>
                      <span style={{ color: '#6c757d' }}>▼</span>
                    </div>
                    {showMaterialDropdown === true && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        marginTop: '4px',
                        background: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        maxHeight: '400px',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <div style={{ padding: '10px', borderBottom: '1px solid #f0f0f0' }}>
                        <input
                          type="text"
                          placeholder="Cerca materiale..."
                          value={materialSearch}
                          onChange={(e) => {
                            setMaterialSearch(e.target.value)
                            setHoveredMaterial(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                          autoFocus
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', maxHeight: '300px', display: 'flex' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {materials
                            .filter((material) => {
                              const materialSpools = spools.filter(
                                spool => spool.material_id === material.id && parseFloat(spool.remaining_grams) > 0
                              )
                              return materialSpools.length > 0
                            })
                            .filter((material) => {
                              if (!materialSearch) return true
                              const search = materialSearch.toLowerCase()
                              return (
                                material.brand.toLowerCase().includes(search) ||
                                material.material_type.toLowerCase().includes(search) ||
                                material.color.toLowerCase().includes(search) ||
                                material.code?.toLowerCase().includes(search)
                              )
                            })
                            .map((material) => (
                              <div
                                key={material.id}
                                onClick={() => {
                                  setFormData({ ...formData, material_id: material.id })
                                  setShowMaterialDropdown(false)
                                  setHoveredMaterial(null)
                                  setMaterialSearch('')
                                }}
                                onMouseEnter={() => setHoveredMaterial(material)}
                                onMouseLeave={() => setHoveredMaterial(null)}
                                style={{
                                  padding: '10px 12px',
                                  cursor: 'pointer',
                                  background: formData.material_id === material.id ? '#e8f4f8' : 'white',
                                  borderBottom: '1px solid #f0f0f0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px'
                                }}
                              >
                                {material.bobina_photo_url && (
                                  <img
                                    src={material.bobina_photo_url}
                                    alt={material.brand}
                                    style={{
                                      width: '40px',
                                      height: '40px',
                                      objectFit: 'cover',
                                      borderRadius: '4px',
                                      flexShrink: 0
                                    }}
                                  />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: '600', color: '#1a1a1a' }}>{material.brand}</div>
                                  <div style={{ fontSize: '12px', color: '#7f8c8d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {material.material_type} -{' '}
                                    {material.color_hex && (
                                      <span
                                        style={{
                                          display: 'inline-block',
                                          width: '12px',
                                          height: '12px',
                                          borderRadius: '50%',
                                          backgroundColor: material.color_hex,
                                          border: '1px solid #ddd',
                                          flexShrink: 0
                                        }}
                                      />
                                    )}
                                    {material.color} - €{parseFloat(material.cost_per_kg).toFixed(2)}/kg
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                        {hoveredMaterial && hoveredMaterial.bobina_photo_url && (
                          <div
                            style={{
                              width: '250px',
                              padding: '15px',
                              borderLeft: '1px solid #f0f0f0',
                              background: '#f8f9fa',
                              position: 'sticky',
                              top: 0,
                              alignSelf: 'flex-start'
                            }}
                            onMouseEnter={() => setHoveredMaterial(hoveredMaterial)}
                            onMouseLeave={() => setHoveredMaterial(null)}
                          >
                            <img
                              src={hoveredMaterial.bobina_photo_url}
                              alt={hoveredMaterial.brand}
                              style={{
                                width: '100%',
                                aspectRatio: '1',
                                objectFit: 'cover',
                                borderRadius: '8px',
                                marginBottom: '10px'
                              }}
                            />
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' }}>
                              {hoveredMaterial.brand}
                            </div>
                            <div style={{ fontSize: '12px', color: '#7f8c8d', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              {hoveredMaterial.material_type} -{' '}
                              {hoveredMaterial.color_hex && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    backgroundColor: hoveredMaterial.color_hex,
                                    border: '1px solid #ddd',
                                    flexShrink: 0
                                  }}
                                />
                              )}
                              {hoveredMaterial.color}
                            </div>
                            <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                              {hoveredMaterial.cost_per_kg ? `€${parseFloat(hoveredMaterial.cost_per_kg).toFixed(2)}/kg` : 'N/A'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {materials.filter((m) => {
                  const materialSpools = spools.filter(
                    spool => spool.material_id === m.id && parseFloat(spool.remaining_grams) > 0
                  )
                  return materialSpools.length > 0
                }).length === 0 && (
                  <small style={{ color: '#e74c3c', display: 'block', marginTop: '8px' }}>
                    Nessun materiale disponibile. Aggiungi bobine con grammi disponibili nella pagina Materiali.
                  </small>
                )}
              </div>
              )}
              {formData.material_id && !selectedModel?.is_multimaterial && (
                <div className="form-group">
                  <label>Bobina</label>
                  {availableSpools.length === 0 ? (
                    <div style={{ padding: '10px', background: '#fff3cd', borderRadius: '4px', color: '#856404', fontSize: '14px' }}>
                      Nessuna bobina disponibile per questo materiale. Crea una bobina nella pagina Materiali.
                    </div>
                  ) : (
                    <select
                      value={formData.spool_id}
                      onChange={(e) => setFormData({ ...formData, spool_id: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        background: 'white',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">Seleziona una bobina...</option>
                      {availableSpools.map((spool) => {
                        const pricePerKg = parseFloat(spool.price || 0)
                        return (
                          <option key={spool.id} value={spool.id}>
                            {spool.purchase_account} - €{pricePerKg.toFixed(2)}/kg - {parseFloat(spool.remaining_grams).toFixed(2)}g residui
                          </option>
                        )
                      })}
                    </select>
                  )}
                  {formData.spool_id && selectedModel && (
                    <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                      Peso prodotto: {(parseFloat(selectedModel.weight_kg) * 1000).toFixed(2)}g
                      {(() => {
                        const selectedSpool = availableSpools.find(s => s.id === formData.spool_id)
                        if (selectedSpool) {
                          const weightGrams = parseFloat(selectedModel.weight_kg) * 1000
                          const remaining = parseFloat(selectedSpool.remaining_grams)
                          const after = remaining - weightGrams
                          return ` | Residuo dopo: ${after.toFixed(2)}g`
                        }
                        return ''
                      })()}
                    </small>
                  )}
                </div>
              )}
              <div className="form-group">
                <label>Accessori usati</label>
                {accessoryUsages.length === 0 ? (
                  <small style={{ color: '#7f8c8d', display: 'block', marginBottom: '8px' }}>
                    Nessun accessorio selezionato
                  </small>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                    {accessoryUsages.map((usage, index) => (
                      <div key={`acc-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: '8px', alignItems: 'center' }}>
                        <select
                          value={usage.accessory_id}
                          onChange={(e) => {
                            const updated = [...accessoryUsages]
                            updated[index] = { ...updated[index], accessory_id: e.target.value }
                            setAccessoryUsages(updated)
                          }}
                        >
                          <option value="">Seleziona accessorio</option>
                          {accessories.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} (disp. {getAccessoryAvailableQty(acc.id)})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={usage.quantity}
                          onChange={(e) => {
                            const updated = [...accessoryUsages]
                            updated[index] = { ...updated[index], quantity: e.target.value }
                            setAccessoryUsages(updated)
                          }}
                          placeholder="Qtà"
                        />
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            const updated = accessoryUsages.filter((_, i) => i !== index)
                            setAccessoryUsages(updated)
                          }}
                        >
                          Rimuovi
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setAccessoryUsages([...accessoryUsages, { accessory_id: '', quantity: 1 }])}
                >
                  + Aggiungi accessorio
                </button>
              </div>

              {formData.model_id && (
                (selectedModel?.is_multimaterial 
                  ? (multimaterialMapping.color1 && multimaterialMapping.color2)
                  : formData.material_id && formData.spool_id
                ) && (() => {
                  const baseCost = selectedModel?.is_multimaterial
                    ? parseFloat(calculateProductionCost(formData.model_id, null, multimaterialMapping, multimaterialSpools))
                    : (() => {
                        const spool = spools.find((s) => s.id === formData.spool_id)
                        if (spool && selectedModel) {
                          return parseFloat(selectedModel.weight_kg) * parseFloat(spool.price || 0)
                        }
                        return 0
                      })()
                  const accessoryCost = calculateAccessoryCost(accessoryUsages)
                  const productionCost = baseCost + accessoryCost
                  
                  return (
                    <div className="cost-preview">
                      <div style={{ marginBottom: '15px' }}>
                        <strong>Costo di produzione calcolato: €{productionCost.toFixed(2)}</strong>
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '10px',
                        padding: '15px',
                        background: '#f8f9fa',
                        borderRadius: '6px',
                        border: '1px solid #e9ecef'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#7f8c8d', fontSize: '14px' }}>Prezzo minimo (2.5x):</span>
                          <strong style={{ color: '#e74c3c', fontSize: '16px' }}>
                            €{(productionCost * 2.5).toFixed(2)}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#7f8c8d', fontSize: '14px' }}>Prezzo consigliato (8x):</span>
                          <strong style={{ color: '#27ae60', fontSize: '16px' }}>
                            €{(productionCost * 8).toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )
                })()
              )}
              <div className="form-group">
                <label>Prezzo di Vendita (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.sale_price}
                  onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                  required
                  placeholder="0.00"
                />
                <small>I costi di imballaggio e amministrativi verranno calcolati in base al canale di vendita configurato nelle Impostazioni</small>
                {formData.model_id && (() => {
                  // Trova tutti i prodotti con lo stesso modello (esclusi quelli in coda)
                  const sameModelProducts = products.filter(p => 
                    p.model_id === formData.model_id && 
                    p.status !== 'in_coda' &&
                    p.status !== 'in_stampa'
                  )
                  
                  if (sameModelProducts.length === 0) {
                    return null
                  }
                  
                  // Raggruppa per stato e calcola statistiche
                  const availableProducts = sameModelProducts.filter(p => p.status === 'disponibile')
                  const soldProducts = sameModelProducts.filter(p => p.status === 'venduto')
                  
                  const availablePrices = availableProducts.map(p => parseFloat(p.sale_price || 0))
                  const soldPrices = soldProducts.map(p => parseFloat(p.sale_price || 0))
                  
                  const avgAvailable = availablePrices.length > 0 
                    ? availablePrices.reduce((a, b) => a + b, 0) / availablePrices.length 
                    : null
                  const avgSold = soldPrices.length > 0 
                    ? soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length 
                    : null
                  const minPrice = sameModelProducts.length > 0
                    ? Math.min(...sameModelProducts.map(p => parseFloat(p.sale_price || 0)))
                    : null
                  const maxPrice = sameModelProducts.length > 0
                    ? Math.max(...sameModelProducts.map(p => parseFloat(p.sale_price || 0)))
                    : null
                  
                  return (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: '#f8f9fa',
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0'
                    }}>
                      <div style={{ 
                        fontSize: '13px', 
                        fontWeight: '600', 
                        color: '#1a1a1a', 
                        marginBottom: '8px' 
                      }}>
                        Prezzi altri prodotti di questo modello:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                        {availableProducts.length > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#27ae60' }}>
                            <span>Disponibili ({availableProducts.length}):</span>
                            <span style={{ fontWeight: '600' }}>
                              {avgAvailable !== null ? `Media: €${avgAvailable.toFixed(2)}` : 'N/A'}
                            </span>
                          </div>
                        )}
                        {soldProducts.length > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#3498db' }}>
                            <span>Venduti ({soldProducts.length}):</span>
                            <span style={{ fontWeight: '600' }}>
                              {avgSold !== null ? `Media: €${avgSold.toFixed(2)}` : 'N/A'}
                            </span>
                          </div>
                        )}
                        {minPrice !== null && maxPrice !== null && (
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            color: '#7f8c8d',
                            marginTop: '4px',
                            paddingTop: '6px',
                            borderTop: '1px solid #e0e0e0'
                          }}>
                            <span>Range:</span>
                            <span style={{ fontWeight: '600' }}>
                              €{minPrice.toFixed(2)} - €{maxPrice.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); resetForm() }}>
                  Annulla
                </button>
                <button type="submit" className="btn-primary">
                  Crea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
