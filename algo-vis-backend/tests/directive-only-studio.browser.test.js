/**
 * 測試模組：directive-only-studio.browser.test
 *
 * 驗證重點：動畫完全由指令驅動（2026-11-14）的實際介面。
 *   - Trace Studio 右欄只有「事件」與「程式碼」兩頁；鏡頭、物件、作用時間線等手動調整都不存在。
 *   - 程式碼頁同時提供程式碼片段與程式碼框外觀設定（字體大小等）。
 *   - 畫布上的動畫物件不能用滑鼠拖曳；拖曳後位置不變，也不寫入任何手動位置。
 *   - 右鍵不再跳出「作用時間線」或物件狀態選單。
 * 執行環境：隔離服務＋無頭瀏覽器，實際編譯一個小程式。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');

const SOURCE = `#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {5, 3, 8};
  // @frame arr
  arr[0] = 1;
  // @frame arr
  return 0;
}`;

test('Trace Studio offers only event and code settings, and animation objects cannot be dragged', { timeout: 150000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/algorithm.html`, { waitUntil: 'networkidle' });
  await page.evaluate(code => { aceEditor.setValue(code, -1); document.getElementById('runBtn').click(); }, SOURCE);
  await page.waitForFunction(() => !document.getElementById('runBtn').classList.contains('loading')
    && ASMTracePlayer.getDocument()?.frames?.length === 2, null, { timeout: 120000 });

  await page.evaluate(() => ASMTraceStudio.open());
  await page.locator('.trace-studio-inspector').waitFor();
  const tabs = await page.locator('.trace-studio-inspector-tool').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')));
  assert.deepEqual(tabs, ['事件', '程式碼']);
  for (const removed of ['物件與樣式', '鏡頭', '幀間動畫', '位置綁定', '物件狀態', '跨幀屬性']) {
    assert.equal(await page.locator('.trace-studio-inspector .trace-studio-section > strong, .trace-studio-inspector header strong', { hasText: removed }).count(), 0, removed);
  }
  // 程式碼頁：程式碼片段與程式碼框外觀設定都在。
  await page.locator('.trace-studio-inspector-tool[aria-label="程式碼"]').click();
  assert.equal(await page.locator('.trace-studio-code-panel').isVisible(), true);
  assert.equal(await page.locator('.trace-studio-code-panel [data-trace-code-controls]').isVisible(), true);
  assert.ok(await page.locator('.trace-studio-code-panel input[data-code-panel-setting="codePanelScrollMs"]').count());

  // 右鍵：沒有作用時間線或物件狀態選單。
  const object = page.locator('#arraySvg [data-trace-object-key]').first();
  await object.waitFor();
  const box = await object.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  assert.equal(await page.locator('.trace-studio-canvas-menu').count(), 0);
  await page.keyboard.press('Escape');

  // 拖曳動畫物件：位置不變，也不寫入手動位置。
  const before = await object.evaluate(element => element.getBoundingClientRect().toJSON());
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 80, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await page.locator('#arraySvg [data-trace-object-key]').first().evaluate(element => element.getBoundingClientRect().toJSON());
  assert.ok(Math.abs(after.x - before.x) < 1 && Math.abs(after.y - before.y) < 1, `object moved: ${JSON.stringify({ before, after })}`);
  const studio = await page.evaluate(() => ASMTracePlayer.getDocument().studio);
  for (const key of ['positions', 'bindings', 'objectStyles', 'visibility', 'cameraRules', 'transitions', 'objects', 'arrows']) {
    const value = studio[key];
    assert.ok(value == null || (Array.isArray(value) ? !value.length : !Object.keys(value).length), `studio.${key} was written`);
  }
  await page.evaluate(() => ASMTraceStudio.close());
  assert.doesNotMatch(await page.evaluate(() => aceEditor.getValue()), /"positions"|"cameraRules"|"bindings"/);
  assert.deepEqual(errors, []);
});
