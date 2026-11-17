/**
 * 測試模組：directive-only-studio.browser.test
 *
 * 驗證重點：動畫完全由指令驅動（2026-11-14）的實際介面。
 *   - 左側面板只有「原始碼」「程式碼框」「事件動畫」三個標籤（2026-11-16），沒有獨立的 Studio 畫面；
 *     鏡頭、物件、作用時間線等手動調整都不存在。
 *   - 程式碼框標籤同時提供程式碼片段與程式碼框外觀設定；事件動畫標籤含整份動畫的事件設定。
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

test('the left panel offers source, code-frame and event-animation tabs, and animation objects cannot be dragged', { timeout: 150000 }, async t => {
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

  // 左側面板只有三個標籤；沒有獨立的 Studio 畫面、縮圖列、事件時間線或頂部「編輯動畫」「事件設定」按鈕。
  const tabs = await page.locator('#codePanel .side-tab').allTextContents();
  assert.deepEqual(tabs.map(text => text.trim()), ['原始碼', '程式碼框', '事件動畫']);
  for (const selector of ['#editAnimationBtn', '#eventSettingsBtn', '#traceStudioRail', '#traceStudioTimeline', '.trace-studio-snippet-focus']) {
    assert.equal(await page.locator(selector).count(), 0, selector);
  }
  assert.equal(await page.locator('#codePanel > header .header-buttons .header-title').textContent(), 'C++',
    'C++ sits beside RUN, not in front of the tabs');
  await page.locator('#sideTabEvents').click();
  for (const removed of ['物件與樣式', '鏡頭', '幀間動畫', '位置綁定', '物件狀態', '跨幀屬性']) {
    assert.equal(await page.locator('#codePanel h3', { hasText: removed }).count(), 0, removed);
  }
  assert.equal(await page.locator('#eventAnimationPanel .trace-event-settings-panel').isVisible(), true,
    'the whole-animation event settings live in the event-animation tab');
  // 程式碼框：程式碼片段與程式碼框外觀設定都在。
  await page.locator('#sideTabCodeFrame').click();
  assert.equal(await page.locator('#codeFramePanel .trace-studio-code-snippet-section').isVisible(), true);
  assert.equal(await page.locator('#codeFramePanel [data-trace-code-controls]').isVisible(), true);
  assert.ok(await page.locator('#codeFramePanel input[data-code-panel-setting="codePanelScrollMs"]').count());
  assert.equal(await page.locator('#editor').isVisible(), false, 'only one tab is shown at a time');
  await page.locator('#sideTabSource').click();

  // 右鍵：沒有作用時間線或物件狀態選單。
  const object = page.locator('#arraySvg [data-trace-object-key]').first();
  await object.waitFor();
  const box = await object.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  assert.equal(await page.locator('.trace-studio-canvas-menu').count(), 0);
  await page.keyboard.press('Escape');

  // 拖曳動畫物件：畫布照一般播放器平移視角（整個場景一起動），物件本身的座標不變，也不寫入手動位置。
  const ownPosition = element => [element.getAttribute('transform'), element.dataset.tracePositionX, element.dataset.tracePositionY,
    element.getAttribute('data-translate')].join('|');
  const before = await object.evaluate(ownPosition);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 80, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await page.locator('#arraySvg [data-trace-object-key]').first().evaluate(ownPosition);
  assert.equal(after, before, 'the object keeps its own scene position');
  const studio = await page.evaluate(() => ASMTracePlayer.getDocument().studio);
  for (const key of ['positions', 'bindings', 'objectStyles', 'visibility', 'cameraRules', 'transitions', 'objects', 'arrows']) {
    const value = studio[key];
    assert.ok(value == null || (Array.isArray(value) ? !value.length : !Object.keys(value).length), `studio.${key} was written`);
  }
  await page.evaluate(() => ASMTraceStudio.close());
  assert.doesNotMatch(await page.evaluate(() => aceEditor.getValue()), /"positions"|"cameraRules"|"bindings"/);
  assert.deepEqual(errors, []);
});
