/**
 * 驗證 @ 指令清單的鍵盤生命週期、捲動追蹤與同一行語法過濾。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

test('directive suggestions close, scroll and filter according to the active line', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(base + '/algorithm.html');
    await page.waitForFunction(() => window.ace && window.ASMDirectiveAssist);

    const setLineAndOpen = async line => {
      await page.evaluate(value => {
        const editor = ace.edit('editor');
        editor.setValue(value, -1);
        editor.moveCursorTo(0, value.length);
        editor.focus();
        window.ASMDirectiveAssist.openSuggestions();
      }, line);
      await page.waitForFunction(() => !document.getElementById('asmDirectiveAssist').hidden);
    };

    await setLineAndOpen('// @');
    const rootLabels = await page.locator('#asmDirectiveAssist .asm-directive-choice strong').allTextContents();
    for (const label of ['@camera', '@branch', '@endbranch', '@endpreset', '@code', '@endcode']) {
      assert.ok(rootLabels.includes(label), `${label} must appear in the root @ list`);
    }

    for (let index = 0; index < 14; index += 1) await page.keyboard.press('ArrowDown');
    const scrollState = await page.evaluate(() => {
      const list = document.querySelector('#asmDirectiveAssist .asm-directive-list');
      const selected = list.querySelector('[aria-selected="true"]');
      const listBox = list.getBoundingClientRect();
      const selectedBox = selected.getBoundingClientRect();
      return {
        scrollTop: list.scrollTop,
        selectedTop: selectedBox.top,
        selectedBottom: selectedBox.bottom,
        listTop: listBox.top,
        listBottom: listBox.bottom
      };
    });
    assert.ok(scrollState.scrollTop > 0, `ArrowDown must scroll the list: ${JSON.stringify(scrollState)}`);
    assert.ok(scrollState.selectedTop >= scrollState.listTop - 1
      && scrollState.selectedBottom <= scrollState.listBottom + 1,
    `the keyboard selection must remain visible: ${JSON.stringify(scrollState)}`);

    await page.keyboard.type('x');
    await page.waitForFunction(() => document.getElementById('asmDirectiveAssist').hidden);
    assert.equal(await page.evaluate(() => ace.edit('editor').getValue()), '// @x',
      'the closing key must continue to the editor');

    await setLineAndOpen('// @frame arr');
    const frameLabels = await page.locator('#asmDirectiveAssist .asm-directive-choice strong').allTextContents();
    for (const label of ['@object', '@let', '@style', '@automark', '@text', '@segment', '@arrow', '@place']) {
      assert.equal(frameLabels.includes(label), false, `${label} must not be suggested on the @frame line`);
    }
    for (const label of ['render', 'with', 'when']) {
      assert.ok(frameLabels.includes(label), `${label} must remain available on the @frame line`);
    }
  } finally {
    await browser.close();
  }
});
