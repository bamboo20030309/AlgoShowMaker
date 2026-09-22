const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

async function startServer() {
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
    env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') },
    windowsHide: true,
    stdio: 'ignore'
  });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(base)).ok) return { server, base }; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('test server did not start');
}

test('table widget edits cells, dimensions, headers and persisted data', { timeout: 90000 }, async () => {
  const { server, base } = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/slides.html`);
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready'));

    if (!(await page.locator('body').evaluate(body => body.classList.contains('asm-edit-mode')))) {
      await page.locator('#modeToggleBtn').click();
    }
    await page.locator('#structureMenuBtn').click();
    await page.locator('[data-tool="structure"][data-structure-mode="table"]').click();
    const table = page.locator('.structure-widget').last();
    await assert.doesNotReject(() => table.waitFor());
    assert.equal(await table.locator('[data-slide-structure]').getAttribute('data-slide-structure'), 'table');
    assert.equal(await table.locator('[data-structure-item-index]').count(), 9);
    assert.equal(await page.locator('#tableEditorControls').isVisible(), true);
    assert.equal(await table.locator('[data-matrix-row="0"][data-matrix-column="1"]').getAttribute('data-table-header'), 'true');
    assert.equal(await table.locator('[data-matrix-row="1"][data-matrix-column="0"]').getAttribute('data-table-header'), 'false');

    const editable = table.locator('[data-matrix-row="1"][data-matrix-column="1"]');
    await editable.dblclick();
    const input = table.locator('.structure-inline-value-input');
    await input.fill('含逗號, 仍是同一格');
    await input.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-matrix-row="1"][data-matrix-column="1"]')?.textContent.includes('含逗號, 仍是同一格'));

    await page.locator('#tableRowsInput').fill('4');
    await page.locator('#tableRowsInput').press('Enter');
    await page.locator('#tableColumnsInput').fill('4');
    await page.locator('#tableColumnsInput').press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.structure-widget [data-structure-item-index]').length === 16);
    await page.locator('#tableHeaderColumnInput').check();
    assert.equal(await table.locator('[data-matrix-row="2"][data-matrix-column="0"]').getAttribute('data-table-header'), 'true');

    await table.locator('[data-matrix-row="2"][data-matrix-column="2"]').click({ button: 'right' });
    await page.locator('[data-structure-action="matrix-row-after"]').click();
    await page.waitForFunction(() => document.querySelectorAll('.structure-widget [data-structure-item-index]').length === 20);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => document.querySelectorAll('.structure-widget [data-structure-item-index]').length === 16);
    await page.keyboard.press('Control+y');
    await page.waitForFunction(() => document.querySelectorAll('.structure-widget [data-structure-item-index]').length === 20);

    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready'));
    const restored = page.locator('.structure-widget').last();
    assert.equal(await restored.locator('[data-structure-item-index]').count(), 20);
    assert.match(await restored.locator('[data-matrix-row="1"][data-matrix-column="1"]').textContent(), /含逗號, 仍是同一格/);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.kill();
  }
});
