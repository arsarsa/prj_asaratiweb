# Cartella `src/assets/`

Questa cartella contiene gli asset e i file frontend critici per l’applicazione web Asarati, inclusi:

- **`index.html`**  
  La pagina HTML principale che include i bundle JS, carica Stripe SDK, e definisce la UI modale di pagamento e l’area dell’iframe 3D.

- **`main.js`**  
  Entry point JavaScript frontend che importa stili, gestisce eventi globali, e funzioni per interazione con iframe 3D e modale pagamento.

- **Cartelle asset**  
  - `/asaratianm/` contiene scene, file e script 3D Blender/Verge3D incorporati in pagina.  
  - `/images/` contiene risorse grafiche generali usate nel sito.

---

## Note Importanti

- Il file **`index.js`** presente in questa cartella sembra contenere logica backend (Stripe Node.js SDK, Firebase Admin) per la funzione di creazione PaymentIntent.  
  - Per mantenere la coerenza del progetto, si consiglia di spostare questa logica sotto la cartella `functions/payment/` e importarla o strutturarla come Firebase Function backend.  
  - In alternativa, rinominare e spostare il file in una posizione adeguata per backend, non nel frontend `src/assets/`.

- La cartella distingue chiaramente **risorse statiche / frontend** e **logica backend** che andrebbero separate seguendo la convenzione del progetto.  

---

## Flusso e utilizzo

- La pagina `index.html` caricata lato client crea l’interfaccia utente per i metodi di pagamento usati nel progetto (attualmente Stripe attivo).  
- `main.js` coordina eventi globali, permette la comunicazione tra iframe (3D) e UI UI/gestione acquisti.  
- Assets 3D e immagini forniscono supporto visivo e interattivo per il sito. 

---

## Raccomandazioni di sviluppo

- Documentare ogni modifica o aggiunta di risorse 3D o grafica nella sottocartella `asaratianm` o `images`.  
- Coordinare l’aggiornamento degli script di frontend e dei bundle Webpack in `public/js` in modo sincronizzato con le modifiche nel codice in `src/`.

---

*Per questioni di manutenzione, sicurezza e chiarezza, si raccomanda di mantenere la separazione backend/frontend secondo gli standard già adottati nel progetto.*

