'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { gunzipSync } = require('node:zlib');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');
const { compile } = require('./helpers/compile');
const { TWEEN_BUILD } = require('./helpers/builds');

test('insertion key initializer copies the visible cell, preserves its source and supports saved traces', { timeout: 120000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const bytes = fs.readFileSync(path.join(__dirname, '../public/guest-decks/insertion-sort.asmdeck'));
  const body = JSON.parse(gunzipSync(bytes.subarray(9))).body;
  const animation = body.deck.groups.flatMap(g => g.slides).find(s => s.animation).animation;
  const input = '10\n1 8 7 2 6 5 3 9 10 12';
  const oldBase = process.env.ASM_TEST_BASE_URL;
  let fresh;
  try { process.env.ASM_TEST_BASE_URL = base; fresh = (await compile(animation.code, input)).trace; }
  finally { if (oldBase === undefined) delete process.env.ASM_TEST_BASE_URL; else process.env.ASM_TEST_BASE_URL = oldBase; }
  const saved = body.prebuiltTraces[animation.prebuilt.traceId];
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/algorithm.html');
  await page.waitForFunction(build => window.ASMTraceFrameTween?.build === build, TWEEN_BUILD);
  for (const [mode, source, speed, disabled] of [
    ['fresh 1x', fresh, 1, false], ['fresh 4x', fresh, 4, false],
    ['saved 4x', saved, 4, false], ['disabled saved', saved, 4, true]
  ]) {
    const result = await page.evaluate(async ({ source, speed, disabled }) => {
      const player = ASMTracePlayer;
      player.apply(JSON.parse(JSON.stringify(source)));
      const trace = player.getDocument();
      const keyId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'key');
      const arrId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
      const frameIndex = trace.frames.findIndex(f => f.events.some(e => e.type === 'assign'
        && e.targets?.some(x => x.role === 'target' && x.variableId === keyId)));
      const frame = trace.frames[frameIndex];
      const declaration = frame.events.find(e => e.type === 'declare' && e.targets?.some(x => x.variableId === keyId));
      if (disabled) {
        declaration.enabled = false; declaration.autoAnimationDisabled = true;
        frame.events.filter(e => e.declarationInitializer && e.targets?.some(x => x.variableId === keyId))
          .forEach(e => { e.enabled = false; e.autoAnimationDisabled = true; });
      }
      window.asmGetAnimationPlaybackRate = () => speed;
      // Capture actual SVG, rather than inferring correctness from the same playback plan.
      const read = () => {
        const transfer = [...document.querySelectorAll('.asm-trace-assign-transfer')]
          .find(e => e.dataset.traceTransferSourceKey === arrId + '#1');
        const sourceCell = document.querySelector(`[data-trace-object-key="${arrId}#1"]`);
        const key = document.querySelector(`[data-trace-variable="${keyId}"]`);
        const bounds = e => {
          const b = e?.getBoundingClientRect(), matrix = document.getElementById('asm-trace-root')?.getScreenCTM();
          if (!b || !matrix) return null;
          const p = new DOMPoint(b.x + b.width / 2, b.y + b.height / 2).matrixTransform(matrix.inverse());
          return { x: p.x, y: p.y };
        };
        return { hasCell: Boolean(transfer?.querySelector('rect')), transfer: bounds(transfer),
          stroke: transfer?.querySelector('rect')?.getAttribute('stroke'),
          source: bounds(sourceCell), target: bounds(key),
          value: transfer?.querySelector('text')?.textContent ?? null,
          sourceValue: sourceCell?.querySelector('text[data-trace-content-role="value"],text')?.textContent,
          sourceOpacity: sourceCell ? getComputedStyle(sourceCell).opacity : null,
          finalValues: key ? [...key.querySelectorAll('text')].map(e => e.textContent) : [],
          eventId: document.querySelector('[data-trace-active-event-id]')?.dataset.traceActiveEventId };
      };
      await player.render(frameIndex - 1, { animatePositions: false, animateEvents: false });
      // An existing customized source must keep its appearance in the copied cell.
      document.querySelector(`[data-trace-object-key="${arrId}#1"] rect`).setAttribute('stroke', '#8844aa');
      let settled = false; const samples = [];
      const transition = player.render(frameIndex).finally(() => { settled = true; });
      for (let i = 0; i < 600 && !settled; i++) { await new Promise(requestAnimationFrame); samples.push(read()); }
      await transition;
      const final = read();
      // Saving and reopening must keep this behavior without adding fields to the trace.
      player.apply(JSON.parse(JSON.stringify(player.getDocument())));
      await player.render(frameIndex, { animatePositions: false, animateEvents: false });
      return { frameIndex, declarationId: declaration.id, samples, final, reopened: read() };
    }, { source, speed, disabled });
    const copies = result.samples.filter(s => s.hasCell && s.value === '8');
    if (disabled) assert.equal(copies.length, 0, mode + ': explicit disabling suppresses the copy');
    else {
      assert.ok(copies.length >= 2, mode + ': visible frame and value must move together: ' + JSON.stringify(result.samples.slice(0, 15)));
      assert.ok(copies.every(s => s.sourceValue === '8' && Number(s.sourceOpacity) > 0), mode + ': source is copied, not removed');
      assert.ok(copies.every(s => s.stroke === '#8844aa'), mode + ': copying preserves the existing cell style');
      assert.ok(copies.some(s => Math.hypot(s.transfer.x - copies[0].transfer.x, s.transfer.y - copies[0].transfer.y) > 3), mode + ': cell actually moves');
    }
    assert.ok(result.final.finalValues.includes('8'), mode + ': key receives arr[1]');
    assert.ok(result.reopened.finalValues.includes('8'), mode + ': saved/reopened key retains its value');
    assert.equal(result.final.hasCell, false, mode + ': no extra transfer frame remains after landing');
  }
  assert.deepEqual(errors, []);
});
