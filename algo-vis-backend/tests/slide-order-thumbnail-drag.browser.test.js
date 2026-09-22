const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('slide order drag uses static thumbnails and still reorders slides', { timeout: 90000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const value = probe.address().port;
      probe.close(() => resolve(value));
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
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const deck = {
      groups: ['first', 'second', 'third'].map((name, index) => ({
        id: `group-${name}`,
        slides: [{
          id: `slide-${name}`,
          canvas: { objects: [{ type: 'textbox', text: name, left: 280, top: 220, width: 600, fontSize: 72, fontFamily: 'Arial' }] },
          widgets: index === 0 ? [{ id: 'code-widget', type: 'code', x: 80, y: 420, w: 620, h: 180, code: 'const value = 1;' }] : []
        }]
      }))
    };
    await page.addInitScript(value => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value)), deck);
    await page.goto(`${base}/slides.html`);
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    await page.locator('#slideOrderToggleBtn').click();
    await page.waitForSelector('#customOverview:not([hidden])');
    await page.waitForFunction(() => [...document.querySelectorAll('.custom-overview-thumb')].every(thumb => thumb.dataset.thumbnailReady === 'true'));

    const sourceMarkup = await page.locator('.custom-overview-thumb').first().evaluate(thumb => ({
      images: thumb.querySelectorAll('.custom-overview-snapshot').length,
      interactive: thumb.querySelectorAll('canvas, input, select, textarea, a, .widget-layer, .slide-widget').length
    }));
    assert.deepEqual(sourceMarkup, { images: 1, interactive: 0 });

    const source = await page.locator('.custom-overview-thumb').nth(0).boundingBox();
    const target = await page.locator('.custom-overview-thumb').nth(1).boundingBox();
    assert.ok(source && target);
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width * 0.75, target.y + target.height / 2, { steps: 12 });
    await page.waitForSelector('.overview-drag-ghost[data-preview-mode="thumbnail"]');
    const ghost = await page.locator('.overview-drag-ghost').evaluate(element => {
      const frame = element.querySelector('.custom-overview-drag-thumbnail');
      const rect = frame.getBoundingClientRect();
      return {
        images: element.querySelectorAll('img').length,
        interactive: element.querySelectorAll('button, input, select, textarea, a, canvas, .widget-layer, .slide-widget').length,
        aspect: rect.width / rect.height
      };
    });
    assert.equal(ghost.images, 1);
    assert.equal(ghost.interactive, 0);
    assert.ok(Math.abs(ghost.aspect - 16 / 9) < 0.02);
    await page.mouse.up();
    await page.waitForFunction(() => !document.querySelector('.overview-drag-ghost'));
    await page.waitForFunction(async () => {
      const stored = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
      return stored.groups.flatMap(group => group.slides).map(slide => slide.id).join(',') === 'slide-second,slide-first,slide-third';
    });
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
