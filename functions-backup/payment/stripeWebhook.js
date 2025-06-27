// functions/payment/stripeWebhook.js
// Backend

import express from "express";
import bodyParser from "body-parser";
import * as functions from "firebase-functions";
import Stripe from "stripe";
import admin from "../utils/firebaseAdmin.js";
import dotenv from "dotenv";

dotenv.config();

const stripeSecret = functions.config().stripe?.secret || process.env.STRIPE_SECRET;
const stripeWebhookSecret = functions.config().stripe?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecret || !stripeWebhookSecret) {
  throw new Error("❌ Chiavi Stripe mancanti: verifica la configurazione in Firebase Functions o .env");
}

const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" });

const app = express();
app.use(bodyParser.raw({ type: "application/json" }));

app.post("/", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("❌ Header stripe-signature mancante");

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    console.log(`✅ Evento Stripe ricevuto: ${event.type}`);
  } catch (err) {
    console.error("❌ Errore validazione webhook:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const productId = paymentIntent.metadata?.productId;
    const productType = paymentIntent.metadata?.productType;
    const email = paymentIntent.metadata?.email || paymentIntent.receipt_email || "sconosciuto";
    const paymentIntentId = paymentIntent.id;

    if (!productId || !productType) {
      console.error("❌ Metadata incompleti nel payment intent");
      return res.status(400).send("Metadata mancanti.");
    }

    const purchaseRef = admin.firestore().collection("purchases").doc(paymentIntentId);
    const snapshot = await purchaseRef.get();
    if (snapshot.exists) {
      console.log(`ℹ️ Pagamento già registrato: ${paymentIntentId}`);
      return res.status(200).send("Pagamento già registrato.");
    }

    try {
      await purchaseRef.set({
        productId,
        productType,
        email,
        paymentIntentId,
        status: "completed",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ Acquisto registrato: ${productType} - ${productId}`);
      return res.status(200).send("Pagamento registrato con successo.");
    } catch (error) {
      console.error("❌ Errore scrittura Firestore:", error);
      return res.status(500).send("Errore interno.");
    }
  }

  res.status(400).send("Evento non gestito.");
});

export const stripeWebhook = functions.region("europe-west1").https.onRequest(app);
