import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { processAndUploadImage, deleteImageFromStorage, validateImageFile } from '../lib/imageUpload'
import { logAction } from '../lib/logging'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEdit, faTrash, faPlus } from '@fortawesome/free-solid-svg-icons'
import './Accessories.css'

const DEFAULT_FORM = {
  name: '',
  description: '',
  photo_url: ''
}

export default function Accessories() {
  const [accessories, setAccessories] = useState([])
  const [accessoryPieces, setAccessoryPieces] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPiecesModal, setShowPiecesModal] = useState(false)
  const [selectedAccessoryForPieces, setSelectedAccessoryForPieces] = useState(null)
  const [editingPiece, setEditingPiece] = useState(null)
  const [piecesModalMode, setPiecesModalMode] = useState('view')
  const [editingAccessory, setEditingAccessory] = useState(null)
  const [formData, setFormData] = useState(DEFAULT_FORM)
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [pieceForm, setPieceForm] = useState({
    unit_cost: '',
    remaining_qty: 1,
    purchase_account: 'Fabio',
    purchased_from: ''
  })

  useEffect(() => {
    loadAccessories()
  }, [])

  const loadAccessories = async () => {
    const [accessoriesRes, piecesRes] = await Promise.all([
      supabase.from('accessories').select('*').order('created_at', { ascending: false }),
      supabase.from('accessory_pieces').select('*').order('created_at', { ascending: false })
    ])

    if (accessoriesRes.error) {
      console.error('Error loading accessories:', accessoriesRes.error)
    } else {
      setAccessories(accessoriesRes.data || [])
    }
    if (piecesRes.error) {
      console.error('Error loading accessory pieces:', piecesRes.error)
    } else {
      setAccessoryPieces(piecesRes.data || [])
    }
    setLoading(false)
  }

  const getAccessoryAvailableQty = (accessoryId) => {
    return accessoryPieces
      .filter((piece) => piece.accessory_id === accessoryId)
      .reduce((sum, piece) => sum + (parseInt(piece.remaining_qty, 10) || 0), 0)
  }

  const getAccessoryAverageCost = (accessoryId) => {
    const pieces = accessoryPieces.filter((piece) => piece.accessory_id === accessoryId)
    if (pieces.length === 0) return null
    const total = pieces.reduce((sum, piece) => sum + (parseFloat(piece.unit_cost || 0) || 0), 0)
    return total / pieces.length
  }

  const resetForm = () => {
    setFormData(DEFAULT_FORM)
    setEditingAccessory(null)
    setSelectedPhotoFile(null)
    setPhotoPreview(null)
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!validateImageFile(file)) {
      return
    }

    setSelectedPhotoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotoPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setUploading(true)

    try {
      let photoUrl = formData.photo_url

      if (selectedPhotoFile) {
        const uploadResult = await processAndUploadImage(
          selectedPhotoFile,
          'accessories',
          `accessory-${Date.now()}`
        )
        photoUrl = uploadResult || ''
      }

      const payload = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        photo_url: photoUrl || null
      }

      if (editingAccessory) {
        const { error } = await supabase
          .from('accessories')
          .update(payload)
          .eq('id', editingAccessory.id)

        if (error) {
          alert('Errore durante la modifica: ' + error.message)
          return
        }

        await logAction(
          'modifica_accessorio',
          'accessorio',
          editingAccessory.id,
          payload.name,
          { changes: payload }
        )
      } else {
        const { data, error } = await supabase
          .from('accessories')
          .insert([payload])
          .select()
          .single()

        if (error) {
          alert('Errore durante la creazione: ' + error.message)
          return
        }

        await logAction(
          'aggiunta_accessorio',
          'accessorio',
          data.id,
          payload.name,
          { accessory: payload }
        )
      }

      await loadAccessories()
      setShowModal(false)
      resetForm()
    } catch (error) {
      console.error('Error:', error)
      alert('Errore durante il salvataggio: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleEdit = (accessory) => {
    setEditingAccessory(accessory)
    setFormData({
      name: accessory.name || '',
      description: accessory.description || '',
      photo_url: accessory.photo_url || ''
    })
    setSelectedPhotoFile(null)
    setPhotoPreview(accessory.photo_url || null)
    setShowModal(true)
  }

  const handleDelete = async (accessory) => {
    if (!confirm(`Eliminare l'accessorio "${accessory.name}"?`)) return

    const { error } = await supabase.from('accessories').delete().eq('id', accessory.id)
    if (error) {
      alert('Errore durante l\'eliminazione: ' + error.message)
      return
    }

    if (accessory.photo_url) {
      await deleteImageFromStorage(accessory.photo_url, 'accessories')
    }

    await logAction(
      'eliminazione_accessorio',
      'accessorio',
      accessory.id,
      accessory.name,
      { accessory }
    )

    await loadAccessories()
  }

  const handleOpenPiecesModal = (accessory, mode = 'view') => {
    setSelectedAccessoryForPieces(accessory)
    setEditingPiece(null)
    setPiecesModalMode(mode)
    setPieceForm({
      unit_cost: '',
      remaining_qty: 1,
      purchase_account: 'Fabio',
      purchased_from: ''
    })
    setShowPiecesModal(true)
  }

  const handleSavePiece = async (e) => {
    e.preventDefault()
    if (!selectedAccessoryForPieces) return

    const qty = parseInt(pieceForm.remaining_qty, 10)
    if (!qty || qty <= 0) {
      alert('Inserisci una quantità valida')
      return
    }

    const payload = {
      accessory_id: selectedAccessoryForPieces.id,
      unit_cost: pieceForm.unit_cost === '' ? 0 : parseFloat(pieceForm.unit_cost),
      remaining_qty: qty,
      purchase_account: pieceForm.purchase_account,
      purchased_from: pieceForm.purchased_from?.trim() || null
    }

    const { error } = editingPiece
      ? await supabase
          .from('accessory_pieces')
          .update(payload)
          .eq('id', editingPiece.id)
      : await supabase
          .from('accessory_pieces')
          .insert([payload])

    if (error) {
      alert('Errore durante il salvataggio pezzi: ' + error.message)
      return
    }

    await loadAccessories()
    setEditingPiece(null)
    setPieceForm({
      unit_cost: '',
      remaining_qty: 1,
      purchase_account: 'Fabio',
      purchased_from: ''
    })
  }

  const handleEditPiece = (piece) => {
    setEditingPiece(piece)
    setPiecesModalMode('edit')
    setPieceForm({
      unit_cost: piece.unit_cost ?? '',
      remaining_qty: piece.remaining_qty ?? 1,
      purchase_account: piece.purchase_account || 'Fabio',
      purchased_from: piece.purchased_from || ''
    })
  }

  const handleDeletePiece = async (piece) => {
    if (!confirm('Eliminare questo pezzo?')) return
    const { error } = await supabase
      .from('accessory_pieces')
      .delete()
      .eq('id', piece.id)
    if (error) {
      alert('Errore durante l\'eliminazione: ' + error.message)
      return
    }
    await loadAccessories()
  }

  if (loading) return <div className="loading">Caricamento...</div>

  return (
    <div className="accessories-page">
      <div className="page-header">
        <h1>Accessori</h1>
        <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true) }}>
          <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
          Nuovo Accessorio
        </button>
      </div>

      <div className="accessories-table-container">
        <table className="accessories-table">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Nome</th>
              <th>Quantità</th>
              <th>Costo medio</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {accessories.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-state">
                  Nessun accessorio presente
                </td>
              </tr>
            ) : (
              accessories.map((accessory) => (
                <tr
                  key={accessory.id}
                  onClick={() => handleOpenPiecesModal(accessory, 'view')}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    {accessory.photo_url ? (
                      <img
                        src={accessory.photo_url}
                        alt={accessory.name}
                        className="accessory-photo"
                      />
                    ) : (
                      <span className="muted">N/A</span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{accessory.name}</div>
                    {accessory.description && (
                      <div className="muted" style={{ fontSize: '12px' }}>{accessory.description}</div>
                    )}
                  </td>
                  <td>{getAccessoryAvailableQty(accessory.id)}</td>
                  <td>
                    {(() => {
                      const avg = getAccessoryAverageCost(accessory.id)
                      return avg === null ? 'N/A' : `€${avg.toFixed(2)}`
                    })()}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-secondary"
                        onClick={(e) => { e.stopPropagation(); handleOpenPiecesModal(accessory, 'add') }}
                        title="Aggiungi pezzi"
                      >
                        <FontAwesomeIcon icon={faPlus} />
                      </button>
                      <button className="btn-edit" onClick={(e) => { e.stopPropagation(); handleEdit(accessory) }} title="Modifica">
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button className="btn-delete" onClick={(e) => { e.stopPropagation(); handleDelete(accessory) }} title="Elimina">
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
            <h2>{editingAccessory ? 'Modifica Accessorio' : 'Nuovo Accessorio'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nome</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Descrizione</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="photo-upload">
                <label>Foto</label>
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
                {photoPreview && (
                  <img src={photoPreview} alt="Anteprima" className="photo-preview" />
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); resetForm() }}>
                  Annulla
                </button>
                <button type="submit" className="btn-primary" disabled={uploading}>
                  {uploading ? 'Salvataggio...' : 'Salva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPiecesModal && selectedAccessoryForPieces && (
        <div className="modal-overlay" onClick={() => { setShowPiecesModal(false); setSelectedAccessoryForPieces(null); setEditingPiece(null); setPiecesModalMode('view') }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingPiece ? 'Modifica pezzo' : 'Pezzi disponibili'}</h2>
            <p style={{ color: '#7f8c8d', marginBottom: '20px' }}>
              Accessorio: <strong>{selectedAccessoryForPieces.name}</strong>
            </p>
            {(piecesModalMode !== 'view' || editingPiece) && (
              <form onSubmit={handleSavePiece}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Quantità</label>
                    <input
                      type="number"
                      min="1"
                      value={pieceForm.remaining_qty}
                      onChange={(e) => setPieceForm({ ...pieceForm, remaining_qty: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Costo unitario (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pieceForm.unit_cost}
                      onChange={(e) => setPieceForm({ ...pieceForm, unit_cost: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Account</label>
                    <select
                      value={pieceForm.purchase_account}
                      onChange={(e) => setPieceForm({ ...pieceForm, purchase_account: e.target.value })}
                    >
                      <option value="Fabio">Fabio</option>
                      <option value="Mesmerized SRLS">Mesmerized SRLS</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Acquistato da</label>
                    <input
                      type="text"
                      value={pieceForm.purchased_from}
                      onChange={(e) => setPieceForm({ ...pieceForm, purchased_from: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => { setShowPiecesModal(false); setSelectedAccessoryForPieces(null); setEditingPiece(null); setPiecesModalMode('view') }}>
                    Annulla
                  </button>
                  <button type="submit" className="btn-primary">
                    {editingPiece ? 'Salva' : 'Aggiungi'}
                  </button>
                </div>
              </form>
            )}

            {piecesModalMode !== 'add' && (
              <div style={{ marginTop: '25px' }}>
                <h3 style={{ marginBottom: '12px' }}>Pezzi disponibili</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {accessoryPieces.filter((piece) => piece.accessory_id === selectedAccessoryForPieces.id && parseInt(piece.remaining_qty, 10) > 0).length === 0 ? (
                    <div className="muted">Nessun pezzo disponibile</div>
                  ) : (
                    accessoryPieces
                      .filter((piece) => piece.accessory_id === selectedAccessoryForPieces.id && parseInt(piece.remaining_qty, 10) > 0)
                      .map((piece) => (
                        <div
                          key={piece.id}
                          style={{
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              Qtà: {piece.remaining_qty} · €{parseFloat(piece.unit_cost || 0).toFixed(2)} cad.
                            </div>
                            <div className="muted" style={{ fontSize: '12px' }}>
                              {piece.purchase_account} {piece.purchased_from ? `· ${piece.purchased_from}` : ''}
                            </div>
                          </div>
                          <div className="action-buttons">
                            <button className="btn-edit" onClick={() => handleEditPiece(piece)} title="Modifica">
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                            <button className="btn-delete" onClick={() => handleDeletePiece(piece)} title="Elimina">
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
