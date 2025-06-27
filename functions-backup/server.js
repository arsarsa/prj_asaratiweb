// functions/server.js - Punto di ingresso principale

import express from "express";
import fs from "fs";
import path from "path";
import { createPaymentIntent } from "./payments/index.js";
import { validatePaymentMethod } from "./payments/index.js";
import { updateDownloadCount } from "./counters/index.js";
import admin from "firebase-admin";

// Leggi il file JSON products.json
const products = JSON.parse(fs.readFileSync(path.resolve("functions/utils/products.json"), "utf-8"));

// Non dichiarare di nuovo la funzione getProduct se già esiste
const getProduct = (productId) => {
  return products.find((product) => product.id === productId);
};

admin.initializeApp();
const app = express();
app.use(express.json());

app.post("/purchase", async (req, res) => {
    const { productId, paymentMethod } = req.body;

    const product = getProduct(productId);
    if (!product) {
        return res.status(400).json({ error: "Prodotto non valido" });
    }

    if (!validatePaymentMethod(paymentMethod)) {
        return res.status(400).json({ error: "Metodo di pagamento non valido" });
    }

    const paymentConfirmed = true; // Logica del pagamento (esempio)

    if (paymentConfirmed) {
        await updateDownloadCounter(productId);
        const file = admin.storage().bucket().file(product.filePath);
        const expirationTime = Date.now() + 15 * 60 * 1000; // 15 minuti
        const options = {
            action: 'read',
            expires: expirationTime,
        };

        try {
            const [url] = await file.getSignedUrl(options);
            return res.json({
                success: true,
                message: "Acquisto confermato e contatore aggiornato.",
                downloadLink: url
            });
        } catch (error) {
            return res.status(500).json({ error: "Errore nella generazione del link di download" });
        }
    } else {
        return res.status(400).json({ error: "Pagamento non confermato" });
    }
});

app.listen(3000, () => console.log("Server in esecuzione sulla porta 3000"));
