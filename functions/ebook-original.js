const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const yauzl = require('yauzl');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const MAX_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL = 300 * 1024 * 1024;
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function xml(bytes) {
  const text = bytes.toString('utf8');
  if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true) throw new Error('XML EPUB non valido o con entità non consentite.');
  return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', processEntities: false, removeNSPrefix: true }).parse(text);
}
function safeName(name) {
  if (!name || name.includes('\\') || name.startsWith('/') || name.split('/').includes('..') || /[\x00-\x1f]/.test(name)) throw new Error('Percorso non consentito nell’archivio.');
  return name;
}
async function archive(bytes) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(bytes, { lazyEntries: true, autoClose: false, validateEntrySizes: true }, (error, zip) => {
      if (error) return reject(error);
      const entries = new Map();
      let total = 0;
      zip.on('error', reject);
      zip.on('entry', entry => {
        try {
          safeName(entry.fileName);
          if (((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000) throw new Error("Link simbolico non consentito nell’archivio.");
          total += entry.uncompressedSize;
          if (entries.has(entry.fileName) || entries.size >= 4000 || total > MAX_TOTAL || entry.uncompressedSize > MAX_BYTES || (entry.generalPurposeBitFlag & 1)) throw new Error('Archivio duplicato, cifrato o troppo grande.');
          entries.set(entry.fileName, entry); zip.readEntry();
        } catch (error) { zip.close(); reject(error); }
      });
      zip.on('end', () => resolve({ zip, entries }));
      zip.readEntry();
    });
  });
}
async function readEntry(zip, entry, max = MAX_BYTES) {
  if (!entry || entry.uncompressedSize > max) throw new Error('Risorsa EPUB mancante o troppo grande.');
  const stream = await new Promise((resolve, reject) => zip.openReadStream(entry, (error, stream) => error ? reject(error) : resolve(stream)));
  const chunks = []; let size = 0;
  for await (const chunk of stream) { size += chunk.length; if (size > max) { stream.destroy(); throw new Error('Risorsa EPUB troppo grande.'); } chunks.push(chunk); }
  return Buffer.concat(chunks);
}
async function inspectEpub(bytes) {
  const { zip, entries } = await archive(bytes);
  try {
    if ((await readEntry(zip, entries.get('mimetype'), 64)).toString() !== 'application/epub+zip') throw new Error('Il file non è un EPUB valido.');
    if (entries.has('META-INF/signatures.xml')) throw new Error('EPUB firmato: richiede una verifica specifica prima della personalizzazione.');
    const container = xml(await readEntry(zip, entries.get('META-INF/container.xml'), 1024 * 1024));
    const roots = array(container.container?.rootfiles?.rootfile).filter(item => item['@media-type'] === 'application/oebps-package+xml');
    if (roots.length !== 1) throw new Error('È richiesto un solo documento principale EPUB.');
    const packagePath = safeName(roots[0]['@full-path']);
    const opf = xml(await readEntry(zip, entries.get(packagePath), 4 * 1024 * 1024)).package;
    const manifest = array(opf?.manifest?.item);
    const spine = array(opf?.spine?.itemref);
    if (!spine.length || !manifest.length) throw new Error('EPUB privo di contenuto leggibile.');
    const ids = new Set();
    for (const item of manifest) {
      if (!item['@id'] || ids.has(item['@id']) || !item['@href'] || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(item['@href'])) throw new Error('Manifest EPUB non valido.');
      ids.add(item['@id']);
      const target = safeName(path.posix.normalize(path.posix.join(path.posix.dirname(packagePath), decodeURIComponent(item['@href'].split('#')[0]))));
      if (!entries.has(target)) throw new Error('Risorsa dichiarata ma assente nell’EPUB.');
    }
    if (spine.some(item => !ids.has(item['@idref']))) throw new Error('Ordine di lettura EPUB non valido.');
    let obfuscatedFonts = 0;
    if (entries.has('META-INF/encryption.xml')) {
      const encryption = xml(await readEntry(zip, entries.get('META-INF/encryption.xml'), 1024 * 1024));
      const encrypted = array(encryption.encryption?.EncryptedData);
      if (!encrypted.length) throw new Error('Descrizione della cifratura EPUB non riconosciuta.');
      for (const item of encrypted) {
        const algorithm = item.EncryptionMethod?.['@Algorithm'];
        const target = safeName(item.CipherData?.CipherReference?.['@URI']);
        if (!['http://www.idpf.org/2008/embedding', 'http://ns.adobe.com/pdf/enc#RC'].includes(algorithm) || !/\.(?:otf|ttf)$/i.test(target) || !entries.has(target)) throw new Error('EPUB protetto da DRM o cifratura non supportata.');
        obfuscatedFonts += 1;
      }
    }
    return { contentFormat: 'epub', epubSha256: sha256(bytes), packagePath, spineItems: spine.length, obfuscatedFonts };
  } finally { zip.close(); }
}
async function inspectOriginal(file, fileName) {
  const stat = await fs.stat(file);
  if (!stat.size || stat.size > MAX_BYTES) throw new Error('Originale vuoto o superiore a 100 MB.');
  const bytes = await fs.readFile(file);
  if (/\.epub$/i.test(fileName)) return { format: 'epub', epubEntry: null, ...await inspectEpub(bytes) };
  if (!/\.zip$/i.test(fileName)) throw new Error('Il pilota richiede un EPUB oppure uno ZIP contenente un EPUB.');
  const { zip, entries } = await archive(bytes);
  try {
    const files = [...entries.values()].filter(entry => !entry.fileName.endsWith('/') && !entry.fileName.split('/').some(part => part.startsWith('.') || part === '__MACOSX'));
    const epubs = files.filter(entry => /\.epub$/i.test(entry.fileName));
    if (epubs.length !== 1 || files.some(entry => !/\.epub$/i.test(entry.fileName) && !/^(?:cover\.(?:jpe?g|png)|readme\.txt)$/i.test(path.posix.basename(entry.fileName)))) throw new Error('Lo ZIP deve contenere un solo EPUB e, facoltativamente, cover e ReadMe.');
    return { format: 'zip', epubEntry: epubs[0].fileName, ...await inspectEpub(await readEntry(zip, epubs[0])) };
  } finally { zip.close(); }
}
module.exports = { inspectOriginal, inspectEpub, sha256, MAX_BYTES };
