# Cartella `src/logic/`

Contiene la logica centrale del frontend del progetto AsaratiWeb, inclusa la configurazione Firebase frontend.

## Contenuti principali

- **`asarati_logic.js`**  
  Moduli e funzioni condivisi nel frontend tra vari moduli e flussi.

- **`firebase-config.js`**  
  Inizializzazione e configurazione Firebase JS SDK lato client, con uso di variabili ambiente per configurazioni sicure.

- **`README.md`**  
  Documentazione specifica e linee guida per la logica frontend.

## Note

- Definisce il punto centrale per tutte le configurazioni e funzioni frontend condivise.  
- Da mantenere leggero e modulare.  
- Le utility specifiche frontend separate in `src/utils/`.  
- Usato da tutti i moduli frontend per evitare duplicazioni.

## Linee guida

- Tutte le configurazioni Firebase frontend devono passare da qui.  
- Non includere logica specifica di singole pagine o flussi.
