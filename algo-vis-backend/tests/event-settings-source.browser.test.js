/**
 * 測試模組：event-settings-source.browser.test
 *
 * 驗證重點：event settings source.browser.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
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
    const flowRows = page.locator('.trace-event-settings-row').filter({ hasText: '流程跳轉' });
    assert.equal(await flowRows.count(), 1, 'return, break and continue share one settings row');
    assert.equal(await page.locator('.trace-event-settings-row').filter({ hasText: '回傳' }).count(), 0);
    assert.equal(await page.locator('.trace-event-settings-row').filter({ hasText: '跳出迴圈' }).count(), 0);
    assert.equal(await page.locator('.trace-event-settings-row').filter({ hasText: '繼續下一輪' }).count(), 0);
    await flowRows.locator('input').first().setChecked(false);
    await page.waitForFunction(() => (
      window.ASMTracePlayer.getDocument()?.studio?.eventSettings?.defaultEnabled?.['control-flow'] === false
    ));
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
