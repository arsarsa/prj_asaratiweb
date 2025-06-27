// src/scripts/utils/modalUI.js

export function showMessage(message, options = {}) {
  const modal = document.getElementById('paymentModal');
  const messageEl = document.getElementById('paymentMessage');
  const titleEl = document.getElementById('sectionTitle');
  const paymentOptions = document.getElementById('paymentOptions');
  const backButton = document.getElementById('backToPaymentOptions');

  if (!modal || !messageEl) {
    console.warn("Modale non trovata.");
    return;
  }

  // Mostra il messaggio
  messageEl.textContent = message;

  // Se specificato, aggiorna anche il titolo
  if (options.title) {
    titleEl.textContent = options.title;
  }

  // Nasconde le opzioni di pagamento (opzionale)
  if (options.hidePaymentOptions) {
    paymentOptions?.classList.add('hidden');
  }

  // Mostra il pulsante di ritorno se specificato
  if (options.showBackButton) {
    backButton?.classList.remove('hidden');
  } else {
    backButton?.classList.add('hidden');
  }

  // Mostra la modale
  modal.classList.remove('hidden');
}
