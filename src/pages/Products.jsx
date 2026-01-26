import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { processAndUploadImage, deleteImageFromStorage, validateImageFile } from '../lib/imageUpload'
import { logAction } from '../lib/logging'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faDollarSign, faTrash, faPlus, faTimes, faMinus, faEdit } from '@fortawesome/free-solid-svg-icons'
import ReactCountryFlag from 'react-country-flag'
import './Products.css'

export default function Products() {
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [materials, setMaterials] = useState([])
  const [models, setModels] = useState([])
  const [vatRegimes, setVatRegimes] = useState([])
  const [spools, setSpools] = useState([])
  const [availableSpools, setAvailableSpools] = useState([]) // Bobine disponibili per il materiale selezionato
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [productsPerPage, setProductsPerPage] = useState(50)
  const [productsPage, setProductsPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('disponibile') // 'tutti', 'disponibile', 'venduto'
  const [showModal, setShowModal] = useState(false)
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [detailProduct, setDetailProduct] = useState(null)
  const [editFormData, setEditFormData] = useState({
    material_id: '',
    spool_id: '',
  })
  const [editAvailableSpools, setEditAvailableSpools] = useState([])
  const [productionExtraCosts, setProductionExtraCosts] = useState([])
  const [savingProductionCosts, setSavingProductionCosts] = useState(false)
  const [hoveredModel, setHoveredModel] = useState(null)
  const [hoveredMaterial, setHoveredMaterial] = useState(null)
  const [hoveredMaterialCard, setHoveredMaterialCard] = useState(null)
  const [hoveredModelCard, setHoveredModelCard] = useState(null)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false) // false o 'color1', 'color2', 'color3', 'color4'
  const [modelSearch, setModelSearch] = useState('')
  const [materialSearch, setMaterialSearch] = useState('')
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [formData, setFormData] = useState({
    model_id: '',
    material_id: '',
    spool_id: '',
    sale_price: '',
  })
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
  const [saleFormData, setSaleFormData] = useState({ 
    final_sale_price: '',
    sales_channel: '',
    vat_regime: '',
    extra_costs: []
  })

  useEffect(() => {
    loadData()
  }, [])

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

  const loadData = async () => {
    const [materialsRes, modelsRes, productsRes, vatRegimesRes, spoolsRes] = await Promise.all([
      supabase.from('materials').select('*').order('brand'),
      supabase.from('models').select('*').order('name'),
      supabase
        .from('products')
        .select(`
          *,
          models(name, weight_kg, photo_url, description, dimensions, sku, is_multimaterial),
          materials(brand, material_type, color, color_hex, purchased_from, cost_per_kg, bobina_photo_url, print_example_photo_url, code, status)
        `)
        .order('created_at', { ascending: false }),
      supabase.from('vat_regimes').select('*').order('vat_rate'),
      supabase.from('spools').select('*').order('created_at', { ascending: false }),
    ])

    setMaterials(materialsRes.data || [])
    setModels(modelsRes.data || [])
    setProducts(productsRes.data || [])
    setVatRegimes(vatRegimesRes.data || [])
    setSpools(spoolsRes.data || [])
    applySearchFilter(productsRes.data || [], searchQuery, sortBy, statusFilter)
    setLoading(false)
  }

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

  // Carica le bobine disponibili quando si modifica un prodotto
  useEffect(() => {
    if (editFormData.material_id && editingProduct) {
      const productModel = models.find(m => m.id === editingProduct.model_id)
      const isSold = editingProduct.status === 'venduto'
      
      if (productModel && !productModel.is_multimaterial) {
        // Calcola il peso necessario in grammi
        const requiredGrams = parseFloat(productModel.weight_kg) * 1000
        
        // Per prodotti venduti, mostra tutte le bobine del materiale (non scaliamo grammi)
        // Per prodotti non venduti, filtra solo quelle con grammi sufficienti
        const materialSpools = isSold
          ? spools.filter(spool => spool.material_id === editFormData.material_id)
          : spools.filter(
              spool => spool.material_id === editFormData.material_id && 
                       parseFloat(spool.remaining_grams) >= requiredGrams
            )
        setEditAvailableSpools(materialSpools)
        
        // Seleziona di default una bobina già consumata se presente, altrimenti la prima disponibile
        if (materialSpools.length > 0 && !editFormData.spool_id) {
          const consumedSpool = materialSpools.find(s => parseFloat(s.remaining_grams) < 1000)
          const defaultSpoolId = consumedSpool ? consumedSpool.id : materialSpools[0].id
          setEditFormData({ ...editFormData, spool_id: defaultSpoolId })
        }
      } else if (productModel?.is_multimaterial) {
        // Per modelli multimateriale, mostra tutte le bobine del materiale
        // (se venduto, anche con 0g; altrimenti solo con grammi > 0)
        const materialSpools = isSold
          ? spools.filter(spool => spool.material_id === editFormData.material_id)
          : spools.filter(spool => spool.material_id === editFormData.material_id && parseFloat(spool.remaining_grams) > 0)
        setEditAvailableSpools(materialSpools)
      } else {
        setEditAvailableSpools([])
      }
    } else {
      setEditAvailableSpools([])
    }
  }, [editFormData.material_id, editingProduct, spools, models])

  const applySearchFilter = (productsList, query, sortValue, statusValue = 'tutti') => {
    // Escludi prodotti con stato "in_coda" o "in_stampa" dalla pagina Prodotti
    let filtered = productsList.filter(product => !['in_coda', 'in_stampa'].includes(product.status))
    
    // Filtro per status
    if (statusValue === 'disponibile') {
      filtered = filtered.filter(product => product.status === 'disponibile')
    } else if (statusValue === 'venduto') {
      filtered = filtered.filter(product => product.status === 'venduto')
    }
    // Se statusValue === 'tutti', non filtrare per status

    // Filtro ricerca
    if (query.trim()) {
      const queryLower = query.toLowerCase()
      filtered = filtered.filter((product) => {
        // Cerca nello SKU
        if (product.sku?.toLowerCase().includes(queryLower)) return true
        
        // Cerca nel nome del modello
        if (product.models?.name?.toLowerCase().includes(queryLower)) return true
        
        // Cerca nel brand del materiale
        if (product.materials?.brand?.toLowerCase().includes(queryLower)) return true
        
        // Cerca nel tipo di materiale
        if (product.materials?.material_type?.toLowerCase().includes(queryLower)) return true
        
        // Cerca nel colore del materiale
        if (product.materials?.color?.toLowerCase().includes(queryLower)) return true
        
        return false
      })
    }

    // Ordinamento
    filtered.sort((a, b) => {
      if (sortValue === 'nome_crescente') {
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
      } else if (sortValue === 'stato_crescente') {
        return (a.status || '').localeCompare(b.status || '')
      } else if (sortValue === 'stato_decrescente') {
        return (b.status || '').localeCompare(a.status || '')
      } else {
        // Default: ordina per data di creazione (più recenti prima)
        const dateA = new Date(a.created_at || 0)
        const dateB = new Date(b.created_at || 0)
        return dateB - dateA
      }
    })

    setFilteredProducts(filtered)
  }

  useEffect(() => {
    applySearchFilter(products, searchQuery, sortBy, statusFilter)
  }, [searchQuery, sortBy, products, statusFilter])

  useEffect(() => {
    setProductsPage(1)
  }, [filteredProducts, productsPerPage])

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

  // Carica le bobine disponibili per ogni materiale multimateriale selezionato (per creazione)
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

  // Carica le bobine disponibili per prodotti multimateriale in modifica
  useEffect(() => {
    if (!editingProduct) return
    const productModel = models.find(m => m.id === editingProduct.model_id)
    if (!productModel?.is_multimaterial) return

    const isSold = editingProduct.status === 'venduto'
    const colorKeys = ['color1', 'color2', 'color3', 'color4']
    const newAvailableSpools = { ...multimaterialAvailableSpools }

    colorKeys.forEach((colorKey) => {
      const materialId = multimaterialMapping[colorKey]
      if (materialId) {
        const weightGrams = parseFloat(productModel[`${colorKey}_weight_g`] || 0)
        // Per prodotti venduti, mostra tutte le bobine (anche con 0g)
        // Per prodotti non venduti, filtra solo quelle con grammi sufficienti
        const materialSpools = isSold
          ? spools.filter(spool => spool.material_id === materialId)
          : spools.filter(
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
  }, [multimaterialMapping, editingProduct, models, spools])

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

    const {
      data: { user },
    } = await supabase.auth.getUser()

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
      alert('Errore durante la creazione: ' + error.message)
    } else {
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

  const handleStatusChange = async (productId, newStatus) => {
    const updateData = { status: newStatus }
    if (newStatus === 'venduto') {
      const product = products.find((p) => p.id === productId)
      setSelectedProduct(product)
      setSaleFormData({ 
        final_sale_price: product?.sale_price || '',
        sales_channel: '',
        vat_regime: '',
        extra_costs: product?.extra_costs || []
      })
      setShowSaleModal(true)
      return
    }
    if (newStatus === 'disponibile') {
      updateData.sold_at = null
      updateData.final_sale_price = null
      updateData.vat_regime = null
      updateData.extra_costs = null
    }

    const product = products.find((p) => p.id === productId)
    const { error } = await supabase.from('products').update(updateData).eq('id', productId)

    if (error) {
      alert('Errore durante l\'aggiornamento: ' + error.message)
    } else {
      // Log dell'operazione
      await logAction(
        'modifica_prodotto',
        'prodotto',
        productId,
        product?.sku || 'Prodotto sconosciuto',
        { changes: updateData }
      )
      await loadData()
    }
  }

  const handleSaleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedProduct) return

    // Prodotti sono sempre unici, quindi quantity_sold è sempre 1
    const quantitySold = 1
    const currentQuantity = selectedProduct.quantity || 0

    if (currentQuantity === 0) {
      alert('Questo prodotto è già stato venduto')
      return
    }

    if (!saleFormData.sales_channel) {
      alert('Seleziona un canale di vendita')
      return
    }

    if (!saleFormData.vat_regime) {
      alert('Seleziona un regime IVA')
      return
    }

    try {
      // Recupera i costi del canale di vendita
      const { data: channelSettings, error: channelError } = await supabase
        .from('sales_channels_settings')
        .select('*')
        .eq('channel_name', saleFormData.sales_channel)
        .single()

      if (channelError && channelError.code !== 'PGRST116') {
        throw new Error('Errore nel recupero delle impostazioni del canale: ' + channelError.message)
      }

      // Recupera il VAT rate dal regime IVA selezionato
      const selectedVatRegime = vatRegimes.find(r => r.name === saleFormData.vat_regime)
      const vatRate = selectedVatRegime ? parseFloat(selectedVatRegime.vat_rate) : 0

      // Calcola i costi di produzione
      const productionCostBase = parseFloat(selectedProduct.production_cost || 0)
      const productionExtraCosts = selectedProduct.production_extra_costs || []
      const productionExtraTotal = productionExtraCosts.reduce((sum, cost) => sum + (parseFloat(cost.amount || 0) || 0), 0)
      const totalProductionCost = productionCostBase + productionExtraTotal

      // Recupera i costi del canale (o usa 0 se non configurati)
      const packagingCost = parseFloat(channelSettings?.packaging_cost || 0)
      const administrativeCost = parseFloat(channelSettings?.administrative_base_cost || 0)
      const promotionCostType = channelSettings?.promotion_cost_type || 'fixed'
      const promotionCostPercent = parseFloat(channelSettings?.promotion_cost_percent || 0)
      const promotionCostPercentBase = channelSettings?.promotion_cost_percent_base || 'gross'

      // Calcola i costi extra della vendita
      const extraCosts = saleFormData.extra_costs || []
      const extraCostsTotal = extraCosts.reduce((sum, cost) => sum + (parseFloat(cost.amount || 0) || 0), 0)

      // Calcola i totali
      const salePrice = parseFloat(saleFormData.final_sale_price)
      // revenue è il ricavo totale per la vendita (prezzo * quantità)
      const revenue = salePrice * quantitySold
      
      // Calcola l'IVA da versare (assumendo che il prezzo includa già l'IVA)
      // Formula: IVA = revenue * (vat_rate / (100 + vat_rate))
      const vatAmount = vatRate > 0 ? revenue * (vatRate / (100 + vatRate)) : 0

      // Calcola il costo sponsorizzazione (fisso o percentuale)
      const vatAmountPerProduct = vatRate > 0 ? salePrice * (vatRate / (100 + vatRate)) : 0
      const promotionBasePrice = promotionCostPercentBase === 'net'
        ? (salePrice - vatAmountPerProduct)
        : salePrice
      const rawPromotionCost = promotionCostType === 'percent'
        ? (promotionBasePrice * (promotionCostPercent / 100))
        : parseFloat(channelSettings?.promotion_cost_per_product || 0)
      const promotionCost = isNaN(rawPromotionCost) || rawPromotionCost < 0
        ? 0
        : parseFloat(rawPromotionCost.toFixed(2))

      // totalCosts è il costo per singolo prodotto
      const totalCostsPerProduct = totalProductionCost + packagingCost + administrativeCost + promotionCost + extraCostsTotal
      
      // profit è il profitto totale (ricavo - costi totali - IVA da versare)
      const profit = revenue - (totalCostsPerProduct * quantitySold) - vatAmount

      // Calcola il breakdown dei costi di produzione per account
      // Questo mappa ogni materiale/bobina utilizzata al suo account di acquisto
      let productionCostByAccount = []
      let spoolPurchaseAccount = null
      let spoolId = null
      
      // Controlla se il prodotto è multimateriale
      const productModel = models.find(m => m.id === selectedProduct.model_id)
      const isMultimaterial = productModel?.is_multimaterial
      
      if (isMultimaterial && selectedProduct.multimaterial_mapping) {
        // Per prodotti multimateriale, calcola il costo per ogni materiale/bobina
        const mapping = Array.isArray(selectedProduct.multimaterial_mapping) 
          ? selectedProduct.multimaterial_mapping 
          : []
        
        // Raggruppa i costi per account
        const costByAccountMap = {}
        
        // Recupera tutte le bobine necessarie dal database in una singola query
        const spoolIds = mapping.map(m => m.spool_id).filter(Boolean)
        if (spoolIds.length > 0) {
          const { data: spoolsData } = await supabase
            .from('spools')
            .select('id, purchase_account, price')
            .in('id', spoolIds)
          
          const spoolsMap = {}
          if (spoolsData) {
            spoolsData.forEach(spool => {
              spoolsMap[spool.id] = spool
            })
          }
          
          for (const colorMapping of mapping) {
            if (!colorMapping.spool_id) continue
            
            const spool = spoolsMap[colorMapping.spool_id]
            if (!spool || !spool.purchase_account) continue
            
            // Trova il peso per questo colore
            const colorKey = `color${colorMapping.color}`
            const weightGrams = parseFloat(productModel[`${colorKey}_weight_g`] || 0)
            const weightKg = weightGrams / 1000
            
            // Calcola il costo per questo materiale
            const costForThisMaterial = weightKg * parseFloat(spool.price || 0)
            
            // Aggiungi al totale per questo account
            if (!costByAccountMap[spool.purchase_account]) {
              costByAccountMap[spool.purchase_account] = {
                account: spool.purchase_account,
                cost: 0
              }
            }
            
            costByAccountMap[spool.purchase_account].cost += costForThisMaterial
          }
        }
        
        // Converti la mappa in array
        productionCostByAccount = Object.values(costByAccountMap).map(item => ({
          account: item.account,
          cost: parseFloat(item.cost.toFixed(2))
        }))
        
        // Per retrocompatibilità, mantieni spool_id e spool_purchase_account del primo colore
        if (mapping.length > 0 && mapping[0].spool_id) {
          spoolId = mapping[0].spool_id
          const { data: firstSpoolData } = await supabase
            .from('spools')
            .select('purchase_account')
            .eq('id', mapping[0].spool_id)
            .single()
          spoolPurchaseAccount = firstSpoolData?.purchase_account || null
        }
      } else if (selectedProduct.spool_id) {
        // Per prodotti non multimateriale, usa spool_id direttamente
        spoolId = selectedProduct.spool_id
        const { data: spoolData } = await supabase
          .from('spools')
          .select('purchase_account, price')
          .eq('id', selectedProduct.spool_id)
          .single()
        
        spoolPurchaseAccount = spoolData?.purchase_account || null
        
        // Calcola il costo per questo account
        if (spoolData && spoolData.purchase_account) {
          const weightKg = productModel ? parseFloat(productModel.weight_kg || 0) : 0
          const cost = weightKg * parseFloat(spoolData.price || 0)
          
          productionCostByAccount = [{
            account: spoolData.purchase_account,
            cost: parseFloat(cost.toFixed(2))
          }]
        }
      }

      // Prepara i dati per la tabella sales
      const saleData = {
        product_id: selectedProduct.id,
        sku: selectedProduct.sku,
        model_id: selectedProduct.model_id,
        model_name: selectedProduct.models?.name || null,
        model_sku: selectedProduct.models?.sku || null,
        material_id: selectedProduct.material_id,
        material_brand: selectedProduct.materials?.brand || null,
        material_type: selectedProduct.materials?.material_type || null,
        material_color: selectedProduct.materials?.color || null,
        material_color_hex: selectedProduct.materials?.color_hex || null,
        spool_id: spoolId || selectedProduct.spool_id || null,
        spool_purchase_account: spoolPurchaseAccount,
        production_cost_by_account: productionCostByAccount,
        quantity_sold: quantitySold,
        sale_price: salePrice,
        sales_channel: saleFormData.sales_channel,
        vat_regime: saleFormData.vat_regime,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        production_cost_base: productionCostBase,
        production_extra_costs: productionExtraCosts,
        total_production_cost: totalProductionCost,
        packaging_cost: packagingCost,
        administrative_cost: administrativeCost,
        promotion_cost: promotionCost,
        extra_costs: extraCosts,
        total_costs: totalCostsPerProduct, // Costo per singolo prodotto
        revenue: revenue,
        profit: profit,
        sold_at: new Date().toISOString()
      }

      // Salva nella tabella sales
      const { error: saleError } = await supabase
        .from('sales')
        .insert(saleData)

      if (saleError) {
        throw new Error('Errore nel salvataggio della vendita: ' + saleError.message)
      }

      // Aggiorna il prodotto (quantità e status)
      const newQuantity = currentQuantity - quantitySold
      const updateData = {
        status: newQuantity > 0 ? 'disponibile' : 'venduto',
        final_sale_price: salePrice,
        sales_channel: saleFormData.sales_channel,
        quantity_sold: quantitySold,
        quantity: newQuantity,
        sold_at: new Date().toISOString(),
        vat_regime: saleFormData.vat_regime,
        extra_costs: extraCosts.length > 0 ? extraCosts : null,
      }

      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', selectedProduct.id)

      if (updateError) {
        throw new Error('Errore durante l\'aggiornamento del prodotto: ' + updateError.message)
      }

      await loadData()
      setShowSaleModal(false)
      setSelectedProduct(null)
      setSaleFormData({ final_sale_price: '', sales_channel: '', vat_regime: '', extra_costs: [] })
      alert('Vendita registrata con successo!')
    } catch (error) {
      console.error('Error:', error)
      alert('Errore durante la vendita: ' + error.message)
    }
  }

  const handleEditProduct = (product) => {
    // Permetti modifica anche per prodotti multimateriale e venduti
    const productModel = models.find(m => m.id === product.model_id)
    const isMultimaterial = productModel?.is_multimaterial
    const isSold = product.status === 'venduto'
    
    setEditingProduct(product)
    
    if (isMultimaterial) {
      // Per prodotti multimateriale, carica il mapping
      const mapping = Array.isArray(product.multimaterial_mapping) 
        ? product.multimaterial_mapping 
        : []
      
      const multimaterialMapping = {}
      const multimaterialSpoolsMapping = {}
      
      mapping.forEach(item => {
        if (item.color) {
          const colorKey = `color${item.color}`
          multimaterialMapping[colorKey] = item.material_id || ''
          multimaterialSpoolsMapping[colorKey] = item.spool_id || ''
        }
      })
      
      setMultimaterialMapping({
        color1: multimaterialMapping.color1 || '',
        color2: multimaterialMapping.color2 || '',
        color3: multimaterialMapping.color3 || '',
        color4: multimaterialMapping.color4 || '',
      })
      setMultimaterialSpools({
        color1: multimaterialSpoolsMapping.color1 || '',
        color2: multimaterialSpoolsMapping.color2 || '',
        color3: multimaterialSpoolsMapping.color3 || '',
        color4: multimaterialSpoolsMapping.color4 || '',
      })
    }
    
    setEditFormData({
      material_id: product.material_id || '',
      spool_id: product.spool_id || '',
    })
    
    setShowEditModal(true)
  }

  const handleUpdateProduct = async (e) => {
    e.preventDefault()
    
    if (!editingProduct) return
    
    const productModel = models.find(m => m.id === editingProduct.model_id)
    if (!productModel) {
      alert('Modello non trovato')
      return
    }
    
    const isSold = editingProduct.status === 'venduto'
    const isMultimaterial = productModel.is_multimaterial
    
    try {
      let newProductionCost = 0
      let updateData = {}
      let productionCostByAccount = []
      let mappingForDb = null // Dichiarato all'inizio per essere disponibile in tutto il blocco
      
      if (isMultimaterial) {
        // Gestione prodotti multimateriale
        const selectedMaterials = [
          { color: 1, materialId: multimaterialMapping.color1 },
          { color: 2, materialId: multimaterialMapping.color2 },
          ...(multimaterialMapping.color3 ? [{ color: 3, materialId: multimaterialMapping.color3 }] : []),
          ...(multimaterialMapping.color4 ? [{ color: 4, materialId: multimaterialMapping.color4 }] : []),
        ].filter(item => item.materialId)
        
        if (selectedMaterials.length === 0) {
          alert('Seleziona almeno un materiale')
          return
        }
        
        // Valida che tutte le bobine siano selezionate
        for (const { color } of selectedMaterials) {
          const colorKey = `color${color}`
          if (!multimaterialSpools[colorKey]) {
            alert(`Seleziona una bobina per Colore ${color}`)
            return
          }
        }
        
        // Calcola costi per ogni bobina e raggruppa per account
        const costByAccountMap = {}
        mappingForDb = []
        
        for (const { color, materialId } of selectedMaterials) {
          const colorKey = `color${color}`
          const spoolId = multimaterialSpools[colorKey]
          const spool = spools.find(s => s.id === spoolId)
          
          if (!spool) {
            alert(`Bobina per Colore ${color} non trovata`)
            return
          }
          
          const weightGrams = parseFloat(productModel[`${colorKey}_weight_g`] || 0)
          const weightKg = weightGrams / 1000
          const costForThisMaterial = weightKg * parseFloat(spool.price || 0)
          
          newProductionCost += costForThisMaterial
          
          // Raggruppa per account
          if (spool.purchase_account) {
            if (!costByAccountMap[spool.purchase_account]) {
              costByAccountMap[spool.purchase_account] = { account: spool.purchase_account, cost: 0 }
            }
            costByAccountMap[spool.purchase_account].cost += costForThisMaterial
          }
          
          mappingForDb.push({
            color,
            material_id: materialId,
            spool_id: spoolId,
          })
        }
        
        productionCostByAccount = Object.values(costByAccountMap).map(item => ({
          account: item.account,
          cost: parseFloat(item.cost.toFixed(2))
        }))
        
        updateData = {
          material_id: mappingForDb[0].material_id, // Primo materiale per retrocompatibilità
          multimaterial_mapping: mappingForDb,
          production_cost: newProductionCost,
        }
        
        // Per prodotti venduti, non scalare i grammi
        if (!isSold) {
          // Gestione grammi per prodotti non venduti
          const oldMapping = Array.isArray(editingProduct.multimaterial_mapping) 
            ? editingProduct.multimaterial_mapping 
            : []
          
          // Ripristina grammi dalle vecchie bobine
          for (const oldItem of oldMapping) {
            if (oldItem.spool_id) {
              const newMappingItem = mappingForDb.find(m => m.color === oldItem.color)
              if (!newMappingItem || newMappingItem.spool_id !== oldItem.spool_id) {
                // La bobina è cambiata, ripristina grammi
                const weightGrams = parseFloat(productModel[`color${oldItem.color}_weight_g`] || 0)
                const { data: oldSpoolData } = await supabase
                  .from('spools')
                  .select('remaining_grams')
                  .eq('id', oldItem.spool_id)
                  .single()
                
                if (oldSpoolData) {
                  const restoredGrams = parseFloat(oldSpoolData.remaining_grams || 0) + weightGrams
                  await supabase
                    .from('spools')
                    .update({ remaining_grams: restoredGrams })
                    .eq('id', oldItem.spool_id)
                }
              }
            }
          }
          
          // Scala grammi dalle nuove bobine (solo quelle che sono cambiate)
          for (const { color, spool_id } of mappingForDb) {
            const oldItem = oldMapping.find(m => m.color === color)
            if (!oldItem || oldItem.spool_id !== spool_id) {
              const weightGrams = parseFloat(productModel[`color${color}_weight_g`] || 0)
              const { data: newSpoolData } = await supabase
                .from('spools')
                .select('remaining_grams')
                .eq('id', spool_id)
                .single()
              
              if (newSpoolData) {
                const currentGrams = parseFloat(newSpoolData.remaining_grams || 0)
                if (weightGrams > currentGrams) {
                  alert(`La bobina per Colore ${color} ha solo ${currentGrams.toFixed(2)}g disponibili, ma richiede ${weightGrams.toFixed(2)}g`)
                  return
                }
                
                const newGrams = currentGrams - weightGrams
                await supabase
                  .from('spools')
                  .update({ remaining_grams: newGrams })
                  .eq('id', spool_id)
              }
            }
          }
        }
      } else {
        // Gestione prodotti non multimateriale
        if (!editFormData.material_id) {
          alert('Seleziona un materiale')
          return
        }
        
        if (!editFormData.spool_id) {
          alert('Seleziona una bobina')
          return
        }
        
        const selectedSpool = spools.find(s => s.id === editFormData.spool_id)
        if (!selectedSpool) {
          alert('Bobina non trovata')
          return
        }
        
        const weightGrams = parseFloat(productModel.weight_kg) * 1000
        const spoolPrice = parseFloat(selectedSpool.price || 0)
        newProductionCost = parseFloat(productModel.weight_kg) * spoolPrice
        
        productionCostByAccount = selectedSpool.purchase_account ? [{
          account: selectedSpool.purchase_account,
          cost: parseFloat(newProductionCost.toFixed(2))
        }] : []
        
        updateData = {
          material_id: editFormData.material_id,
          spool_id: editFormData.spool_id,
          production_cost: newProductionCost,
        }
        
        // Per prodotti venduti, non scalare i grammi
        if (!isSold) {
          // Gestione grammi per prodotti non venduti
          const hadOldSpool = editingProduct.spool_id && editingProduct.spool_id !== editFormData.spool_id
          
          if (hadOldSpool) {
            // Ripristina grammi dalla bobina vecchia
            const { data: oldSpoolData } = await supabase
              .from('spools')
              .select('remaining_grams')
              .eq('id', editingProduct.spool_id)
              .single()
            
            if (oldSpoolData) {
              const restoredGrams = parseFloat(oldSpoolData.remaining_grams || 0) + weightGrams
              await supabase
                .from('spools')
                .update({ remaining_grams: restoredGrams })
                .eq('id', editingProduct.spool_id)
            }
          }
          
          // Verifica disponibilità e scala grammi dalla bobina nuova (solo per prodotti non venduti)
          if (!isSold) {
            const { data: newSpoolData } = await supabase
              .from('spools')
              .select('remaining_grams')
              .eq('id', editFormData.spool_id)
              .single()
            
            if (newSpoolData) {
              const currentGrams = parseFloat(newSpoolData.remaining_grams || 0)
              if (weightGrams > currentGrams) {
                alert(`La bobina selezionata ha solo ${currentGrams.toFixed(2)}g disponibili, ma il prodotto richiede ${weightGrams.toFixed(2)}g`)
                return
              }
              
              const newGrams = currentGrams - weightGrams
              await supabase
                .from('spools')
                .update({ remaining_grams: newGrams })
                .eq('id', editFormData.spool_id)
            }
          }
        }
      }
      
      // Aggiorna il prodotto
      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', editingProduct.id)
      
      if (updateError) {
        throw new Error('Errore durante l\'aggiornamento del prodotto: ' + updateError.message)
      }
      
      // Se il prodotto è venduto, aggiorna anche la vendita associata (più recente)
      if (isSold) {
        const { data: salesDataArray, error: salesFetchError } = await supabase
          .from('sales')
          .select('*')
          .eq('product_id', editingProduct.id)
          .order('created_at', { ascending: false })
          .limit(1)
        
        if (salesFetchError) {
          console.error('Errore nel recupero della vendita:', salesFetchError)
          throw new Error('Errore nel recupero della vendita associata: ' + salesFetchError.message)
        }
        
        if (!salesDataArray || salesDataArray.length === 0) {
          console.warn('Nessuna vendita trovata per il prodotto:', editingProduct.id)
          // Non blocchiamo l'operazione se non c'è una vendita, ma avvisiamo l'utente
          alert('Il prodotto è stato aggiornato, ma non è stata trovata una vendita associata. Questo può accadere se il prodotto è stato marcato come venduto manualmente.')
        } else {
          const salesData = salesDataArray[0]
          
          // Recupera i dati aggiornati del materiale e modello
          const updatedMaterial = materials.find(m => m.id === updateData.material_id)
          
          // Ricalcola i costi per la vendita
          const productionCostBase = newProductionCost
          const productionExtraCosts = editingProduct.production_extra_costs || []
          const productionExtraTotal = productionExtraCosts.reduce((sum, cost) => sum + (parseFloat(cost.amount || 0) || 0), 0)
          const totalProductionCost = productionCostBase + productionExtraTotal
          
          // Ricalcola il profitto (revenue - total_costs)
          const quantitySold = salesData.quantity_sold || 1
          if (quantitySold <= 0) {
            throw new Error('Quantità venduta non valida')
          }
          
          const revenue = parseFloat(salesData.revenue || 0)
          const packagingCost = parseFloat(salesData.packaging_cost || 0) * quantitySold
          const administrativeCost = parseFloat(salesData.administrative_cost || 0) * quantitySold
          const promotionCost = parseFloat(salesData.promotion_cost || 0) * quantitySold
          const extraCostsTotal = (salesData.extra_costs || []).reduce((sum, cost) => sum + (parseFloat(cost.amount || 0) || 0), 0) * quantitySold
          const totalCosts = (totalProductionCost * quantitySold) + packagingCost + administrativeCost + promotionCost + extraCostsTotal
          const profit = revenue - totalCosts - (parseFloat(salesData.vat_amount || 0))
          
          // Determina spool_id e spool_purchase_account per retrocompatibilità
          let spoolIdForSale = null
          let spoolPurchaseAccountForSale = null
          
          if (isMultimaterial && mappingForDb && mappingForDb.length > 0) {
            // Per prodotti multimateriale, usa la bobina del primo colore per retrocompatibilità
            spoolIdForSale = mappingForDb[0]?.spool_id || null
            if (spoolIdForSale) {
              const firstSpool = spools.find(s => s.id === spoolIdForSale)
              spoolPurchaseAccountForSale = firstSpool?.purchase_account || null
            }
          } else if (editFormData.spool_id) {
            spoolIdForSale = editFormData.spool_id
            const selectedSpool = spools.find(s => s.id === editFormData.spool_id)
            spoolPurchaseAccountForSale = selectedSpool?.purchase_account || null
          }
          
          // Verifica che tutti i valori numerici siano validi
          const validatedProductionCostBase = isNaN(productionCostBase) || productionCostBase < 0 ? 0 : parseFloat(productionCostBase.toFixed(2))
          const validatedTotalProductionCost = isNaN(totalProductionCost) || totalProductionCost < 0 ? 0 : parseFloat(totalProductionCost.toFixed(2))
          const validatedTotalCostsPerUnit = isNaN(totalCosts) || totalCosts < 0 ? 0 : parseFloat((totalCosts / quantitySold).toFixed(2))
          const validatedProfit = isNaN(profit) ? 0 : parseFloat(profit.toFixed(2))
          
          // Verifica e normalizza production_cost_by_account
          const normalizedProductionCostByAccount = Array.isArray(productionCostByAccount) 
            ? productionCostByAccount.map(item => ({
                account: item.account,
                cost: parseFloat(item.cost || 0)
              })).filter(item => item.account && !isNaN(item.cost) && item.cost >= 0)
            : []
          
          // Aggiorna la vendita con i nuovi dati
          // Nota: total_costs è per singolo prodotto, nei report viene moltiplicato per quantity_sold
          const salesUpdateData = {
            production_cost_base: validatedProductionCostBase,
            total_production_cost: validatedTotalProductionCost,
            total_costs: validatedTotalCostsPerUnit,
            profit: validatedProfit,
            spool_id: spoolIdForSale,
            spool_purchase_account: spoolPurchaseAccountForSale,
          }
          
          // Aggiungi production_cost_by_account solo se la colonna esiste (gestione retrocompatibilità)
          // Se l'aggiornamento fallisce con questo campo, verrà eseguito senza
          if (normalizedProductionCostByAccount.length > 0) {
            salesUpdateData.production_cost_by_account = normalizedProductionCostByAccount
          }
          
          // Aggiorna anche i dati del materiale se il materiale è cambiato
          if (updatedMaterial) {
            salesUpdateData.material_id = updateData.material_id
            salesUpdateData.material_brand = updatedMaterial.brand || null
            salesUpdateData.material_type = updatedMaterial.material_type || null
            salesUpdateData.material_color = updatedMaterial.color || null
            salesUpdateData.material_color_hex = updatedMaterial.color_hex || null
          }
          
          // Log dei dati prima dell'update per debugging
          console.log('Aggiornamento vendita:', {
            salesId: salesData.id,
            updateData: salesUpdateData,
            productionCostByAccount,
          })
          
          let salesUpdateError = null
          
          // Primo tentativo: aggiorna con tutti i campi inclusi production_cost_by_account
          const { error: firstError } = await supabase
            .from('sales')
            .update(salesUpdateData)
            .eq('id', salesData.id)
          
          // Se l'errore è relativo alla colonna production_cost_by_account, riprova senza
          if (firstError && firstError.message.includes('production_cost_by_account')) {
            console.warn('Colonna production_cost_by_account non trovata, aggiorno senza questo campo')
            const { production_cost_by_account, ...salesUpdateDataWithoutAccount } = salesUpdateData
            const { error: secondError } = await supabase
              .from('sales')
              .update(salesUpdateDataWithoutAccount)
              .eq('id', salesData.id)
            
            if (secondError) {
              salesUpdateError = secondError
            } else {
              console.log('Vendita aggiornata senza production_cost_by_account (colonna non esistente nel database)')
              alert('Il prodotto è stato aggiornato. La colonna production_cost_by_account non esiste nel database. Esegui lo script SQL add_production_cost_by_account.sql per aggiungerla.')
            }
          } else if (firstError) {
            salesUpdateError = firstError
          } else {
            console.log('Vendita aggiornata con successo:', salesData.id)
          }
          
          if (salesUpdateError) {
            console.error('Errore durante l\'aggiornamento della vendita:', salesUpdateError)
            console.error('Dati che stavamo cercando di aggiornare:', salesUpdateData)
            console.error('Dati della vendita originale:', salesData)
            // Mostriamo l'errore specifico all'utente ma non blocchiamo l'operazione
            // Il prodotto è già stato aggiornato, quindi è meglio informare l'utente
            alert(`Il prodotto è stato aggiornato con successo, ma c'è stato un errore nell'aggiornamento della vendita associata.\n\nErrore: ${salesUpdateError.message}\n\nID Vendita: ${salesData.id}\n\nDovrai aggiornare manualmente i costi nella vendita o nei report. Controlla la console del browser per maggiori dettagli.`)
          }
        }
      }
      
      // Log dell'operazione
      await logAction(
        'modifica_prodotto',
        'prodotto',
        editingProduct.id,
        `${editingProduct.sku} - Materiale/Bobina aggiornati`,
        { 
          old_material_id: editingProduct.material_id,
          new_material_id: updateData.material_id,
          old_spool_id: editingProduct.spool_id,
          new_spool_id: isMultimaterial ? null : updateData.spool_id,
          old_production_cost: editingProduct.production_cost,
          new_production_cost: newProductionCost,
          is_sold: isSold,
          is_multimaterial: isMultimaterial
        }
      )
      
      await loadData()
      setShowEditModal(false)
      setEditingProduct(null)
      setEditFormData({ material_id: '', spool_id: '' })
      setMultimaterialMapping({ color1: '', color2: '', color3: '', color4: '' })
      setMultimaterialSpools({ color1: '', color2: '', color3: '', color4: '' })
      alert('Prodotto aggiornato con successo!' + (isSold ? ' La vendita associata è stata aggiornata con i nuovi costi.' : ''))
    } catch (error) {
      console.error('Error:', error)
      alert('Errore durante l\'aggiornamento: ' + error.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questo prodotto?')) return

    const product = products.find((p) => p.id === id)
    const productSku = product?.sku || 'Prodotto sconosciuto'

    const { error } = await supabase.from('products').delete().eq('id', id)

    if (error) {
      alert('Errore durante l\'eliminazione: ' + error.message)
    } else {
      // Log dell'operazione
      await logAction(
        'eliminazione_prodotto',
        'prodotto',
        id,
        productSku,
        { product_data: product }
      )
      await loadData()
    }
  }

  const handleProductClick = (product) => {
    setDetailProduct(product)
    setProductionExtraCosts(product?.production_extra_costs || [])
    setShowDetailModal(true)
  }

  const handleSaveProductionExtraCosts = async () => {
    if (!detailProduct) return
    
    setSavingProductionCosts(true)
    try {
      const { error } = await supabase
        .from('products')
        .update({ production_extra_costs: productionExtraCosts.length > 0 ? productionExtraCosts : null })
        .eq('id', detailProduct.id)

      if (error) throw error

      // Log dell'operazione
      await logAction(
        'modifica_prodotto',
        'prodotto',
        detailProduct.id,
        detailProduct.sku || 'Prodotto sconosciuto',
        { changes: { production_extra_costs: productionExtraCosts } }
      )

      // Aggiorna il prodotto locale
      const updatedProduct = { ...detailProduct, production_extra_costs: productionExtraCosts }
      setDetailProduct(updatedProduct)
      
      // Aggiorna anche nella lista prodotti e nei prodotti filtrati
      const updatedProducts = products.map(p => p.id === detailProduct.id ? updatedProduct : p)
      setProducts(updatedProducts)
      
      // Aggiorna anche filteredProducts se necessario
      setFilteredProducts(filteredProducts.map(p => p.id === detailProduct.id ? updatedProduct : p))
      
      alert('Costi extra di produzione salvati con successo!')
    } catch (error) {
      console.error('Error saving production extra costs:', error)
      alert('Errore nel salvataggio dei costi extra di produzione')
    } finally {
      setSavingProductionCosts(false)
    }
  }

  const calculateTotalProductionCost = () => {
    const baseCost = parseFloat(detailProduct?.production_cost || 0)
    const extraCostsTotal = (productionExtraCosts || []).reduce((sum, cost) => sum + (parseFloat(cost.amount) || 0), 0)
    return baseCost + extraCostsTotal
  }

  const handleProductPhotosUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setUploadingPhotos(true)
    try {
      const uploadedUrls = []
      
      for (const file of files) {
        const validation = validateImageFile(file)
        if (!validation.valid) {
          alert(`Errore per ${file.name}: ${validation.error}`)
          continue
        }

        try {
          const url = await processAndUploadImage(file, 'material-photos')
          uploadedUrls.push(url)
        } catch (error) {
          console.error(`Errore caricamento ${file.name}:`, error)
          alert(`Errore durante il caricamento di ${file.name}`)
        }
      }

      if (uploadedUrls.length > 0) {
        const currentPhotos = detailProduct.product_photos || []
        const updatedPhotos = [...currentPhotos, ...uploadedUrls]

        const { error } = await supabase
          .from('products')
          .update({ product_photos: updatedPhotos })
          .eq('id', detailProduct.id)

        if (error) {
          throw error
        }

        // Aggiorna il prodotto locale
        setDetailProduct({ ...detailProduct, product_photos: updatedPhotos })
        await loadData() // Ricarica i dati per aggiornare la lista
      }
    } catch (error) {
      console.error('Error uploading photos:', error)
      alert('Errore durante il caricamento delle foto')
    } finally {
      setUploadingPhotos(false)
      e.target.value = '' // Reset input
    }
  }

  const handleRemoveProductPhoto = async (photoUrl) => {
    if (!confirm('Sei sicuro di voler rimuovere questa foto?')) return

    try {
      // Rimuovi l'URL dall'array
      const currentPhotos = detailProduct.product_photos || []
      const updatedPhotos = currentPhotos.filter((url) => url !== photoUrl)

      // Elimina l'immagine dallo storage
      if (photoUrl.includes('supabase.co/storage')) {
        await deleteImageFromStorage(photoUrl, 'material-photos')
      }

      // Aggiorna il database
      const { error } = await supabase
        .from('products')
        .update({ product_photos: updatedPhotos })
        .eq('id', detailProduct.id)

      if (error) {
        throw error
      }

      // Aggiorna il prodotto locale
      setDetailProduct({ ...detailProduct, product_photos: updatedPhotos })
      await loadData() // Ricarica i dati per aggiornare la lista
    } catch (error) {
      console.error('Error removing photo:', error)
      alert('Errore durante la rimozione della foto')
    }
  }


  const handleDownloadAllPhotos = async () => {
    if (!detailProduct.product_photos || detailProduct.product_photos.length === 0) {
      return
    }

    try {
      const sku = detailProduct.sku || 'prodotto'
      const photos = detailProduct.product_photos

      // Scarica ogni immagine
      for (let i = 0; i < photos.length; i++) {
        const photoUrl = photos[i]
        try {
          const response = await fetch(photoUrl)
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `${sku}_foto_${i + 1}.${blob.type.split('/')[1] || 'jpg'}`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
          
          // Piccolo delay tra i download per evitare problemi del browser
          if (i < photos.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        } catch (error) {
          console.error(`Errore durante il download della foto ${i + 1}:`, error)
        }
      }
    } catch (error) {
      console.error('Error downloading photos:', error)
      alert('Errore durante il download delle foto')
    }
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

  const resetForm = () => {
    setFormData({
      model_id: '',
      material_id: '',
      spool_id: '',
      sale_price: '',
    })
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
    setShowModelDropdown(false)
    setShowMaterialDropdown(false)
    setHoveredModel(null)
    setHoveredMaterial(null)
    setModelSearch('')
    setMaterialSearch('')
  }

  const getStatusBadge = (status) => {
    const badges = {
      in_coda: { label: 'In Coda', class: 'status-queue' },
      disponibile: { label: 'Disponibile', class: 'status-available' },
      venduto: { label: 'Venduto', class: 'status-sold' },
    }
    return badges[status] || badges.in_coda
  }

  if (loading) return <div className="loading">Caricamento...</div>

  const selectedModel = models.find((m) => m.id === formData.model_id)
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / productsPerPage))
  const safePage = Math.min(productsPage, totalPages)
  const paginatedProducts = filteredProducts.slice(
    (safePage - 1) * productsPerPage,
    safePage * productsPerPage
  )
  const productionCost = selectedModel?.is_multimaterial 
    ? calculateProductionCost(formData.model_id, null, multimaterialMapping)
    : calculateProductionCost(formData.model_id, formData.material_id)

  return (
    <div className="products-page">
      <div className="page-header">
        <h1>Gestione Prodotti</h1>
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
          <div className="form-group" style={{ marginBottom: 0, flex: '0 0 250px', display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '14px', marginBottom: '8px', display: 'block', color: '#1a1a1a', fontWeight: '500' }}>
              Stato
            </label>
            <div style={{
              display: 'flex',
              gap: '4px',
              background: '#f0f0f0',
              borderRadius: '6px',
              padding: '4px',
              border: '2px solid #e0e0e0',
              marginTop: 'auto'
            }}>
              <button
                type="button"
                onClick={() => setStatusFilter('tutti')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: statusFilter === 'tutti' ? '#1a1a1a' : 'transparent',
                  color: statusFilter === 'tutti' ? 'white' : '#1a1a1a',
                  transition: 'all 0.2s ease'
                }}
              >
                Tutti
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('disponibile')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: statusFilter === 'disponibile' ? '#27ae60' : 'transparent',
                  color: statusFilter === 'disponibile' ? 'white' : '#1a1a1a',
                  transition: 'all 0.2s ease'
                }}
              >
                Disponibile
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('venduto')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: statusFilter === 'venduto' ? '#3498db' : 'transparent',
                  color: statusFilter === 'venduto' ? 'white' : '#1a1a1a',
                  transition: 'all 0.2s ease'
                }}
              >
                Venduto
              </button>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '0 0 200px', display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '14px', marginBottom: '8px', display: 'block', color: '#1a1a1a', fontWeight: '500' }}>
              Prodotti per pagina
            </label>
            <select
              value={productsPerPage}
              onChange={(e) => setProductsPerPage(parseInt(e.target.value, 10))}
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
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '0 0 260px', display: 'flex', flexDirection: 'column' }}>
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
              <option value="created_at">Data Caricamento (Più recenti)</option>
              <option value="nome_crescente">Nome Crescente</option>
              <option value="nome_decrescente">Nome Decrescente</option>
              <option value="materiale_crescente">Materiale Crescente</option>
              <option value="materiale_decrescente">Materiale Decrescente</option>
              <option value="prezzo_crescente">Prezzo Vendita Crescente</option>
              <option value="prezzo_decrescente">Prezzo Vendita Decrescente</option>
              <option value="stato_crescente">Stato Crescente</option>
              <option value="stato_decrescente">Stato Decrescente</option>
            </select>
          </div>
        </div>
      </div>

      <div className="products-table-container">
        {filteredProducts.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #ecf0f1' }}>
            <div style={{ fontSize: '13px', color: '#7f8c8d' }}>
              Pagina {safePage} di {totalPages}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-secondary"
                onClick={() => setProductsPage((prev) => Math.max(1, prev - 1))}
                disabled={safePage <= 1}
              >
                Precedente
              </button>
              <button
                className="btn-secondary"
                onClick={() => setProductsPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={safePage >= totalPages}
              >
                Successiva
              </button>
            </div>
          </div>
        )}
        <table className="products-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Modello</th>
              <th>Materiale</th>
              <th>Stato</th>
              <th>Costo Produzione</th>
              <th>Prezzo Vendita</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-state">
                  {products.length === 0 
                    ? 'Nessun prodotto trovato. Crea il primo prodotto!'
                    : 'Nessun prodotto corrisponde alla ricerca.'}
                </td>
              </tr>
            ) : (
              paginatedProducts.map((product) => {
                const statusBadge = getStatusBadge(product.status)
                return (
                  <tr 
                    key={product.id}
                    className="product-row"
                    onClick={(e) => {
                      // Non aprire il dettaglio se si clicca su un bottone
                      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                        return
                      }
                      handleProductClick(product)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <strong style={{ fontFamily: 'monospace', color: '#1a1a1a' }}>
                        {product.sku || 'N/A'}
                      </strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{ position: 'relative' }}
                          onMouseEnter={() => setHoveredModelCardId(product.id)}
                          onMouseLeave={() => setHoveredModelCardId(null)}
                        >
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
                        </div>
                        <span>{product.models?.name || 'N/A'}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                        <div
                          style={{ flex: 1, position: 'relative' }}
                          onMouseEnter={(e) => {
                            setHoveredMaterialCard({
                              id: product.id,
                              rect: e.currentTarget.getBoundingClientRect()
                            })
                          }}
                          onMouseLeave={() => setHoveredMaterialCard(null)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong>{product.materials?.brand || 'N/A'}</strong>
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
                          <small style={{ color: '#7f8c8d', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {product.materials?.material_type || ''} - 
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
                          </small>
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
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${statusBadge.class}`}>
                        {statusBadge.label}
                      </span>
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
                        {product.status !== 'venduto' && (
                          <>
                            {product.status === 'in_coda' && (
                              <button
                                className="btn-status"
                                onClick={() => handleStatusChange(product.id, 'disponibile')}
                                title="Imposta come disponibile"
                              >
                                <FontAwesomeIcon icon={faCheck} />
                              </button>
                            )}
                            {product.status === 'disponibile' && (
                              <button
                                className="btn-status"
                                onClick={() => handleStatusChange(product.id, 'venduto')}
                                title="Vendi"
                              >
                                <FontAwesomeIcon icon={faDollarSign} />
                              </button>
                            )}
                          </>
                        )}
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
                        <button className="btn-delete" onClick={() => handleDelete(product.id)} title="Elimina">
                          <FontAwesomeIcon icon={faTrash} />
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
      {filteredProducts.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
          <div style={{ fontSize: '13px', color: '#7f8c8d' }}>
            Pagina {safePage} di {totalPages}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-secondary"
              onClick={() => setProductsPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage <= 1}
            >
              Precedente
            </button>
            <button
              className="btn-secondary"
              onClick={() => setProductsPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage >= totalPages}
            >
              Successiva
            </button>
          </div>
        </div>
      )}

      {/* Modal creazione prodotto spostata in PrintQueue */}
      {false && showModal && (
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
                                  // Filtra solo materiali con bobine disponibili (grammi > 0)
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
                                      setMultimaterialSpools({ ...multimaterialSpools, [key]: '' }) // Reset bobina quando cambia materiale
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
                          {materials.filter((material) => material.status === 'disponibile').length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#e74c3c' }}>
                              Nessun materiale disponibile
                            </div>
                          ) : (
                            materials
                              .filter((material) => {
                                // Filtra solo materiali con bobine disponibili (grammi > 0)
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
                              ))
                          )}
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
              {formData.model_id && (
                (selectedModel?.is_multimaterial 
                  ? (multimaterialMapping.color1 && multimaterialMapping.color2)
                  : formData.material_id && formData.spool_id
                ) && (
                <div className="cost-preview">
                  <div style={{ marginBottom: '15px' }}>
                    <strong>Costo di produzione calcolato: €{productionCost}</strong>
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
                        €{(parseFloat(productionCost) * 2.5).toFixed(2)}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#7f8c8d', fontSize: '14px' }}>Prezzo consigliato (8x):</span>
                      <strong style={{ color: '#27ae60', fontSize: '16px' }}>
                        €{(parseFloat(productionCost) * 8).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
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

      {showSaleModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => { setShowSaleModal(false); setSelectedProduct(null) }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Conferma Vendita</h2>
            <form onSubmit={handleSaleSubmit}>
              <div className="form-group">
                <label>Prezzo di Vendita Originale</label>
                <input type="text" value={`€${parseFloat(selectedProduct.sale_price).toFixed(2)}`} disabled />
              </div>
              <div className="form-group">
                <label>Canale di Vendita</label>
                <select
                  value={saleFormData.sales_channel}
                  onChange={(e) => setSaleFormData({ ...saleFormData, sales_channel: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'white'
                  }}
                >
                  <option value="">Seleziona un canale</option>
                  <option value="Vinted">Vinted</option>
                  <option value="eBay">eBay</option>
                  <option value="Shopify">Shopify</option>
                  <option value="Negozio Fisico">Negozio Fisico</option>
                </select>
              </div>
              <div className="form-group">
                <label>Regime IVA</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={saleFormData.vat_regime}
                    onChange={(e) => setSaleFormData({ ...saleFormData, vat_regime: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 50px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: 'white'
                    }}
                  >
                    <option value="">Seleziona un regime IVA</option>
                    {vatRegimes.map((regime) => (
                      <option key={regime.id} value={regime.name}>
                        {regime.name}
                      </option>
                    ))}
                  </select>
                  {saleFormData.vat_regime && (() => {
                    const selectedRegime = vatRegimes.find(r => r.name === saleFormData.vat_regime)
                    return selectedRegime?.country_code ? (
                      <div style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none'
                      }}>
                        <ReactCountryFlag
                          countryCode={selectedRegime.country_code}
                          svg
                          style={{
                            width: '24px',
                            height: '18px'
                          }}
                        />
                      </div>
                    ) : null
                  })()}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label>Prezzo Finale di Vendita (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={saleFormData.final_sale_price}
                    onChange={(e) => setSaleFormData({ ...saleFormData, final_sale_price: e.target.value })}
                    required
                    placeholder="0.00"
                  />
                  <small>Puoi modificare il prezzo originale</small>
                </div>
              </div>
              
              <div className="form-group">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Costi Extra
                  <button
                    type="button"
                    onClick={() => {
                      setSaleFormData({
                        ...saleFormData,
                        extra_costs: [...saleFormData.extra_costs, { amount: '', note: '' }]
                      })
                    }}
                    style={{
                      background: '#2d2d2d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    Aggiungi Costo
                  </button>
                </label>
                {saleFormData.extra_costs.length === 0 ? (
                  <div style={{ 
                    padding: '15px', 
                    background: '#f5f5f5', 
                    borderRadius: '8px', 
                    textAlign: 'center',
                    color: '#666',
                    fontSize: '14px'
                  }}>
                    Nessun costo extra aggiunto
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {saleFormData.extra_costs.map((cost, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'flex-start',
                        padding: '12px',
                        background: '#f9f9f9',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <div style={{ flex: 1 }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cost.amount}
                            onChange={(e) => {
                              const newCosts = [...saleFormData.extra_costs]
                              newCosts[index].amount = e.target.value
                              setSaleFormData({ ...saleFormData, extra_costs: newCosts })
                            }}
                            placeholder="0.00"
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '2px solid #e0e0e0',
                              borderRadius: '6px',
                              fontSize: '14px',
                              marginBottom: '8px'
                            }}
                          />
                          <input
                            type="text"
                            value={cost.note}
                            onChange={(e) => {
                              const newCosts = [...saleFormData.extra_costs]
                              newCosts[index].note = e.target.value
                              setSaleFormData({ ...saleFormData, extra_costs: newCosts })
                            }}
                            placeholder="es: Accessorio incluso"
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '2px solid #e0e0e0',
                              borderRadius: '6px',
                              fontSize: '14px'
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newCosts = saleFormData.extra_costs.filter((_, i) => i !== index)
                            setSaleFormData({ ...saleFormData, extra_costs: newCosts })
                          }}
                          style={{
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Rimuovi"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    ))}
                    <div style={{
                      padding: '10px',
                      background: '#e8f4f8',
                      borderRadius: '6px',
                      fontSize: '14px',
                      color: '#2d2d2d'
                    }}>
                      <strong>Totale Costi Extra:</strong> €{saleFormData.extra_costs.reduce((sum, cost) => sum + (parseFloat(cost.amount) || 0), 0).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setShowSaleModal(false); setSelectedProduct(null) }}
                >
                  Annulla
                </button>
                <button type="submit" className="btn-primary">
                  Conferma Vendita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingProduct && (() => {
        const productModel = models.find(m => m.id === editingProduct.model_id)
        const isMultimaterial = productModel?.is_multimaterial
        const isSold = editingProduct.status === 'venduto'
        
        return (
        <div className="modal-overlay" onClick={() => { 
          setShowEditModal(false); 
          setEditingProduct(null); 
          setEditFormData({ material_id: '', spool_id: '' })
          setMultimaterialMapping({ color1: '', color2: '', color3: '', color4: '' })
          setMultimaterialSpools({ color1: '', color2: '', color3: '', color4: '' })
          setShowMaterialDropdown(false)
          setMaterialSearch('')
          setMultimaterialMapping({ color1: '', color2: '', color3: '', color4: '' })
          setMultimaterialSpools({ color1: '', color2: '', color3: '', color4: '' })
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>Modifica Materiale/Bobina</h2>
            {isSold && (
              <div style={{ 
                padding: '12px', 
                background: '#fff3cd', 
                borderRadius: '4px', 
                color: '#856404', 
                fontSize: '14px',
                marginBottom: '20px',
                border: '1px solid #ffc107'
              }}>
                <strong>Nota:</strong> Questo prodotto è già stato venduto. La modifica aggiornerà solo i costi di produzione e la vendita associata, ma <strong>non scalerà/ripristinerà grammi dalle bobine</strong>.
              </div>
            )}
            <form onSubmit={handleUpdateProduct}>
              <div className="form-group">
                <label>Prodotto</label>
                <div style={{ padding: '10px', background: '#f8f9fa', borderRadius: '4px', fontSize: '14px' }}>
                  <strong>{editingProduct.sku}</strong> - {editingProduct.models?.name || 'N/A'}
                  {isMultimaterial && <span style={{ marginLeft: '10px', color: '#7f8c8d', fontSize: '12px' }}>(Multimateriale)</span>}
                </div>
              </div>

              {!isMultimaterial && (
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Materiale</label>
                  <div style={{ position: 'relative' }}>
                    <div
                      onClick={() => {
                        setShowMaterialDropdown(showMaterialDropdown === 'edit' ? false : 'edit')
                        setShowModelDropdown(false)
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
                              // Per prodotti venduti, mostra tutti i materiali con bobine (anche con 0g)
                              // Per prodotti non venduti, mostra solo materiali con bobine disponibili
                              const materialSpools = isSold 
                                ? spools.filter(spool => spool.material_id === material.id)
                                : spools.filter(spool => spool.material_id === material.id && parseFloat(spool.remaining_grams) > 0)
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
              )}

              {isMultimaterial ? (
                <div className="form-group">
                  <label>Materiali per Colore</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {[
                      { key: 'color1', label: 'Colore 1', required: true },
                      { key: 'color2', label: 'Colore 2', required: true },
                      ...(productModel?.color3_weight_g ? [{ key: 'color3', label: 'Colore 3', required: false }] : []),
                      ...(productModel?.color4_weight_g ? [{ key: 'color4', label: 'Colore 4', required: false }] : []),
                    ].filter(({ key }) => productModel?.[`${key}_weight_g`]).map(({ key, label, required }) => (
                      <div key={key} style={{ position: 'relative' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '5px', display: 'block' }}>
                          {label} {required && <span style={{ color: '#e74c3c' }}>*</span>}
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <div
                              onClick={() => {
                                setShowMaterialDropdown(showMaterialDropdown === `edit_${key}` ? false : `edit_${key}`)
                                setShowModelDropdown(false)
                                if (showMaterialDropdown !== `edit_${key}`) {
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
                                {(() => {
                                  const weightGrams = parseFloat(productModel?.[`${key}_weight_g`] || 0)
                                  // Per prodotti venduti, mostra tutte le bobine del materiale (non scaliamo grammi)
                                  // Per prodotti non venduti, filtra solo quelle con grammi sufficienti
                                  const availableSpoolsForColor = isSold
                                    ? spools.filter(spool => spool.material_id === multimaterialMapping[key])
                                    : spools.filter(
                                        spool => spool.material_id === multimaterialMapping[key] &&
                                                 parseFloat(spool.remaining_grams) >= weightGrams
                                      )
                                  
                                  return availableSpoolsForColor.length === 0 ? (
                                    <div style={{ padding: '10px', background: '#fff3cd', borderRadius: '4px', color: '#856404', fontSize: '14px' }}>
                                      {isSold 
                                        ? 'Nessuna bobina trovata per questo materiale.'
                                        : 'Nessuna bobina disponibile per questo materiale.'}
                                    </div>
                                  ) : (
                                    <select
                                      value={multimaterialSpools[key] || ''}
                                      onChange={(e) => setMultimaterialSpools({ ...multimaterialSpools, [key]: e.target.value })}
                                      required={required}
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
                                      {availableSpoolsForColor.map((spool) => {
                                        const pricePerKg = parseFloat(spool.price || 0)
                                        return (
                                          <option key={spool.id} value={spool.id}>
                                            {spool.purchase_account} - €{pricePerKg.toFixed(2)}/kg{!isSold ? ` - ${parseFloat(spool.remaining_grams).toFixed(2)}g residui` : ''}
                                          </option>
                                        )
                                      })}
                                    </select>
                                  )
                                })()}
                              </div>
                            )}
                            {showMaterialDropdown === `edit_${key}` && (
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
                                <div>
                                  {materials
                                    .filter((material) => {
                                      const materialSpools = isSold
                                        ? spools.filter(spool => spool.material_id === material.id)
                                        : spools.filter(spool => spool.material_id === material.id && parseFloat(spool.remaining_grams) > 0)
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
                      </div>
                    ))}
                  </div>
                  <small>Seleziona un materiale e una bobina per ogni colore utilizzato nel modello</small>
                </div>
              ) : (
                <>
                  {editFormData.material_id && (
                    <div className="form-group">
                      <label>Bobina</label>
                      {editAvailableSpools.length === 0 ? (
                        <div style={{ padding: '10px', background: '#fff3cd', borderRadius: '4px', color: '#856404', fontSize: '14px' }}>
                          {isSold 
                            ? 'Nessuna bobina trovata per questo materiale.'
                            : 'Nessuna bobina disponibile per questo materiale.'}
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
                </>
              )}

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => { 
                    setShowEditModal(false)
                    setEditingProduct(null)
                    setEditFormData({ material_id: '', spool_id: '' })
                    setMultimaterialMapping({ color1: '', color2: '', color3: '', color4: '' })
                    setMultimaterialSpools({ color1: '', color2: '', color3: '', color4: '' })
                    setShowMaterialDropdown(false)
                    setMaterialSearch('')
                  }}
                >
                  Annulla
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={
                    isMultimaterial
                      ? !multimaterialMapping.color1 || !multimaterialMapping.color2 || !multimaterialSpools.color1 || !multimaterialSpools.color2
                      : !editFormData.material_id || !editFormData.spool_id
                  }
                >
                  Salva Modifiche
                </button>
              </div>
            </form>
          </div>
        </div>
        )
      })()}

      {showDetailModal && detailProduct && (
        <div className="modal-overlay" onClick={() => { setShowDetailModal(false); setDetailProduct(null) }}>
          <div className="modal-content product-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Dettagli Prodotto</h2>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                <div className="detail-item highlight" style={{ padding: '8px 12px', fontSize: '14px' }}>
                  <strong>SKU:</strong> {detailProduct.sku || 'N/A'}
                </div>
              </div>
            </div>
            
            <div className="product-detail-content">
              {/* Sezione Modello */}
              <div className="detail-section">
                <h3>Modello</h3>
                <div className="detail-info-grid">
                  {detailProduct.models?.photo_url && (
                    <div className="detail-image">
                      <img src={detailProduct.models.photo_url} alt={detailProduct.models.name} />
                    </div>
                  )}
                  <div className="detail-info">
                    <div className="detail-item">
                      <strong>Nome:</strong> {detailProduct.models?.name || 'N/A'}
                    </div>
                    {detailProduct.models?.description && (
                      <div className="detail-item">
                        <strong>Descrizione:</strong> {detailProduct.models.description}
                      </div>
                    )}
                    <div className="detail-item">
                      <strong>Peso:</strong> {detailProduct.models?.weight_kg ? Math.round(parseFloat(detailProduct.models.weight_kg) * 1000) + ' g' : 'N/A'}
                    </div>
                    {detailProduct.models?.dimensions && (
                      <div className="detail-item">
                        <strong>Dimensioni:</strong> {detailProduct.models.dimensions} {!detailProduct.models.dimensions.includes('cm') && 'cm'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sezione Materiale */}
              <div className="detail-section">
                <h3>{detailProduct.multimaterial_mapping && Array.isArray(detailProduct.multimaterial_mapping) && detailProduct.multimaterial_mapping.length > 1 ? 'Materiali' : 'Materiale'}</h3>
                {detailProduct.multimaterial_mapping && Array.isArray(detailProduct.multimaterial_mapping) && detailProduct.multimaterial_mapping.length > 1 ? (
                  // Visualizzazione multimateriale
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {detailProduct.multimaterial_mapping.map((mapping, index) => {
                      const material = materials.find((m) => m.id === mapping.material_id)
                      const model = models.find((m) => m.id === detailProduct.model_id)
                      const colorWeight = model ? 
                        (mapping.color === 1 ? model.color1_weight_g :
                         mapping.color === 2 ? model.color2_weight_g :
                         mapping.color === 3 ? model.color3_weight_g :
                         mapping.color === 4 ? model.color4_weight_g : null) : null
                      
                      if (!material) return null
                      
                      return (
                        <div key={index} style={{ 
                          border: '1px solid #e0e0e0', 
                          borderRadius: '8px', 
                          padding: '15px',
                          background: '#f8f9fa'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <h4 style={{ margin: 0, fontSize: '16px', color: '#1a1a1a' }}>
                              Colore {mapping.color}
                              {colorWeight && <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#7f8c8d', marginLeft: '8px' }}>({colorWeight}g)</span>}
                            </h4>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '20px', alignItems: 'start' }}>
                            <div style={{ display: 'flex', flexDirection: 'row', gap: '12px' }}>
                              {material.bobina_photo_url && (
                                <div className="detail-image">
                                  <img src={material.bobina_photo_url} alt="Bobina" />
                                  <small>Foto Bobina</small>
                                </div>
                              )}
                              {material.print_example_photo_url && (
                                <div className="detail-image">
                                  <img src={material.print_example_photo_url} alt="Esempio Stampa" />
                                  <small>Esempio Stampa</small>
                                </div>
                              )}
                            </div>
                            <div className="detail-info">
                              <div className="detail-item">
                                <strong>Brand:</strong> {material.brand || 'N/A'}
                              </div>
                              <div className="detail-item">
                                <strong>Materiale:</strong> {material.material_type || 'N/A'}
                              </div>
                              <div className="detail-item">
                                <strong>Colore:</strong>
                                {material.color_hex && (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      width: '16px',
                                      height: '16px',
                                      borderRadius: '50%',
                                      backgroundColor: material.color_hex,
                                      border: '1px solid #ddd',
                                      marginLeft: '8px',
                                      verticalAlign: 'middle'
                                    }}
                                    title={material.color_hex}
                                  />
                                )}
                                <span style={{ marginLeft: '8px' }}>{material.color || 'N/A'}</span>
                              </div>
                              <div className="detail-item">
                                <strong>Costo al Kg:</strong> €{material.cost_per_kg ? parseFloat(material.cost_per_kg).toFixed(2) : 'N/A'}
                              </div>
                              {colorWeight && (
                                <div className="detail-item">
                                  <strong>Costo per questo colore:</strong> €{((parseFloat(colorWeight) / 1000) * parseFloat(material.cost_per_kg || 0)).toFixed(2)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  // Visualizzazione materiale singolo (comportamento originale)
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '20px', alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'row', gap: '12px' }}>
                      {detailProduct.materials?.bobina_photo_url && (
                        <div className="detail-image">
                          <img src={detailProduct.materials.bobina_photo_url} alt="Bobina" />
                          <small>Foto Bobina</small>
                        </div>
                      )}
                      {detailProduct.materials?.print_example_photo_url && (
                        <div className="detail-image">
                          <img src={detailProduct.materials.print_example_photo_url} alt="Esempio Stampa" />
                          <small>Esempio Stampa</small>
                        </div>
                      )}
                    </div>
                    <div className="detail-info">
                      <div className="detail-item">
                        <strong>Brand:</strong> {detailProduct.materials?.brand || 'N/A'}
                      </div>
                      <div className="detail-item">
                        <strong>Materiale:</strong> {detailProduct.materials?.material_type || 'N/A'}
                      </div>
                      <div className="detail-item">
                        <strong>Colore:</strong>
                        {detailProduct.materials?.color_hex && (
                          <span
                            style={{
                              display: 'inline-block',
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              backgroundColor: detailProduct.materials.color_hex,
                              border: '1px solid #ddd',
                              marginLeft: '8px',
                              verticalAlign: 'middle'
                            }}
                            title={detailProduct.materials.color_hex}
                          />
                        )}
                        <span style={{ marginLeft: '8px' }}>{detailProduct.materials?.color || 'N/A'}</span>
                      </div>
                      <div className="detail-item">
                        <strong>Costo al Kg:</strong> €{detailProduct.materials?.cost_per_kg ? parseFloat(detailProduct.materials.cost_per_kg).toFixed(2) : 'N/A'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sezione Costi e Prezzi */}
              <div className="detail-section">
                <h3>Informazioni Economiche</h3>
                <div className="detail-info">
                  <div className="detail-item">
                    <strong>Costo di Produzione Base:</strong> €{parseFloat(detailProduct.production_cost).toFixed(2)}
                  </div>
                  
                  {/* Gestione Costi Extra di Produzione */}
                  <div className="detail-item" style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <strong>Costi Extra di Produzione</strong>
                      <button
                        type="button"
                        onClick={() => {
                          setProductionExtraCosts([...productionExtraCosts, { amount: '', note: '' }])
                        }}
                        style={{
                          background: '#2d2d2d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <FontAwesomeIcon icon={faPlus} />
                        Aggiungi
                      </button>
                    </div>
                    {productionExtraCosts.length === 0 ? (
                      <div style={{ 
                        padding: '10px', 
                        background: '#f5f5f5', 
                        borderRadius: '6px', 
                        textAlign: 'center',
                        color: '#666',
                        fontSize: '13px'
                      }}>
                        Nessun costo extra aggiunto
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                        {productionExtraCosts.map((cost, index) => (
                          <div key={index} style={{
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'flex-start',
                            padding: '10px',
                            background: '#f9f9f9',
                            borderRadius: '6px',
                            border: '1px solid #e0e0e0'
                          }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666', fontWeight: '500' }}>
                                Importo (€)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={cost.amount}
                                onChange={(e) => {
                                  const newCosts = [...productionExtraCosts]
                                  newCosts[index].amount = e.target.value
                                  setProductionExtraCosts(newCosts)
                                }}
                                placeholder="0.00"
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  border: '2px solid #e0e0e0',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  marginBottom: '8px'
                                }}
                              />
                              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#666', fontWeight: '500' }}>
                                Nota
                              </label>
                              <input
                                type="text"
                                value={cost.note}
                                onChange={(e) => {
                                  const newCosts = [...productionExtraCosts]
                                  newCosts[index].note = e.target.value
                                  setProductionExtraCosts(newCosts)
                                }}
                                placeholder="es: Accessorio incluso"
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  border: '2px solid #e0e0e0',
                                  borderRadius: '6px',
                                  fontSize: '14px'
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newCosts = productionExtraCosts.filter((_, i) => i !== index)
                                setProductionExtraCosts(newCosts)
                              }}
                              style={{
                                background: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Rimuovi"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        ))}
                        {productionExtraCosts.length > 0 && (
                          <div style={{
                            padding: '8px',
                            background: '#e8f4f8',
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: '#2d2d2d',
                            fontWeight: '500'
                          }}>
                            Totale Costi Extra: €{productionExtraCosts.reduce((sum, cost) => sum + (parseFloat(cost.amount) || 0), 0).toFixed(2)}
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveProductionExtraCosts}
                      disabled={savingProductionCosts}
                      style={{
                        background: '#2d2d2d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        cursor: savingProductionCosts ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        width: '100%',
                        marginTop: '10px'
                      }}
                    >
                      {savingProductionCosts ? 'Salvataggio...' : 'Salva Costi Extra'}
                    </button>
                  </div>

                  <div className="detail-item highlight" style={{ marginTop: '15px', padding: '12px', background: '#f0f8ff', borderRadius: '6px' }}>
                    <strong>Costo di Produzione Totale:</strong> €{calculateTotalProductionCost().toFixed(2)}
                  </div>
                  <div className="detail-item highlight">
                    <strong>Prezzo Consigliato (8x):</strong> €{(calculateTotalProductionCost() * 8).toFixed(2)}
                  </div>
                  <div className="detail-item">
                    <strong>Prezzo di Vendita:</strong> €{parseFloat(detailProduct.sale_price).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Sezione Foto specifiche del modello */}
              <div className="detail-section">
                <h3>Foto specifiche del modello</h3>
                <input
                  id="product-photos-upload"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  multiple
                  onChange={handleProductPhotosUpload}
                  style={{ display: 'none' }}
                />
                <div style={{ marginBottom: '15px' }}>
                  <button
                    type="button"
                    onClick={() => document.getElementById('product-photos-upload')?.click()}
                    className="btn-primary"
                    disabled={uploadingPhotos}
                    style={{ marginBottom: '15px' }}
                  >
                    <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
                    {uploadingPhotos ? 'Caricamento...' : 'Carica Foto'}
                  </button>
                </div>
                {detailProduct.product_photos && detailProduct.product_photos.length > 0 ? (
                  <>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
                      gap: '15px',
                      marginTop: '15px'
                    }}>
                      {detailProduct.product_photos.map((photoUrl, index) => (
                        <div
                          key={index}
                          style={{
                            position: 'relative',
                            aspectRatio: '1',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '2px solid #e0e0e0'
                          }}
                        >
                          <img
                            src={photoUrl}
                            alt={`Foto prodotto ${index + 1}`}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveProductPhoto(photoUrl)}
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
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '16px'
                            }}
                            title="Rimuovi immagine"
                          >
                            <FontAwesomeIcon icon={faTimes} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '20px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={handleDownloadAllPhotos}
                        className="btn-secondary"
                        style={{ minWidth: '150px' }}
                      >
                        📥 Scarica tutte
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#7f8c8d',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    border: '2px dashed #ddd'
                  }}>
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>📷</div>
                    <div>Nessuna foto caricata</div>
                  </div>
                )}
              </div>

              {/* Sezione Altro */}
              <div className="detail-section">
                <h3>Altro</h3>
                <div className="detail-info" style={{ gap: '6px' }}>
                  <div className="detail-item">
                    <strong>Stato:</strong>
                    <span className={`status-badge ${getStatusBadge(detailProduct.status).class}`} style={{ marginLeft: '10px' }}>
                      {getStatusBadge(detailProduct.status).label}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Creato il:</strong> {formatDate(detailProduct.created_at)}
                  </div>
                  {detailProduct.sold_at && (
                    <div className="detail-item">
                      <strong>Venduto il:</strong> {formatDate(detailProduct.sold_at)}
                    </div>
                  )}
                </div>
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
    </div>
  )
}
