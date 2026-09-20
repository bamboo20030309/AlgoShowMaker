const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

test('rapid next and previous use stable-frame navigation at the confirmed threshold',
  { timeout: 30000 }, async () => {
    const base = process.env.ASM_TEST_BASE_URL;
    assert.ok(base, 'ASM_TEST_BASE_URL must point to the isolated beta service');
    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.stack || error.message));
      await page.goto(base + '/algorithm.html');
      await page.waitForFunction(() => window.ASMPlaybackNavigation && window.asmApplyTraceDocument);
      await page.evaluate(() => {
        const original = window.ASMTraceRenderers.renderFrame;
        window.__navigationRenders = [];
        window.ASMTraceRenderers.renderFrame = function (...args) {
          const options = args[3] || {};
          window.__navigationRenders.push({
            frame: args[1]?.id,
            previous: args[2]?.id || null,
            animateEvents: options.animateEvents,
            animatePositions: options.animatePositions,
            direction: options.direction
          });
          return original.apply(this, args);
        };
        window.asmApplyTraceDocument({
          variables: {},
          frames: Array.from({ length: 6 }, (_, index) => ({
            id: `frame-${index}`, source: {}, state: {}, events: [], bindings: []
          })),
          studio: { eventSettings: { gapMs: 0 } }
        });
      });
      await page.evaluate(() => {
        const button = document.getElementById('nextBtn');
        for (let index = 0; index < 3; index += 1) {
          button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        }
      });
      await page.waitForFunction(() => window.CodeScript.get_current_frame_index() === 3);
      let state = await page.evaluate(() => ({
        current: window.CodeScript.get_current_frame_index(),
        last: window.__navigationRenders.at(-1)
      }));
      assert.equal(state.current, 3, 'three inputs advance exactly three frames');
      assert.deepEqual(state.last, {
        frame: 'frame-3', previous: null,
        animateEvents: false, animatePositions: false, direction: 0
      });

      await page.locator('#prevBtn').dispatchEvent('mousedown');
      await page.locator('#prevBtn').dispatchEvent('mouseup');
      await page.waitForFunction(() => window.CodeScript.get_current_frame_index() === 2);
      state = await page.evaluate(() => ({
        current: window.CodeScript.get_current_frame_index(),
        last: window.__navigationRenders.at(-1)
      }));
      assert.equal(state.current, 2);
      assert.equal(state.last.previous, null);
      assert.equal(state.last.animateEvents, false);
      assert.equal(state.last.animatePositions, false);

      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(360);
      await page.keyboard.up('ArrowRight');
      await page.waitForFunction(() => window.CodeScript.get_current_frame_index() >= 3);
      state = await page.evaluate(() => ({
        current: window.CodeScript.get_current_frame_index(),
        last: window.__navigationRenders.at(-1)
      }));
      assert.ok(state.current >= 3, 'holding ArrowRight produces repeat input');
      assert.equal(state.last.previous, null, 'held repeat uses stable-frame fast browsing');
      assert.equal(state.last.animateEvents, false);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
