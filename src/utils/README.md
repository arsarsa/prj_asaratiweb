# Cartella `src/utils/`

Contiene moduli di utility frontend riutilizzabili e pure, indipendenti da logica di business specifica.

## Contenuti principali

- **`commonFrontend.js`**  
  Funzioni di validazione input leggere (email, stringhe non vuote).

- **`storageFrontend.js`**  
  Funzioni per interazione con Firebase Storage client SDK (ottenimento URL firmati).

- **`downloadUtils.js`**  
  Callable Firebase Functions per ottenere URL firmati download (server-driven).

- **`paymentUtils.js`**  
  Utility frontend per interazioni callable Firebase legate a pagamenti, newsletter, ecc.

- **`testCommonFrontend.js`**  
  Script di test rapido delle funzioni di validazione frontend (usato solo durante sviluppo).

## Note

- Libera da riferimenti UI per essere facilmente testabile e manutenibile.  
- Importata trasversalmente da moduli in `src/scripts/` e `src/logic/`.

## Linee guida

- Tenere funzione specifiche, leggere e mantenere naming chiaro (`Frontend` nel nome quando necessario).  
- Documentare bene ogni funzione.  
- Rivedere periodicamente per evitare duplicati o logiche complesse che non competono qui.
