// src/scripts/payments/paypalPayment.js (placeholder)
//

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase-config.js';

/**
 * ✅ Crea un ordine PayPal lato server (tramite Firebase Function).
 * @param {string} productId - ID del prodotto da acquistare.
 * @param {string} email - Email per la ricevuta (opzionale ma consigliato).
 * @returns {Promise<string>} - ID dell’ordine PayPal.
 */
export async function createPayPalOrder({ productId, email }) {
  const callable = httpsCallable(functions, 'createPayPalOrder');
  const result = await callable({ productId, email });
  return result.data.orderId;
}

/**
 * ✅ Cattura il pagamento PayPal (una volta autorizzato nel frontend).
 * @param {string} orderId - ID dell’ordine da catturare.
 * @returns {Promise<object>} - Risultato della cattura.
 */
export async function capturePayPalOrder(orderId) {
  const callable = httpsCallable(functions, 'capturePayPalOrder');
  const result = await callable({ orderId });
  return result.data;
}

/**
 * ✅ Ottieni URL del file acquistato.
 */
export async function getDownloadURLForFile(productId) {
  const callable = httpsCallable(functions, 'getDownloadUrl');
  const result = await callable({ productId });
  return result.data.downloadUrl;
}
