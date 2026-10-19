const crypto = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { buildPreview, copyBounded, MAX_SOURCE_BYTES } = require("./audio-preview");

function createAudioPreviewHandlers({ functions, admin, db, bucket }) {
  const HttpsError = functions.https.HttpsError;
  const now = () => admin.firestore.FieldValue.serverTimestamp();
  function reference(data, context) {
    if (context.auth?.token.admin !== true) throw new HttpsError("permission-denied", "Accesso amministratore richiesto.");
    if (!/^[a-zA-Z0-9_-]{3,80}$/.test(data?.productId || "")) throw new HttpsError("invalid-argument", "ID prodotto non valido.");
    return db.collection("products").doc(data.productId);
  }
  function sourcePath(product, productId) {
    if (product.type !== "audiobook" || product.archivedAt) throw new HttpsError("failed-precondition", "Seleziona un audiobook non archiviato.");
    const root = product.accessMode === "free" ? "public_file" : "protected_file";
    const allowed = [`${root}/audioBook/${productId}`];
    if (root === "protected_file") allowed.push(`${root}/audioBook`); // Existing catalogue.
    if (!allowed.includes(product.storagePath) || !/^[^/\\\r\n]+\.(zip|mp3|wav|m4a|m4b|mp4)$/i.test(product.storageFileName || "")) {
      throw new HttpsError("failed-precondition", "Il percorso del file audiobook non è valido.");
    }
    return `${product.storagePath}/${product.storageFileName}`;
  }
  async function getProduct(ref) {
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new HttpsError("not-found", "Prodotto non trovato.");
    sourcePath(snapshot.data(), ref.id);
    return snapshot.data();
  }
  async function acquire(ref, status) {
    const jobId = crypto.randomUUID();
    const product = await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new HttpsError("not-found", "Prodotto non trovato.");
      const current = snapshot.data();
      sourcePath(current, ref.id);
      const job = current.audioPreviewJob;
      if (job?.status === "running" && Date.now() - job.startedAt.toMillis() < 10 * 60 * 1000) {
        throw new HttpsError("failed-precondition", "È già in corso un’elaborazione dell’anteprima. Attendi il completamento.");
      }
      tx.update(ref, { audioPreviewJob: { id: jobId, status: "running", operation: status, startedAt: now() } });
      return current;
    });
    return { product, jobId };
  }
  async function complete(ref, jobId, fields) {
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (snapshot.get("audioPreviewJob.id") !== jobId) throw new HttpsError("aborted", "Operazione superata da una richiesta più recente.");
      tx.update(ref, { ...fields, audioPreviewJob: { id: jobId, status: "ready", finishedAt: now() } });
    });
  }
  async function failed(ref, jobId, error) {
    console.error("Audio preview operation failed", { productId: ref.id, message: error.message });
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (snapshot.get("audioPreviewJob.id") === jobId) {
        tx.update(ref, { audioPreviewJob: { id: jobId, status: "error", finishedAt: now() } });
      }
    });
  }
  async function assertCurrentSource(product, productId, draft) {
    const objectPath = sourcePath(product, productId);
    const [metadata] = await bucket.file(objectPath).getMetadata();
    if (draft.sourcePath !== objectPath || String(metadata.generation) !== draft.sourceGeneration) {
      throw new HttpsError("failed-precondition", "Il file originale è cambiato: genera nuovamente l’anteprima.");
    }
  }
  async function generate(data, context) {
    const ref = reference(data, context);
    const { product, jobId } = await acquire(ref, "generate");
    let directory;
    let draftPath;
    let saved = false;
    try {
      const objectPath = sourcePath(product, ref.id);
      const [metadata] = await bucket.file(objectPath).getMetadata();
      if (!Number(metadata.size) || Number(metadata.size) > MAX_SOURCE_BYTES) {
        throw new HttpsError("failed-precondition", "Il file deve avere dimensione compresa tra 1 byte e 512 MB.");
      }
      directory = await fs.mkdtemp(path.join(os.tmpdir(), "audio-preview-"));
      const source = path.join(directory, "source");
      const sourceGeneration = String(metadata.generation);
      await copyBounded(bucket.file(objectPath, { generation: sourceGeneration }).createReadStream(), source, MAX_SOURCE_BYTES);
      const preview = await buildPreview({ source, fileName: product.storageFileName, directory });
      const draft = {
        id: jobId, path: `protected_file/audio_previews/${ref.id}/${jobId}.mp3`,
        sourcePath: objectPath, sourceGeneration, duration: preview.duration,
        fadeSeconds: preview.fadeSeconds, peaks: preview.peaks, segments: preview.selectedNames,
        createdAt: now(), createdBy: context.auth.uid,
      };
      draftPath = draft.path;
      await assertCurrentSource(await getProduct(ref), ref.id, draft);
      await bucket.upload(preview.output, { destination: draft.path, resumable: false,
        metadata: { contentType: "audio/mpeg", cacheControl: "private, no-store" } });
      await complete(ref, jobId, { audioPreviewDraft: draft });
      saved = true;
      if (product.audioPreviewDraft?.path?.startsWith(`protected_file/audio_previews/${ref.id}/`)) {
        await bucket.file(product.audioPreviewDraft.path).delete({ ignoreNotFound: true }).catch(console.error);
      }
      return { success: true, duration: preview.duration, published: false };
    } catch (error) {
      await failed(ref, jobId, error);
      if (draftPath && !saved) await bucket.file(draftPath).delete({ ignoreNotFound: true }).catch(console.error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("failed-precondition", `Anteprima non generata. ${error.message}`.slice(0, 500));
    } finally {
      if (directory) await fs.rm(directory, { recursive: true, force: true });
    }
  }
  async function preview(data, context) {
    const ref = reference(data, context);
    const product = await getProduct(ref);
    const draft = product.audioPreviewDraft;
    if (!draft || draft.path !== `protected_file/audio_previews/${ref.id}/${draft.id}.mp3`) {
      throw new HttpsError("failed-precondition", "Genera prima una bozza dell’anteprima.");
    }
    const [exists] = await bucket.file(draft.path).exists();
    if (!exists) throw new HttpsError("not-found", "Bozza non disponibile. Genera nuovamente l’anteprima.");
    const [previewUrl] = await bucket.file(draft.path).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 15 * 60 * 1000 });
    return { previewUrl, peaks: draft.peaks, duration: draft.duration, segments: draft.segments, draftId: draft.id };
  }
  async function publish(data, context) {
    const ref = reference(data, context);
    if (typeof data.published !== "boolean") throw new HttpsError("invalid-argument", "Specifica lo stato di pubblicazione.");
    const { product, jobId } = await acquire(ref, data.published ? "publish" : "unpublish");
    const publicPath = `public_file/product_audio_previews/${ref.id}.mp3`;
    try {
      if (!data.published) {
        await ref.update({ audioPreviewPublished: false });
        await bucket.file(publicPath).delete({ ignoreNotFound: true });
        await complete(ref, jobId, { audioPreviewPublished: false, audioPreviewUpdatedAt: now() });
        return { published: false };
      }
      const draft = product.audioPreviewDraft;
      if (!draft || data.draftId !== draft.id || draft.path !== `protected_file/audio_previews/${ref.id}/${draft.id}.mp3`) {
        throw new HttpsError("failed-precondition", "Ascolta la bozza corrente prima di pubblicarla.");
      }
      await assertCurrentSource(product, ref.id, draft);
      await ref.update({ audioPreviewPublished: false });
      await bucket.file(draft.path).copy(bucket.file(publicPath));
      const current = await getProduct(ref);
      await assertCurrentSource(current, ref.id, draft);
      await complete(ref, jobId, {
        audioPreviewPath: publicPath, audioPreviewPublished: true, audioPreviewPeaks: draft.peaks,
        audioPreviewDuration: draft.duration, audioPreviewPublishedDraftId: draft.id,
        audioPreviewUpdatedAt: now(), audioPreviewPublishedBy: context.auth.uid,
      });
      return { published: true };
    } catch (error) {
      await failed(ref, jobId, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Impossibile aggiornare la pubblicazione dell’anteprima. Riprova.");
    }
  }
  return { generate, preview, publish };
}

module.exports = { createAudioPreviewHandlers };
