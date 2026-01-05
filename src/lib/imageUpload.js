import imageCompression from 'browser-image-compression'
import { supabase } from './supabase'

// Formati immagine accettati
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB in bytes

/**
 * Valida il file immagine
 * @param {File} file - Il file da validare
 * @returns {Object} - { valid: boolean, error: string | null }
 */
export const validateImageFile = (file) => {
  if (!file) {
    return { valid: false, error: 'Nessun file selezionato' }
  }

  // Verifica formato
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Formato non supportato. Formati accettati: JPG, PNG, WEBP, GIF`
    }
  }

  // Verifica dimensione
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File troppo grande. Dimensione massima: 5MB`
    }
  }

  return { valid: true, error: null }
}

/**
 * Comprime un'immagine mantenendo una buona qualità
 * @param {File} file - Il file immagine da comprimere
 * @returns {Promise<File>} - Il file compresso
 */
export const compressImage = async (file) => {
  const options = {
    maxSizeMB: 5, // Dimensione massima target (5MB)
    maxWidthOrHeight: 1920, // Larghezza/altezza massima
    useWebWorker: true,
    fileType: file.type,
  }

  try {
    const compressedFile = await imageCompression(file, options)
    return compressedFile
  } catch (error) {
    console.error('Errore durante la compressione:', error)
    throw new Error('Errore durante la compressione dell\'immagine')
  }
}

/**
 * Carica un'immagine su Supabase Storage
 * @param {File} file - Il file da caricare
 * @param {string} bucketName - Nome del bucket (default: 'model-photos')
 * @param {string} folder - Cartella all'interno del bucket (opzionale)
 * @returns {Promise<string>} - URL pubblico dell'immagine caricata
 */
export const uploadImageToStorage = async (file, bucketName = 'model-photos', folder = '') => {
  try {
    // Genera un nome file univoco
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`
    const filePath = folder ? `${folder}/${fileName}` : fileName

    // Carica il file
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      throw error
    }

    // Ottieni l'URL pubblico
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath)

    if (!urlData?.publicUrl) {
      throw new Error('Impossibile ottenere l\'URL pubblico del file')
    }

    return urlData.publicUrl
  } catch (error) {
    console.error('Errore durante il caricamento:', error)
    throw new Error(`Errore durante il caricamento: ${error.message}`)
  }
}

/**
 * Elimina un'immagine da Supabase Storage
 * @param {string} imageUrl - URL completo dell'immagine da eliminare
 * @param {string} bucketName - Nome del bucket (default: 'model-photos')
 * @returns {Promise<void>}
 */
export const deleteImageFromStorage = async (imageUrl, bucketName = 'model-photos') => {
  try {
    // Estrai il path dal URL
    const urlParts = imageUrl.split('/')
    const filePath = urlParts.slice(urlParts.indexOf(bucketName) + 1).join('/')

    if (!filePath) {
      console.warn('Impossibile estrarre il path dal URL:', imageUrl)
      return
    }

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath])

    if (error) {
      console.error('Errore durante l\'eliminazione:', error)
    }
  } catch (error) {
    console.error('Errore durante l\'eliminazione dell\'immagine:', error)
  }
}

/**
 * Funzione completa per processare e caricare un'immagine
 * @param {File} file - Il file immagine da processare
 * @param {string} bucketName - Nome del bucket (default: 'model-photos')
 * @returns {Promise<string>} - URL pubblico dell'immagine caricata
 */
export const processAndUploadImage = async (file, bucketName = 'model-photos') => {
  // Valida il file
  const validation = validateImageFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  // Comprimi l'immagine
  const compressedFile = await compressImage(file)

  // Carica su Supabase Storage
  const publicUrl = await uploadImageToStorage(compressedFile, bucketName)

  return publicUrl
}

