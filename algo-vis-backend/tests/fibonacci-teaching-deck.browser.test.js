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

test('Fibonacci teaching deck compares recursion and array DP and rebuilds its animation',
  { timeout: 120000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const archivePath = path.join(root, 'public', 'guest-decks', 'fibonacci-teaching.asmdeck');
    const decoded = await ASMDeck.decode(new Blob([fs.readFileSync(archivePath)]));
    const slides = decoded.deck.groups.flatMap(group => group.slides || []);
    const lessonText = slides.flatMap(slide => slide.canvas?.objects || [])
      .map(object => object.text || '').join('\n');
    const widgetText = slides.flatMap(slide => slide.widgets || [])
      .map(widget => widget.content || '').join('\n');
    const animations = slides.filter(slide => slide.animation).map(slide => slide.animation);
    const treeLabels = (slides[5].canvas?.objects || []).map(object => object.text || '');

    assert.equal(slides.length, 10);
    assert.match(widgetText, /F\(n\)=F\(n-1\)\+F\(n-2\)/);
    assert.match(lessonText, /動態規劃：把算過的答案存進陣列/);
    assert.match(lessonText, /O\(φⁿ\)/);
    assert.match(lessonText, /陣列 DP/);
    assert.match(widgetText,
      /vector<int> dp\(n\+1\);\ndp\[1\]=1;\nfor\(int i=2;i<=n;i\+\+\) dp\[i\]=dp\[i-1\]\+dp\[i-2\];/);
    assert.equal(treeLabels.filter(label => label === 'F(2)').length, 3);
    assert.equal(treeLabels.filter(label => label === 'F(0)').length, 3);
    assert.equal(animations.length, 2);
    assert.match(animations[0].code, /@layout recursion as "fib_tree"/);
    assert.match(animations[0].code, /@frame n in fib_tree with display\("F\(\$\{call\}\)"\)/);
    assert.match(animations[0].code, /int left = F\(n - 1\);[\s\S]*int right = F\(n - 2\);/);
    assert.match(animations[1].code, /@object dp with labels\(value,index\)/);
    assert.match(animations[1].code, /dp\[i\]=dp\[i-1\]\+dp\[i-2\];/);
    assert.deepEqual(animations.map(animation => animation.input), ['5\n', '10']);

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

      await page.goto(`${base}/slides.html?sample=fibonacci-teaching`, {
        waitUntil: 'domcontentloaded'
      });
      await page.waitForFunction(() => document.body.dataset.asmdeckRebuild === 'ready', null,
        { timeout: 90000 });
      assert.equal(await page.locator('.slides section').count(), 10);
      assert.equal(await page.locator('body').getAttribute('data-asmdeck-rebuild-progress'), '2/2');
      assert.equal(await page.locator('.algorithm-slide-frame:not([hidden])').count(), 2);
      assert.deepEqual(errors, []);
    } finally {
      if (browser) await browser.close();
      server.kill();
    }
  });
