// functions/payment/stripeWebhook.js
// Backend

import express from "express";
import bodyParser from "body-parser";
import Stripe from "stripe";
import admin from "../utils/firebaseAdmin.js";
import dotenv from "dotenv";
import { region, https, logger } from "firebase-functions";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET, { apiVersion: "2023-10-16" });
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const app = express();
app.use(bodyParser.raw({ type: "application/json" }));

app.post("/", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("❌ Header stripe-signature mancante");

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    logger.info(`✅ Evento Stripe ricevuto: ${event.type}`);
  } catch (err) {
    logger.error("❌ Errore validazione webhook:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const productId = paymentIntent.metadata?.productId;
    const productType = paymentIntent.metadata?.productType;
    const email = paymentIntent.metadata?.email || paymentIntent.receipt_email || "sconosciuto";
    const paymentIntentId = paymentIntent.id;

    if (!productId || !productType) {
      logger.error("❌ Metadata incompleti nel payment intent");
      return res.status(400).send("Metadata mancanti.");
    }

    const purchaseRef = admin.firestore().collection("purchases").doc(paymentIntentId);
    const snapshot = await purchaseRef.get();
    if (snapshot.exists) {
      logger.info(`ℹ️ Pagamento già registrato: ${paymentIntentId}`);
      return res.status(200).send("Pagamento già registrato.");
    }

    try {
      await purchaseRef.set({
        productId,
        productType,
        email,
        paymentIntentId,
        status: "completed",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(`✅ Acquisto registrato: ${productType} - ${productId}`);
      return res.status(200).send("Pagamento registrato con successo.");
    } catch (error) {
      logger.error("❌ Errore scrittura Firestore:", error);
      return res.status(500).send("Errore interno.");
    }
  }

  res.status(400).send("Evento non gestito.");
});

export const stripeWebhook = region('europe-west1').https.onRequest((req, res) => {
  app(req, res);
});
