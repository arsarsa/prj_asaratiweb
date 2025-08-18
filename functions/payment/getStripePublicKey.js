// functions/payment/getStripePublicKey.js
// Backend - Firebase Cloud Function per fornire chiave pubblica Stripe

import * as functions from 'firebase-functions';

export const getStripePublicKey = functions
  .region('europe-west1')
  .https.onCall((data, context) => {
    // Nessun controllo su context.auth - chiave pubblica può essere distribuita liberamente

    const isLocalhost = data?.isLocalhost === true;

    // Recupera la configurazione Functions
    const config = functions.config();

    // Se siamo in localhost, preferisci la chiave di test ("test_public_key") o fallback a "public_key"
    // Altrimenti la chiave live ("live_public_key")
    const publicKey = isLocalhost
      ? config.stripe?.test_public_key || config.stripe?.public_key
      : config.stripe?.live_public_key;

    if (!publicKey) {
      throw new functions.https.HttpsError('not-found', 'Chiave Stripe pubblica non trovata.');
    }

    return { publicKey };
  });
