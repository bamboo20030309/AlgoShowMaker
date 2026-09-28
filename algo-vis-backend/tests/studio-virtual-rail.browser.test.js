const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('Studio mounts only visible cards and renders bounded thumbnails across 500 frames', { timeout: 120000 }, async () => {
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
      try {
        if ((await fetch(`${base}/algorithm.html?asmEmbed=editor`)).ok) break;
      } catch { }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (process.env.ASM_VERIFY_PREFLIGHT === '1') {
      const {execFile} = require('node:child_process');
      await new Promise((resolve, reject) => execFile(process.execPath,
        ['--test', 'tests/studio-availability-preflight.browser.test.js'],
        {cwd: root, env: {...process.env, ASM_TEST_BASE_URL: base}, windowsHide: true},
        (error, stdout, stderr) => { console.log(stdout); if (error) reject(new Error(stdout + stderr)); else resolve(); }));
    }
    browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}/algorithm.html?asmEmbed=editor`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.asmApplyTraceDocument && window.ASMPlaybackTime);

    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    const opening = await page.evaluate(() => {
      const frames = Array.from({length: 500}, (_, index) => ({
        id: 'virtual-' + index, state: {}, events: [], source: {line: index + 1},
        texts: [{id: 'caption', segments: [{kind: 'literal', text: 'Frame ' + index}]}]
      }));
      const trace = window.ASMTracePlayer.apply({frames, variables: {}, studio: {}, rules: []});
      window.__thumbnailCalls = [];
      const create = window.ASMTraceRenderers.createThumbnail;
      window.ASMTraceRenderers.createThumbnail = (...args) => {
        window.__thumbnailCalls.push(args[1].id);
        return create(...args);
      };
      const preflight = window.ASMTraceRenderers.preflightEventAvailability;
      window.__preflightScopes = [];
      window.ASMTraceRenderers.preflightEventAvailability = (...args) => {
        window.__preflightScopes.push(args[1]);
        return preflight(...args);
      };
      const start = performance.now();
      window.ASMTraceStudio.open(trace);
      return {elapsed: performance.now() - start};
    });
    const list = page.locator('.trace-studio-frame-list');
    await page.waitForFunction(() => document.querySelector('[data-thumbnail-rendered="true"]'));
    await page.waitForTimeout(700);
    const inspect = () => list.evaluate(element => ({
      count: element.querySelectorAll('.trace-studio-frame').length,
      capacity: Math.ceil(element.clientHeight / 179) + 3,
      indices: [...element.querySelectorAll('.trace-studio-frame')].map(el => Number(el.dataset.frameIndex)),
      drawn: window.__thumbnailCalls.slice(),
      scopes: window.__preflightScopes,
      height: element.scrollHeight
    }));
    const initial = await inspect();
    assert.ok(initial.count <= initial.capacity, JSON.stringify(initial));
    assert.ok(initial.drawn.length <= initial.capacity, JSON.stringify(initial));
    assert.deepEqual(initial.scopes, [{frameIndex: 0}]);
    assert.ok(initial.indices.includes(0));
    const timeTrack = page.locator('.trace-studio-timeline-track');
    const timelineCount = () => timeTrack.evaluate(el => ({
      count: el.querySelectorAll('button').length,
      limit: Math.ceil(el.clientWidth / 45) + 3
    }));
    const timelineInitial = await timelineCount();
    assert.ok(timelineInitial.count > 0 && timelineInitial.count <= timelineInitial.limit);
    await timeTrack.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await page.waitForFunction(() => document.querySelector('.trace-studio-time-frame[data-frame-index="499"]'));
    const timelineLast = await timelineCount();
    assert.ok(timelineLast.count <= timelineLast.limit);
    await page.locator('.trace-studio-time-frame[data-frame-index="499"]').click();
    assert.equal(await page.evaluate(() => window.ASMTracePlayer.getCurrentFrame()), 499);
    await page.evaluate(() => window.ASMTracePlayer.renderStable(0));
    await page.waitForFunction(() => document.querySelector('.trace-studio-time-frame[data-frame-index="0"]'));

    await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.waitForFunction(() => document.querySelector('.trace-studio-frame[data-frame-index="499"]'));
    await page.waitForTimeout(700);
    const last = await inspect();
    assert.ok(last.count <= last.capacity, JSON.stringify(last));
    assert.ok(!last.indices.includes(0));
    await page.locator('.trace-studio-frame[data-frame-index="499"]').click();
    assert.equal(await page.evaluate(() => window.ASMTracePlayer.getCurrentFrame()), 499);
    await page.evaluate(() => window.ASMTracePlayer.renderStable(250));
    await page.waitForFunction(() => document.querySelector('.trace-studio-frame[data-frame-index="250"]'));
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.trace-studio-frame[data-frame-index="250"]').isVisible(), true);
    await page.evaluate(() => window.ASMTraceStudio.close());
    await page.evaluate(() => window.ASMTraceStudio.open());
    await page.waitForFunction(() => document.querySelector('.trace-studio-frame[data-frame-index="250"]'));
    const reopened = await inspect();
    assert.ok(reopened.count <= reopened.capacity);
    assert.ok(reopened.indices.includes(250));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({openingMs: opening.elapsed, initialCards: initial.count,
      initialThumbnails: initial.drawn.length, capacity: initial.capacity, lastCards: last.count}));
  } finally {
    await browser?.close();
    server.kill();
  }
});

