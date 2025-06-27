// functions/uploadProducts.js

import admin from "firebase-admin";
import { Storage } from "@google-cloud/storage";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

admin.initializeApp();
const db = admin.firestore();
const storage = new Storage();
const bucketName = "asarati-27c0d.appspot.com"; // Bucket in Firebase Storage

async function uploadFiles() {
    try {
        const rawData = fs.readFileSync("functions/utils/products.json");
        const products = JSON.parse(rawData);

        for (const product of products) {
            const productId = uuidv4(); // Genera un ID univoco per il prodotto
            const fileName = path.basename(product.filePath);
            const destinationPath = `products/${productId}/${fileName}`;

            console.log(`🚀 Uploading: ${product.name} -> ${destinationPath}`);

            // Carica il file su Firebase Storage
            await storage.bucket(bucketName).upload(product.filePath, { destination: destinationPath });

            // Salva i dettagli nel Firestore Database
            await db.collection("products").doc(productId).set({
                name: product.name,
                description: product.description,
                price: product.price,
                filePath: destinationPath, // Salviamo solo il percorso, il link sarà generato su richiesta
                createdAt: admin.firestore.Timestamp.now(),
                salesCount: 0
            });

            console.log(`✅ Caricato: ${product.name} (ID: ${productId})`);
        }
    } catch (error) {
        console.error("❌ Errore durante l'upload:", error);
    }
}

// Avvia il processo di upload
uploadFiles().catch(console.error);
