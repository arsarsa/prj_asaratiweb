const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { audioPosition, openArchive, listEntries, copyBounded, MAX_ENTRY_BYTES } = require("./audio-preview");
const exec = promisify(execFile);

async function durationSeconds(file, ffprobePath) {
  const { stdout } = await exec(ffprobePath, ["-v", "error", "-protocol_whitelist", "file,pipe",
    "-select_streams", "a:0", "-show_entries", "stream=codec_type:format=duration", "-of", "json", file],
  { timeout: 20000, maxBuffer: 1024 * 1024 });
  const info = JSON.parse(stdout);
  const duration = Number(info.format?.duration);
  if (info.streams?.[0]?.codec_type !== "audio" || !Number.isFinite(duration) || duration <= 0) {
    throw new Error("Il file non contiene una traccia audio con durata leggibile.");
  }
  return Math.round(duration * 1000) / 1000;
}

function archiveTracks(entries) {
  const tracks = entries.map(entry => ({ entry, position: audioPosition(entry.fileName) }))
    .filter(item => item.position && item.position.chapter >= 1 && item.position.segment >= 1);
  if (!tracks.length) throw new Error("Nessuna traccia trovata: usa nomi come 001_001_001.mp3.");
  if (new Set(tracks.map(item => item.position.book)).size !== 1) throw new Error("Lo ZIP deve contenere un solo libro.");
  if (tracks.length > 300) throw new Error("Il pacchetto supera il limite di 300 tracce.");
  tracks.sort((a, b) => a.position.chapter - b.position.chapter || a.position.segment - b.position.segment || (a.position.extension === "mp3" ? -1 : 1));
  const selected = [];
  for (const item of tracks) {
    const previous = selected.at(-1);
    if (previous && previous.position.chapter === item.position.chapter && previous.position.segment === item.position.segment) {
      if (previous.position.extension === item.position.extension) throw new Error("Posizione audio duplicata nello ZIP.");
    } else selected.push(item);
  }
  return selected;
}

async function extract(zip, entry, output, limit) {
  if ((entry.generalPurposeBitFlag & 1) || entry.uncompressedSize > limit) throw new Error("Voce ZIP cifrata o troppo grande.");
  const stream = await new Promise((resolve, reject) => zip.openReadStream(entry, (error, value) => error ? reject(error) : resolve(value)));
  await copyBounded(stream, output, limit);
}

async function inspectPackage({ source, fileName, directory, ffmpegPath = require("ffmpeg-static"), ffprobePath = require("ffprobe-static").path }) {
  if (!/\.zip$/i.test(fileName)) {
    const duration = await durationSeconds(source, ffprobePath);
    return { durationSeconds: duration, tracks: [{ fileName, durationSeconds: duration }], cover: null };
  }
  const zip = await openArchive(source);
  try {
    const entries = await listEntries(zip);
    const tracks = [];
    const deadline = Date.now() + 420000;
    for (const [index, { entry, position }] of archiveTracks(entries).entries()) {
      if (Date.now() > deadline) throw new Error("Analisi troppo lunga: riduci le dimensioni del pacchetto.");
      const input = path.join(directory, `track-${index}.${position.extension}`);
      await extract(zip, entry, input, MAX_ENTRY_BYTES);
      try {
        tracks.push({ fileName: entry.fileName, book: position.book, chapter: position.chapter, segment: position.segment,
          durationSeconds: await durationSeconds(input, ffprobePath) });
      } finally { await fs.rm(input, { force: true }); }
    }
    const covers = entries.filter(entry => path.posix.basename(entry.fileName).toLowerCase() === "cover.jpg"
      && !entry.fileName.split("/").some(part => part.startsWith(".") || part === "__MACOSX"));
    const root = covers.find(entry => entry.fileName === "cover.jpg" || entry.fileName === "Cover.jpg");
    if (!root && covers.length > 1) throw new Error("Sono presenti più cover.jpg: lascia una sola copertina nel pacchetto.");
    let cover = null;
    const entry = root || covers[0];
    if (entry) {
      const input = path.join(directory, "cover-original.jpg");
      await extract(zip, entry, input, 10 * 1024 * 1024);
      const { stdout } = await exec(ffprobePath, ["-v", "error", "-show_entries", "stream=codec_name,width,height", "-of", "json", input], { timeout: 10000 });
      const image = JSON.parse(stdout).streams?.[0];
      if (image?.codec_name !== "mjpeg" || !image.width || !image.height || image.width * image.height > 32000000) {
        throw new Error("cover.jpg deve essere un’immagine JPEG valida, fino a 32 megapixel.");
      }
      cover = path.join(directory, "cover.jpg");
      await exec(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", input,
        "-frames:v", "1", "-vf", "scale=w='min(1200,iw)':h='min(1200,ih)':force_original_aspect_ratio=decrease",
        "-map_metadata", "-1", "-q:v", "3", cover], { timeout: 30000 });
    }
    return { durationSeconds: Math.round(tracks.reduce((sum, track) => sum + track.durationSeconds, 0) * 1000) / 1000, tracks, cover };
  } finally { zip.close(); }
}

module.exports = { inspectPackage, durationSeconds, archiveTracks };
