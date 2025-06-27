// restructure.js

import path from 'path';
import fs from 'fs-extra';
// Usa import come oggetto
import * as glob from 'glob';

// Configura i percorsi delle nuove cartelle
const structure = {
    functions: {
        counters: 'functions/counters',
        downloads: 'functions/downloads',
        payments: 'functions/payments',
        utils: 'functions/utils',
        webhooks: 'functions/webhooks'
    },
    src: {
        assets: 'src/assets',
        scripts: 'src/scripts',
        styles: 'src/style'
    },
    public: {
        root: 'public',
        animations: 'public/asaratianm',
        images: 'public/images'
    }
};

// Funzione per spostare i file in base alla nuova struttura
async function moveFiles() {
    try {
        console.log('🔄 Avvio ristrutturazione...');
        
        // Aggiungiamo il controllo del percorso attuale per debug
        console.log(`Directory corrente: ${process.cwd()}`);

        // Funzione per evitare spostamenti di file quando origine e destinazione sono gli stessi
        const moveIfNeeded = async (source, dest) => {
            try {
                // Verifica se il file di origine esiste prima di spostarlo
                await fs.promises.access(source, fs.constants.F_OK);
                
                if (source !== dest) {
                    await fs.move(source, dest, { overwrite: true });
                    console.log(`✅ File spostato: ${source} → ${dest}`);
                } else {
                    console.log(`❌ Ignorato: ${source} già nella posizione corretta.`);
                }
            } catch (err) {
                console.log(`❌ File non trovato: ${source}`);
                // Aggiungi un'ulteriore logica di debug per capire il percorso
                console.log(`Controllo se il file esiste nel percorso: ${source}`);
            }
        };

        // Spostiamo i file di funzione
        await moveIfNeeded('functions/utils/products.js', structure.functions.utils + '/products.js');

        // Spostiamo gli asset con i percorsi aggiornati
        await moveIfNeeded('src/assets/asaratianm/asaratianm.html', structure.public.animations + '/asaratianm.html');
        // Usa il nome corretto per il file asaratianm.html
        await moveIfNeeded('src/assets/asaratianm/asaratianm.html', structure.public.root + '/asaratianm.html');

        // Spostiamo l'index.html dalla cartella pubblica
        await moveIfNeeded('public/index.html', structure.public.root + '/index.html');

        // Spostiamo gli script
        await moveIfNeeded('src/scripts/index.js', structure.src.scripts + '/index.js');

        console.log('✅ File spostati con successo.');

    } catch (err) {
        console.error('❌ Errore durante la ristrutturazione:', err);
    }
}

// Funzione per aggiornare i percorsi nei file
async function updateFilePaths() {
    console.log('🔄 Aggiornamento percorsi nei file...');

    // Cerca nei file HTML, CSS e JS
    glob.glob('public/**/*.{html,js,css}', async (err, files) => {
        if (err) {
            console.error('❌ Errore nella ricerca dei file:', err);
            return;
        }

        for (let file of files) {
            let content = await fs.readFile(file, 'utf8');

            // Sostituisci i vecchi percorsi con quelli nuovi
            content = content.replace(/src="\/src\/scripts\/(.*?)"/g, 'src="/scripts/$1"');
            content = content.replace(/href="\/src\/style\/(.*?)"/g, 'href="/style/$1"');

            // Salviamo i file con i percorsi aggiornati
            await fs.writeFile(file, content);
            console.log(`🔧 Percorsi aggiornati in ${file}`);
        }

        console.log('✅ Aggiornamento completato.');
    });
}

// Esegui lo script
(async () => {
    await moveFiles();
    await updateFilePaths();
})();
