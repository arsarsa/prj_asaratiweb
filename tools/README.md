# Cartella `tools/`

Racchiude script CLI e utility per la gestione della configurazione, deployment e sviluppo.

## Contenuti principali

- **`setup-secret.js`**  
  Script Node.js per generare token segreti random e impostarli nella configurazione Firebase Functions.

- **`show-config.js`**  
  Script per mostrare in console la configurazione Firebase Functions in uso (debug e verifica).

- **`README.md`**  
  Documentazione di utilizzo e best practice per gli script presenti.

## Note

- Strumenti da linea di comando, indipendenti dal codice applicativo frontend/backend.  
- Facilitano deployment sicuro e gestione segreti.

## Linee guida

- Documentare chiaramente uso e scopo di ogni script.  
- Tenere separato da codice business-critical.
