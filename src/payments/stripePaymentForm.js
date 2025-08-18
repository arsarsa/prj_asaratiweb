// src/scripts/payments/stripePaymentForm.js
// Frontend (Pagamento Stripe)

import { loadStripeAndMountCard, createPaymentIntent } from '../utils/paymentUtils.js';
import { initPaidDownloadFlow } from '../flow/paidDownloadFlow.js';
import { isValidEmail, isNonEmptyString } from '../../utils/commonFrontend.js';

export async function initStripeForm() {
  const emailInput = document.querySelector('#stripeEmail');
  const newsletterCheckbox = document.querySelector('#newsletterConsent');
  const submitButton = document.querySelector('#stripeSubmitButton');
  const statusText = document.querySelector('#paymentResult');

  if (!emailInput || !submitButton || !statusText) {
    console.error('❌ Elementi mancanti nel DOM.');
    return;
  }

  const { stripe, card } = await loadStripeAndMountCard();

  submitButton.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const wantsNewsletter = newsletterCheckbox?.checked;
    const ebookId = sessionStorage.getItem("selectedFilename") || "ebook1";

    if (!isValidEmail(email)) {
      statusText.textContent = 'Email non valida.';
      return;
    }

    if (!isNonEmptyString(ebookId)) {
      statusText.textContent = 'ID prodotto non valido.';
      return;
    }

    submitButton.disabled = true;
    statusText.textContent = '⏳ Elaborazione pagamento...';

    try {
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card,
        billing_details: { email }
      });

      if (error) throw error;

      const { clientSecret } = await createPaymentIntent({ productId: ebookId, email });

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: paymentMethod.id
      });

      if (result.error) throw result.error;

      if (result.paymentIntent.status === 'succeeded') {
        statusText.textContent = '✅ Pagamento riuscito!';
        await initPaidDownloadFlow({ productId: ebookId, email, wantsNewsletter });
      } else {
        statusText.textContent = 'Pagamento non completato.';
      }
    } catch (err) {
      console.error(err);
      statusText.textContent = 'Errore: ' + (err.message || 'Errore sconosciuto');
    } finally {
      submitButton.disabled = false;
    }
  });
}
