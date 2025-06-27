/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 129:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* unused harmony export purchaseAndDownload */
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
    const publicKey = await getStripePublicKey();
    const stripe = Stripe(publicKey);
    showStatus('💳 Preparazione pagamento...');
    const {
      clientSecret
    } = await createPaymentIntent({
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
        await subscribeToNewsletter(email);
      }
      showStatus('⬇️ Preparazione download...');
      const {
        downloadUrl
      } = await getDownloadURLForFile(ebookId);
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

/***/ 368:
/***/ ((__unused_webpack___webpack_module__, __unused_webpack___webpack_exports__, __webpack_require__) => {


// UNUSED EXPORTS: createPaymentIntent, getDownloadURLForFile, getStripePublicKey, loadStripeAndMountCard, subscribeToNewsletter

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
const firebase_config_functions = (0,index_esm/* getFunctions */.Uz)(app, 'europe-west1');

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
  const callable = httpsCallable(functions, 'getStripePublicKey');
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
  const callable = httpsCallable(functions, 'createPaymentIntent');
  const result = await callable({
    productId,
    receiptEmail: email,
    currency: 'eur'
  });
  return result.data;
}

// ✅ Iscrizione alla newsletter (facoltativa)
async function subscribeToNewsletter(email) {
  const callable = httpsCallable(functions, 'subscribeNewsletter');
  const result = await callable({
    email
  });
  return result.data;
}

// ✅ Ottieni la signed URL per il download del file acquistato
async function getDownloadURLForFile(productId) {
  const callable = httpsCallable(functions, 'getDownloadUrl');
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
/******/ 			// no module.id needed
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
/******/ 			782: 0
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
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module depends on other loaded chunks and execution need to be delayed
/******/ 	var __webpack_exports__ = __webpack_require__.O(undefined, [395,699,898,630,653,314,830,76], () => (__webpack_require__(129)))
/******/ 	__webpack_exports__ = __webpack_require__.O(__webpack_exports__);
/******/ 	
/******/ })()
;