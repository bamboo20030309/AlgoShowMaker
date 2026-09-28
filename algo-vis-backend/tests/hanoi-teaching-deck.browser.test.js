const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes, webcrypto } = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

global.crypto = webcrypto;
global.ASMTraceProvenance = require('../public/trace-provenance.js');
global.ASMTraceViewSource = require('../public/trace-view-source.js');
global.ASMTraceModel = { normalizeTraceDocument: value => value };
const ASMDeck = require('../public/asmdeck.js');

test('Tower of Hanoi teaching deck explains the lesson and rebuilds its final animation',
  { timeout: 120000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const archivePath = path.join(root, 'public', 'guest-decks', 'hanoi-teaching.asmdeck');
    const sourcePath = path.join(root, 'algorithm_sample', 'Backtracking', 'hanoi-recursion.cpp');
    const decoded = await ASMDeck.decode(new Blob([fs.readFileSync(archivePath)]));
    const slides = decoded.deck.groups.flatMap(group => group.slides || []);
    const lessonText = slides.flatMap(slide => slide.canvas?.objects || [])
      .map(object => object.text || '').join('\n');
    const animation = slides.at(-1).animation;

    assert.equal(slides.length, 8);
    assert.match(lessonText, /Édouard Lucas/);
    assert.match(lessonText, /一次只能拿一個/);
    assert.match(lessonText, /移花、搬動底盤、接木/);
    const normalizeNewlines = value => value.replace(/\r\n/g, '\n');
    assert.equal(normalizeNewlines(animation.code), normalizeNewlines(fs.readFileSync(sourcePath, 'utf8')));
    assert.equal(animation.input, '4\n');

    const port = await new Promise(resolve => {
      const probe = net.createServer();
      probe.listen(0, '127.0.0.1', () => {
        const value = probe.address().port;
        probe.close(() => resolve(value));
      });
    });
    const server = spawn(process.execPath, ['server.js'], {
      cwd: root,
      env: {
        ...process.env,
        PORT: String(port),
        ASM_REGRESSION: '1',
        JWT_SECRET: randomBytes(32).toString('hex')
      },
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
      browser = await chromium.launch({
        headless: true,
        ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
      });
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
      });

      await page.goto(`${base}/slides.html?sample=hanoi-teaching`, {
        waitUntil: 'domcontentloaded'
      });
      await page.waitForFunction(() => document.body.dataset.asmdeckRebuild === 'ready', null,
        { timeout: 90000 });
      assert.equal(await page.locator('.slides section').count(), 8);
      assert.equal(await page.locator('body').getAttribute('data-asmdeck-rebuild-progress'), '1/1');
      assert.equal(await page.locator('.algorithm-slide-frame:not([hidden])').count(), 1);
      assert.deepEqual(errors, []);
    } finally {
      if (browser) await browser.close();
      server.kill();
    }
  });
