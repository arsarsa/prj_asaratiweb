// functions/payment/stripeWebhook.js
// Backend

import * as functions from 'firebase-functions';
import Stripe from 'stripe';
import { firestore } from '../firebaseAdmin.js';

// Chiave segreta Stripe da config functions o env (fallback)
const stripeSecret = process.env.STRIPE_SECRET || functions.config().stripe?.secret;
if (!stripeSecret) throw new Error('Chiave Stripe segreta mancante.');

const stripe = new Stripe(stripeSecret, {
  apiVersion: '2023-10-16',
});

// Webhook endpoint HTTPS da Stripe
export const stripeWebhook = functions
  .region('europe-west1')
  .https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = functions.config().stripe?.webhook_secret;

    if (!webhookSecret) {
      functions.logger.error('Webhook Stripe: webhook_secret mancante in config.');
      return res.status(500).send('Errore configurazione webhook');
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      functions.logger.error('Webhook Stripe: verifica firma fallita', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const data = event.data.object;

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          // Aggiorna stato ordine in Firestore
          const orderId = data.metadata?.orderId;
          if (!orderId) {
            functions.logger.warn('Webhook Stripe: payment_intent.succeeded senza orderId');
            break;
          }

          await firestore.collection('orders').doc(orderId).update({
            status: 'paid',
            paymentIntentId: data.id,
            paidAt: new Date().toISOString(),
          });

          // Salva info pagamento per riferimento
          await firestore.collection('payments').doc(data.id).set(data);

          functions.logger.info(`Pagamento confermato per ordine ${orderId}`);
          break;

        case 'payment_intent.payment_failed':
          functions.logger.info(`Pagamento fallito per PaymentIntent ${data.id}`);
          break;

        // Puoi aggiungere altri eventi Stripe se necessario

        default:
          functions.logger.info(`Evento Stripe non gestito: ${event.type}`);
      }
    } catch (error) {
      functions.logger.error('Errore gestione evento webhook Stripe', error);
      return res.status(500).send('Errore interno gestione webhook');
    }

    // Risposta 200 OK a Stripe
    res.json({ received: true });
  });

