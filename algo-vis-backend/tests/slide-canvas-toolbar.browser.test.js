/**
 * 測試模組：slide-canvas-toolbar.browser.test
 *
 * 驗證重點：投影片動畫畫布工具列（介面改版階段 1）。
 *   - 上一步／下一步只留圖示；上一大步／下一大步只在舊版腳本動畫顯示，trace 與投影片一律不顯示。
 *   - 投影片上的動畫只有畫布（2026-11-16）：沒有分頁列，放映與編輯畫面的工具列完全相同，沒有 RUN。
 *   - RUN 在投影片編輯欄的輸入框上方：成功時換上新動畫並從第 0 幀開始（公開範例只換本次開啟的副本）。
 *   - RUN 失敗：保留原動畫，RUN 旁提示到「編輯動畫」查看，「編輯動畫」按鈕出現紅點。
 *   - 「編輯動畫」把同一個 iframe 展開成完整頁面（不重新載入），返回後搬回投影片。
 * 執行環境：隔離服務＋無頭瀏覽器；公開範例以 route 提供，不碰任何帳號或雲端資料。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');
const animation = require('./fixtures/missing-prefix-animation.json');
global.ASMTraceProvenance = require('../public/trace-provenance');
const archive = require('../public/asmdeck');

const PLAY_ONLY = ['restartBtn', 'prevBtn', 'playToggleBtn', 'nextBtn', 'finishBtn', 'frameTimeline'];

test('slide animation: canvas-only toolbar, sidebar RUN, failed RUN keeps the animation, shared editor iframe', { timeout: 240000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());

  // ---- Code page: icon-only step buttons; big steps only for legacy script animations. ----
  {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.goto(`${base}/algorithm.html`);
    await page.waitForFunction(() => typeof window.syncCurrentFrameFromCodeScript === 'function');
    for (const id of ['prevBtn', 'nextBtn']) {
      assert.equal((await page.locator(`#${id}`).textContent()).trim(), '', `${id} has no text label`);
      assert.ok(await page.locator(`#${id}`).getAttribute('aria-label'));
    }
    const bigSteps = () => page.evaluate(() => ['prevKeyFrameBtn', 'nextKeyFrameBtn']
      .map(id => getComputedStyle(document.getElementById(id)).display !== 'none'));
    await page.evaluate(() => { window.CodeScript = { isTracePlayer: true, get_frame_count: () => 3, get_current_frame_index: () => 0, get_key_frames: () => [] }; syncCurrentFrameFromCodeScript(); });
    assert.deepEqual(await bigSteps(), [false, false], 'trace animations hide big steps');
    await page.evaluate(() => { window.CodeScript = { get_frame_count: () => 3, get_current_frame_index: () => 0, get_key_frames: () => [0, 2], has_next_key: () => true, has_prev_key: () => false }; syncCurrentFrameFromCodeScript(); });
    assert.deepEqual(await bigSteps(), [true, true], 'legacy AV.hpp animations keep big steps');
    await page.close();
  }

  // ---- Slides: a public sample deck with one trace animation. ----
  const deck = { groups: [{ id: 'g', slides: [{ id: 'anim', kind: 'algorithm-animation',
    animation, canvas: { objects: [] }, widgets: [] }] }] };
  const buffer = Buffer.from(await (await archive.encode({ deck, assets: {} })).arrayBuffer());
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  await context.route('**/guest-decks.json', route => route.fulfill({ json: { decks: [{ id: 'toolbar-test', title: 'Toolbar', archive: '/toolbar-test.asmdeck' }] } }));
  await context.route('**/toolbar-test.asmdeck', route => route.fulfill({ body: buffer }));
  await context.route('**/api/user/preferences/event-settings', route => route.fulfill({ json: { eventSettings: {} } }));
  let jobs = 0, failJobs = false;
  await context.route('**/api/compile/jobs', route => {
    if (route.request().method() !== 'POST') return route.continue();
    jobs += 1;
    return failJobs ? route.fulfill({ status: 500, json: { error: '測試用編譯失敗' } }) : route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/slides.html?sample=toolbar-test`);
  const player = await (await page.waitForSelector('.algorithm-slide-frame', { state: 'attached' })).contentFrame();
  await player.waitForFunction(() => window.ASMTracePlayer?.getDocument()?.frames?.length > 0, null, { timeout: 180000 });
  await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  const visible = () => player.evaluate(() => [...document.querySelectorAll('#tab-canvas .controls > *')]
    .filter(el => getComputedStyle(el).display !== 'none').map(el => el.id || el.className));
  const editing = async on => {
    if (await page.evaluate(() => document.body.classList.contains('asm-edit-mode')) !== on) await page.locator('#modeToggleBtn').click();
    await player.waitForFunction(on => document.documentElement.classList.contains('asm-slide-editing') === on, on);
  };

  // Editing and presenting show exactly the same play-only toolbar; no tabs and no RUN on the canvas.
  await editing(true);
  const shown = await visible();
  for (const id of [...PLAY_ONLY, 'ttsAvBtn', 'traceFreshnessNotice', 'playbackTime', 'frameInfo', 'speedValue']) assert.ok(shown.includes(id), id);
  assert.ok(!shown.includes('prevKeyFrameBtn') && !shown.includes('nextKeyFrameBtn'));
  assert.equal(await player.locator('#slideRunBtn').count(), 0, 'RUN left the canvas toolbar');
  assert.equal(await player.locator('#subTabs').isVisible(), false, 'the slide shows only the canvas');
  await editing(false);
  assert.deepEqual(await visible(), shown);
  // 放映時編輯欄移出畫面、透明且不能點（slides.css body:not(.asm-edit-mode) .editor-chrome）。
  await page.waitForFunction(() => {
    const chrome = getComputedStyle(document.getElementById('editorChrome'));
    return chrome.pointerEvents === 'none' && Number(chrome.opacity) === 0;
  }, null, { timeout: 5000 });
  await editing(true);
  assert.equal(await page.locator('#algorithmSidebarBlock').isVisible(), true);

  // Sidebar RUN success: regenerated, back to frame 0, saved locally.
  const run = page.locator('#algorithmSlideRunBtn');
  await player.locator('#nextBtn').click();
  await player.locator('#nextBtn').click();
  await player.waitForFunction(() => CodeScript.get_current_frame_index() > 0);
  await page.evaluate(() => ASMDeck.clearCache());
  const before = jobs;
  await player.evaluate(() => { window.__beforeRun = ASMTracePlayer.getDocument(); window.__sameWindow = 'kept'; });
  await run.click();
  await page.waitForFunction(() => document.getElementById('algorithmSlideRunBtn').classList.contains('loading'));
  await page.waitForFunction(() => !document.getElementById('algorithmSlideRunBtn').classList.contains('loading'), null, { timeout: 180000 });
  assert.equal(jobs, before + 1, 'RUN compiles the saved program once');
  await player.waitForFunction(() => window.ASMTracePlayer?.getDocument() !== window.__beforeRun
    && ASMTracePlayer.getDocument()?.frames?.length === 9 && CodeScript.get_current_frame_index() === 0);
  assert.equal(await page.locator('#algorithmSlideError').isVisible(), false);
  assert.equal(await page.locator('#algorithmSlideStatus').textContent(), '已是最新');

  // Sidebar RUN failure: the player keeps the very same animation; the hint points to 編輯動畫.
  await player.evaluate(() => { window.__beforeFail = ASMTracePlayer.getDocument(); });
  await page.evaluate(() => ASMDeck.clearCache());
  failJobs = true;
  await run.click();
  await page.locator('#algorithmSlideError').waitFor({ state: 'visible', timeout: 60000 });
  assert.match(await page.locator('#algorithmSlideError').textContent(), /執行失敗[\s\S]*編輯動畫[\s\S]*測試用編譯失敗/);
  assert.equal(await page.locator('#algorithmEditSlideBtn .algorithm-edit-alert').isVisible(), true);
  assert.equal(await player.evaluate(() => ASMTracePlayer.getDocument() === window.__beforeFail), true, 'old animation still plays');
  failJobs = false;

  // 開啟編輯動畫: the same iframe (no reload) expands into the full page; returning puts it back.
  await page.locator('#algorithmSlideErrorOpen').click();
  await page.locator('#algorithmEditorPage').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#algorithmEditorStage .algorithm-slide-frame'));
  const editor = await (await page.$('#algorithmEditorStage .algorithm-slide-frame')).contentFrame();
  await editor.waitForFunction(() => document.body.classList.contains('asm-embed-editor'));
  assert.equal(await editor.evaluate(() => window.__sameWindow), 'kept', 'the slide iframe was moved, not reloaded');
  assert.equal(await editor.locator('#top-bar').isVisible(), false);
  assert.equal(await editor.locator('#codePanel').isVisible(), true);
  await page.locator('#algorithmEditorBackBtn').click();
  await page.locator('#algorithmEditorPage').waitFor({ state: 'hidden', timeout: 30000 });
  await player.waitForFunction(() => document.body.classList.contains('asm-embed-runtime'));
  assert.equal(await page.evaluate(() => Boolean(document.querySelector('section.asm-slide .algorithm-slide-frame'))), true);
  assert.equal(await player.evaluate(() => window.__sameWindow), 'kept');
  assert.deepEqual(errors, []);
});
