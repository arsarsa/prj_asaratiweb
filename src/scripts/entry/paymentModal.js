// src/scripts/entry/paymentModal.js

import { triggerDownload } from '@utils/fileUtils.js';
import { initStripeForm } from '@payments/stripePaymentForm.js';
import { showElement, hideElement, setText, showOnlyContainer } from '@utils/uiUtils.js';

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

  const modalContent = modal.querySelector(".modal-content");

  // Previeni chiusura modale cliccando dentro il contenuto (evita bubbling)
  modalContent.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  // Chiudi modale cliccando all'esterno (sul modal overlay)
  modal.addEventListener("click", () => {
    hideElement("paymentModal");
  });

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (data?.action === "openPaymentModal") {
      const { filetype, filename, title } = data || {};

      if (filename && filetype) {
        window.selectedFilename = filename;
        window.selectedFiletype = filetype;
        window.selectedTitle = title || filename;

        sessionStorage.setItem("selectedFilename", filename);
        sessionStorage.setItem("selectedFiletype", filetype);
        sessionStorage.setItem("selectedTitle", title || filename);

        console.log("✅ Dati ricevuti da Verge3D:", { filetype, filename, title });

        showPaymentModalUI(null, filename, filetype, title);
      } else {
        console.warn("⚠️ Messaggio da Verge3D incompleto:", data);
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

  function showPaymentModalUI(container = null, filename = "", filetype = "", title = "") {
    showElement("paymentModal");
    showElement("paymentOptions");
    showOnlyContainer(paymentContainers, container);
    hideElement("backToPaymentOptions");

    const productTitle = title || filename || "il tuo prodotto";

    if (sectionTitle) {
      sectionTitle.textContent = `💰 Scegli un metodo di pagamento per: ${productTitle}`;
    }

    const paymentMessage = document.getElementById("paymentMessage");
    if (paymentMessage) {
      paymentMessage.textContent = `📘 Stai per scaricare: ${productTitle}`;
    }
  }

  window.avviaDownloadEDopoChiudiModale = async function () {
    try {
      const filename = window.selectedFilename;
      const filetype = window.selectedFiletype;
      if (!filename || !filetype) {
        console.warn("⚠️ File o tipo mancanti");
        return;
      }

      console.log("📥 Avvio download automatico...");
      await triggerDownload(filename, filetype);

      setTimeout(() => {
        hideElement("paymentModal");
        console.log("✅ Modale chiusa dopo il download.");
      }, 4000);
    } catch (error) {
      console.error("❌ Errore durante il download:", error);
    }
  };
});
