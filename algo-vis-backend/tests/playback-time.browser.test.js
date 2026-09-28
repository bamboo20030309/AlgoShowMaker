const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('playback clock estimates total time, follows rate, and restarts the current frame at its offset', { timeout: 120000 }, async () => {
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
        if ((await fetch(`${base}/algorithm.html?asmEmbed=runtime`)).ok) break;
      } catch { }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}/algorithm.html?asmEmbed=runtime`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.asmApplyTraceDocument && window.ASMPlaybackTime);
    await page.evaluate(() => {
      const text = value => ({ segments: [{ kind: 'literal', text: value }] });
      window.asmApplyTraceDocument({
        frames: [
          { id: 'frame-0', state: {}, source: { line: 1 }, texts: [text('第一幀會朗讀一段足以估算時間的中文說明。')], events: [] },
          { id: 'frame-1', state: {}, source: { line: 2 }, texts: [text('第二幀也有另一段說明文字。')], events: [] }
        ],
        variables: {}, rules: [], studio: { eventSettings: { gapMs: 100 } }
      });
      const originalStops = window.CodeScript.get_stop_frames;
      window.CodeScript.get_stop_frames = () => [1];
      window.initFrameInfoFromCodeScript();
      window.CodeScript.get_stop_frames = originalStops;
      window.speakText = (_text, options) => {
        setTimeout(() => options.onstart?.(), 0);
        setTimeout(() => options.onend?.(), 5000);
        return {};
      };
    });

    const clock = page.locator('#playbackTime');
    await assert.doesNotReject(() => clock.waitFor({ state: 'visible' }));
    const initial = await clock.textContent();
    assert.match(initial, /^00:00 \/ 00:0[1-9]/);
    const layout = await clock.evaluate(element => ({
      previousId: element.previousElementSibling?.id,
      numeric: getComputedStyle(element).fontVariantNumeric,
      width: element.getBoundingClientRect().width
    }));
    assert.equal(layout.previousId, 'frameTimeline');
    assert.match(layout.numeric, /tabular-nums/);
    assert.ok(layout.width >= 90);

    const timelineStyle = await page.locator('#frameTimeline').evaluate(element => ({
      progress: getComputedStyle(element).getPropertyValue('--frame-progress').trim(),
      trackHeight: getComputedStyle(element.querySelector('.frame-track')).height,
      playheadHeight: getComputedStyle(element.querySelector('.frame-playhead')).height,
      markerCount: element.querySelectorAll('.frame-bar').length,
      stopCount: element.querySelectorAll('.frame-bar.stopframe').length
    }));
    assert.deepEqual(timelineStyle, {
      progress: '25%',
      trackHeight: '6px',
      playheadHeight: '10px',
      markerCount: 0,
      stopCount: 0
    });
    await page.locator('#frameTimeline').hover({ position: { x: 20, y: 15 } });
    await assert.doesNotReject(() => page.locator('#frameHoverPreview').waitFor({ state: 'visible' }));
    assert.equal(await page.locator('#frameHoverPreview').textContent(), '第 1 / 2 幀');
    const timeColors = await clock.evaluate(element => ({
      current: getComputedStyle(element.querySelector('.playback-time-current')).color,
      total: getComputedStyle(element.querySelector('.playback-time-total')).color
    }));
    assert.notEqual(timeColors.current, timeColors.total);
    const timelineBox = await page.locator('#frameTimeline').boundingBox();
    await page.mouse.move(timelineBox.x + timelineBox.width * 0.25, timelineBox.y + timelineBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(timelineBox.x + timelineBox.width * 0.75, timelineBox.y + timelineBox.height / 2);
    await page.mouse.up();
    assert.equal(await page.locator('#frameInfo').textContent(), '2 / 2');
    await page.locator('#frameTimeline').click({ position: { x: timelineBox.width * 0.25, y: timelineBox.height / 2 } });
    assert.equal(await page.locator('#frameInfo').textContent(), '1 / 2');

    const parseSeconds = label => {
      const value = label.split('/')[1].trim().split(':').map(Number);
      return value.length === 2 ? value[0] * 60 + value[1] : value[0] * 3600 + value[1] * 60 + value[2];
    };
    const normalTotal = parseSeconds(initial);
    await page.locator('#speedSlider').evaluate(slider => {
      slider.value = slider.min;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const fastTotal = parseSeconds(await clock.textContent());
    assert.ok(fastTotal < normalTotal, `${fastTotal} should be less than ${normalTotal}`);

    await page.locator('#playToggleBtn').click();
    await page.waitForTimeout(1200);
    assert.match(await clock.textContent(), /^00:01 \/ /);
    await page.locator('#playToggleBtn').click();
    assert.match(await clock.textContent(), /^00:01 \/ /);
    await page.locator('#playToggleBtn').click();
    assert.match(await clock.textContent(), /^00:00 \/ /);

    await page.evaluate(() => {
      const frames = Array.from({ length: 120 }, (_, index) => ({
        id: `dense-${index}`, state: {}, source: { line: index + 1 }, texts: [], events: []
      }));
      window.asmApplyTraceDocument({ frames, variables: {}, rules: [], studio: {} });
      window.CodeScript.get_key_frames = () => [0, 119];
      window.initFrameInfoFromCodeScript();
    });
    assert.equal(await page.locator('.frame-bar').count(), 0);
    const compactBox = await page.locator('#frameTimeline').boundingBox();
    assert.ok(compactBox.width <= 220, '120 frames keep the timeline within 220px');
    assert.equal(await page.locator('.frame-playhead').count(), 1);
    await page.locator('#frameTimeline').click({ position: { x: compactBox.width - 1, y: 15 } });
    assert.equal(await page.locator('#frameInfo').textContent(), '120 / 120');
    await page.locator('#frameTimeline').click({ position: { x: 1, y: 15 } });
    assert.equal(await page.locator('#frameInfo').textContent(), '1 / 120');
  } finally {
    await browser?.close();
    server.kill();
  }
});
