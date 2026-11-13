/**
 * 測試模組：slide-canvas-toolbar.browser.test
 *
 * 驗證重點：投影片動畫畫布工具列（介面改版階段 1）。
 *   - 上一步／下一步只留圖示；上一大步／下一大步只在舊版腳本動畫顯示，trace 與投影片一律不顯示。
 *   - 放映（非編輯畫面）只留 ⏮ ◀ ⏯ ▶ ⏭ 與進度條；編輯畫面顯示完整工具列與 RUN。
 *   - RUN 成功：換上新動畫並從第 0 幀開始（公開範例只換本次開啟的副本，不回寫官方教材）。
 *   - RUN 失敗：保留原動畫，畫布上方顯示錯誤與「開啟編輯器」。
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

test('slide canvas toolbar: play-only when presenting, RUN while editing, failed RUN keeps the animation', { timeout: 240000 }, async t => {
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
  await player.waitForFunction(() => ASMTracePlayer.getDocument()?.frames?.length > 0);
  await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  const visible = () => player.evaluate(() => [...document.querySelectorAll('#tab-canvas .controls > *')]
    .filter(el => getComputedStyle(el).display !== 'none').map(el => el.id || el.className));
  const editing = async on => {
    if (await page.evaluate(() => document.body.classList.contains('asm-edit-mode')) !== on) await page.locator('#modeToggleBtn').click();
    await player.waitForFunction(on => document.documentElement.classList.contains('asm-slide-editing') === on, on);
  };

  // Presenting / viewing: only the five play buttons and the progress bar.
  await editing(false);
  assert.deepEqual(await visible(), PLAY_ONLY);

  // Editing: RUN first, full toolbar, never the big steps.
  await editing(true);
  const shown = await visible();
  assert.equal(shown[0], 'slideRunBtn');
  for (const id of [...PLAY_ONLY, 'traceFreshnessNotice', 'speedValue']) assert.ok(shown.includes(id), id);
  assert.ok(!shown.includes('prevKeyFrameBtn') && !shown.includes('nextKeyFrameBtn'));

  // RUN success: regenerated, back to frame 0, saved locally.
  const run = player.locator('#slideRunBtn');
  await player.locator('#nextBtn').click();
  await player.locator('#nextBtn').click();
  await player.waitForFunction(() => CodeScript.get_current_frame_index() > 0);
  await page.evaluate(() => ASMDeck.clearCache());
  const before = jobs;
  await player.evaluate(() => { window.__beforeRun = ASMTracePlayer.getDocument(); });
  await run.click();
  await player.waitForFunction(() => document.getElementById('slideRunBtn').disabled);
  assert.equal((await run.textContent()).trim(), '執行中…');
  await player.waitForFunction(() => !document.getElementById('slideRunBtn').disabled, null, { timeout: 180000 });
  assert.equal(jobs, before + 1, 'RUN compiles the saved program once');
  assert.equal((await run.textContent()).trim(), 'RUN');
  await player.waitForFunction(() => ASMTracePlayer.getDocument() !== window.__beforeRun
    && ASMTracePlayer.getDocument()?.frames?.length === 9 && CodeScript.get_current_frame_index() === 0);
  assert.equal(await player.locator('#slideRunError').isVisible(), false);

  // RUN failure: the player keeps the very same animation (nothing is swapped in).
  await player.evaluate(() => { window.__beforeFail = ASMTracePlayer.getDocument(); });
  await page.evaluate(() => ASMDeck.clearCache());
  failJobs = true;
  await run.click();
  await player.locator('#slideRunError').waitFor({ state: 'visible', timeout: 60000 });
  assert.match(await player.locator('#slideRunError').textContent(), /RUN 失敗，仍保留原動畫：.*測試用編譯失敗/);
  assert.equal((await run.textContent()).trim(), 'RUN');
  assert.equal(await player.evaluate(() => ASMTracePlayer.getDocument() === window.__beforeFail), true, 'old animation still plays');
  // The error is editing-only and offers the editor.
  await editing(false);
  assert.equal(await player.locator('#slideRunError').isVisible(), false);
  await editing(true);
  await player.getByRole('button', { name: '開啟編輯器' }).click();
  await page.locator('#algorithmEditorModal').waitFor({ state: 'visible' });
  assert.deepEqual(errors, []);
});
