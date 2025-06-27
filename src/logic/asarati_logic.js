// src/asarati_logic.js
// Frontend (Gestione di tutta la logica client-side e avvio dell’inizializzazione)

import './style/asarati_style.css';
import { getStorageForMode } from './services/storage.js';
import { startStripePurchase } from './scripts/payments/stripePayment.js';
import { showPaymentModalUI } from './scripts/paymentModal.js';  // ✅ Import necessario

console.log("🚀 asarati_logic.js caricato");

export function init() {
  let connectionMode = localStorage.getItem('connectionMode') || 'live';
  localStorage.setItem('connectionMode', connectionMode);

  console.log("🌍 Modalità di connessione:", connectionMode);

  const storage = getStorageForMode(connectionMode);
  if (!storage) {
    console.error("❌ Errore: Storage non inizializzato");
    return { success: false, message: "Storage non disponibile" };
  }

  console.log("✅ Storage inizializzato");
  return { success: true, storage };
}

window.startAcquisto = startStripePurchase;

window.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return;

  const { action, filename, filetype } = event.data;

  if (action === 'openPaymentModal') {
    console.log(`🖱️ Richiesta pagamento: ${filetype} (${filename})`);

    const result = init();
    if (result.success) {
      showPaymentModalUI(null, filename, filetype, filename); // ✅ Usato direttamente
    } else {
      console.error("❌ Inizializzazione fallita:", result.message);
    }
  }
});
