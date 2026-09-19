const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

test('automatic event toggles persist in asm-view and survive RUN', { timeout: 60000 }, async () => {
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
    await page.waitForFunction(() => window.ace && window.ASMTracePlayer && window.ASMTraceViewSource);
    const code = `#include <vector>
int main() {
  std::vector<int> values = {1, 2};
  // @frame values
  values[0] = 3;
  // @frame values
}`;
    await page.evaluate(source => ace.edit('editor').setValue(source, -1), code);
    await page.click('#runBtn');
    await page.waitForFunction(source => window.ASMTracePlayer.getDocument()?.sourceCode === source,
      code, { timeout: 30000 });

    await page.click('#eventSettingsBtn');
    await page.locator('.trace-auto-fixed-toggle').setChecked(false);
    await page.locator('.trace-auto-loop-boundary-toggle').setChecked(true);
    await page.waitForFunction(() => {
      const source = ace.edit('editor').getValue();
      const settings = window.ASMTraceViewSource.parse(source)?.studio?.eventSettings;
      return settings?.autoFixedEnabled === false && settings?.autoLoopBoundaryEnabled === true;
    });
    const savedSource = await page.evaluate(() => ace.edit('editor').getValue());
    const savedSettings = await page.evaluate(() => (
      window.ASMTraceViewSource.parse(ace.edit('editor').getValue()).studio.eventSettings
    ));
    assert.deepEqual(savedSettings, {
      autoFixedEnabled: false,
      autoLoopBoundaryEnabled: true
    });

    await page.evaluate(() => window.ASMTraceStudio?.close?.());
    await page.click('#runBtn');
    await page.waitForFunction(source => window.ASMTracePlayer.getDocument()?.sourceCode === source,
      savedSource, { timeout: 30000 });
    const reloadedSettings = await page.evaluate(() => (
      window.ASMTracePlayer.getDocument().studio.eventSettings
    ));
    assert.equal(reloadedSettings.autoFixedEnabled, false);
    assert.equal(reloadedSettings.autoLoopBoundaryEnabled, true);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
