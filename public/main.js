// src/assets/main.js
// Frontend (Entry point JS del frontend)

import '../style/asarati_style.css';
import '../scripts/entry/paymentModal.js';
import { purchaseAndDownload } from '../scripts/entry/purchase_and_download.js';

window.testClick = function () {
  console.log("✅ Bottone 3D cliccato!");
};

window.purchaseAndDownload = purchaseAndDownload; // Esponi per richiamo da HTML o Verge3D

window.addEventListener("message", (event) => {
  const { action, payload } = event.data;

  if (action === "testClick") window.testClick();

  if (action === "openPaymentModal") {
    console.log("✅ Richiesta di apertura modale ricevuta!");
    document.getElementById("paymentModal")?.classList.remove("hidden");
  }

  if (action === "purchaseAndDownload") {
    // Esempio: payload = { ebookId, email, wantsNewsletter }
    purchaseAndDownload(payload);
  }
});
