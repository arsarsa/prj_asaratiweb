// public/js/productSelection.js

// Ottieni o genera anonUid persistente
let anonUid = localStorage.getItem('anon_uid');
if (!anonUid) {
  anonUid = crypto.randomUUID();
  localStorage.setItem('anon_uid', anonUid);
}

// Utilizza anonUid in tutte le chiamate ordine/pagamento
