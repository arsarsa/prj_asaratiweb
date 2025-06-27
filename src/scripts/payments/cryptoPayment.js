// src/scripts/payments/cryptoPayment.js (placeholder)
//

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase-config.js';

/**
 * ✅ Inizia una transazione crypto (es. con Coinbase Commerce o altro).
 * @param {string} productId - ID del prodotto.
 * @param {string} email - Email per la conferma (opzionale).
 * @returns {Promise<object>} - { paymentUrl, transactionId }
 */
export async function createCryptoTransaction({ productId, email }) {
  const callable = httpsCallable(functions, 'createCryptoTransaction');
  const result = await callable({ productId, email });
  return result.data; // es. { paymentUrl, transactionId }
}

/**
 * 🔁 Polling (opzionale): verifica lo stato della transazione.
 * @param {string} transactionId
 * @returns {Promise<object>} - { status: 'pending' | 'confirmed' | 'failed' }
 */
export async function checkCryptoTransactionStatus(transactionId) {
  const callable = httpsCallable(functions, 'checkCryptoTransactionStatus');
  const result = await callable({ transactionId });
  return result.data;
}

/**
 * ✅ Ottieni URL firmato per il download dopo conferma.
 */
export async function getDownloadURLForFile(productId) {
  const callable = httpsCallable(functions, 'getDownloadUrl');
  const result = await callable({ productId });
  return result.data.downloadUrl;
}
