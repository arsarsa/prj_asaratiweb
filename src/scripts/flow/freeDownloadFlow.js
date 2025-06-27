// src/scripts/flow/freeDownloadFlow.js

import { getDownloadURLForFile, subscribeToNewsletter } from '../utils/paymentUtils.js';

export async function initFreeDownloadFlow({ productId, email = '', wantsNewsletter = false }) {
  try {
    showStatus('⬇️ Preparazione del download...');

    const downloadUrl = await getDownloadURLForFile(productId);
    if (!downloadUrl) throw new Error('URL di download non disponibile.');

    if (wantsNewsletter && email) {
      await subscribeToNewsletter(email);
    }

    showStatus('📦 Avvio del download...');
    window.location.href = downloadUrl;
    setTimeout(hideStatus, 4000);
  } catch (error) {
    console.error('❌ Errore nel download gratuito:', error);
    showStatus(`Errore: ${error.message}`);
    setTimeout(hideStatus, 6000);
  }
}
