// src/scripts/utils/fileUtils.js

import { showMessage } from './modalUI.js';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';

const storage = getStorage(); // Firebase app già inizializzata altrove

/**
 * Scarica un file da Firebase Storage, distinguendo tra public e protected.
 * @param {string} fileId - Il nome base del file, senza estensione.
 * @param {Object} options - Opzioni di download.
 * @param {boolean} [options.protected=false] - Se il file è protetto (a pagamento).
 * @param {string} [options.subfolder] - Se protetto: eBook, audioBook, boxBook.
 */
export async function triggerDownload(fileId, options = {}) {
  if (!fileId) {
    showMessage("Errore: file mancante.");
    return;
  }

  const { protected: isProtected = false, subfolder = '' } = options;

  let storagePath;
  if (isProtected) {
    if (!subfolder) {
      showMessage("Errore: cartella protetta mancante.");
      return;
    }
    storagePath = `protected_files/${subfolder}/${fileId}.pdf`;
  } else {
    storagePath = `public_files/${fileId}.pdf`;
  }

  try {
    const fileRef = ref(storage, storagePath);
    const url = await getDownloadURL(fileRef);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileId}.pdf`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showMessage(`Download avviato: ${fileId}.pdf`);
  } catch (error) {
    console.error("Errore durante il download:", error);
    showMessage("Errore durante il download del file.");
  }
}
