// src/scripts/entry/paymentModal.js
// Frontend

import { triggerDownload } from '../utils/fileUtils.js';
import { initStripeForm } from "../payments/stripePaymentForm.js";
import { showElement, hideElement, setText, showOnlyContainer } from "../utils/uiUtils.js";

document.addEventListener("DOMContentLoaded", async () => {
  const modal = document.getElementById("paymentModal");
  const paymentOptions = document.getElementById("paymentOptions");
  const stripeFormContainer = document.getElementById("stripeFormContainer");
  const paypalFormContainer = document.getElementById("paypalFormContainer");
  const cryptoFormContainer = document.getElementById("cryptoFormContainer");
  const backToPaymentOptionsBtn = document.getElementById("backToPaymentOptions");
  const closeModalBtn = document.getElementById("closeModal");
  const sectionTitle = document.getElementById("sectionTitle");

  const paymentContainers = [stripeFormContainer, paypalFormContainer, cryptoFormContainer];

  let stripeInitPromise = null;

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (data?.type === "apriModalPagamento") {
      const { filetype, ebookId, title } = data.payload || {};

      if (filetype && ebookId) {
        window.selectedFilename = ebookId;
        window.selectedFiletype = filetype;
        window.selectedTitle = title || ebookId;

        sessionStorage.setItem("selectedFilename", ebookId);
        sessionStorage.setItem("selectedFiletype", filetype);
        sessionStorage.setItem("selectedTitle", title || ebookId);

        console.log("✅ Dati ricevuti da Verge3D:", { filetype, ebookId, title });

        showPaymentModalUI(null, ebookId, filetype, title);
      } else {
        console.warn("⚠️ Messaggio da Verge3D incompleto:", data.payload);
      }
    }
  });

  document.getElementById("stripeButton").addEventListener("click", async () => {
    console.log("Stripe button clicked");
    hideElement("paymentOptions");
    showOnlyContainer(paymentContainers, stripeFormContainer);
    showElement("backToPaymentOptions");
    setText("sectionTitle", "💳 Pagamento con Stripe");

    if (!stripeInitPromise) {
      stripeInitPromise = initStripeForm();
    }
    await stripeInitPromise;
  });

  document.getElementById("paypalButton").addEventListener("click", () => {
    console.log("PayPal button clicked");
    hideElement("paymentOptions");
    showOnlyContainer(paymentContainers, paypalFormContainer);
    showElement("backToPaymentOptions");
    setText("sectionTitle", "🅿️ Pagamento con PayPal");
  });

  document.getElementById("cryptoButton").addEventListener("click", () => {
    console.log("Crypto button clicked");
    hideElement("paymentOptions");
    showOnlyContainer(paymentContainers, cryptoFormContainer);
    showElement("backToPaymentOptions");
    setText("sectionTitle", "🪙 Pagamento in Crypto");
  });

  backToPaymentOptionsBtn.addEventListener("click", () => {
    showOnlyContainer(paymentContainers, null);
    showElement("paymentOptions");
    hideElement("backToPaymentOptions");
    const productTitle = window.selectedTitle || "il tuo prodotto";
    setText("sectionTitle", `💰 Scegli un metodo di pagamento per: ${productTitle}`);
  });

  closeModalBtn.addEventListener("click", () => {
    hideElement("paymentModal");
  });

  modal.addEventListener("click", (event) => {
    const modalContent = modal.querySelector(".modal-content");
    if (!modalContent.contains(event.target)) {
      hideElement("paymentModal");
    }
  });

  function showPaymentModalUI(container = null, ebookId = "", filetype = "", title = "") {
    showElement("paymentModal");
    showElement("paymentOptions");
    showOnlyContainer(paymentContainers, container);
    hideElement("backToPaymentOptions");

    const sectionTitle = document.getElementById("sectionTitle");
    const paymentMessage = document.getElementById("paymentMessage");

    const productTitle = title || ebookId || "il tuo prodotto";

    if (sectionTitle) {
      sectionTitle.textContent = `💰 Scegli un metodo di pagamento per: ${productTitle}`;
    }

    if (paymentMessage) {
      paymentMessage.textContent = `📘 Stai per scaricare: ${productTitle}`;
    }
  }

  // ✅ Nuova funzione globale: scarica e chiudi la modale dopo X secondi
  window.avviaDownloadEDopoChiudiModale = async function () {
    try {
      const filename = window.selectedFilename;
      const filetype = window.selectedFiletype;
      if (!filename || !filetype) {
        console.warn("⚠️ File o tipo mancanti");
        return;
      }

      console.log("📥 Avvio download automatico...");
      await gestisciDownloadAutomatico(filename, filetype);

      // ✅ Auto-nascondi la modale dopo 4 secondi (opzionale)
      setTimeout(() => {
        hideElement("paymentModal");
        console.log("✅ Modale chiusa dopo il download.");
      }, 4000);
    } catch (error) {
      console.error("❌ Errore durante il download:", error);
    }
  };
});
