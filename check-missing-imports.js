// check-missing-imports.js
/*
Cercare tutti gli import nei file `.js` in `src/` e `logic/` che usano percorsi relativi tipo `../`, `./`
Verificare se i file referenziati esistono o sono mancanti
Riportare la lista dei file mancanti per te da correggere
*/

import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const searchDirs = ['src', 'logic']; // cartelle da scandire
const importRegEx = /import\s+(?:[\w{}\s,*]+)\s+from\s+['"](.+)['"]/g;

function getAllJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllJsFiles(fullPath, fileList);
    } else if (fullPath.endsWith('.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function resolveImportPath(importPath, baseDir) {
  if (importPath.startsWith('.')) {
    // relativo rispetto a baseDir
    const possibleExt = ['', '.js', '.json', '.css'];
    for (const ext of possibleExt) {
      const absPath = path.resolve(baseDir, importPath + ext);
      if (fs.existsSync(absPath)) return null; // trovato, assente errore
      // se la path è una cartella con index.js
      if (fs.existsSync(path.join(absPath, 'index.js'))) return null;
    }
    return path.resolve(baseDir, importPath);
  } else {
    // modulo npm o alias esterno, non controlliamo
    return null;
  }
}

async function main() {
  let missingImports = [];

  for (const dir of searchDirs) {
    const absDir = path.resolve(rootDir, dir);
    if (!fs.existsSync(absDir)) continue;

    const jsFiles = getAllJsFiles(absDir);

    for (const filePath of jsFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      let match;

      while ((match = importRegEx.exec(content)) !== null) {
        const importPath = match[1];
        const baseDir = path.dirname(filePath);
        const missingFilePath = resolveImportPath(importPath, baseDir);

        if (missingFilePath) {
          missingImports.push({
            file: filePath.replace(rootDir + '/', ''),
            import: importPath,
            resolvedTo: missingFilePath.replace(rootDir + '/', ''),
          });
        }
      }
    }
  }

  if (missingImports.length === 0) {
    console.log('Nessun import mancante nei file js di src/ e logic/ ☑️');
  } else {
    console.log('Import mancanti trovati:\n');
    missingImports.forEach(mi => {
      console.log(`File: ${mi.file}\n  Import: '${mi.import}' → Manca: ${mi.resolvedTo}\n`);
    });
  }
}

main();
