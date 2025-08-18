// src/scripts/flow/freeDownloadFlow.js

import { getDownloadURLForFile, subscribeToNewsletter } from '../utils/paymentUtils.js';
import { isValidEmail, isNonEmptyString } from '../utils/commonFrontend.js';

export async function initFreeDownloadFlow({ productId, email = '', wantsNewsletter = false }) {
  try {
    if (!isNonEmptyString(productId)) throw new Error('ID prodotto non valido.');
    if (wantsNewsletter && !isValidEmail(email)) throw new Error('Email non valida.');

    showStatus('⬇️ Preparazione del download...');

    const downloadUrl = await getDownloadURLForFile(productId);
    if (!downloadUrl) throw new Error('URL di download non disponibile.');

    if (wantsNewsletter) {
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
