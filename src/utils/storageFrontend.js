// src/utils/storageFrontend.js
// Utility frontend per ottenere URL firmate da Firebase Storage, usando config condivisa

import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";
import { app } from '../logic/firebase-config.js';  // importa app Firebase unica per frontend
import { isNonEmptyString } from './commonFrontend.js';

function logInfo(message, data) {
  console.log(`ℹ️ INFO: ${message}`, data || '');
}

function logError(message, data) {
  console.error(`❌ ERROR: ${message}`, data || '');
}

/**
 * Recupera URL firmato da Firebase Storage per un percorso specifico.
 * @param {string} pathStorage - Percorso file in Firebase Storage
 * @returns {Promise<string>} - URL firmata download
 */
export async function getDownloadURLFromStorage(pathStorage) {
  if (!isNonEmptyString(pathStorage)) {
    const errorMsg = 'Percorso Storage non valido.';
    logError(errorMsg, pathStorage);
    throw new Error(errorMsg);
  }
  try {
    const storage = getStorage(app);
    const fileRef = ref(storage, pathStorage);
    const url = await getDownloadURL(fileRef);
    logInfo('URL download generata con successo.', { pathStorage });
    return url;
  } catch (error) {
    logError('Errore nel recupero dell\'URL download.', { pathStorage, error });
    throw error;
  }
}
