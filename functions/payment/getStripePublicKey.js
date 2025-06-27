// functions/payment/getStripePublicKey.js
// Backend - Cloud Function

import { https } from 'firebase-functions';
import { region } from 'firebase-functions';
import * as functions from 'firebase-functions';

export const getStripePublicKey = region('europe-west1').https.onCall((data, context) => {
  // ✅ Nessun controllo su context.auth

  const isLocalhost = data.isLocalhost || false;

  const config = functions.config();

  const publicKey = isLocalhost
    ? config.stripe.test_public_key || config.stripe.public_key
    : config.stripe.live_public_key;

  if (!publicKey) {
    throw new https.HttpsError('not-found', 'Chiave Stripe pubblica non trovata.');
  }

  return { publicKey };
});
