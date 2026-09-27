const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('Trace Studio edits automatic code snippets one line at a time', { timeout: 90000 }, async () => {
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
      try { if ((await fetch(base)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/algorithm.html`);
    await page.waitForFunction(() => window.ace && window.ASMTracePlayer && window.ASMTraceStudio);
    const code = fs.readFileSync(path.join(__dirname, 'fixtures/bubble.cpp'), 'utf8');
    await page.evaluate(source => ace.edit('editor').setValue(source, -1), code);
    await page.evaluate(() => { document.getElementById('inputArea').value = '6\n5 7 2 1 9 4\n'; });
    await page.click('#runBtn');
    await page.waitForFunction(source => window.ASMTracePlayer.getDocument()?.sourceCode === source,
      code, { timeout: 30000 });
    const selected = await page.evaluate(async () => {
      const player = window.ASMTracePlayer;
      const document = player.getDocument();
      const index = document.frames.findIndex(frame => frame.events.some(event => (
        event.type === 'swap' && event.enabled !== false && event.autoAnimationDisabled !== true
      )));
      if (index < 0) return false;
      await player.render(index, { animatePositions: false, animateEvents: false });
      window.ASMTraceStudio.open();
      return true;
    });
    assert.equal(selected, true, 'fixture must produce an animated swap event frame');
    await page.getByRole('button', { name: '程式碼', exact: true }).click();

    const rows = page.locator('.trace-studio-snippet-line-button');
    await rows.first().waitFor();
    assert.ok(await rows.count() >= 12, 'the editor should keep the complete source visible as line buttons');
    assert.match(await page.locator('.trace-studio-code-snippet-list').textContent(), /#include/);
    assert.match(await page.locator('.trace-studio-code-snippet-list').textContent(), /return 0/);
    assert.ok(await page.locator('.trace-studio-snippet-line-button:not(.is-enabled)').count() > 0,
      'lines outside the current automatic snippet should remain visible and transparent');
    const markedRows = await rows.filter({ has: page.locator('mark.trace-studio-snippet-event-source') }).count();
    assert.ok(markedRows >= 1, 'an animated expression should be marked in fluorescent yellow');
    const firstHighlight = page.locator('mark.trace-studio-snippet-event-source').first();
    assert.ok((await firstHighlight.textContent()).trim().length > 0);
    assert.equal(await firstHighlight.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 244, 92)');
    assert.equal(await page.locator('.trace-studio-snippet-code mark + mark').count(), 0,
      'adjacent event ranges should render as one continuous fluorescent block');

    const regularRow = page.locator('.trace-studio-snippet-line-button.is-enabled')
      .filter({ hasNot: page.locator('mark.trace-studio-snippet-event-source') }).first();
    assert.equal(await regularRow.getAttribute('aria-pressed'), 'true');
    const regularLine = await regularRow.getAttribute('data-source-line');
    const stableRegularRow = page.locator(
      `.trace-studio-snippet-line-button[data-source-line="${regularLine}"]`
    );
    await regularRow.click();
    assert.equal(await page.locator('.trace-studio-snippet-confirm').count(), 0,
      'a regular line should toggle without a confirmation');
    assert.equal(await stableRegularRow.getAttribute('aria-pressed'), 'false');
    await stableRegularRow.click();
    assert.equal(await stableRegularRow.getAttribute('aria-pressed'), 'true');

    const eventRow = rows.filter({ has: page.locator('mark.trace-studio-snippet-event-source') }).first();
    assert.equal(await eventRow.evaluate(button => button.classList.contains('is-enabled')), true);
    await eventRow.click();
    await page.getByText('這一行包含目前幀的事件動畫').waitFor();
    assert.equal(await eventRow.evaluate(button => button.classList.contains('is-enabled')), true,
      'the first click must not accidentally exclude an event line');
    await page.getByRole('button', { name: '仍要排除' }).click();
    await page.waitForFunction(() => {
      const mark = document.querySelector('.trace-studio-snippet-event-source');
      return mark && !mark.closest('button').classList.contains('is-enabled');
    });
    assert.match(await page.locator('.trace-studio-snippet-meta').textContent(), /事件行未收錄/);
    assert.ok(await page.evaluate(() => {
      const settings = window.ASMTraceViewSource.parse(ace.edit('editor').getValue());
      return Boolean(settings?.studio?.frameMaps?.codeSnippetOverrides?.length);
    }), 'the custom line state should be written to @asm-view settings');

    await page.getByRole('button', { name: '恢復自動篩選' }).click();
    await page.waitForFunction(() => document.querySelector('.trace-studio-snippet-event-source')
      ?.closest('button')?.classList.contains('is-enabled'));
    await page.locator('.trace-studio-history button').first().click();
    await page.waitForFunction(() => !document.querySelector('.trace-studio-snippet-event-source')
      ?.closest('button')?.classList.contains('is-enabled'));
    await page.locator('.trace-studio-history button').nth(1).click();
    await page.waitForFunction(() => document.querySelector('.trace-studio-snippet-event-source')
      ?.closest('button')?.classList.contains('is-enabled'));
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.kill();
  }
});
