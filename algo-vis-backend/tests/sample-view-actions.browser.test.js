const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('public sample viewer can export and share its viewing link', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const selected = probe.address().port;
      probe.close(() => resolve(selected));
    });
  });
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') },
    windowsHide: true,
    stdio: 'ignore'
  });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try { if ((await fetch(base)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    global.ASMTraceProvenance = require('../public/trace-provenance');
    const ASMDeck = require('../public/asmdeck');
    const deck = { groups: [{ id: 'sample-group', slides: [{ id: 'sample-slide', canvas: { objects: [] }, widgets: [] }] }] };
    const archive = Buffer.from(await (await ASMDeck.encode({ deck, assets: {} })).arrayBuffer());
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/guest-decks.json', route => route.fulfill({
      json: { decks: [{ id: 'fixture', title: 'Public Sample', archive: '/guest-decks/fixture.asmdeck' }] }
    }));
    await page.route('**/guest-decks/fixture.asmdeck', route => route.fulfill({
      body: archive, contentType: 'application/octet-stream'
    }));
    await page.goto(`${base}/slides.html?sample=fixture`);
    await page.waitForSelector('body.sample-deck-ready');
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('asm-edit-mode')), false);
    assert.equal(await page.locator('#editorChrome').isVisible(), false);
    assert.equal(await page.locator('#exportDeckBtn').isVisible(), true);
    assert.equal(await page.locator('#shareDeckBtn').isVisible(), true);
    assert.equal(await page.locator('#importDeckBtn').isVisible(), false);

    await page.locator('#shareDeckBtn').click();
    assert.equal(await page.locator('#sampleShareDialog').evaluate(el => el.open), true);
    assert.equal(await page.locator('#sampleShareUrl').inputValue(), `${base}/slides.html?sample=fixture`);
    assert.equal(await page.locator('#shareDialog').evaluate(el => el.open), false);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#copySampleShareUrlBtn').click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${base}/slides.html?sample=fixture`);
    assert.equal(await page.locator('#sampleShareStatus').textContent(), '連結已複製。');
    await page.locator('#closeSampleShareDialogBtn').click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#exportDeckBtn').click()
    ]);
    assert.equal(download.suggestedFilename(), 'Public Sample.asmdeck');
    const exportedBytes = Buffer.concat(await (await download.createReadStream()).toArray());
    assert.deepEqual(exportedBytes, archive);
    const exported = await ASMDeck.decode(new Blob([exportedBytes]));
    assert.equal(exported.deck.groups[0].slides.length, 1);

    const sharedPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await sharedPage.route('**/api/shared-slides/fixture', route => route.fulfill({
      json: { slide: { deck, title: 'Shared Deck' }, access: 'view' }
    }));
    await sharedPage.goto(`${base}/slides.html?share=fixture`);
    await sharedPage.waitForSelector('body.shared-view-only');
    await sharedPage.waitForFunction(() => document.title === 'Shared Deck - AlgoShowMaker');
    assert.equal(await sharedPage.locator('#exportDeckBtn').isVisible(), false);
    assert.equal(await sharedPage.locator('#shareDeckBtn').isVisible(), false);
    assert.equal(await sharedPage.locator('#sampleShareDialog').evaluate(el => el.open), false);
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
