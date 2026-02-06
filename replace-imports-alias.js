// replace-imports-alias.js
/*
Script in Node.js molto semplice che effettua una sostituzione automatica nel codice sorgente
Cambia gli import che usano percorsi relativi (come `'../../logic/firebase-config.js'`)
con i nuovi import basati sugli alias che abbiamo definito (es. `'@logic/firebase-config.js'`)
*/

import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

const aliasMap = {
  '../../logic/': '@logic/',
  '../../utils/': '@utils/',
  '../utils/': '@utils/',
  '../flow/': '@flow/',
  './scripts/': '@scripts/',
  './services/': '@logic/services/',
  './scripts/payments/': '@payments/',
};

// Funzione per trovare e sostituire negli import
function replaceImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [relPath, alias] of Object.entries(aliasMap)) {
    const regex = new RegExp(`(['"])${relPath.replace(/\//g, '\\/')}([^'"]+)\\1`, 'g');
    const replacement = `'${
      alias
    }$2'`;

    const newContent = content.replace(regex, replacement);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Modificato: ${filePath.replace(rootDir + '/', '')}`);
  }
}

// Funzione per scan directory ricorsiva e sostituire import in tutti js
function scanDirAndReplace(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Cartella non trovata, salto: ${dir}`);
    return;
  }
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      scanDirAndReplace(fullPath);
    } else if (fullPath.endsWith('.js')) {
      replaceImportsInFile(fullPath);
    }
  }
}

console.log('Inizio sostituzione import con alias...');

scanDirAndReplace(path.join(rootDir, 'src'));
scanDirAndReplace(path.join(rootDir, 'logic'));

console.log('Sostituzione completata.');
