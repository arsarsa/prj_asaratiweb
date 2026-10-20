const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const yazl = require('yazl');
const { inspectOriginal, inspectEpub, sha256 } = require('../ebook-original');
async function zip(files) {
  const archive = new yazl.ZipFile(); const chunks = [];
  for (const [name, bytes] of Object.entries(files)) archive.addBuffer(Buffer.from(bytes), name, { compress: name !== 'mimetype' });
  archive.outputStream.on('data', b => chunks.push(b));
  const done = new Promise((resolve, reject) => { archive.outputStream.on('end', resolve); archive.outputStream.on('error', reject); });
  archive.end(); await done; return Buffer.concat(chunks);
}
async function epub(overrides = {}) {
  return zip({ mimetype: 'application/epub+zip', 'META-INF/container.xml': '<container><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    'OPS/book.opf': '<package><metadata><identifier id="uid">original-identifier</identifier></metadata><manifest><item id="chapter1" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="font" href="fonts/demo.otf" media-type="font/otf"/></manifest><spine><itemref idref="chapter1"/></spine></package>',
    'OPS/chapter.xhtml': '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Libro di prova.</p></body></html>', 'OPS/fonts/demo.otf': 'dummy-font', ...overrides });
}
async function withOriginal(bytes, name, fn) { const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'epub-test-')); try { const file = path.join(dir,name); await fs.writeFile(file,bytes); return await fn(file); } finally { await fs.rm(dir,{recursive:true,force:true}); } }

test('valid EPUB inside ZIP is identified without modifying the original archive', async () => {
  const e = await epub(); const bytes = await zip({'Book.epub':e,'__MACOSX/._Book.epub':'metadata'});
  await withOriginal(bytes,'book.epub.zip',async file=>{ const before=sha256(await fs.readFile(file));const info=await inspectOriginal(file,'book.epub.zip');assert.equal(info.epubEntry,'Book.epub');assert.equal(info.epubSha256,sha256(e));assert.equal(info.spineItems,1);assert.equal(sha256(await fs.readFile(file)),before); });
});
test('font obfuscation is preserved and is distinguished from content DRM', async () => {
  const encryption='<encryption><EncryptedData><EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/><CipherData><CipherReference URI="OPS/fonts/demo.otf"/></CipherData></EncryptedData></encryption>';
  const bytes=await epub({'META-INF/encryption.xml':encryption});const before=sha256(bytes);const info=await inspectEpub(bytes);assert.equal(info.obfuscatedFonts,1);assert.equal(info.epubSha256,before);assert.equal(sha256(bytes),before);
});
// Separate cases keep malformed input out of the real pilot files.
test('DRM encryption, invalid spine and signed EPUB are rejected', async () => {
  const drm=await epub({'META-INF/encryption.xml':'<encryption><EncryptedData><EncryptionMethod Algorithm="urn:unsupported-drm"/><CipherData><CipherReference URI="OPS/chapter.xhtml"/></CipherData></EncryptedData></encryption>'});
  await assert.rejects(()=>inspectEpub(drm),/DRM/);
  await assert.rejects(()=>epub({'OPS/book.opf':'<package><manifest><item id="x" href="chapter.xhtml"/></manifest><spine><itemref idref="missing"/></spine></package>'}).then(inspectEpub),/lettura/);
  await assert.rejects(()=>epub({'META-INF/signatures.xml':'<signatures/>'}).then(inspectEpub),/firmato/);
});
test('ambiguous ZIP, missing EPUB and unexpected outer attachments are rejected', async () => {
  const e=await epub();for(const files of [{'a.epub':e,'b.epub':e},{'readme.txt':'no epub'},{'a.epub':e,'run.exe':'bad'}])await withOriginal(await zip(files),'book.zip',file=>assert.rejects(()=>inspectOriginal(file,'book.zip')));
});
test('external XML entities and missing manifest resources are rejected', async () => {
  await assert.rejects(()=>epub({'META-INF/container.xml':'<!DOCTYPE x [<!ENTITY remote SYSTEM "file:///etc/passwd">]><container>&remote;</container>'}).then(inspectEpub),/XML/);
  await assert.rejects(()=>epub({'OPS/book.opf':'<package><manifest><item id="a" href="missing.xhtml"/></manifest><spine><itemref idref="a"/></spine></package>'}).then(inspectEpub),/assente/);
});
module.exports={zip,epub};
