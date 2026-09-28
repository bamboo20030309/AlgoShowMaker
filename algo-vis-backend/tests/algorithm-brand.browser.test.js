/**
 * 測試模組：algorithm-brand.browser.test
 *
 * 驗證重點：algorithm brand.browser.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('algorithm brand matches the home identity and links home', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const selectedPort = probe.address().port;
      probe.close(() => resolve(selectedPort));
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
      try {
        if ((await fetch(`${base}/algorithm.html`)).ok) break;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}/algorithm.html`, { waitUntil: 'domcontentloaded' });

    const brand = page.getByRole('link', { name: 'AlgoShowMaker 首頁' });
    assert.equal(await brand.getAttribute('href'), '/');
    assert.equal(await brand.locator('span').textContent(), 'AlgoShowMaker');
    const readAppearance = element => {
      const image = element.querySelector('img');
      const style = getComputedStyle(element);
      return {
        display: style.display,
        gap: style.gap,
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        imageLoaded: image.complete && image.naturalWidth > 0,
        imageWidth: image.getBoundingClientRect().width,
        imageHeight: image.getBoundingClientRect().height
      };
    };
    const algorithmAppearance = await brand.evaluate(readAppearance);
    assert.ok(['flex', 'inline-flex'].includes(algorithmAppearance.display));
    assert.deepEqual({ ...algorithmAppearance, display: undefined }, {
      display: undefined,
      gap: '9px',
      color: 'rgb(255, 255, 255)',
      fontFamily: 'Arial, "Noto Sans TC", sans-serif',
      fontSize: '17px',
      fontWeight: '700',
      lineHeight: 'normal',
      imageLoaded: true,
      imageWidth: 28,
      imageHeight: 28
    });

    await brand.hover();
    await page.waitForTimeout(200);
    const hoverFeedback = await brand.evaluate(element => ({
      background: getComputedStyle(element, '::before').backgroundColor,
      borderColor: getComputedStyle(element, '::before').borderColor,
      transform: getComputedStyle(element.querySelector('img')).transform
    }));
    assert.equal(hoverFeedback.background, 'rgba(112, 190, 255, 0.1)');
    assert.equal(hoverFeedback.borderColor, 'rgba(112, 190, 255, 0.18)');
    assert.notEqual(hoverFeedback.transform, 'none');

    await brand.click();
    await page.waitForURL(`${base}/`);
    const homeBrand = page.getByRole('link', { name: 'AlgoShowMaker 首頁' });
    assert.equal(await homeBrand.locator('span').textContent(), 'AlgoShowMaker');
    assert.deepEqual(await homeBrand.evaluate(readAppearance), algorithmAppearance);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
