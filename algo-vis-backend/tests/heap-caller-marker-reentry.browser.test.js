const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('an invisible caller marker never shifts the outgoing heap parameter label',
  { timeout: 60000 }, async () => {
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
      await page.waitForFunction(() => window.ace && window.ASMTracePlayer);
      const code = fs.readFileSync(
        path.join(__dirname, 'fixtures/heap-caller-marker-reentry.cpp'), 'utf8'
      );
      await page.evaluate(code => {
        ace.edit('editor').setValue(code, -1);
        const input = document.getElementById('inputArea');
        input.value = '10\n10 67 24 1 5 36 5 11 24 100';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('runBtn').click();
      }, code);
      await page.waitForFunction(code => (
        window.ASMTracePlayer.getDocument()?.sourceCode === code
        && window.ASMTracePlayer.getDocument()?.frames?.length === 34
      ), code, { timeout: 30000 });

      await page.locator('.trace-studio-frame[data-frame-index="4"]').click();
      await page.waitForTimeout(700);
      await page.evaluate(() => {
        const markerRows = () => [...document.querySelectorAll(
          '#arraySvg [data-trace-source-variable-id]'
        )].filter(element => {
          const id = String(element.dataset.traceSourceVariableId || '');
          return /(^|:)(now|i)@/.test(id) && element.getBoundingClientRect().height > 0;
        }).map(element => {
          const label = element.querySelector('.trace-variable-marker-label-box')
            ?.getBoundingClientRect();
          const motion = element.querySelector('.asm-trace-motion');
          return {
            id: element.dataset.traceSourceVariableId,
            opacity: Number(getComputedStyle(motion || element).opacity),
            x: label?.x,
            y: label?.y
          };
        });
        window.__heapMarkerReentrySamples = {
          initial: markerRows().find(row => /:now@/.test(row.id)),
          samples: [markerRows()]
        };
        window.__heapMarkerReentryTimer = window.setInterval(() => {
          window.__heapMarkerReentrySamples.samples.push(markerRows());
        }, 8);
      });
      await page.click('#nextBtn');
      await page.waitForTimeout(900);
      const result = await page.evaluate(() => {
        window.clearInterval(window.__heapMarkerReentryTimer);
        return window.__heapMarkerReentrySamples;
      });

      assert.ok(result.initial, 'frame 5 exposes the now marker');
      const beforeMotion = result.samples.flatMap(rows => {
        const now = rows.find(row => /:now@/.test(row.id));
        const caller = rows.find(row => /:i@/.test(row.id));
        if (!now || Math.abs(now.y - result.initial.y) >= 0.5) return [];
        if (caller && caller.opacity > 0.01) return [];
        return [now];
      });
      assert.ok(beforeMotion.length > 0,
        'the test samples now while the caller marker is still invisible');
      assert.ok(beforeMotion.every(now => Math.abs(now.x - result.initial.x) < 0.5),
        `now shifted before i entered: ${JSON.stringify({ initial: result.initial, beforeMotion })}`);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
