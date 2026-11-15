/**
 * 測試模組：slide-video-widget.browser.test
 *
 * 驗證重點：YouTube 影片 widget 的新增、編輯、存檔重開、舊資料相容、未知元件保留、
 * 縮圖與 .asmdeck 往返，以及播放模式的 iframe 屬性、換頁暫停、自動播放、fragment、
 * 焦點返回、TTS 暫停與錯誤替代畫面。
 * 執行環境：Playwright（Windows 使用 Edge）＋本測試自行啟動的隨機埠隔離 server。
 * 網路：i.ytimg.com 與 www.youtube-nocookie.com 一律由 page.route 攔截，不連線真正的 YouTube；
 * 模擬播放器只實作本專案使用的 postMessage 子集。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

const ID_A = 'aaaaaaaaaaa';
const ID_B = 'bbbbbbbbbbb';
const ID_OFFLINE = 'ooooooooooo';
const STORAGE_KEY = 'asm_reveal_fabric_deck_v5';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const STUB_PLAYER = `<!doctype html><html><body style="margin:0;background:#000">
<button id="stubPlay" style="width:100%;height:100vh">stub player</button>
<script>
window.__commands = [];
let parentOrigin = null, id = null;
const autoplay = new URL(location.href).searchParams.get('autoplay') === '1';
function send(message) { if (parentOrigin) parent.postMessage(JSON.stringify({ ...message, id }), parentOrigin); }
window.__send = send;
addEventListener('message', event => {
  let data; try { data = JSON.parse(event.data); } catch { return; }
  window.__commands.push(data.event === 'command' ? data.func : data.event);
  if (data.event === 'listening' && !parentOrigin) {
    parentOrigin = event.origin; id = data.id;
    send({ event: 'onReady' });
    if (autoplay) send({ event: 'onStateChange', info: 1 });
  }
  if (data.func === 'playVideo') send({ event: 'onStateChange', info: 1 });
  if (data.func === 'pauseVideo') send({ event: 'onStateChange', info: 2 });
});
document.getElementById('stubPlay').addEventListener('click', () => send({ event: 'onStateChange', info: 1 }));
</script></body></html>`;

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

async function openPage(browser, deck = null) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  // Playwright runs the latest matching route first: block any other YouTube
  // request, then let the specific stubs below take precedence.
  await context.route(/^https:\/\/[^/]*(?:youtube|ytimg)/, route => route.abort());
  await context.route(/^https:\/\/i\.ytimg\.com\//, route => route.request().url().includes(ID_OFFLINE)
    ? route.abort()
    : route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }));
  await context.route(/^https:\/\/www\.youtube-nocookie\.com\/embed\//, route => route.fulfill({
    status: 200, contentType: 'text/html', body: STUB_PLAYER
  }));
  await context.addInitScript(({ deck: initialDeck, key }) => {
    if (initialDeck && !sessionStorage.getItem('video-test-seeded')) {
      sessionStorage.setItem('video-test-seeded', '1');
      localStorage.setItem(key, JSON.stringify(initialDeck));
    }
    const fake = {
      speaking: false, pending: false, paused: false, calls: [],
      getVoices: () => [],
      speak(utterance) { this.speaking = true; this.calls.push('speak'); this.utterance = utterance; },
      pause() { this.paused = true; this.calls.push('pause'); },
      resume() { this.paused = false; this.calls.push('resume'); },
      cancel() { this.speaking = false; this.calls.push('cancel'); },
      addEventListener() {}, removeEventListener() {}
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => fake });
  }, { deck, key: STORAGE_KEY });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, errors };
}

async function ready(page, base) {
  await page.goto(`${base}/slides.html`);
  await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready'));
}

async function setEditMode(page, enabled) {
  const editing = await page.locator('body').evaluate(body => body.classList.contains('asm-edit-mode'));
  if (editing !== enabled) await page.locator('#modeToggleBtn').click();
  await page.waitForFunction(value => document.body.classList.contains('asm-edit-mode') === value, enabled);
}

async function savedDeck(page) {
  await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  return page.evaluate(async key => ASMSlideStorage.create(indexedDB, localStorage).loadDeck(key), STORAGE_KEY);
}

function playerFrame(page, videoId) {
  return page.frames().find(frame => frame.url().includes(`/embed/${videoId}`));
}

async function playerCommands(page, videoId) {
  const frame = playerFrame(page, videoId);
  return frame ? frame.evaluate(() => window.__commands.slice()) : null;
}

function slide(id, widgets = [], objects = []) {
  return { id, canvas: { objects }, widgets };
}

// -----------------------------------------------------------------------------
// 編輯、存檔與相容性
// -----------------------------------------------------------------------------
test('video widgets are added, edited, persisted and coexist with legacy data', { timeout: 120000 }, async () => {
  const { server, base } = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const legacyDeck = {
      groups: [{
        id: 'g1',
        slides: [slide('s1', [
          // 舊／外部資料：只有必要欄位。
          { id: 'minimal-video', type: 'video', videoId: ID_A, x: 40, y: 40, w: 320, h: 180 },
          // 既有自訂值與明確關閉，必須原樣保留。
          { id: 'custom-video', type: 'video', videoId: ID_B, x: 400, y: 40, w: 400, h: 225,
            startSeconds: 65, endSeconds: 0, autoplay: false, muted: true, title: '自訂標題', aspect: '16:9' },
          // 未來版本的元件：欄位必須完整保留，不可被改成 LaTeX。
          { id: 'future-widget', type: 'hologram', x: 40, y: 300, w: 300, h: 150, layerIndex: 1003,
            hologramSource: 'keep-me', nested: { depth: 2, list: [1, 2, 3] } },
          // 沒有 type 的極舊資料仍視為 LaTeX。
          { id: 'typeless', content: String.raw`\(x^2\)`, x: 400, y: 300, w: 200, h: 80 },
          { id: 'bad-video', type: 'video', videoId: 'not-an-id', x: 700, y: 300, w: 320, h: 180 }
        ])]
      }]
    };
    const { page, errors } = await openPage(browser, legacyDeck);
    await ready(page, base);
    await setEditMode(page, true);

    const minimal = page.locator('[data-widget-id="minimal-video"]');
    assert.equal(await minimal.getAttribute('data-widget-type'), 'video');
    assert.match(await minimal.locator('.video-poster').getAttribute('src'), new RegExp(`i\\.ytimg\\.com/vi/${ID_A}/`));
    assert.equal(await page.locator('iframe.slide-video-frame').count(), 0, 'edit mode never loads players');
    const future = page.locator('[data-widget-id="future-widget"]');
    assert.equal(await future.getAttribute('data-widget-type'), 'hologram');
    assert.match(await future.textContent(), /此版本不支援的元件/);
    assert.equal(await page.locator('[data-widget-id="typeless"]').getAttribute('data-widget-type'), 'latex');
    assert.equal(await page.locator('[data-widget-id="bad-video"]').getAttribute('data-video-fallback'), 'invalid');

    // 使用舊物件：選取後由面板修改並存檔。
    await page.locator('[data-widget-id="custom-video"]').click();
    assert.equal(await page.locator('#videoEditorPanel').isVisible(), true);
    assert.equal(await page.locator('#videoStartInput').inputValue(), '1:05');
    assert.equal(await page.locator('#videoEndInput').inputValue(), '');
    assert.equal(await page.locator('#videoMutedInput').isChecked(), true);
    assert.equal(await page.locator('#videoAutoplayInput').isChecked(), false);
    await page.locator('#videoTitleInput').fill('改過的標題');
    await page.locator('#videoTitleInput').press('Tab');
    await page.locator('#videoEndInput').fill('2:00');
    await page.locator('#videoEndInput').press('Tab');

    // 新建：工具列對話框，先擋無效網址，再插入 Shorts。
    await page.locator('#exitVideoEditorBtn').click();
    await page.locator('[data-tool="video"]').click();
    await page.locator('#videoInsertDialog').waitFor();
    await page.locator('#videoInsertUrl').fill('https://example.com/watch?v=aaaaaaaaaaa');
    assert.equal(await page.locator('#confirmVideoInsertBtn').isDisabled(), true);
    await page.locator('#videoInsertUrl').fill(`https://www.youtube.com/shorts/${ID_B}?t=12`);
    assert.equal(await page.locator('#confirmVideoInsertBtn').isDisabled(), false);
    await page.locator('#confirmVideoInsertBtn').click();
    await page.waitForFunction(() => document.body.dataset.lastToolStatus === 'added:video');
    const added = page.locator('.video-widget.is-selected');
    assert.equal(await added.count(), 1);
    assert.equal(await page.locator('#videoUrlInput').inputValue(), `https://youtu.be/${ID_B}?t=12`);
    await page.locator('#videoAutoplayInput').check();

    // 新建：直接貼上網址。
    await page.locator('#exitVideoEditorBtn').click();
    await page.evaluate(id => {
      const data = new DataTransfer();
      data.setData('text/plain', `https://youtu.be/${id}`);
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, ID_A);
    await page.waitForFunction(() => document.querySelectorAll('.video-widget').length === 5);

    // undo／redo 涵蓋影片欄位。
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => document.querySelectorAll('.video-widget').length === 4);
    await page.keyboard.press('Control+y');
    await page.waitForFunction(() => document.querySelectorAll('.video-widget').length === 5);

    let saved = await savedDeck(page);
    let widgets = saved.groups[0].slides[0].widgets;
    const byId = id => widgets.find(widget => widget.id === id);
    assert.deepEqual(
      ['provider', 'videoId', 'startSeconds', 'endSeconds', 'autoplay', 'muted', 'aspect', 'title'].map(key => byId('minimal-video')[key]),
      ['youtube', ID_A, 0, null, false, false, '16:9', '']
    );
    assert.deepEqual(
      ['startSeconds', 'endSeconds', 'muted', 'autoplay', 'title', 'x', 'w'].map(key => byId('custom-video')[key]),
      [65, 120, true, false, '改過的標題', 400, 400]
    );
    assert.deepEqual(byId('future-widget').nested, { depth: 2, list: [1, 2, 3] });
    assert.equal(byId('future-widget').hologramSource, 'keep-me');
    assert.equal(byId('future-widget').type, 'hologram');
    const shorts = widgets.find(widget => widget.type === 'video' && widget.aspect === '9:16');
    assert.deepEqual([shorts.videoId, shorts.startSeconds, shorts.autoplay, shorts.w, shorts.h], [ID_B, 12, true, 270, 480]);
    assert.match(shorts.content, new RegExp(`youtu\\.be/${ID_B}`), 'readable fallback for older builds');
    assert.equal(widgets.filter(widget => widget.type === 'video').length, 5);

    // 縮圖不因遠端海報而拋錯（離線海報退回圖示）。
    const thumbnail = await page.evaluate(deck => AlgoDeckThumbnail.createSlide({
      ...deck.groups[0].slides[0],
      widgets: [...deck.groups[0].slides[0].widgets, { id: 'x', type: 'video', videoId: 'ooooooooooo', x: 0, y: 0, w: 320, h: 180 }]
    }), saved);
    assert.match(thumbnail, /^data:image\/jpeg;base64,/);

    // 重開後全部仍在。
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready'));
    await setEditMode(page, true);
    assert.equal(await page.locator('.video-widget').count(), 5);
    assert.equal(await page.locator('[data-widget-id="future-widget"]').getAttribute('data-widget-type'), 'hologram');
    // The newly added videos overlap its centre; its top-left corner stays uncovered.
    await page.locator('[data-widget-id="custom-video"]').click({ position: { x: 20, y: 20 } });
    assert.equal(await page.locator('#videoTitleInput').inputValue(), '改過的標題');
    assert.equal(await page.locator('#videoEndInput').inputValue(), '2:00');

    // .asmdeck 往返：匯出後再匯入，影片欄位與未知元件不變。
    saved = await savedDeck(page);
    const archive = await page.evaluate(async deck => {
      const blob = await ASMDeck.encode(await ASMDeck.project(deck));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return Array.from(bytes);
    }, saved);
    await page.locator('#importDeckInput').setInputFiles({ name: 'video.asmdeck', mimeType: 'application/octet-stream', buffer: Buffer.from(archive) });
    await page.waitForFunction(() => document.querySelectorAll('.video-widget').length === 5 && document.body.dataset.localDeckSave === 'saved');
    const imported = await savedDeck(page);
    widgets = imported.groups[0].slides[0].widgets;
    assert.equal(byId('custom-video').title, '改過的標題');
    assert.equal(byId('custom-video').endSeconds, 120);
    assert.equal(byId('future-widget').hologramSource, 'keep-me');
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.kill();
  }
});

// -----------------------------------------------------------------------------
// 播放模式
// -----------------------------------------------------------------------------
test('presentation playback loads players on demand, pauses on navigation and pauses TTS', { timeout: 120000 }, async () => {
  const { server, base } = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const text = { type: 'textbox', left: 100, top: 600, width: 600, text: '旁白文字', fontSize: 28, fill: '#1f282d', styles: {} };
    const deck = {
      groups: [
        { id: 'g1', slides: [slide('p1', [{ id: 'v1', type: 'video', videoId: ID_A, x: 100, y: 80, w: 640, h: 360, startSeconds: 5, endSeconds: 30, muted: true }], [text])] },
        { id: 'g2', slides: [slide('p2', [{ id: 'v2', type: 'video', videoId: ID_B, x: 100, y: 80, w: 640, h: 360,
          autoplay: true, fragmentEnabled: true }])] },
        { id: 'g3', slides: [slide('p3', [{ id: 'v3', type: 'video', videoId: ID_OFFLINE, x: 100, y: 80, w: 640, h: 360 }])] }
      ]
    };
    const { page, errors } = await openPage(browser, deck);
    await ready(page, base);
    await setEditMode(page, false);
    assert.equal(await page.locator('iframe.slide-video-frame').count(), 0, 'nothing loads before a click');

    // 點擊海報 → 建立 nocookie iframe，屬性與參數正確。
    await page.locator('[data-widget-id="v1"] .video-play-button').click();
    const frame = page.locator('[data-widget-id="v1"] iframe.slide-video-frame');
    await frame.waitFor();
    const attributes = await frame.evaluate(element => ({
      sandbox: element.getAttribute('sandbox'), allow: element.getAttribute('allow'),
      referrer: element.getAttribute('referrerpolicy'), src: element.src
    }));
    assert.equal(attributes.sandbox, 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox');
    assert.equal(attributes.allow, 'autoplay; encrypted-media; picture-in-picture; fullscreen');
    assert.equal(attributes.referrer, 'strict-origin-when-cross-origin');
    const src = new URL(attributes.src);
    assert.equal(src.origin, 'https://www.youtube-nocookie.com');
    assert.equal(src.pathname, `/embed/${ID_A}`);
    assert.deepEqual(['start', 'end', 'autoplay', 'mute', 'enablejsapi', 'origin'].map(key => src.searchParams.get(key)),
      ['5', '30', '1', '1', '1', base]);
    await page.waitForFunction(() => document.querySelector('[data-widget-id="v1"] iframe')?.dataset.videoReady === 'true');

    // TTS 播放中，影片開始播放 → TTS 暫停且之後不自動恢復。
    // The click autoplayed the player; pause it so the next play is a new start.
    await playerFrame(page, ID_A).evaluate(() => window.__send({ event: 'onStateChange', info: 2 }));
    await page.waitForFunction(() => document.querySelector('[data-widget-id="v1"] iframe')?.dataset.playerState === '2');
    await page.evaluate(() => document.getElementById('ttsPanelToggleBtn').click());
    await page.locator('#ttsPlayPauseBtn').click();
    await page.waitForFunction(() => document.body.dataset.ttsPlaybackState === 'playing', null, { timeout: 10000 });
    await playerFrame(page, ID_A).evaluate(() => document.getElementById('stubPlay').click());
    await page.waitForFunction(() => document.body.dataset.ttsPlaybackState === 'paused');
    assert.equal(await page.evaluate(() => document.body.dataset.videoPausedTts), 'true');
    await playerFrame(page, ID_A).evaluate(() => window.__send({ event: 'onStateChange', info: 2 }));
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.body.dataset.ttsPlaybackState), 'paused');
    await page.locator('#ttsStopBtn').click().catch(() => {});
    // An expanded TTS panel replaces the object editors; close it for later steps.
    await page.evaluate(() => document.getElementById('ttsPanelToggleBtn').click());
    await page.waitForFunction(() => document.getElementById('ttsPanelToggleBtn').getAttribute('aria-expanded') !== 'true');

    // 點進跨來源播放器後焦點會回到投影片，方向鍵仍能換頁並暫停離開頁的影片。
    const box = await frame.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => Number(document.body.dataset.videoFocusReturned || 0) > 0);
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('section.present')?.dataset.slideId === 'p2');
    await page.waitForFunction(() => document.querySelector('[data-widget-id="v1"] iframe')?.dataset.playerState === '2');
    assert.ok((await playerCommands(page, ID_A)).includes('pauseVideo'));

    // 自動播放的 fragment 影片：fragment 出現後才載入。
    assert.equal(await page.locator('[data-widget-id="v2"] iframe').count(), 0);
    await page.keyboard.press('ArrowRight');
    await page.locator('[data-widget-id="v2"] iframe.slide-video-frame').waitFor();
    assert.equal(new URL(await page.locator('[data-widget-id="v2"] iframe').getAttribute('src')).searchParams.get('autoplay'), '1');
    await page.waitForFunction(() => document.querySelector('[data-widget-id="v2"] iframe')?.dataset.playerState === '1');
    assert.equal(await page.locator('[data-widget-id="v1"] iframe').count(), 1, 'one recently left player is kept');

    // 第三頁：離線海報顯示替代畫面；只保留最近離開的一個播放器。
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('section.present')?.dataset.slideId === 'p3');
    await page.waitForFunction(() => document.body.dataset.videoFrames === '1');
    assert.equal(await page.locator('[data-widget-id="v1"] iframe').count(), 0);
    await page.waitForFunction(() => document.querySelector('[data-widget-id="v2"] iframe')?.dataset.playerState === '2');
    await page.waitForFunction(() => document.querySelector('[data-widget-id="v3"]')?.dataset.videoFallback === 'offline');
    assert.equal(await page.locator('[data-widget-id="v3"] .video-fallback a').getAttribute('href'), `https://www.youtube.com/watch?v=${ID_OFFLINE}`);

    // 回到第二頁再觸發 onError 150 → 替代訊息，播放器卸載。
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => document.querySelector('section.present')?.dataset.slideId === 'p2');
    await playerFrame(page, ID_B).evaluate(() => window.__send({ event: 'onError', info: 150 }));
    await page.waitForFunction(() => document.querySelector('[data-widget-id="v2"]')?.dataset.videoFallback === 'error-150');
    assert.equal(await page.locator('[data-widget-id="v2"] iframe').count(), 0);
    assert.equal(await page.evaluate(() => document.body.dataset.videoFrames), '0', 'teardown on error updates the frame count');

    // 總覽與編輯模式都卸載播放器。
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => document.querySelector('section.present')?.dataset.slideId === 'p1');
    await page.locator('[data-widget-id="v1"] .video-play-button').click();
    await page.locator('[data-widget-id="v1"] iframe').waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.body.dataset.videoFrames === '0');
    await page.keyboard.press('Escape');
    await page.locator('[data-widget-id="v1"] .video-play-button').click();
    await page.locator('[data-widget-id="v1"] iframe').waitFor();
    await setEditMode(page, true);
    await page.waitForFunction(() => document.body.dataset.videoFrames === '0');

    // 編輯模式：側欄沒有預覽按鈕；與放映相同，直接按影片中間的播放鍵播放，取消選取就停止。
    assert.equal(await page.locator('#videoPreviewBtn, #videoOpenLink').count(), 0);
    // 拖曳影片（從播放鍵按下也一樣）只移動，不會播放。
    const playBox = await page.locator('[data-widget-id="v1"] .video-play-button').boundingBox();
    await page.mouse.move(playBox.x + playBox.width / 2, playBox.y + playBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(playBox.x + playBox.width / 2 + 40, playBox.y + playBox.height / 2 + 20, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.body.dataset.videoFrames), '0', 'dragging does not play');
    await page.locator('[data-widget-id="v1"] .video-play-button').click();
    await page.locator('[data-widget-id="v1"] iframe[data-video-preview="true"]').waitFor();
    assert.equal(await page.locator('.slide-widget[data-widget-id="v1"]').evaluate(el => el.classList.contains('is-selected')), true);
    await page.locator('#exitVideoEditorBtn').click();
    await page.waitForFunction(() => document.body.dataset.videoFrames === '0');
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.kill();
  }
});

test('video poster and player fill their bounds without Reveal image margins or maximums', { timeout: 60000 }, async t => {
  const { startIsolatedServer } = require('./helpers/isolated-server');
  const { base } = await startIsolatedServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const deck = { groups: [{ id: 'fit-group', slides: [slide('fit-slide', [
    { id: 'fit-old', type: 'video', videoId: ID_A, x: 70, y: 80, w: 640, h: 360 },
    { id: 'fit-custom', type: 'video', videoId: ID_B, x: 800, y: 80, w: 240, h: 427,
      aspect: '9:16', muted: true, autoplay: false, startSeconds: 12, title: 'custom' }
  ])] }] };
  const { page, errors } = await openPage(browser, deck);
  await page.route(/^https:\/\/i\.ytimg\.com\//, route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body:
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#287bc1"/><path d="M0 0H480V360H0Z" fill="none" stroke="#42d17b" stroke-width="12"/></svg>' }));
  await ready(page, base);
  async function assertEdges(selector, owner) {
    const offsets = await page.locator(selector).evaluateAll((els, ownerSelector) => els.map(el => {
      const a = el.getBoundingClientRect(), b = el.closest(ownerSelector).getBoundingClientRect();
      return [a.left-b.left, a.top-b.top, a.right-b.right, a.bottom-b.bottom];
    }), owner);
    assert.ok(offsets.length > 0, selector);
    for (const values of offsets) for (const offset of values) assert.ok(Math.abs(offset) < 0.1, `${selector}: ${offsets}`);
  }
  await setEditMode(page, true);
  await assertEdges('.video-poster', '.video-widget');
  await page.locator('[data-tool="video"]').click();
  await page.locator('#videoInsertUrl').fill(`https://youtu.be/${ID_A}`);
  await page.locator('#confirmVideoInsertBtn').click();
  await page.waitForFunction(() => document.querySelectorAll('.video-widget').length === 3);
  await assertEdges('.video-poster', '.video-widget');
  const saved = await savedDeck(page);
  const custom = saved.groups[0].slides[0].widgets.find(w => w.id === 'fit-custom');
  assert.deepEqual([custom.w, custom.h, custom.aspect, custom.muted, custom.autoplay, custom.startSeconds], [240,427,'9:16',true,false,12]);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready'));
  await assertEdges('.video-poster', '.video-widget');
  await setEditMode(page, false);
  await page.locator('.video-widget').last().locator('.video-play-button').click();
  await page.locator('.video-widget iframe').waitFor();
  await assertEdges('.slide-video-frame', '.video-widget');
  const fs = require('node:fs'); fs.mkdirSync(path.join(__dirname,'../test-results/video-fit'), {recursive:true});
  await page.screenshot({path:path.join(__dirname,'../test-results/video-fit/verified.png')});
  assert.deepEqual(errors, []);
});
