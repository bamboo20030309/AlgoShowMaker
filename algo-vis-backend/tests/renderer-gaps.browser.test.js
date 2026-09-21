const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

test('array renderers apply horizontal and vertical gaps on their layout axes', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/algorithm.html');
    await page.waitForFunction(() => typeof window.drawArray === 'function');
    const result = await page.evaluate(() => {
      const gap = { horizontal: 10, vertical: 20 };
      window.drawArray('normal-gap', { x: 0, y: 0 }, [1, 2, 3, 4], [], [0, 3], 'normal', 2, 1, gap);
      window.drawArray('heap-gap', { x: 0, y: 0 }, [0, 1, 2, 3, 4, 5, 6, 7], [], undefined, 'heap', Infinity, 1, gap);
      window.drawArray('heap-touching', { x: 0, y: 0 }, [0, 1, 2, 3], [], undefined, 'heap', Infinity, 1, { horizontal: 0, vertical: 0 });
      window.drawArray('bit-gap', { x: 0, y: 0 }, [0, 1, 2, 3, 4], [], undefined, 'BIT', Infinity, 1, gap);
      window.drawArray('queue-gap', { x: 0, y: 0 }, [1, 2, 3], [], [0, 2], 'queue', Infinity, 0, gap);
      window.drawArray('stack-gap', { x: 0, y: 0 }, [1, 2, 3], [], [0, 2], 'stack', Infinity, 0, gap);
      window.drawArray('disk-gap', { x: 0, y: 0 }, [1, 2, 3], [], [0, 2], 'disk', Infinity, 0, gap);

      const rect = (group, index) => document.querySelector(`#cell-${group}-${index} > rect`);
      const number = (node, name) => Number(node?.getAttribute(name));
      return {
        normal: {
          x0: number(rect('normal-gap', 0), 'x'), x1: number(rect('normal-gap', 1), 'x'),
          y0: number(rect('normal-gap', 0), 'y'), y2: number(rect('normal-gap', 2), 'y')
        },
        heap: {
          rootWidth: number(rect('heap-gap', 0), 'width'),
          childWidth: number(rect('heap-gap', 1), 'width'),
          rootY: number(rect('heap-gap', 0), 'y'), childY: number(rect('heap-gap', 1), 'y'),
          edgeCount: document.querySelectorAll('#heap-gap .asm-heap-edges line').length,
          touchingEdgeCount: document.querySelectorAll('#heap-touching .asm-heap-edges line').length
        },
        bit: {
          unitWidth: number(rect('bit-gap', 0), 'width'),
          fourWidth: number(rect('bit-gap', 3), 'width'),
          firstY: number(rect('bit-gap', 0), 'y'), secondY: number(rect('bit-gap', 1), 'y')
        },
        queueStep: number(rect('queue-gap', 1), 'x') - number(rect('queue-gap', 0), 'x'),
        stackStep: Math.abs(number(rect('stack-gap', 1), 'y') - number(rect('stack-gap', 0), 'y')),
        diskStep: Math.abs(number(rect('disk-gap', 1), 'y') - number(rect('disk-gap', 0), 'y'))
      };
    });
    assert.deepEqual(result.normal, { x0: 8, x1: 58, y0: 8, y2: 80 });
    assert.deepEqual(result.heap, {
      rootWidth: 190, childWidth: 90, rootY: 8, childY: 80, edgeCount: 6, touchingEdgeCount: 0
    });
    assert.deepEqual(result.bit, { unitWidth: 40, fourWidth: 190, firstY: 152, secondY: 80 });
    assert.equal(result.queueStep, 50);
    assert.equal(result.stackStep, 60);
    assert.equal(result.diskStep, 60);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
