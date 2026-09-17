const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('external deck files drop onto import and add controls, workspace creates and persists a new deck', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => { const probe = net.createServer(); probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close(() => resolve(port)); }); });
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') }, windowsHide: true, stdio: 'ignore' });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const fixture = label => ({ groups: [{ id: label, slides: [1, 2].map(n => ({ id: `${label}-${n}`, canvas: { objects: [{ type: 'textbox', text: `${label} ${n}`, left: 100, top: 100, width: 600, fontSize: 32 }] }, widgets: [] })) }] });
    async function drop(selector, name, deck, mode = 'json') {
      await page.evaluate(async ({ selector, name, deck, mode }) => {
        const payload = mode === 'asmdeck' ? await ASMDeck.encode(await ASMDeck.project(deck)) : typeof deck === 'string' ? deck : JSON.stringify(deck);
        const transfer = new DataTransfer(); transfer.items.add(new File([payload], name));
        const target = document.querySelector(selector);
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
        window.dropHighlight = target.classList.contains('deck-file-drop-active');
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      }, { selector, name, deck, mode });
    }
    await page.goto(base + '/slides.html'); await page.waitForFunction(() => document.body.dataset.slideCount);
    await drop('#importDeckBtn', 'import.json', fixture('import'));
    await page.waitForSelector('[data-slide-id="import-2"]'); assert.equal(await page.evaluate(() => document.body.dataset.slideCount), '2');
    assert.equal(await page.evaluate(() => window.dropHighlight), true);
    await drop('.slide-edge-add-right', 'edge.json', fixture('edge'));
    await page.waitForSelector('[data-slide-id="edge-2"]'); assert.equal(await page.locator('section.asm-slide[data-slide-id="import-1"]').count(), 0);
    await drop('#importDeckBtn', 'compact.asmdeck', fixture('compact'), 'asmdeck');
    await page.waitForSelector('[data-slide-id="compact-2"]');
    await drop('#importDeckBtn', 'invalid.json', '{}');
    await page.waitForFunction(() => document.getElementById('cloudSaveStatus').textContent.includes('不是有效'));
    assert.equal(await page.locator('section.asm-slide[data-slide-id="compact-2"]').count(), 1);
    await drop('#importDeckBtn', 'notes.txt', 'text');
    await page.waitForFunction(() => document.getElementById('cloudSaveStatus').textContent.includes('.asmdeck'));
    await page.route('**/api/shared-slides/view-fixture', route => route.fulfill({ json: { access: 'view', slide: { title: 'viewer', deck: fixture('viewer') } } }));
    await page.goto(base + '/slides.html?share=view-fixture');
    await page.waitForSelector('body.shared-view-only');
    await drop('#importDeckBtn', 'denied.json', fixture('denied'));
    assert.equal(await page.locator('section.asm-slide[data-slide-id="viewer-1"]').count(), 1);
    assert.equal(await page.locator('section.asm-slide[data-slide-id="denied-1"]').count(), 0);
    let created = 0, saved = null; const resources = new Map();
    await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'fixture', username: 'fixture' } } }));
    await page.route('**/api/slide-library', route => route.fulfill({ json: { layout: { folders: [], unfiled: [] } } }));
    await page.route('**/api/slides', route => {
      if (route.request().method() === 'POST') { created++; return route.fulfill({ json: { slide: { deck_uid: 'dropped-deck' } } }); }
      return route.fulfill({ json: { slides: [] } });
    });
    await page.route('**/api/slides/dropped-deck', route => route.fulfill({ json: { slide: { title: 'workspace', deck: saved || { groups: [] } } } }));
    await page.route('**/api/slides/dropped-deck/resources/**', route => {
      const pieces = new URL(route.request().url()).pathname.split('/'); const index = pieces.indexOf('resources'); const key = pieces[index + 1];
      if (route.request().method() === 'GET') return route.fulfill({ json: { total: 0, parts: [] } });
      const body = route.request().postDataJSON();
      const parts = resources.get(key) || []; parts[Number(pieces[index + 2])] = body.data; resources.set(key, parts);
      return route.fulfill({ json: { success: true } });
    });
    await page.route('**/api/slides/dropped-deck/content', route => {
      const body = route.request().postDataJSON(); saved = JSON.parse(resources.get(body.snapshot).join('')).deck;
      return route.fulfill({ json: { success: true } });
    });
    await page.evaluate(() => localStorage.setItem('algo_jwt_token', 'fixture-token'));
    await page.goto(base); await page.waitForSelector('#dashboardView:not([hidden])');
    await drop('#emptyCreateBtn', 'invalid.json', '{}');
    await page.waitForFunction(() => document.getElementById('libraryMessage').textContent.includes('不是有效')); assert.equal(created, 0);
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['{}'], 'one.json')); transfer.items.add(new File(['{}'], 'two.json'));
      document.getElementById('emptyCreateBtn').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    await page.waitForFunction(() => document.getElementById('libraryMessage').textContent.includes('每次請拖入一份'));
    assert.equal(created, 0);
    await drop('#createDeckBtn', 'workspace.asmdeck', fixture('workspace'), 'asmdeck');
    await page.waitForURL('**/slides.html?deck=dropped-deck&importFile=*');
    await page.waitForSelector('[data-slide-id="workspace-2"]');
    await page.waitForURL('**/slides.html?deck=dropped-deck', { timeout: 30000 });
    assert.equal(created, 1); assert.equal(saved.groups[0].slides.length, 2);
    await page.reload(); await page.waitForSelector('[data-slide-id="workspace-2"]');
    assert.equal(await page.evaluate(() => document.body.dataset.slideCount), '2');
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); server.kill(); }
});
