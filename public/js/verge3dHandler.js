// public/js/verge3dHandler.js

window.addEventListener('message', (event) => {
  const { action, filename, filetype } = event.data;
  if (action === "openPaymentModal") {
    openModalPayment(filename, filetype);
  }
});

function openModalPayment(filename, filetype) {
  // Mostra modale pagamento con dati passati da Verge3D
  console.log(`Apri pagamento per ${filename} (${filetype})`);
  // Logica per aprire e settare modale
}
