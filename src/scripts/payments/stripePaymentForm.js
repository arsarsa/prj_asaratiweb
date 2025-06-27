// src/scripts/payment/stripePaymentForm.js
// Frontend (Pagamento Stripe)

import { loadStripeAndMountCard } from '../utils/paymentUtils.js';
import { initPaidDownloadFlow } from '../flow/paidDownloadFlow.js';

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

    if (!email.includes('@')) {
      statusText.textContent = 'Email non valida.';
      return;
    }

    try {
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card,
        billing_details: { email }
      });

      if (error) throw error;

      const ebookId = sessionStorage.getItem("selectedFilename") || "ebook1";

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
    }
  });
}
