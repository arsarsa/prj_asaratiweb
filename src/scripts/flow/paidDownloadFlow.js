// src/scripts/flow/paidDownloadFlow.js

import {
  getStripePublicKey,
  createPaymentIntent,
  getDownloadURLForFile,
  subscribeToNewsletter
} from '@utils/paymentUtils.js';

import { isValidEmail, isNonEmptyString } from '@utils/commonFrontend.js';

export async function initPaidDownloadFlow({ productId, email, wantsNewsletter }) {
  try {
    if (!isNonEmptyString(productId)) throw new Error('ID prodotto non valido.');
    if (!isValidEmail(email)) throw new Error('Email non valida.');

    showStatus('💳 Avvio procedura di pagamento...');

    const publicKey = await getStripePublicKey();
    const stripe = Stripe(publicKey);

    const { clientSecret } = await createPaymentIntent({ productId, email });

    showStatus('📲 Attendi conferma del pagamento...');
    const result = await stripe.confirmCardPayment(clientSecret);

    if (result.error) throw new Error(result.error.message);

    if (result.paymentIntent.status === 'succeeded') {
      showStatus('✅ Pagamento riuscito!');

      if (wantsNewsletter) {
        showStatus('📩 Iscrizione alla newsletter...');
        await subscribeToNewsletter(email);
      }

      const downloadUrl = await getDownloadURLForFile(productId);
      if (!downloadUrl) throw new Error('URL di download non disponibile.');

      showStatus('⬇️ Avvio del download...');
      window.location.href = downloadUrl;
    } else {
      throw new Error('Pagamento incompleto.');
    }
  } catch (error) {
    console.error('❌ Errore nel flusso di pagamento:', error);
    showStatus(`Errore: ${error.message}`);
  } finally {
    setTimeout(hideStatus, 6000);
  }
}
