# Cartella `src/scripts/`

Contiene i moduli JavaScript frontend, organizzati per funzionalità e flussi di lavoro.

## Sottocartelle e scopi

- **`entry/`**  
  Entry points e script di pagina (es. gestione evento acquisto e download).

- **`flow/`**  
  Flussi applicativi, ad esempio gestione dei download gratuiti e con pagamento (freeDownloadFlow.js, paidDownloadFlow.js).

- **`payments/`**  
  Moduli specifici per i metodi di pagamento attivi o in sviluppo (Stripe, Paypal placeholder, Crypto placeholder).

- **`utils/`**  
  Helpers specifici per le operazioni di script (funzioni ausiliarie usate solo dai moduli in `scripts/`).

## Note

- Codice frontend legato a specifici processi, pagine o componenti UI.  
- Deve essere modulare e ben separato per facilitare manutenzione e test.  
- Importa utilities da `src/utils/` e la logica centrale da `src/logic/`.

## Linee guida

- Evitare duplicazioni tra moduli di pagamento e flussi.  
- Tenere chiari i confini logici e di responsabilità tra `flow/` e `payments/`.  
- Documentare ogni modulo, specificando dipendenze e input/output.
