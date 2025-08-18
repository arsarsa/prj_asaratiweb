// src/scripts/payments/cryptoPayment.js
// Placeholder pagamento Crypto - interazioni callable Firebase Functions

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../logic/firebase-config.js';
import { isValidEmail, isNonEmptyString } from '../../utils/commonFrontend.js';

/**
 * Inizia una transazione crypto (es. Coinbase Commerce o altro).
 * @param {string} productId - ID del prodotto.
 * @param {string} email - Email per la conferma (opzionale).
 * @returns {Promise<object>} - { paymentUrl, transactionId }
 */
export async function createCryptoTransaction({ productId, email }) {
  if (!isNonEmptyString(productId)) throw new Error('ID prodotto non valido.');
  if (email && !isValidEmail(email)) throw new Error('Email non valida.');

  const callable = httpsCallable(functions, 'createCryptoTransaction');
  const result = await callable({ productId, email });
  return result.data;
}

/**
 * Polling: verifica lo stato della transazione.
 * @param {string} transactionId
 * @returns {Promise<object>} - { status: 'pending' | 'confirmed' | 'failed' }
 */
export async function checkCryptoTransactionStatus(transactionId) {
  if (!isNonEmptyString(transactionId)) throw new Error('ID transazione non valido.');

  const callable = httpsCallable(functions, 'checkCryptoTransactionStatus');
  const result = await callable({ transactionId });
  return result.data;
}
