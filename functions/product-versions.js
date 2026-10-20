const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { createWriteStream } = require('node:fs');
const { inspectOriginal, MAX_BYTES } = require('./ebook-original');
const { productBase, validStoragePath, versionIdIsValid } = require('./product-storage');

function createVersionHandlers({ db, bucket, HttpsError, timestamp, deleteField,
  inspect = inspectOriginal, clock = Date.now, randomId = crypto.randomUUID }) {
  const error = (code, text) => new HttpsError(code, text);
  function refFor(id) {
    if (!/^[a-zA-Z0-9_-]{3,80}$/.test(id || '')) throw error('invalid-argument', 'ID prodotto non valido.');
    return db.collection('products').doc(id);
  }
  function admin(context) {
    if (!context?.auth || context.auth.token?.admin !== true) throw error('permission-denied', 'Accesso amministratore richiesto.');
    return { kind: 'firebase', uid: context.auth.uid };
  }
  function eligible(product, id) {
    if (!product || product.archivedAt || product.type !== 'ebook' || product.accessMode !== 'paid'
      || !validStoragePath(product, id, true) || !/\.(?:epub|zip)$/i.test(product.storageFileName)) {
      throw error('failed-precondition', 'Il versionamento pilota richiede un eBook a pagamento in EPUB o ZIP, non archiviato.');
    }
  }
  async function metadata(name, generation) {
    const file = bucket.file(name, generation ? { generation: String(generation) } : undefined);
    const [meta] = await file.getMetadata();
    if (!meta.generation || !Number(meta.size) || Number(meta.size) > MAX_BYTES) throw error('failed-precondition', 'Originale mancante, vuoto o superiore a 100 MB.');
    return { file, meta };
  }
  async function digest(file, output) {
    const hash = crypto.createHash('sha256'); let size = 0;
    const meter = new Transform({ transform(chunk, encoding, next) {
      size += chunk.length;
      if (size > MAX_BYTES) return next(error('resource-exhausted', 'Originale superiore a 100 MB.'));
      hash.update(chunk); next(null, chunk);
    } });
    if (output) await pipeline(file.createReadStream({ validation: 'crc32c' }), meter, createWriteStream(output, { mode: 0o600, flags: 'wx' }));
    else { await pipeline(file.createReadStream({ validation: 'crc32c' }), meter, new Transform({ transform(chunk, encoding, next) { next(); } })); }
    return { sha256: hash.digest('hex'), sizeBytes: size };
  }
  async function snapshot(product, id, versionId, sourcePath, actor) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'asarati-version-'));
    try {
      const { meta } = await metadata(sourcePath);
      const source = bucket.file(sourcePath, { generation: String(meta.generation) });
      const local = path.join(directory, 'original');
      const hash = await digest(source, local);
      if (hash.sizeBytes !== Number(meta.size)) throw error('aborted', 'Dimensione del file cambiata durante la verifica.');
      const inspection = await inspect(local, product.storageFileName);
      const targetPath = `${productBase(product, id)}/versions/${versionId}/original/${product.storageFileName}`;
      const target = bucket.file(targetPath);
      try {
        await source.copy(target, { preconditionOpts: { ifGenerationMatch: 0 }, metadata: {
          contentType: meta.contentType || 'application/octet-stream', cacheControl: 'private, max-age=0',
          metadata: { productId: id, versionId, originalSha256: hash.sha256, sourceGeneration: String(meta.generation) },
        } });
      } catch (copyError) { if (Number(copyError.code) !== 412) throw copyError; }
      const { meta: saved } = await metadata(targetPath);
      const targetHash = await digest(bucket.file(targetPath, { generation: String(saved.generation) }));
      if (targetHash.sha256 !== hash.sha256 || targetHash.sizeBytes !== hash.sizeBytes) throw error('data-loss', 'La copia versionata non coincide con l’originale. Nessun file è stato sovrascritto.');
      return {
        schemaVersion: 1, versionId, productId: id, status: 'ready', ...inspection,
        original: { storagePath: targetPath, fileName: product.storageFileName, generation: String(saved.generation),
          sha256: hash.sha256, sizeBytes: hash.sizeBytes, contentType: saved.contentType || 'application/octet-stream' },
        source: { storagePath: sourcePath, generation: String(meta.generation) },
        uploadedAt: timestamp(), uploadedBy: actor,
      };
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
  }
  const response = version => ({ success: true, versionId: version.versionId, sha256: version.original.sha256,
    sizeBytes: version.original.sizeBytes, format: version.format, epubEntry: version.epubEntry });
  async function clearFailure(jobRef, token) {
    await db.runTransaction(async tx => {
      const job = await tx.get(jobRef);
      if (job.exists && job.get('token') === token) tx.update(jobRef, { status: 'error', token: deleteField(), errorCode: 'version-preparation-failed', updatedAt: timestamp() });
    });
  }
  async function captureInitialVersion(id, actor) {
    const ref = refFor(id); const jobRef = ref.collection('versionJobs').doc('initialize'); const token = randomId();
    const result = await db.runTransaction(async tx => {
      const current = await tx.get(ref); const job = await tx.get(jobRef);
      if (!current.exists) throw error('not-found', 'Prodotto non trovato.');
      const product = current.data(); eligible(product, id);
      if (product.versioningEnabled) {
        const version = await tx.get(ref.collection('versions').doc(product.currentVersionId));
        if (!version.exists || version.get('status') !== 'ready') throw error('failed-precondition', 'Registro delle versioni non pronto.');
        return { ready: version.data() };
      }
      if (job.exists && job.get('status') === 'processing' && job.get('leaseUntilMs') > clock()) throw error('aborted', 'Preparazione della versione già in corso.');
      tx.set(jobRef, { token, status: 'processing', leaseUntilMs: clock() + 10 * 60 * 1000, updatedAt: timestamp() });
      return { product };
    });
    if (result.ready) return response(result.ready);
    const product = result.product;
    try {
      const sourcePath = `${product.storagePath}/${product.storageFileName}`;
      const version = await snapshot(product, id, 'v1', sourcePath, actor);
      const { meta: latest } = await metadata(sourcePath);
      if (String(latest.generation) !== version.source.generation) throw error('aborted', 'L’originale è cambiato durante la preparazione.');
      await db.runTransaction(async tx => {
        const current = await tx.get(ref); const job = await tx.get(jobRef);
        const versionRef = ref.collection('versions').doc('v1'); const existing = await tx.get(versionRef);
        if (job.get('token') !== token || current.get('versioningEnabled') || current.get('archivedAt') || current.get('storagePath') !== product.storagePath || current.get('storageFileName') !== product.storageFileName || existing.exists) throw error('aborted', 'Il prodotto è cambiato: la versione non è stata attivata.');
        tx.create(versionRef, version);
        tx.update(ref, { versioningEnabled: true, currentVersionId: 'v1', nextVersionNumber: 2,
          storagePath: path.posix.dirname(version.original.storagePath), originalSha256: version.original.sha256, originalGeneration: version.original.generation });
        tx.update(jobRef, { status: 'ready', token: deleteField(), updatedAt: timestamp() });
      });
      return response(version);
    } catch (failure) { await clearFailure(jobRef, token); throw failure; }
  }
  async function initialize(data, context) { return captureInitialVersion(data.productId, admin(context)); }
  async function stage(data, context) {
    const actor = admin(context); const id = data.productId; const ref = refFor(id); const revisionId = randomId();
    const jobRef = ref.collection('versionUploads').doc(revisionId);
    const staged = await db.runTransaction(async tx => {
      const current = await tx.get(ref); if (!current.exists) throw error('not-found', 'Prodotto non trovato.');
      const product = current.data(); eligible(product, id);
      if (!product.versioningEnabled || !versionIdIsValid(product.currentVersionId)) throw error('failed-precondition', 'Prepara prima la versione iniziale.');
      const extension = product.storageFileName.split('.').pop().toLowerCase();
      if (typeof data.fileName !== 'string' || data.fileName.split('.').pop().toLowerCase() !== extension || /[\\/\r\n]/.test(data.fileName)) throw error('invalid-argument', 'La revisione deve mantenere il formato dell’originale.');
      const number = product.nextVersionNumber;
      if (!Number.isSafeInteger(number) || number < 2 || number > 999999999) throw error('failed-precondition', 'Numero di versione non valido.');
      const versionId = `v${number}`;
      const objectPath = `protected_file/version_uploads/${id}/${revisionId}/${product.storageFileName}`;
      const contentType = String(data.contentType || 'application/octet-stream');
      tx.create(jobRef, { status: 'pending', actor, baseVersionId: product.currentVersionId, versionId, objectPath,
        fileName: product.storageFileName, contentType, expiresAtMs: clock() + 30 * 60 * 1000, createdAt: timestamp() });
      tx.update(ref, { nextVersionNumber: number + 1 });
      return { objectPath, contentType, versionId };
    });
    const [uploadUrl] = await bucket.file(staged.objectPath).getSignedUrl({ version: 'v4', action: 'write',
      expires: clock() + 15 * 60 * 1000, contentType: staged.contentType });
    return { uploadUrl, objectPath: staged.objectPath, revisionId, versionId: staged.versionId };
  }
  async function finalize(data, context) {
    const actor = admin(context); const id = data.productId; const ref = refFor(id);
    if (!/^[a-f0-9-]{36}$/.test(data.revisionId || '')) throw error('invalid-argument', 'ID revisione non valido.');
    const jobRef = ref.collection('versionUploads').doc(data.revisionId); const token = randomId();
    const acquired = await db.runTransaction(async tx => {
      const current = await tx.get(ref); const jobDoc = await tx.get(jobRef);
      if (!current.exists || !jobDoc.exists) throw error('not-found', 'Revisione non trovata.');
      const product = current.data(); const job = jobDoc.data(); eligible(product, id);
      if (job.actor.uid !== actor.uid) throw error('permission-denied', 'La revisione appartiene a un altro amministratore.');
      if (job.status === 'ready') {
        const version = await tx.get(ref.collection('versions').doc(job.versionId));
        if (!version.exists) throw error('failed-precondition', 'Registro della revisione non trovato.');
        return { ready: version.data() };
      }
      if (job.expiresAtMs < clock() || job.baseVersionId !== product.currentVersionId || job.fileName !== product.storageFileName) throw error('aborted', 'La revisione è scaduta o è superata da una versione più recente.');
      if (job.status === 'processing' && job.leaseUntilMs > clock()) throw error('aborted', 'Finalizzazione già in corso.');
      if (job.objectPath !== `protected_file/version_uploads/${id}/${data.revisionId}/${product.storageFileName}` || !versionIdIsValid(job.versionId)) throw error('failed-precondition', 'Percorso della revisione non valido.');
      tx.update(jobRef, { status: 'processing', token, leaseUntilMs: clock() + 10 * 60 * 1000 });
      return { product, job };
    });
    if (acquired.ready) return response(acquired.ready);
    try {
      const { product, job } = acquired;
      const version = await snapshot(product, id, job.versionId, job.objectPath, actor);
      await db.runTransaction(async tx => {
        const current = await tx.get(ref); const jobDoc = await tx.get(jobRef);
        const versionRef = ref.collection('versions').doc(job.versionId); const existing = await tx.get(versionRef);
        if (jobDoc.get('token') !== token || current.get('currentVersionId') !== job.baseVersionId || current.get('archivedAt') || existing.exists) throw error('aborted', 'Un’altra revisione ha aggiornato il prodotto.');
        tx.create(versionRef, version);
        tx.update(ref, { currentVersionId: job.versionId, storagePath: path.posix.dirname(version.original.storagePath),
          originalSha256: version.original.sha256, originalGeneration: version.original.generation, revisedAt: timestamp(), updatedAt: timestamp(),
          revisedBy: { uid: actor.uid }, updatedBy: { uid: actor.uid } });
        tx.update(jobRef, { status: 'ready', token: deleteField(), updatedAt: timestamp() });
      });
      return response(version);
    } catch (failure) { await clearFailure(jobRef, token); throw failure; }
  }
  return { initialize, captureInitialVersion, stage, finalize };
}
module.exports = { createVersionHandlers };
