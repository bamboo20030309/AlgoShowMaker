const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('navigation stays available during local save and cannot fake cloud save success',
  { timeout: 60000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const port = await new Promise(resolve => {
      const socket = net.createServer();
      socket.listen(0, '127.0.0.1', () => {
        const value = socket.address().port;
        socket.close(() => resolve(value));
      });
    });
    const server = spawn(process.execPath, ['server.js'], { cwd: root,
      env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1' },
      windowsHide: true, stdio: 'ignore' });
    let browser;
    let releaseCloud;
    try {
      const base = `http://127.0.0.1:${port}`;
      for (let i = 0; i < 80; i++) {
        try { if ((await fetch(base)).ok) break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      browser = await chromium.launch({ headless: true,
        ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const deck = { groups: [0, 1].map(i => ({ id: `group-${i}`, slides: [{
        id: `slide-${i}`, canvas: { objects: [] }, widgets: []
      }] })) };
      await page.addInitScript(() => localStorage.setItem('algo_jwt_token', 'fixture'));
      // Hold only the first IndexedDB write. The UI must initialize before it resolves.
      await page.route('**/slides-storage.js?*', route => route.fulfill({
        contentType: 'application/javascript',
        body: fs.readFileSync(path.join(root, 'public/slides-storage.js'), 'utf8') + `
          const fixtureCreate = ASMSlideStorage.create;
          ASMSlideStorage.create = (...args) => {
            const store = fixtureCreate(...args);
            const save = store.saveDeck.bind(store);
            let first = true;
            store.saveDeck = (...values) => {
              if (!first) return save(...values);
              first = false;
              return new Promise(resolve => window.releaseLocalFixture =
                () => resolve(save(...values)));
            };
            return store;
          };`
      }));
      let rejectSave = true;
      let cloudGate = new Promise(resolve => { releaseCloud = resolve; });
      await page.route('**/api/slides/fixture**', async route => {
        if (route.request().url().includes('/resources/')) {
          return route.fulfill({ json: { total: 0, parts: [] } });
        }
        if (route.request().method() === 'GET') {
          return route.fulfill({ json: { slide: { title: 'fixture', deck } } });
        }
        await cloudGate;
        return route.fulfill({ status: rejectSave ? 500 : 200,
          json: rejectSave ? { error: 'fixture save failed' } : { slide: { title: 'fixture' } } });
      });
      await page.goto(`${base}/slides.html?deck=fixture`);
      await page.waitForFunction(() => window.releaseLocalFixture &&
        document.querySelector('.reveal')?.classList.contains('ready'));
      assert.equal(await page.locator('body').getAttribute('data-local-deck-save'), 'pending');
      await page.getByRole('button', { name: 'next slide', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('section.present')?.dataset.slideId === 'slide-1');
      await page.evaluate(() => window.releaseLocalFixture());
      const archive = await page.evaluate(async value => {
        const projected = await ASMDeck.project(value);
        return Array.from(new Uint8Array(await (await ASMDeck.encode(projected)).arrayBuffer()));
      }, deck);
      await page.locator('#importDeckInput').setInputFiles({
        name: 'fixture.asmdeck', mimeType: 'application/octet-stream', buffer: Buffer.from(archive)
      });
      await page.waitForFunction(() => document.querySelector('#cloudSaveStatus')?.dataset.state === 'pending');
      await page.getByRole('button', { name: 'next slide', exact: true }).click();
      assert.equal(await page.locator('#cloudSaveStatus').getAttribute('data-state'), 'pending');
      await page.waitForFunction(() => document.querySelector('#cloudSaveStatus')?.dataset.state === 'saving');
      await page.getByRole('button', { name: 'previous slide', exact: true }).click();
      assert.equal(await page.locator('#cloudSaveStatus').getAttribute('data-state'), 'saving');
      releaseCloud();
      await page.waitForFunction(() => document.querySelector('#cloudSaveStatus')?.dataset.state === 'error');
      await page.getByRole('button', { name: 'next slide', exact: true }).click();
      assert.equal(await page.locator('#cloudSaveStatus').getAttribute('data-state'), 'error');
      rejectSave = false;
      cloudGate = Promise.resolve();
      await page.locator('#importDeckInput').setInputFiles({
        name: 'fixture.asmdeck', mimeType: 'application/octet-stream', buffer: Buffer.from(archive)
      });
      await page.waitForFunction(() => document.querySelector('#cloudSaveStatus')?.textContent.includes('已儲存'));
      await page.getByRole('button', { name: 'next slide', exact: true }).click();
      assert.equal(await page.locator('#cloudSaveStatus').getAttribute('data-state'), 'saved');
      assert.deepEqual(errors, []);
    } finally {
      releaseCloud?.();
      await browser?.close();
      server.kill();
    }
  });
