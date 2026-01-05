import { supabase } from './supabase'

/**
 * Registra un'operazione nel log
 * @param {string} actionType - Tipo di azione (es: 'aggiunta_materiale', 'modifica_modello', ecc.)
 * @param {string} entityType - Tipo di entità ('materiale', 'modello', 'prodotto')
 * @param {string} entityId - ID dell'entità
 * @param {string} entityName - Nome/SKU dell'entità per riferimento rapido
 * @param {object} details - Dettagli aggiuntivi dell'operazione (opzionale)
 */
export async function logAction(actionType, entityType, entityId, entityName, details = {}) {
  try {
    // Ottieni l'utente corrente
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.warn('Nessun utente loggato, impossibile registrare il log')
      return
    }

    const { error } = await supabase
      .from('logs')
      .insert([
        {
          user_id: user.id,
          user_email: user.email || 'unknown',
          action_type: actionType,
          entity_type: entityType,
          entity_id: entityId,
          entity_name: entityName,
          details: details
        }
      ])

    if (error) {
      console.error('Errore durante la registrazione del log:', error)
    }
  } catch (error) {
    console.error('Errore durante la registrazione del log:', error)
  }
}

