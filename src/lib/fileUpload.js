import { supabase } from './supabase'

const MAX_3MF_SIZE = 200 * 1024 * 1024 // 200MB
const ALLOWED_3MF_MIME_TYPES = ['model/3mf', 'application/vnd.ms-package', 'application/octet-stream']

export const validate3mfFile = (file) => {
  if (!file) {
    return { valid: false, error: 'Nessun file selezionato' }
  }

  const fileName = file.name || ''
  if (!fileName.toLowerCase().endsWith('.3mf')) {
    return { valid: false, error: 'Formato non supportato. Carica un file .3mf' }
  }

  if (file.type && !ALLOWED_3MF_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'Tipo file non supportato. Carica un file .3mf' }
  }

  if (file.size > MAX_3MF_SIZE) {
    return {
      valid: false,
      error: 'File troppo grande. Dimensione massima: 200MB'
    }
  }

  return { valid: true, error: null }
}

export const upload3mfToStorage = async (file, bucketName = 'model-3mf', folder = '') => {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`
    const filePath = folder ? `${folder}/${fileName}` : fileName

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      throw error
    }

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

export const delete3mfFromStorage = async (fileUrl, bucketName = 'model-3mf') => {
  try {
    const urlParts = fileUrl.split('/')
    const filePath = urlParts.slice(urlParts.indexOf(bucketName) + 1).join('/')

    if (!filePath) {
      console.warn('Impossibile estrarre il path dal URL:', fileUrl)
      return
    }

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath])

    if (error) {
      console.error('Errore durante l\'eliminazione:', error)
    }
  } catch (error) {
    console.error('Errore durante l\'eliminazione del file:', error)
  }
}
