// functions/index.js

import * as functions from 'firebase-functions';
import express from 'express';
import cors from 'cors';

import { createOrder } from './orderHandler.js';
import { handlePaymentWebhook } from './webhookListener.js';
import { generateDownloadLink } from './downloadLinkGenerator.js';

// Importa tutte le funzioni modulari da firebaseFunctions.js
import * as firebaseFunctions from './firebaseFunctions.js';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Endpoint per creazione ordine e inizializzazione pagamento
app.post('/createOrder', createOrder);

// Endpoint webhook per conferma pagamento da gateway (Stripe)
app.post('/paymentWebhook', express.raw({type: 'application/json'}), handlePaymentWebhook);

// Endpoint per generare link download sicuro
app.get('/downloadLink', generateDownloadLink);

// Esposizione server Express come funzione https
export const api = functions.https.onRequest(app);

// Re-esporta tutte le altre funzioni dal modulo firebaseFunctions.js
// Per far sì che Firebase le riconosca e le deployi
export const {
  createPaymentIntent,
  stripeWebhook,
  getStripePublicKey,
  updateDownloadCount,
  getDownloadCount,
  verifyTokenFunction,
  sendConfirmationEmail,
  subscribeToNewsletter,
} = firebaseFunctions;
