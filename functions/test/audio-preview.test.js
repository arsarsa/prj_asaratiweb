const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const ffmpeg = require("ffmpeg-static");
const { audioPosition, selectFirstChapter, buildPreview, waveform } = require("../audio-preview");
const { createAudioPreviewHandlers } = require("../audio-preview-functions");

// Minimal stored ZIP fixtures, independent of any ZIP implementation under test.
function zipFiles(files) {
  const local = [], directory = [];
  let offset = 0;
  for (const [name, data] of files) {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const fileName = Buffer.from(name);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(fileName.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(fileName.length, 28); entry.writeUInt32LE(offset, 42);
    local.push(header, fileName, data); directory.push(entry, fileName);
    offset += header.length + fileName.length + data.length;
  }
  const central = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, central, end]);
}

test("chapter selection accepts old/new names and keeps numeric order", () => {
  assert.deepEqual(audioPosition("Audio/001_005_003.wav"), { book: "001", chapter: 5, segment: 3, extension: "wav" });
  assert.equal(audioPosition("__MACOSX/._001_001_001.mp3"), null);
  const entries = ["001_001_002.mp3", "001_002_001.mp3", "001_001_001.wav", "001_001_001.mp3"].map((fileName) => ({ fileName }));
  assert.deepEqual(selectFirstChapter(entries).map((entry) => entry.fileName), ["001_001_001.mp3", "001_001_002.mp3"]);
  assert.equal(selectFirstChapter([{ fileName: "USN_Cpt01-01.mp3" }]).length, 1);
  assert.throws(() => selectFirstChapter([{ fileName: "random.mp3" }]), /Primo capitolo/);
  assert.throws(() => selectFirstChapter([{ fileName: "001_001_002.mp3" }]), /iniziare/);
  assert.throws(() => selectFirstChapter([{ fileName: "001_001_001.mp3" }, { fileName: "002_001_001.mp3" }]), /più libri/);
  assert.throws(() => selectFirstChapter([{ fileName: "001_001_001.mp3" }, { fileName: "001_001_003.mp3" }]), /consecutiva/);
});

test("ZIP preview joins short segments, stops at chapter boundary, and fades out", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "preview-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const wav = path.join(directory, "tone.wav");
  execFileSync(ffmpeg, ["-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", wav]);
  const audio = await fs.readFile(wav);
  const source = path.join(directory, "book.zip");
  await fs.writeFile(source, zipFiles([["001_001_002.wav", audio], ["001_002_001.wav", audio], ["001_001_001.wav", audio]]));
  const result = await buildPreview({ source, fileName: "book.zip", directory });
  assert.equal(result.duration, 6);
  assert.equal(result.fadeSeconds, 5);
  assert.deepEqual(result.selectedNames, ["001_001_001.wav", "001_001_002.wav"]);
  assert.equal(result.peaks.length, 120);
  assert.ok(result.peaks.at(-1) < result.peaks[0] / 10);
  const pcm = execFileSync(ffmpeg, ["-loglevel", "error", "-i", result.output, "-f", "s16le", "-ac", "1", "-ar", "22050", "pipe:1"]);
  assert.ok(Math.abs(pcm.length / 2 / 22050 - 6) < 0.1);
  const peaks = waveform(pcm);
  assert.ok(peaks.at(-1) < peaks[0] / 10);
});

test("long first segment produces exactly 120 seconds without changing its source", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "preview-long-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, "long.wav");
  execFileSync(ffmpeg, ["-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=220:duration=123", source]);
  const original = await fs.readFile(source);
  const result = await buildPreview({ source, fileName: "long.wav", directory });
  assert.equal(result.duration, 120);
  assert.equal(result.fadeSeconds, 5);
  assert.deepEqual(await fs.readFile(source), original);
});

test("unsafe archive paths are rejected without extracting outside the work directory", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "preview-zip-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, "bad.zip");
  await fs.writeFile(source, zipFiles([["../001_001_001.mp3", Buffer.from("bad")]]));
  await assert.rejects(buildPreview({ source, fileName: "bad.zip", directory }), /invalid relative path/);
});

class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
function mockHandlers(product, bucketOverride) {
  const operations = [];
  let state = { ...product };
  const snapshot = () => ({ exists: true, data: () => state, get: (key) => key.split(".").reduce((value, part) => value?.[part], state) });
  const ref = { id: "audio01", get: async () => snapshot(), update: async (fields) => { state = { ...state, ...fields }; } };
  const transaction = { get: async () => snapshot(), update: (unused, fields) => { state = { ...state, ...fields }; } };
  const handlers = createAudioPreviewHandlers({
    functions: { https: { HttpsError } }, admin: { firestore: { FieldValue: { serverTimestamp: () => ({ toMillis: () => Date.now() }) } } },
    db: { collection: () => ({ doc: () => ref }), runTransaction: (fn) => fn(transaction) },
    bucket: bucketOverride || { file: (name) => ({ getMetadata: async () => [{ generation: "new-version" }], delete: async () => operations.push(["delete", name]) }) },
  });
  return { handlers, operations, current: () => state };
}
const auth = { auth: { uid: "admin", token: { admin: true } } };
const product = { type: "audiobook", storagePath: "protected_file/audioBook/audio01", storageFileName: "book.zip" };

test("preview callables require admin authorization before accessing data", async () => {
  const { handlers } = mockHandlers(product);
  for (const handler of Object.values(handlers)) {
    await assert.rejects(handler({ productId: "audio01" }, {}), (error) => error.code === "permission-denied");
  }
});

test("publication rejects stale originals and concurrent jobs", async () => {
  const draft = { id: "draft01", path: "protected_file/audio_previews/audio01/draft01.mp3", sourcePath: "protected_file/audioBook/audio01/book.zip", sourceGeneration: "old-version" };
  const { handlers, current } = mockHandlers({ ...product, audioPreviewDraft: draft, audioPreviewPublished: false });
  await assert.rejects(handlers.publish({ productId: "audio01", published: true, draftId: "draft01" }, auth), /originale è cambiato/);
  assert.equal(current().audioPreviewPublished, false);
  const running = mockHandlers({ ...product, audioPreviewJob: { status: "running", startedAt: { toMillis: () => Date.now() } } });
  await assert.rejects(running.handlers.generate({ productId: "audio01" }, auth), /già in corso/);
});

test("unpublishing hides preview, removes public asset and retains private draft", async () => {
  const { handlers, operations, current } = mockHandlers({ ...product, audioPreviewPublished: true, audioPreviewDraft: { id: "keep" } });
  assert.deepEqual(await handlers.publish({ productId: "audio01", published: false }, auth), { published: false });
  assert.equal(current().audioPreviewPublished, false);
  assert.equal(current().audioPreviewDraft.id, "keep");
  assert.deepEqual(operations, [["delete", "public_file/product_audio_previews/audio01.mp3"]]);
});


test("approved current draft publishes its waveform to the QRC product fields", async () => {
  const copies = [];
  const draft = { id: "draft01", path: "protected_file/audio_previews/audio01/draft01.mp3", sourcePath: "protected_file/audioBook/audio01/book.zip", sourceGeneration: "current", peaks: [0.2, 0.8], duration: 120 };
  const bucket = { file: name => ({ name, getMetadata: async () => [{generation: "current"}], copy: async target => copies.push([name, target.name]) }) };
  const { handlers, current } = mockHandlers({ ...product, audioPreviewDraft: draft }, bucket);
  await handlers.publish({ productId: "audio01", published: true, draftId: "draft01" }, auth);
  assert.equal(current().audioPreviewPublished, true);
  assert.equal(current().audioPreviewPath, "public_file/product_audio_previews/audio01.mp3");
  assert.deepEqual(current().audioPreviewPeaks, draft.peaks);
  assert.deepEqual(copies, [[draft.path, "public_file/product_audio_previews/audio01.mp3"]]);
});
