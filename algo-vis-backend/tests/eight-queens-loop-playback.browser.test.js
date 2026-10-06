const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const { chromium } = require('playwright');

test('loop sample covers all 256 configurations without event-heavy skipped intervals',
  { timeout: 90000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const archive = JSON.parse(gunzipSync(fs.readFileSync(path.join(root,
      'drafts/eight-queens-teaching.asmdeck')).subarray(9)));
    const animation = archive.body.deck.groups[1].slides.at(-1).animation;
    const trace = archive.body.prebuiltTraces[animation.prebuilt.traceId];
    assert.equal(trace.sourceCode, fs.readFileSync(path.join(root,
      'algorithm_sample/Backtracking/8queen-loop-teaching.cpp'), 'utf8'));
    assert.equal(trace.frames.length, 257);
    const value = (frame, name) => Object.values(frame.state)
      .find(item => item.name === name)?.data;
    const configs = trace.frames.slice(0, 256);
    assert.deepEqual(configs.map(frame => value(frame, 'attempt').value),
      Array.from({ length: 256 }, (_, i) => i + 1));
    const positions = configs.map(frame => value(frame, 'pos').items.map(item => item.value));
    assert.equal(new Set(positions.map(values => values.join(','))).size, 256);
    for (const [index, frame] of configs.entries()) {
      const board = value(frame, 'board').items.map(row => row.items.map(cell => cell.value));
      assert.deepEqual(board, positions[index].map(col => [0, 1, 2, 3].map(i => Number(i === col))));
      assert.ok(frame.events.length < 250, `frame ${index} has an unbounded event batch`);
    }
    assert.equal(configs.filter(frame => value(frame, 'valid').value).length, 2);
    assert.equal(value(trace.frames.at(-1), 'ans').value, 2);
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
      await page.goto(`${base}/algorithm.html?asmEmbed=runtime`);
      await page.waitForFunction(() => window.asmApplyTraceDocument);
      const timings = await page.evaluate(async document => {
        const start = performance.now();
        window.asmApplyTraceDocument(document);
        const loadMs = performance.now() - start;
        const steps = [];
        for (const index of [19, 20, 96, 255, 256]) {
          const before = performance.now();
          await window.CodeScript.goto(index);
          steps.push({ index: window.CodeScript.get_current_frame_index(), ms: performance.now() - before });
        }
        await window.CodeScript.prev();
        const previous = window.CodeScript.get_current_frame_index();
        await window.CodeScript.goto(19);
        const nextStart = performance.now();
        await window.CodeScript.next();
        return { loadMs, steps, nextMs: performance.now() - nextStart,
          count: window.CodeScript.get_frame_count(), previous,
          next: window.CodeScript.get_current_frame_index() };
      }, trace);
      assert.equal(timings.count, 257);
      assert.deepEqual(timings.steps.map(step => step.index), [19, 20, 96, 255, 256]);
      assert.equal(timings.previous, 255);
      assert.equal(timings.next, 20);
      const enabled = await page.evaluate(() => {
        const document = window.ASMTracePlayer.getDocument();
        return document.frames[20].events.filter(event => event.enabled).map(event => event.type);
      });
      assert.ok(!enabled.some(type => ['assign', 'write', 'declare', 'compare'].includes(type)));
      // This case measures frame/event playback, not spoken-caption duration.
      // Complete speech callbacks deterministically; real TTS has separate tests.
      await page.evaluate(() => {
        window.fixtureSpeechCalls = 0;
        window.speakText = (_text, options) => {
          window.fixtureSpeechCalls++;
          options.onstart?.();
          setTimeout(() => options.onend?.(), 0);
        };
      });
      await page.locator('#playToggleBtn').click();
      try {
        await page.waitForFunction(() => window.CodeScript.get_current_frame_index() >= 23,
          null, { timeout: 10000 });
      } catch (error) {
        const state = await page.evaluate(() => ({
          frame: CodeScript.get_current_frame_index(),
          pressed: document.getElementById('playToggleBtn').getAttribute('aria-pressed'),
          activeEvent: document.querySelector('[data-trace-active-event-id]')?.dataset,
          enabled: ASMTracePlayer.getDocument().frames[CodeScript.get_current_frame_index()].events
            .filter(e => e.enabled).map(e => ({ type: e.type, source: e.source?.text, unavailable: e.autoAnimationDisabled })),
          hidden: document.hidden, visibility: document.body.dataset
        }));
        console.log(JSON.stringify({ timings, state }));
        throw error;
      }
      await page.locator('#playToggleBtn').click();
      assert.equal(await page.locator('#playToggleBtn').getAttribute('aria-pressed'), 'false');
      assert.ok(await page.evaluate(() => window.fixtureSpeechCalls > 0),
        'caption callbacks are exercised without measuring spoken text length');
      assert.deepEqual(errors, []);
      const output = path.join(root, 'test-results/eight-queens-draft');
      fs.mkdirSync(output, { recursive: true });
      fs.writeFileSync(path.join(output, 'loop-playback.json'), JSON.stringify(timings, null, 2));
      console.log(JSON.stringify(timings));
    } finally {
      await browser?.close();
      server.kill();
    }
  });
