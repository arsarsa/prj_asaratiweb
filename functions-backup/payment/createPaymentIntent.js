// functions/payment/createPaymentIntent.js
// Backend (Firebase Cloud Function - Stripe PaymentIntent)

import * as functions from "firebase-functions";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const stripeSecret = functions.config().stripe?.secret || process.env.STRIPE_SECRET;
const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" });

if (!stripeSecret) {
  throw new Error("La chiave segreta di Stripe è mancante. Configura 'stripe.secret' o 'STRIPE_SECRET'.");
}

export const createPaymentIntent = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
      const { amount, currency, metadata, receiptEmail } = data;

    // Controlli basilari
    if (!amount || typeof amount !== "number" || amount <= 0) {
      throw new functions.https.HttpsError("invalid-argument", "L'importo fornito non è valido.");
    }
    if (!currency || typeof currency !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "La valuta fornita non è valida.");
    }
    if (!receiptEmail || typeof receiptEmail !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "L'email del destinatario è mancante o non valida.");
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        metadata: metadata || {}, // Default vuoto se non fornito
        receipt_email: receiptEmail,
        automatic_payment_methods: { enabled: true },
      });

      functions.logger.info("✅ PaymentIntent creato con successo", {
        id: paymentIntent.id,
        amount,
        currency,
      });

      return { clientSecret: paymentIntent.client_secret };
    } catch (error) {
      console.error("❌ Errore durante la creazione del PaymentIntent:", error);
      throw new functions.https.HttpsError("internal", "Errore interno nella creazione del pagamento.");
    }
  });
