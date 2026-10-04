const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

test('animation source loads and dialog reopen preserve independent Ace undo histories',
  { timeout: 60000 }, async () => {
    const base = process.env.ASM_TEST_BASE_URL;
    assert.ok(base, 'use an isolated test server');
    const browser = await chromium.launch({ headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://cdn.jsdelivr.net/npm/katex@latest/dist/**', route => route.fulfill({
        contentType: route.request().url().endsWith('.css') ? 'text/css' : 'application/javascript',
        body: route.request().url().endsWith('.css') ? '' : 'window.renderMathInElement = function() {};'
      }));
      const source = 'int main() {\n int value = 1;\n // @frame value\n return 0;\n}\n'
        + '/* @asm-view\n{"version":1,"rules":[],"skins":{},"studio":{"eventSettings":{"autoFixedEnabled":false,"autoLoopBoundaryEnabled":false}}}\n@asm-view */\n';
      // Legacy slides contain no editor-history fields; history stays transient.
      await page.addInitScript(code => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify({
        groups: [{ id: 'history-group', slides: [{ id: 'history-slide', kind: 'algorithm-animation',
          animation: { code, input: '17' },
          canvas: { objects: [] }, widgets: [] }] }]
      })), source);
      await page.goto(base + '/slides.html');
      await page.waitForFunction(() => document.body.dataset.slideCount);
      await page.evaluate(() => document.getElementById('algorithmEditSlideBtn').click());
      await page.waitForFunction(code => {
        const frame = document.getElementById('algorithmEditorFrame');
        return frame.contentWindow?.ace?.edit('editor').getValue() === code
          && !document.getElementById('algorithmEditorModal').classList.contains('is-loading');
      }, source);
      const editor = await (await page.$('#algorithmEditorFrame')).contentFrame();
      const changed = source + '// user change\n';
      await editor.evaluate(code => window.asmReplaceEditorCode(code), changed);
      // Reapplying identical source preserves both undo history and selection.
      await editor.evaluate(code => {
        ace.edit('editor').moveCursorTo(1, 3);
        window.__historySession = ace.edit('editor').session;
        window.addEventListener('message', event => {
          if (event.data?.type === 'asm-load-animation') window.__historyApplied = (window.__historyApplied || 0) + 1;
        });
        window.postMessage({ type: 'asm-load-animation', editorSessionKey: 'history-slide',
          animation: { code, input: '17' } }, location.origin);
      }, changed);
      await editor.waitForFunction(() => window.__historyApplied === 1);
      assert.deepEqual(await editor.evaluate(() => ace.edit('editor').getCursorPosition()), { row: 1, column: 3 });
      await editor.evaluate(() => ace.edit('editor').undo());
      assert.equal(await editor.evaluate(() => ace.edit('editor').getValue()), source);
      await editor.evaluate(() => ace.edit('editor').redo());
      assert.equal(await editor.evaluate(() => ace.edit('editor').getValue()), changed);

      await editor.click('#runBtn');
      await editor.waitForFunction(code => window.ASMTracePlayer.getDocument()?.sourceCode === code,
        changed, { timeout: 30000 });
      await editor.evaluate(() => ace.edit('editor').undo());
      assert.equal(await editor.evaluate(() => ace.edit('editor').getValue()), source, 'RUN preserves undo');
      await editor.evaluate(() => ace.edit('editor').redo());
      await page.click('#saveAlgorithmEditorBtn');
      await page.waitForFunction(() => document.getElementById('algorithmEditorModal').hidden);
      assert.match(await page.locator('#algorithmEditorFrame').getAttribute('src'), /asmEmbed=editor/);
      await page.evaluate(() => document.getElementById('algorithmEditSlideBtn').click());
      await page.waitForFunction(() => !document.getElementById('algorithmEditorModal').hidden
        && !document.getElementById('algorithmEditorModal').classList.contains('is-loading'));
      assert.equal(await editor.evaluate(() => ace.edit('editor').session === window.__historySession), true);
      assert.equal(await editor.locator('#inputArea').inputValue(), '17');
      assert.equal(await editor.evaluate(() => window.ASMTraceViewSource.parse(ace.edit('editor').getValue())
        .studio.eventSettings.autoFixedEnabled), false, 'explicit old settings survive save/reopen');
      await editor.evaluate(() => ace.edit('editor').undo());
      assert.equal(await editor.evaluate(() => ace.edit('editor').getValue()), source, 'save/reopen retains undo');
      await editor.evaluate(() => ace.edit('editor').redo());

      // A different animation owns a fresh history; returning restores the first.
      await editor.evaluate(() => window.postMessage({ type: 'asm-load-animation',
        editorSessionKey: 'another-slide', animation: { code: 'int other = 2;', input: '' } }, location.origin));
      await editor.waitForFunction(() => ace.edit('editor').getValue() === 'int other = 2;');
      assert.equal(await editor.evaluate(() => ace.edit('editor').session.getUndoManager().hasUndo()), false);
      await editor.evaluate(code => window.postMessage({ type: 'asm-load-animation',
        editorSessionKey: 'history-slide', animation: { code, input: '' } }, location.origin), changed);
      await editor.waitForFunction(code => ace.edit('editor').getValue() === code, changed);
      await editor.evaluate(() => ace.edit('editor').undo());
      assert.equal(await editor.evaluate(() => ace.edit('editor').getValue()), source);
      // The native mobile textarea must also retain undo rather than setValue.
      await editor.evaluate(() => {
        const input = document.querySelector('.asm-mobile-code-input');
        input.value = ace.edit('editor').getValue() + '// mobile edit\n';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      assert.equal(await editor.evaluate(() => ace.edit('editor').getValue()), source + '// mobile edit\n');
      await editor.evaluate(() => ace.edit('editor').undo());
      assert.equal(await editor.evaluate(() => ace.edit('editor').getValue()), source);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
