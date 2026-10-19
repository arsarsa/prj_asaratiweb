// Run with: node functions/test/audio-preview-ui.cjs (requires Playwright).
// Firebase modules are replaced with local fixtures; no remote data is touched.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "@playwright/test");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");

(async () => {
  const root = path.resolve(__dirname, "../..");
  const server = http.createServer(async (req, res) => {
    const name = path.join(root, new URL(req.url, "http://localhost").pathname);
    try {
      const body = await fs.readFile(name);
      res.setHeader("Content-Type", name.endsWith(".js") ? "text/javascript" : "text/html");
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.calls = [];
      window.fixture = { type: "audiobook", name: "Audio di prova", active: true, price: "3", counters: {} };
    });
    await page.route("https://www.gstatic.com/firebasejs/**", async (route) => {
      const name = route.request().url();
      let body;
      if (name.endsWith("firebase-app.js")) body = "export const initializeApp = () => ({});";
      if (name.endsWith("firebase-auth.js")) body = "export const getAuth = () => ({ currentUser: {} }); export const onAuthStateChanged = (auth, fn) => fn({});";
      if (name.endsWith("firebase-firestore.js")) body = `
        export const getFirestore = () => ({});
        export const collection = (db, name) => name;
        export const doc = (db, name, id) => name;
        export const getDocs = async name => { const docs = name === 'products' ? [{ id: 'audio01', data: () => window.fixture }] : []; return {docs, forEach: fn => docs.forEach(fn)}; };
        export const getDoc = async () => ({ exists: () => false });`;
      if (name.endsWith("firebase-functions.js")) body = `
        export const getFunctions = () => ({});
        export const httpsCallable = (unused, name) => async data => {
          window.calls.push({ name, data });
          if (name === 'generateAudiobookPreview') { window.fixture.audioPreviewDraft = {id:'draft01'}; return {data:{success:true}}; }
          if (name === 'getAudiobookPreview') return {data:{draftId:'draft01',previewUrl:'/fixture.mp3',duration:120,peaks:Array(120).fill(0.7)}};
          if (name === 'setAudiobookPreviewPublished') { window.fixture.audioPreviewPublished=data.published; return {data:{published:data.published}}; }
          return {data:{summaries:{}}};
        };`;
      await route.fulfill({ contentType: "text/javascript", body });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/uploadfile/online_upload.html`);
    await page.getByRole("button", { name: "Mostra prodotti caricati" }).click();
    await page.getByRole("button", { name: "Genera anteprima", exact: true }).click();
    await page.getByRole("dialog", { name: "Anteprima audio" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Pubblica anteprima sul QRC" }).waitFor({ state: "visible" });
    assert.equal(await page.locator("#audioPreviewWaveform rect").count(), 120);
    assert.equal(await page.evaluate(() => window.fixture.audioPreviewPublished), undefined);
    await page.getByRole("button", { name: "Pubblica anteprima sul QRC" }).click();
    await page.getByRole("button", { name: "Ritira anteprima" }).waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => window.fixture.audioPreviewPublished), true);
    await page.getByRole("button", { name: "Ritira anteprima" }).click();
    await page.getByRole("button", { name: "Ritira anteprima" }).waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => window.fixture.audioPreviewPublished), false);
    assert.deepEqual(errors, []);
    const calls = await page.evaluate(() => window.calls.filter(call => call.name === 'setAudiobookPreviewPublished'));
    assert.equal(calls[0].data.draftId, "draft01");
    console.log("PASS: UI generates a private draft, draws waveform, explicitly publishes and withdraws preview.");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
