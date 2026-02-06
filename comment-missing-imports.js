// comment-missing-imports.js
/*
Script personalizzato per
• Leggere la lista di file assenti (quelli rilevati dal controllo)
• Cercare e commentare solo gli import che puntano a quei file (non tutti gli import con alias)
*/

import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

const missingFiles = [
  '@logic/services/storage.js',
  '@payments/stripePayment.js',
  '@scripts/paymentModal.js',
  '@logic/firebase-config.js',
  '@utils/commonFrontend.js',
  '@flow/paidDownloadFlow.js'
];

// Funzione per commentare solo import associati a file assenti
function commentMissingImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const mf of missingFiles) {
    const regex = new RegExp(`^\\s*import\\s+.*['"]${mf}['"];?`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `// $&`);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Commentati import mancanti in: ${filePath.replace(rootDir + '/', '')}`);
  }
}

function scanDirAndComment(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      scanDirAndComment(fullPath);
    } else if (fullPath.endsWith('.js')) {
      commentMissingImportsInFile(fullPath);
    }
  }
}

console.log('Inizio commento import a file assenti...');
scanDirAndComment(path.join(rootDir, 'src'));
console.log('Commento completato.');
