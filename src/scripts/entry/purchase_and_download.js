// src/scripts/entry/purchase_and_download.js
// Frontend - Gestione dinamica acquisto + download + (eventuale) newsletter

import {
  createPaymentIntent,
  getStripePublicKey,
  getDownloadURLForFile,
  subscribeToNewsletter
} from '../../utils/paymentUtils.js';

async function purchaseAndDownload({ ebookId, email, wantsNewsletter }) {
  try {
    showStatus('🔑 Connessione con Stripe...');

    const publicKey = await getStripePublicKey();
    const stripe = Stripe(publicKey);

    showStatus('💳 Preparazione pagamento...');
    const { clientSecret } = await createPaymentIntent({ productId: ebookId, email });

    showStatus('📲 Attendi conferma del pagamento...');
    const result = await stripe.confirmCardPayment(clientSecret);
    console.log('🧾 Stripe Result:', result);

    if (result.error) {
      console.error('❌ Errore durante il pagamento:', result.error.message);
      showStatus('❌ Pagamento fallito: ' + result.error.message);
      setTimeout(hideStatus, 6000);
      return;
    }

    if (result.paymentIntent.status === 'succeeded') {
      showStatus('✅ Pagamento riuscito!');

      if (wantsNewsletter) {
        showStatus('📩 Iscrizione alla newsletter...');
        await subscribeToNewsletter(email);
      }

      showStatus('⬇️ Preparazione download...');
      const { downloadUrl } = await getDownloadURLForFile(ebookId);

      if (!downloadUrl) {
        showStatus('❌ Errore: URL di download non disponibile.');
        console.error('⚠️ Nessun URL ricevuto per il file', ebookId);
        setTimeout(hideStatus, 6000);
        return;
      }

      showStatus('📦 Avvio del download...');
      // Avvio download
      window.location.href = downloadUrl;

      setTimeout(hideStatus, 4000);
    }
  } catch (error) {
    console.error('❌ Errore durante la procedura:', error);
    showStatus('❌ Errore: ' + (error.message || 'Errore imprevisto.'));
    setTimeout(hideStatus, 6000);
  }
}

export { purchaseAndDownload };
