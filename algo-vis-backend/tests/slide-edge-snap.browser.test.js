/**
 * 測試模組：slide-edge-snap.browser.test
 *
 * 驗證重點：所有物件都會貼齊投影片的邊界與中線（貼齊系統把投影片本身當成目標）。
 *   - Fabric 物件（圖片）拖到靠近左邊 → 貼齊 x = 0，並顯示導線。
 *   - HTML 物件（影片）拖到靠近右下角 → 貼齊右邊與下邊。
 *   - 拖到靠近中線 → 中心貼齊投影片中線。
 *   - 按住 Alt 拖曳不貼齊（既有的略過貼齊操作）。
 * 執行環境：靜態 UI 服務＋無頭瀏覽器；YouTube 縮圖以 route 攔截，不連外。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startStaticUiServer } = require('./helpers/static-ui-server');

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('images, videos and other objects snap to the slide edges and center lines', { timeout: 90000 }, async t => {
  const { base } = await startStaticUiServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/i\.ytimg\.com|youtube-nocookie\.com/, route => route.fulfill({ status: 204, body: '' }));
  await page.addInitScript(pixel => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify({ groups: [{ id: 'g', slides: [{
      id: 's',
      widgets: [{ id: 'v', type: 'video', videoId: 'aaaaaaaaaaa', x: 700, y: 300, w: 320, h: 180 }],
      canvas: { objects: [{ type: 'image', src: pixel, left: 300, top: 420, width: 1, height: 1, scaleX: 160, scaleY: 120 }] }
    }] }] }));
    sessionStorage.setItem('seeded', '1');
  }, PIXEL);
  await page.route('**/slides.js?*', route => route.fulfill({ contentType: 'application/javascript', body: `
    const loadFixture = fabric.Canvas.prototype.loadFromJSON;
    fabric.Canvas.prototype.loadFromJSON = function(...args) {
      window.fixtureCanvas = this; return loadFixture.apply(this, args);
    };
  ` + fs.readFileSync(path.join(__dirname, '../public/slides.js'), 'utf8') }));
  await page.goto(base + '/slides.html');
  await page.waitForFunction(() => window.fixtureCanvas?.getObjects().length === 1 && Reveal.isReady()
    && document.querySelector('.slide-widget[data-widget-id="v"]'));
  if (!await page.evaluate(() => document.body.classList.contains('asm-edit-mode'))) await page.locator('#modeToggleBtn').click();
  await page.waitForFunction(() => document.body.classList.contains('asm-edit-mode'));

  // 投影片座標 → 螢幕座標。
  const screen = (x, y) => page.evaluate(({ x, y }) => {
    const rect = fixtureCanvas.upperCanvasEl.getBoundingClientRect();
    const p = fabric.util.transformPoint(new fabric.Point(x, y), fixtureCanvas.viewportTransform);
    return { x: rect.x + p.x * rect.width / fixtureCanvas.width, y: rect.y + p.y * rect.height / fixtureCanvas.height };
  }, { x, y });
  const guideShown = () => page.evaluate(() => !document.querySelector('#snapGuideLayer').hidden);
  // 從 (fromX, fromY) 拖 (dx, dy) 個投影片單位，放開前回報是否有導線。
  const drag = async (fromX, fromY, dx, dy, { alt = false } = {}) => {
    const start = await screen(fromX, fromY), end = await screen(fromX + dx, fromY + dy);
    await page.mouse.move(start.x, start.y);
    if (alt) await page.keyboard.down('Alt');
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    const guide = await guideShown();
    await page.mouse.up();
    if (alt) await page.keyboard.up('Alt');
    await page.waitForTimeout(150);
    return guide;
  };
  const image = () => page.evaluate(() => {
    const bounds = fixtureCanvas.getObjects()[0].getBoundingRect(true, true);
    return { left: bounds.left, top: bounds.top, right: bounds.left + bounds.width, bottom: bounds.top + bounds.height };
  });
  const video = () => page.evaluate(() => {
    const el = document.querySelector('.slide-widget[data-widget-id="v"]');
    const x = parseFloat(el.style.left), y = parseFloat(el.style.top);
    return { left: x, top: y, right: x + parseFloat(el.style.width), bottom: y + parseFloat(el.style.height) };
  });
  const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.01, `${label}: ${actual} ≠ ${expected}`);

  // 圖片（Fabric）：左邊 300 → 拖 -295，停在 5，貼齊到 0。
  assert.equal(await drag(380, 480, -295, 0), true, 'a guide appears at the slide edge');
  near((await image()).left, 0, 'image snaps to the left edge');

  // 影片（HTML 物件）：右下角 (1020, 480) → 拖到 (1274, 714)，貼齊右邊 1280 與下邊 720。
  await drag(720, 320, 254, 234);
  const v = await video();
  near(v.right, 1280, 'video snaps to the right edge');
  near(v.bottom, 720, 'video snaps to the bottom edge');

  // 中線：影片中心拖到 x = 645 附近 → 貼齊 640。
  const before = await video();
  const centerX = (before.left + before.right) / 2;
  await drag(before.left + 20, before.top + 20, 645 - centerX, 0);
  const centered = await video();
  near((centered.left + centered.right) / 2, 640, 'video centers on the slide center line');

  // Alt 拖曳略過貼齊：圖片停在 5，不會被拉到 0。
  const img = await image();
  await drag(img.left + 80, img.top + 60, 200, 0);
  await drag(img.left + 280, img.top + 60, -195, 0, { alt: true });
  // 滑鼠以整數螢幕像素移動，落點約在 5（誤差 1 以內），重點是沒有被拉到 0。
  const altLeft = (await image()).left;
  assert.ok(Math.abs(altLeft - 5) < 1 && altLeft > 3, `Alt drag does not snap: ${altLeft}`);
  assert.deepEqual(errors, []);
});
