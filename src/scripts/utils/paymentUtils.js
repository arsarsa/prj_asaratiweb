// src/utils/paymentUtils.js
// Frontend - Utility per gestire interazioni con le Firebase Functions

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../logic/firebase-config.js';

let stripeInstance = null;
let elementsInstance = null;

// 🔐 Recupera la chiave pubblica Stripe tramite callable Firebase
export async function getStripePublicKey() {
  const callable = httpsCallable(functions, 'getStripePublicKey');
  const result = await callable({ isLocalhost: location.hostname === 'localhost' });
  return result.data.publicKey;
}

export async function loadStripeAndMountCard(cardElementId = '#card-element') {
  // Evita di inizializzare Stripe più volte
  if (!stripeInstance) {
    const publicKey = await getStripePublicKey();
    stripeInstance = Stripe(publicKey);
    elementsInstance = stripeInstance.elements();
  }

  const card = elementsInstance.create('card');
  card.mount(cardElementId);
  return { stripe: stripeInstance, card };
}

// ✅ Crea un intent di pagamento per un prodotto
export async function createPaymentIntent({ productId, email }) {
  const callable = httpsCallable(functions, 'createPaymentIntent');
  const result = await callable({ productId, receiptEmail: email, currency: 'eur' });
  return result.data;
}

// ✅ Iscrizione alla newsletter (facoltativa)
export async function subscribeToNewsletter(email) {
  const callable = httpsCallable(functions, 'subscribeNewsletter');
  const result = await callable({ email });
  return result.data;
}

// ✅ Ottieni la signed URL per il download del file acquistato
export async function getDownloadURLForFile(productId) {
  const callable = httpsCallable(functions, 'getDownloadUrl');
  const result = await callable({ productId });
  return result.data.downloadUrl;
}
