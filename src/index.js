// src/index.js

import './style.css';
import { initFirebase } from './firebase-init.js';
import { initProductsModal } from './modale-scelta-prodotto.js';
import { initPaymentModal } from './modale-scelta-pagamento.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Asarati App inizializzata');
    console.log("BUILD TEST " + Date.now());

    try {
        // 1. Firebase
        await initFirebase();

        // 2. Payment modal
        initPaymentModal();

        // 3. Product modal + Verge3D listener
        initProductsModal();

        console.log('✅ Tutti i moduli caricati');

    } catch (err) {
        console.error('❌ Errore inizializzazione:', err);
    }
});
