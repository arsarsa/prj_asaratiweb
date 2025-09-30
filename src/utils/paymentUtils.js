// src/utils/paymentUtils.js
// Frontend - Utility per gestire interazioni con Firebase Functions e Stripe frontend integration

import { httpsCallable } from 'firebase/functions';
import { functions } from '../logic/firebase-config.js';

let stripeInstance = null;
let elementsInstance = null;

/**
 * Recupera la chiave pubblica Stripe tramite callable Firebase
 * @returns {Promise<string>} publicKey
 */
export async function getStripePublicKey() {
  const callable = httpsCallable(functions, 'getStripePublicKey');
  const result = await callable({ isLocalhost: location.hostname === 'localhost' });
  return result.data.publicKey;
}

/**
 * Inizializza Stripe e monta l'elemento carta nel DOM (se non già inizializzato)
 * @param {string} cardElementId selettore CSS per montare la card
 * @returns {Promise<{stripe: Object, card: Object}>}
 */
export async function loadStripeAndMountCard(cardElementId = '#card-element') {
  if (!stripeInstance) {
    const publicKey = await getStripePublicKey();
    stripeInstance = Stripe(publicKey);
    elementsInstance = stripeInstance.elements();
  }

  const card = elementsInstance.create('card');
  card.mount(cardElementId);

  return { stripe: stripeInstance, card };
}

/**
 * Crea un PaymentIntent per un prodotto specificato
 * @param {Object} params
 * @param {string} params.productId
 * @param {string} params.email - Email dell'utente che riceverà la ricevuta
 * @returns {Promise<Object>} dati PaymentIntent da backend
 */
export async function createPaymentIntent({ productId, email }) {
  const callable = httpsCallable(functions, 'createPaymentIntent');
  const result = await callable({ productId, receiptEmail: email, currency: 'eur' });
  return result.data;
}

/**
 * Iscrive l'utente alla newsletter
 * @param {string} email
 * @returns {Promise<Object>} risposta backend
 */
export async function subscribeToNewsletter(email) {
  const callable = httpsCallable(functions, 'subscribeToNewsletter');  // Attenzione al nome callable coerente con backend
  const result = await callable({ email });
  return result.data;
}

/**
 * Ottiene la URL firmata per il download del prodotto
 * @param {string} productId
 * @returns {Promise<string>} URL download
 */
export async function getDownloadURLForFile(productId) {
  const callable = httpsCallable(functions, 'getDownloadUrl');
  const result = await callable({ productId });
  return result.data.downloadUrl;
}
