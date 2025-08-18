// public/js/paymentModal.js

import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe('pk_test_...'); // chiave pubblica

export async function processPayment(productId, email, quantity, anonUid, paymentMethod = 'stripe') {
  try {
    // 1. Invia ordine al backend per creazione
    const response = await fetch('/api/createOrder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, paymentMethod, quantity, anonUid, email }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Errore ordine');

    // 2. Crea PaymentIntent (lato backend o frontend, qui ipotizziamo backend)
    const clientSecret = await fetchClientSecret(data.orderId);

    // 3. Conferma pagamento con Stripe UI
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: { email },
      },
    });
    if (error) throw error;

    if (paymentIntent.status === 'succeeded') {
      // 4. Genera downloadToken
      const downloadToken = crypto.randomUUID();

      // 5. Salva downloadToken in DB (usando endpoint o SDK)
      await saveDownloadToken(downloadToken, email, productId);

      // 6. Avvia download
      gestisciDownloadAutomatico(downloadToken);

      alert('Pagamento completato, download avviato!');
    }
  } catch (err) {
    console.error('Errore pagamento:', err);
    alert('Errore durante il pagamento: ' + err.message);
  }
}
