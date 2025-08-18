// src/scripts/payments/paypalPayment.js
// Placeholder pagamento PayPal - interazioni callable Firebase Functions

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../logic/firebase-config.js';
import { isValidEmail, isNonEmptyString } from '../../utils/commonFrontend.js';

/**
 * Crea un ordine PayPal lato server.
 * @param {string} productId
 * @param {string} email
 * @returns {Promise<string>} orderId
 */
export async function createPayPalOrder({ productId, email }) {
  if (!isNonEmptyString(productId)) throw new Error('ID prodotto non valido.');
  if (email && !isValidEmail(email)) throw new Error('Email non valida.');

  const callable = httpsCallable(functions, 'createPayPalOrder');
  const result = await callable({ productId, email });
  return result.data.orderId;
}

/**
 * Cattura pagamento PayPal lato server.
 * @param {string} orderId
 * @returns {Promise<object>}
 */
export async function capturePayPalOrder(orderId) {
  if (!isNonEmptyString(orderId)) throw new Error('ID ordine non valido.');

  const callable = httpsCallable(functions, 'capturePayPalOrder');
  const result = await callable({ orderId });
  return result.data;
}
