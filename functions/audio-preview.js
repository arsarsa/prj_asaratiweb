const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");
const { Transform } = require("node:stream");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const yauzl = require("yauzl");

const exec = promisify(execFile);
const SAMPLE_RATE = 22050;
const PREVIEW_SECONDS = 120;
const MAX_SOURCE_BYTES = 512 * 1024 * 1024;
const MAX_ENTRY_BYTES = 256 * 1024 * 1024;

function audioPosition(fileName) {
  const base = path.posix.basename(fileName);
  if (fileName.split("/").some((part) => part.startsWith(".")) || fileName.startsWith("__MACOSX/")) return null;
  const modern = /^(\d{3})_(\d{3})_(\d{3})\.(mp3|wav)$/i.exec(base);
  const legacy = /^([a-z0-9_-]+)_Cpt(\d+)-(\d+)\.(mp3|wav)$/i.exec(base);
  const match = modern || legacy;
  if (!match) return null;
  return { book: match[1].toLowerCase(), chapter: Number(match[2]), segment: Number(match[3]), extension: match[4].toLowerCase() };
}

function selectFirstChapter(entries) {
  const candidates = entries.map((entry) => ({ entry, position: audioPosition(entry.fileName) }))
    .filter(({ position }) => position && position.chapter === 1 && position.segment >= 1);
  const books = new Set(candidates.map(({ position }) => position.book));
  if (books.size !== 1) throw new Error(books.size ? "Lo ZIP contiene più libri: carica un solo audiobook." : "Primo capitolo non trovato. Usa 001_001_001.mp3 oppure USN_Cpt01-01.mp3.");
  candidates.sort((a, b) => a.position.segment - b.position.segment || (a.position.extension === "mp3" ? -1 : 1));
  const unique = [];
  for (const item of candidates) {
    const previous = unique[unique.length - 1];
    if (previous && previous.position.segment === item.position.segment) {
      if (previous.position.extension === item.position.extension) throw new Error("Segmento duplicato nello ZIP.");
      continue; // When both masters exist, use MP3 rather than duplicating the segment.
    }
    unique.push(item);
  }
  if (unique[0]?.position.segment !== 1) throw new Error("Il primo capitolo deve iniziare dal segmento 001 (oppure 01).");
  for (let i = 0; i < unique.length; i++) {
    if (unique[i].position.segment !== i + 1) throw new Error("La numerazione dei segmenti del primo capitolo non è consecutiva.");
  }
  return unique.map(({ entry }) => entry);
}

function byteLimit(max) {
  let bytes = 0;
  return new Transform({ transform(chunk, encoding, callback) {
    bytes += chunk.length;
    callback(bytes > max ? new Error("File troppo grande per generare l’anteprima.") : null, chunk);
  } });
}

async function copyBounded(input, destination, max) {
  await pipeline(input, byteLimit(max), fs.createWriteStream(destination, { flags: "wx" }));
}

async function openArchive(fileName) {
  return new Promise((resolve, reject) => yauzl.open(fileName, {
    lazyEntries: true, autoClose: false, validateEntrySizes: true, strictFileNames: true,
  }, (error, zip) => error ? reject(error) : resolve(zip)));
}

async function listEntries(zip) {
  return new Promise((resolve, reject) => {
    const entries = [];
    let count = 0;
    zip.on("error", reject);
    zip.on("entry", (entry) => {
      if (++count > 5000) return reject(new Error("Lo ZIP contiene troppi file."));
      entries.push(entry);
      zip.readEntry();
    });
    zip.once("end", () => resolve(entries));
    zip.readEntry();
  });
}

async function decodePcm(input, seconds, ffmpegPath) {
  const { stdout } = await exec(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-protocol_whitelist", "file,pipe",
    "-i", input, "-t", String(seconds), "-map", "0:a:0", "-vn", "-ac", "1", "-ar", String(SAMPLE_RATE),
    "-f", "s16le", "pipe:1",
  ], { encoding: "buffer", maxBuffer: SAMPLE_RATE * 2 * PREVIEW_SECONDS + 1024 * 1024, timeout: 90000 });
  return stdout;
}

function waveform(pcm, count = 120) {
  const samples = Math.floor(pcm.length / 2);
  const peaks = Array.from({ length: count }, (_, index) => {
    let peak = 0;
    for (let i = Math.floor(index * samples / count); i < Math.floor((index + 1) * samples / count); i++) {
      peak = Math.max(peak, Math.abs(pcm.readInt16LE(i * 2)) / 32768);
    }
    return peak;
  });
  const max = Math.max(...peaks);
  return peaks.map((peak) => max ? Number((peak / max).toFixed(4)) : 0);
}

async function buildPreview({ source, fileName, directory, ffmpegPath = require("ffmpeg-static") }) {
  const chunks = [];
  const selectedNames = [];
  let samples = 0;
  const maxSamples = SAMPLE_RATE * PREVIEW_SECONDS;
  async function append(input, name) {
    const pcm = await decodePcm(input, (maxSamples - samples) / SAMPLE_RATE, ffmpegPath);
    if (pcm.length < 2) throw new Error(`Il segmento ${name} non contiene audio leggibile.`);
    const remaining = (maxSamples - samples) * 2;
    chunks.push(pcm.subarray(0, remaining));
    samples += Math.min(pcm.length, remaining) / 2;
    selectedNames.push(name);
  }
  if (/\.zip$/i.test(fileName)) {
    const zip = await openArchive(source);
    try {
      const entries = selectFirstChapter(await listEntries(zip));
      for (const [index, entry] of entries.entries()) {
        if (samples >= maxSamples) break;
        if (entry.generalPurposeBitFlag & 1) throw new Error("Gli ZIP con password non sono supportati.");
        if (entry.uncompressedSize > MAX_ENTRY_BYTES) throw new Error("Un segmento audio supera il limite di 256 MB.");
        const input = path.join(directory, `segment-${index}.${path.extname(entry.fileName).slice(1)}`);
        const stream = await new Promise((resolve, reject) => zip.openReadStream(entry, (error, readable) => error ? reject(error) : resolve(readable)));
        await copyBounded(stream, input, MAX_ENTRY_BYTES);
        try { await append(input, entry.fileName); } finally { await fsp.rm(input, { force: true }); }
      }
    } finally { zip.close(); }
  } else {
    if (!/\.(mp3|wav|m4a|m4b|mp4)$/i.test(fileName)) throw new Error("Formato audiobook non supportato.");
    await append(source, fileName);
  }
  const pcm = Buffer.concat(chunks);
  const duration = pcm.length / 2 / SAMPLE_RATE;
  if (duration < 0.1) throw new Error("Audio troppo breve per generare un’anteprima.");
  const fadeSeconds = Math.min(5, duration);
  const fadeStart = duration - fadeSeconds;
  for (let sample = Math.floor(fadeStart * SAMPLE_RATE); sample < samples; sample++) {
    const gain = Math.max(0, (samples - 1 - sample) / (fadeSeconds * SAMPLE_RATE));
    pcm.writeInt16LE(Math.round(pcm.readInt16LE(sample * 2) * gain), sample * 2);
  }
  const raw = path.join(directory, "preview.pcm");
  const output = path.join(directory, "preview.mp3");
  await fsp.writeFile(raw, pcm);
  await exec(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-f", "s16le", "-ar", String(SAMPLE_RATE), "-ac", "1", "-i", raw,
    "-map_metadata", "-1", "-codec:a", "libmp3lame", "-b:a", "96k", output,
  ], { timeout: 90000 });
  return { output, duration, fadeSeconds, peaks: waveform(pcm), selectedNames };
}

module.exports = { buildPreview, audioPosition, selectFirstChapter, waveform, copyBounded, MAX_SOURCE_BYTES, MAX_ENTRY_BYTES, openArchive, listEntries };
