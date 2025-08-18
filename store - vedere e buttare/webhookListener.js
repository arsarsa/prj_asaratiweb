// functions/webhookListener.js

import Stripe from 'stripe';
import { db } from './firebaseAdmin.js';
import functions from 'firebase-functions';

const stripe = new Stripe(functions.config().stripe.secret_key);
const endpointSecret = functions.config().stripe.webhook_secret;

export const handlePaymentWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    functions.logger.error('Webhook signature verification failed.', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const data = event.data.object;

  switch (event.type) {
    case 'payment_intent.succeeded':
      // Aggiorna stato ordine e salva info in payments/stripe/
      try {
        const orderId = data.metadata.orderId;
        await db.collection('orders').doc(orderId).update({
          status: 'paid',
          paymentIntentId: data.id,
          paidAt: new Date().toISOString()
        });
        // Salvataggio info pagamento
        await db.collection('payments').doc(data.id).set(data);
        functions.logger.info(`Pagamento confermato per ordine ${orderId}`);
      } catch (err) {
        functions.logger.error('Errore aggiornamento ordine dopo pagamento', err);
      }
      break;
    // gestisci altri eventi se necessario
    default:
      functions.logger.info(`Evento Stripe non gestito: ${event.type}`);
  }

  res.json({ received: true });
};
