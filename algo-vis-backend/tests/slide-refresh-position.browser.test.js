const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('refresh restores horizontal/vertical position by slide ID without changing old deck content',
  { timeout: 60000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const port = await new Promise(resolve => {
      const server = net.createServer(); server.listen(0, '127.0.0.1', () => {
        const port = server.address().port; server.close(() => resolve(port));
      });
    });
    const server = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true, stdio: 'ignore',
      env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1' } });
    let browser;
    try {
      const base = `http://127.0.0.1:${port}`;
      for (let i = 0; i < 80; i++) {
        try { if ((await fetch(base)).ok) break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      browser = await chromium.launch({ headless: true,
        ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
      const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const deck = { groups: [
        { id: 'g0', slides: [{ id: 's0', canvas: { objects: [] }, widgets: [] }] },
        { id: 'g1', slides: [0, 1, 2].map(i => ({ id: `s1-${i}`, canvas: { objects: [] },
          widgets: i === 2 ? [{ id: 'old-code', type: 'code', content: 'int n = 42;',
            x: 100, y: 100, w: 400, h: 200, fontSize: 26, showLineNumbers: false }] : [] })) }
      ] };
      await page.addInitScript(value => {
        if (sessionStorage.getItem('fixture')) return;
        localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value));
        sessionStorage.setItem('fixture', '1');
      }, deck);
      const ready = () => page.waitForFunction(() => Reveal.isReady() &&
        document.body.dataset.fabricBuild?.startsWith('ready'));
      const current = () => page.locator('.reveal section.present[data-slide-id]').getAttribute('data-slide-id');
      await page.goto(base + '/slides.html'); await ready();
      assert.equal(await current(), 's0');
      await page.getByRole('button', { name: 'next slide', exact: true }).click();
      await page.getByRole('button', { name: 'below slide', exact: true }).click();
      await page.getByRole('button', { name: 'below slide', exact: true }).click();
      assert.equal(await current(), 's1-2');
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      await page.reload(); await ready();
      assert.equal(await current(), 's1-2');
      const saved = await page.evaluate(async () => ASMSlideStorage.create(indexedDB, localStorage)
        .loadDeck('asm_reveal_fabric_deck_v5'));
      const oldCode = saved.groups[1].slides[2].widgets[0];
      assert.equal(oldCode.content, 'int n = 42;'); assert.equal(oldCode.showLineNumbers, false);
      assert.equal(oldCode.fontSize, 26);
      // Change the order while retaining IDs: reload must follow the same slide.
      await page.evaluate(async () => {
        const store = ASMSlideStorage.create(indexedDB, localStorage);
        const deck = await store.loadDeck('asm_reveal_fabric_deck_v5');
        deck.groups[1].slides.reverse(); await store.saveDeck('asm_reveal_fabric_deck_v5', JSON.stringify(deck));
      });
      await page.reload(); await ready(); assert.equal(await current(), 's1-2');
      assert.deepEqual(await page.evaluate(() => { const { h, v } = Reveal.getIndices(); return { h, v }; }), { h: 1, v: 0 });
      // A different deck has its own navigation state; returning restores this one.
      await page.evaluate(() => localStorage.setItem('algo_jwt_token', 'fixture'));
      await page.route('**/api/slides/other**', route => route.fulfill({ json: { slide: { title: 'other', deck } } }));
      await page.goto(base + '/slides.html?deck=other'); await ready();
      assert.equal(await current(), 's0');
      await page.goto(base + '/slides.html'); await ready(); assert.equal(await current(), 's1-2');
      // Stale or malformed bookmarks must not prevent an old deck from opening.
      await page.evaluate(() => sessionStorage.setItem('asm_reveal_fabric_deck_v5:position', '{"slideId":"deleted"}'));
      // Go directly to a fresh navigation so beforeunload cannot replace the injected value.
      await page.close();
      const fresh = await context.newPage();
      await fresh.addInitScript(() => sessionStorage.setItem('asm_reveal_fabric_deck_v5:position', '{"slideId":"deleted"}'));
      await fresh.goto(base + '/slides.html');
      await fresh.waitForFunction(() => Reveal.isReady() && document.body.dataset.fabricBuild?.startsWith('ready'));
      assert.equal(await fresh.locator('.reveal section.present[data-slide-id]').getAttribute('data-slide-id'), 's0');
      assert.deepEqual(errors, []);
    } finally { await browser?.close(); server.kill(); }
  });


