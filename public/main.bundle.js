/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 129:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   B: () => (/* binding */ purchaseAndDownload)
/* harmony export */ });
/* harmony import */ var _utils_paymentUtils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(368);
// src/scripts/entry/purchase_and_download.js
// Frontend - Gestione dinamica acquisto + download + (eventuale) newsletter


async function purchaseAndDownload(_ref) {
  let {
    ebookId,
    email,
    wantsNewsletter
  } = _ref;
  try {
    showStatus('🔑 Connessione con Stripe...');
    const publicKey = await (0,_utils_paymentUtils_js__WEBPACK_IMPORTED_MODULE_0__/* .getStripePublicKey */ .IS)();
    const stripe = Stripe(publicKey);
    showStatus('💳 Preparazione pagamento...');
    const {
      clientSecret
    } = await (0,_utils_paymentUtils_js__WEBPACK_IMPORTED_MODULE_0__/* .createPaymentIntent */ .f)({
      productId: ebookId,
      email
    });
    showStatus('📲 Attendi conferma del pagamento...');
    const result = await stripe.confirmCardPayment(clientSecret);
    console.log('🧾 Stripe Result:', result);
    if (result.error) {
      console.error('❌ Errore durante il pagamento:', result.error.message);
      showStatus('❌ Pagamento fallito: ' + result.error.message);
      setTimeout(hideStatus, 6000);
      return;
    }
    if (result.paymentIntent.status === 'succeeded') {
      showStatus('✅ Pagamento riuscito!');
      if (wantsNewsletter) {
        showStatus('📩 Iscrizione alla newsletter...');
        await (0,_utils_paymentUtils_js__WEBPACK_IMPORTED_MODULE_0__/* .subscribeToNewsletter */ .ZG)(email);
      }
      showStatus('⬇️ Preparazione download...');
      const {
        downloadUrl
      } = await (0,_utils_paymentUtils_js__WEBPACK_IMPORTED_MODULE_0__/* .getDownloadURLForFile */ .tA)(ebookId);
      if (!downloadUrl) {
        showStatus('❌ Errore: URL di download non disponibile.');
        console.error('⚠️ Nessun URL ricevuto per il file', ebookId);
        setTimeout(hideStatus, 6000);
        return;
      }
      showStatus('📦 Avvio del download...');
      // Avvio download
      window.location.href = downloadUrl;
      setTimeout(hideStatus, 4000);
    }
  } catch (error) {
    console.error('❌ Errore durante la procedura:', error);
    showStatus('❌ Errore: ' + (error.message || 'Errore imprevisto.'));
    setTimeout(hideStatus, 6000);
  }
}


/***/ }),

/***/ 181:
/***/ ((__unused_webpack___webpack_module__, __unused_webpack___webpack_exports__, __webpack_require__) => {


// EXTERNAL MODULE: ./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js
var injectStylesIntoStyleTag = __webpack_require__(72);
var injectStylesIntoStyleTag_default = /*#__PURE__*/__webpack_require__.n(injectStylesIntoStyleTag);
// EXTERNAL MODULE: ./node_modules/style-loader/dist/runtime/styleDomAPI.js
var styleDomAPI = __webpack_require__(825);
var styleDomAPI_default = /*#__PURE__*/__webpack_require__.n(styleDomAPI);
// EXTERNAL MODULE: ./node_modules/style-loader/dist/runtime/insertBySelector.js
var insertBySelector = __webpack_require__(659);
var insertBySelector_default = /*#__PURE__*/__webpack_require__.n(insertBySelector);
// EXTERNAL MODULE: ./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js
var setAttributesWithoutAttributes = __webpack_require__(56);
var setAttributesWithoutAttributes_default = /*#__PURE__*/__webpack_require__.n(setAttributesWithoutAttributes);
// EXTERNAL MODULE: ./node_modules/style-loader/dist/runtime/insertStyleElement.js
var insertStyleElement = __webpack_require__(540);
var insertStyleElement_default = /*#__PURE__*/__webpack_require__.n(insertStyleElement);
// EXTERNAL MODULE: ./node_modules/style-loader/dist/runtime/styleTagTransform.js
var styleTagTransform = __webpack_require__(113);
var styleTagTransform_default = /*#__PURE__*/__webpack_require__.n(styleTagTransform);
// EXTERNAL MODULE: ./node_modules/css-loader/dist/cjs.js!./src/style/asarati_style.css
var asarati_style = __webpack_require__(344);
;// ./src/style/asarati_style.css

      
      
      
      
      
      
      
      
      

var options = {};

options.styleTagTransform = (styleTagTransform_default());
options.setAttributes = (setAttributesWithoutAttributes_default());
options.insert = insertBySelector_default().bind(null, "head");
options.domAPI = (styleDomAPI_default());
options.insertStyleElement = (insertStyleElement_default());

var update = injectStylesIntoStyleTag_default()(asarati_style/* default */.A, options);




       /* harmony default export */ const style_asarati_style = (asarati_style/* default */.A && asarati_style/* default */.A.locals ? asarati_style/* default */.A.locals : undefined);

// EXTERNAL MODULE: ./node_modules/firebase/storage/dist/esm/index.esm.js
var index_esm = __webpack_require__(269);
;// ./src/scripts/utils/fileUtils.js
// src/scripts/utils/fileUtils.js



const storage = (0,index_esm/* getStorage */.c7)(); // Firebase app già inizializzata altrove

/**
 * Scarica un file da Firebase Storage, distinguendo tra public e protected.
 * @param {string} fileId - Il nome base del file, senza estensione.
 * @param {Object} options - Opzioni di download.
 * @param {boolean} [options.protected=false] - Se il file è protetto (a pagamento).
 * @param {string} [options.subfolder] - Se protetto: eBook, audioBook, boxBook.
 */
async function triggerDownload(fileId) {
  let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  if (!fileId) {
    showMessage("Errore: file mancante.");
    return;
  }
  const {
    protected: isProtected = false,
    subfolder = ''
  } = options;
  let storagePath;
  if (isProtected) {
    if (!subfolder) {
      showMessage("Errore: cartella protetta mancante.");
      return;
    }
    storagePath = `protected_files/${subfolder}/${fileId}.pdf`;
  } else {
    storagePath = `public_files/${fileId}.pdf`;
  }
  try {
    const fileRef = ref(storage, storagePath);
    const url = await getDownloadURL(fileRef);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileId}.pdf`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showMessage(`Download avviato: ${fileId}.pdf`);
  } catch (error) {
    console.error("Errore durante il download:", error);
    showMessage("Errore durante il download del file.");
  }
}
// EXTERNAL MODULE: ./src/scripts/utils/paymentUtils.js + 1 modules
var paymentUtils = __webpack_require__(368);
;// ./src/scripts/flow/paidDownloadFlow.js
// src/scripts/flow/paidDownloadFlow.js


async function initPaidDownloadFlow(_ref) {
  let {
    productId,
    email,
    wantsNewsletter
  } = _ref;
  try {
    showStatus('💳 Avvio procedura di pagamento...');
    const publicKey = await (0,paymentUtils/* getStripePublicKey */.IS)();
    const stripe = Stripe(publicKey);
    const {
      clientSecret
    } = await (0,paymentUtils/* createPaymentIntent */.f)({
      productId,
      email
    });
    showStatus('📲 Attendi conferma del pagamento...');
    const result = await stripe.confirmCardPayment(clientSecret);
    if (result.error) throw new Error(result.error.message);
    if (result.paymentIntent.status === 'succeeded') {
      showStatus('✅ Pagamento riuscito!');
      if (wantsNewsletter && email) {
        showStatus('📩 Iscrizione alla newsletter...');
        await (0,paymentUtils/* subscribeToNewsletter */.ZG)(email);
      }
      const downloadUrl = await (0,paymentUtils/* getDownloadURLForFile */.tA)(productId);
      if (!downloadUrl) throw new Error('URL di download non disponibile.');
      showStatus('⬇️ Avvio del download...');
      window.location.href = downloadUrl;
    } else {
      throw new Error('Pagamento incompleto.');
    }
  } catch (error) {
    console.error('❌ Errore nel flusso di pagamento:', error);
    showStatus(`Errore: ${error.message}`);
  } finally {
    setTimeout(hideStatus, 6000);
  }
}
;// ./src/scripts/payments/stripePaymentForm.js
// src/scripts/payment/stripePaymentForm.js
// Frontend (Pagamento Stripe)



async function initStripeForm() {
  const emailInput = document.querySelector('#stripeEmail');
  const newsletterCheckbox = document.querySelector('#newsletterConsent');
  const submitButton = document.querySelector('#stripeSubmitButton');
  const statusText = document.querySelector('#paymentResult');
  if (!emailInput || !submitButton || !statusText) {
    console.error('❌ Elementi mancanti nel DOM.');
    return;
  }
  const {
    stripe,
    card
  } = await (0,paymentUtils/* loadStripeAndMountCard */.c7)();
  submitButton.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const wantsNewsletter = newsletterCheckbox?.checked;
    if (!email.includes('@')) {
      statusText.textContent = 'Email non valida.';
      return;
    }
    try {
      const {
        error,
        paymentMethod
      } = await stripe.createPaymentMethod({
        type: 'card',
        card,
        billing_details: {
          email
        }
      });
      if (error) throw error;
      const ebookId = sessionStorage.getItem("selectedFilename") || "ebook1";
      const {
        clientSecret
      } = await createPaymentIntent({
        productId: ebookId,
        email
      });
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: paymentMethod.id
      });
      if (result.error) throw result.error;
      if (result.paymentIntent.status === 'succeeded') {
        statusText.textContent = '✅ Pagamento riuscito!';
        await initPaidDownloadFlow({
          productId: ebookId,
          email,
          wantsNewsletter
        });
      } else {
        statusText.textContent = 'Pagamento non completato.';
      }
    } catch (err) {
      console.error(err);
      statusText.textContent = 'Errore: ' + (err.message || 'Errore sconosciuto');
    }
  });
}
;// ./src/scripts/utils/uiUtils.js
// src/utils/uiUtils.js
// Frontend

function showElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}
function hideElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}
function showDisplay(id) {
  let displayStyle = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "block";
  const el = document.getElementById(id);
  if (el) el.style.display = displayStyle;
}
function hideDisplay(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function showOnlyContainer(containers, containerToShow) {
  containers.forEach(container => {
    if (container === containerToShow) {
      container.classList.remove("hidden");
    } else {
      container.classList.add("hidden");
    }
  });
}
;// ./src/scripts/entry/paymentModal.js
// src/scripts/entry/paymentModal.js
// Frontend




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
  window.addEventListener("message", event => {
    const data = event.data;
    if (data?.type === "apriModalPagamento") {
      const {
        filetype,
        ebookId,
        title
      } = data.payload || {};
      if (filetype && ebookId) {
        window.selectedFilename = ebookId;
        window.selectedFiletype = filetype;
        window.selectedTitle = title || ebookId;
        sessionStorage.setItem("selectedFilename", ebookId);
        sessionStorage.setItem("selectedFiletype", filetype);
        sessionStorage.setItem("selectedTitle", title || ebookId);
        console.log("✅ Dati ricevuti da Verge3D:", {
          filetype,
          ebookId,
          title
        });
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
  modal.addEventListener("click", event => {
    const modalContent = modal.querySelector(".modal-content");
    if (!modalContent.contains(event.target)) {
      hideElement("paymentModal");
    }
  });
  function showPaymentModalUI() {
    let container = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    let ebookId = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "";
    let filetype = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "";
    let title = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : "";
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
// EXTERNAL MODULE: ./src/scripts/entry/purchase_and_download.js
var purchase_and_download = __webpack_require__(129);
;// ./src/assets/main.js
// src/assets/main.js
// Frontend (Entry point JS del frontend)




window.testClick = function () {
  console.log("✅ Bottone 3D cliccato!");
};
window.purchaseAndDownload = purchase_and_download/* purchaseAndDownload */.B; // Esponi per richiamo da HTML o Verge3D

window.addEventListener("message", event => {
  const {
    action,
    payload
  } = event.data;
  if (action === "testClick") window.testClick();
  if (action === "openPaymentModal") {
    console.log("✅ Richiesta di apertura modale ricevuta!");
    document.getElementById("paymentModal")?.classList.remove("hidden");
  }
  if (action === "purchaseAndDownload") {
    // Esempio: payload = { ebookId, email, wantsNewsletter }
    (0,purchase_and_download/* purchaseAndDownload */.B)(payload);
  }
});

/***/ }),

/***/ 344:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(601);
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(314);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/* src/style/asarati_style.css

/* ---------------------------------
   Impostazioni Globali
---------------------------------- */
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  background: #000; /* Puoi cambiare il colore di sfondo */
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  box-sizing: border-box;
  color: #333;
}

*, *::before, *::after {
  box-sizing: inherit;
}

/* ---------------------------------
   Verge3D Container
---------------------------------- */
#verge-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

#verge-frame {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

/* ---------------------------------
   Modale di Pagamento
---------------------------------- */
#paymentModal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: #fff;
  padding: 2rem;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  text-align: center;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  z-index: 1001;
}

/* Nascondi elementi */
.hidden {
  display: none !important;
}

/* ---------------------------------
   Form Stripe e Pulsanti
---------------------------------- */
#stripeFormContainer {
  margin: 1rem 0;
}

#sectionTitle {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;     /* spazio sotto il titolo */
  text-align: center;      /* centrato */
  color: #333;
  font-family: 'Arial', sans-serif;
}

/* Stile base dei pulsanti */
button.payment-button,
button.close-button {
  display: block;
  width: 100%;
  max-width: 300px;
  margin: 0.5rem auto;
  padding: 12px 20px;
  font-size: 1rem;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
}

/* Hover e Focus comuni */
button:hover,
button:focus {
  transform: scale(1.05);
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.25);
  outline: none;
}

/* Colori specifici per ogni tipo di pagamento */
#stripeButton {
  background-color: #6772e5;
  color: #fff;
}

#paypalButton {
  background-color: #ffc439;
  color: #111;
}

#cryptoButton {
  background-color: #4caf50;
  color: #fff;
}

/* Pulsante di chiusura */
.close-button {
  background-color: #333;
  color: #fff;
  font-size: 0.95rem;
  margin-top: 1.5rem;
}

.close-button:hover {
  background-color: #555;
}
`, ""]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ }),

/***/ 368:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  f: () => (/* binding */ createPaymentIntent),
  tA: () => (/* binding */ getDownloadURLForFile),
  IS: () => (/* binding */ getStripePublicKey),
  c7: () => (/* binding */ loadStripeAndMountCard),
  ZG: () => (/* binding */ subscribeToNewsletter)
});

// EXTERNAL MODULE: ./node_modules/firebase/functions/dist/esm/index.esm.js
var index_esm = __webpack_require__(749);
// EXTERNAL MODULE: ./node_modules/firebase/app/dist/esm/index.esm.js
var esm_index_esm = __webpack_require__(223);
// EXTERNAL MODULE: ./node_modules/firebase/auth/dist/esm/index.esm.js
var dist_esm_index_esm = __webpack_require__(908);
// EXTERNAL MODULE: ./node_modules/firebase/storage/dist/esm/index.esm.js
var storage_dist_esm_index_esm = __webpack_require__(269);
;// ./src/logic/firebase-config.js
// src/firebase-config.js
// Backend





const firebaseConfig = {
  apiKey: "AIzaSyDrMHULANbTosaXlthzXOReBm2Dp5B-6F8",
  authDomain: "asarati-27c0d.firebaseapp.com",
  databaseURL: "https://asarati-27c0d-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "asarati-27c0d",
  storageBucket: "asarati-27c0d.appspot.com",
  messagingSenderId: "365615545063",
  appId: "1:365615545063:web:df5c14dc00672ea6370042",
  measurementId: "G-CPZH0JMD7F"
};

// ✅ Inizializza app
const app = (0,esm_index_esm/* initializeApp */.Wp)(firebaseConfig);

// ✅ Autenticazione
const auth = (0,dist_esm_index_esm/* getAuth */.xI)(app);

// ✅ Callable Functions
const functions = (0,index_esm/* getFunctions */.Uz)(app, 'europe-west1');

// ✅ Storage configurabile
function getStorage() {
  let useEmulator = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
  const storage = _getStorage(app);
  if (useEmulator) {
    connectStorageEmulator(storage, 'localhost', 9199);
    console.log("🧪 Connesso a Firebase Storage Emulator");
  }
  return storage;
}

// ✅ Esportazioni


// ✅ Export default per chi ha bisogno del config puro
/* harmony default export */ const firebase_config = ((/* unused pure expression or super */ null && (firebaseConfig)));
;// ./src/scripts/utils/paymentUtils.js
// src/utils/paymentUtils.js
// Frontend - Utility per gestire interazioni con le Firebase Functions



let stripeInstance = null;
let elementsInstance = null;

// 🔐 Recupera la chiave pubblica Stripe tramite callable Firebase
async function getStripePublicKey() {
  const callable = (0,index_esm/* httpsCallable */.Qg)(functions, 'getStripePublicKey');
  const result = await callable({
    isLocalhost: location.hostname === 'localhost'
  });
  return result.data.publicKey;
}
async function loadStripeAndMountCard() {
  let cardElementId = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '#card-element';
  // Evita di inizializzare Stripe più volte
  if (!stripeInstance) {
    const publicKey = await getStripePublicKey();
    stripeInstance = Stripe(publicKey);
    elementsInstance = stripeInstance.elements();
  }
  const card = elementsInstance.create('card');
  card.mount(cardElementId);
  return {
    stripe: stripeInstance,
    card
  };
}

// ✅ Crea un intent di pagamento per un prodotto
async function createPaymentIntent(_ref) {
  let {
    productId,
    email
  } = _ref;
  const callable = (0,index_esm/* httpsCallable */.Qg)(functions, 'createPaymentIntent');
  const result = await callable({
    productId,
    receiptEmail: email,
    currency: 'eur'
  });
  return result.data;
}

// ✅ Iscrizione alla newsletter (facoltativa)
async function subscribeToNewsletter(email) {
  const callable = (0,index_esm/* httpsCallable */.Qg)(functions, 'subscribeNewsletter');
  const result = await callable({
    email
  });
  return result.data;
}

// ✅ Ottieni la signed URL per il download del file acquistato
async function getDownloadURLForFile(productId) {
  const callable = (0,index_esm/* httpsCallable */.Qg)(functions, 'getDownloadUrl');
  const result = await callable({
    productId
  });
  return result.data.downloadUrl;
}

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/chunk loaded */
/******/ 	(() => {
/******/ 		var deferred = [];
/******/ 		__webpack_require__.O = (result, chunkIds, fn, priority) => {
/******/ 			if(chunkIds) {
/******/ 				priority = priority || 0;
/******/ 				for(var i = deferred.length; i > 0 && deferred[i - 1][2] > priority; i--) deferred[i] = deferred[i - 1];
/******/ 				deferred[i] = [chunkIds, fn, priority];
/******/ 				return;
/******/ 			}
/******/ 			var notFulfilled = Infinity;
/******/ 			for (var i = 0; i < deferred.length; i++) {
/******/ 				var [chunkIds, fn, priority] = deferred[i];
/******/ 				var fulfilled = true;
/******/ 				for (var j = 0; j < chunkIds.length; j++) {
/******/ 					if ((priority & 1 === 0 || notFulfilled >= priority) && Object.keys(__webpack_require__.O).every((key) => (__webpack_require__.O[key](chunkIds[j])))) {
/******/ 						chunkIds.splice(j--, 1);
/******/ 					} else {
/******/ 						fulfilled = false;
/******/ 						if(priority < notFulfilled) notFulfilled = priority;
/******/ 					}
/******/ 				}
/******/ 				if(fulfilled) {
/******/ 					deferred.splice(i--, 1)
/******/ 					var r = fn();
/******/ 					if (r !== undefined) result = r;
/******/ 				}
/******/ 			}
/******/ 			return result;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/jsonp chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded and loading chunks
/******/ 		// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 		// [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
/******/ 		var installedChunks = {
/******/ 			782: 0,
/******/ 			792: 0
/******/ 		};
/******/ 		
/******/ 		// no chunk on demand loading
/******/ 		
/******/ 		// no prefetching
/******/ 		
/******/ 		// no preloaded
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 		
/******/ 		__webpack_require__.O.j = (chunkId) => (installedChunks[chunkId] === 0);
/******/ 		
/******/ 		// install a JSONP callback for chunk loading
/******/ 		var webpackJsonpCallback = (parentChunkLoadingFunction, data) => {
/******/ 			var [chunkIds, moreModules, runtime] = data;
/******/ 			// add "moreModules" to the modules object,
/******/ 			// then flag all "chunkIds" as loaded and fire callback
/******/ 			var moduleId, chunkId, i = 0;
/******/ 			if(chunkIds.some((id) => (installedChunks[id] !== 0))) {
/******/ 				for(moduleId in moreModules) {
/******/ 					if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 						__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 					}
/******/ 				}
/******/ 				if(runtime) var result = runtime(__webpack_require__);
/******/ 			}
/******/ 			if(parentChunkLoadingFunction) parentChunkLoadingFunction(data);
/******/ 			for(;i < chunkIds.length; i++) {
/******/ 				chunkId = chunkIds[i];
/******/ 				if(__webpack_require__.o(installedChunks, chunkId) && installedChunks[chunkId]) {
/******/ 					installedChunks[chunkId][0]();
/******/ 				}
/******/ 				installedChunks[chunkId] = 0;
/******/ 			}
/******/ 			return __webpack_require__.O(result);
/******/ 		}
/******/ 		
/******/ 		var chunkLoadingGlobal = self["webpackChunkasaratiweb"] = self["webpackChunkasaratiweb"] || [];
/******/ 		chunkLoadingGlobal.forEach(webpackJsonpCallback.bind(null, 0));
/******/ 		chunkLoadingGlobal.push = webpackJsonpCallback.bind(null, chunkLoadingGlobal.push.bind(chunkLoadingGlobal));
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/nonce */
/******/ 	(() => {
/******/ 		__webpack_require__.nc = undefined;
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module depends on other loaded chunks and execution need to be delayed
/******/ 	var __webpack_exports__ = __webpack_require__.O(undefined, [395,699,898,630,653,314,830,76,122,788], () => (__webpack_require__(181)))
/******/ 	__webpack_exports__ = __webpack_require__.O(__webpack_exports__);
/******/ 	
/******/ })()
;