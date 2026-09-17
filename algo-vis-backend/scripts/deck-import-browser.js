const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function runDeckImportBrowser(browser, baseURL, output) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  const errors = [], expectedErrors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (message.location().url?.includes('/trace/analyze') && /400/.test(message.text())) {
      expectedErrors.push(message.text());
    } else errors.push(message.text());
  });
  const code = '#include <bits/stdc++.h>\nusing namespace std;\n\n\n// @camera focus arr\n'
    + 'int main() {\n vector<int> arr={5,2};\n // @frame arr\n'
    + ' if(arr[0]>arr[1]) swap(arr[0],arr[1]);\n // @frame arr\n}\n';
  const rebuild = { view: { version: 1, rules: [], skins: {}, studio: {
    cameraRules: [{ id: 'import-camera', name: '匯入鏡頭', allFrames: true, zoom: 1.4 }],
    eventInstructionStates: { 'declare:main:arr': false }
  } }, globals: { eventSettings: { gapMs: 720, autoFixedEnabled: false } } };
  const slide = { id: 'repair-slide', kind: 'algorithm-animation', canvas: { objects: [] },
    animation: { mode: 'trace', code, input: '6\n5 7 2 1 9 4', sliceMode: 'manual', watches: [], rebuild } };
  const deck = { groups: [{ id: 'repair-group', slides: [slide,
    { id: 'other-slide', canvas: { objects: [] }, widgets: [] }] }] };
  async function stored() {
    return page.evaluate(() => ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5'));
  }
  async function openEditor() {
    await page.locator('#algorithmEditSlideBtn').click();
    await page.waitForFunction(() => !document.getElementById('algorithmEditorModal').hidden
      && !document.getElementById('algorithmEditorModal').classList.contains('is-loading'));
    return page.frames().find(frame => frame.url().includes('asmEmbed=editor'));
  }
  try {
    await page.goto(baseURL + '/slides.html');
    await page.waitForFunction(() => window.ASMDeck && document.body.dataset.slideCount);
    const bytes = await page.evaluate(async deck => {
      const blob = await ASMDeck.encode({ deck, assets: {} });
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    }, deck);
    await page.locator('#importDeckInput').setInputFiles({ name: 'repair.asmdeck',
      mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
    await page.waitForFunction(() => document.body.dataset.asmdeckLastImportStats
      && document.querySelector('section[data-slide-id="repair-slide"]'));
    assert.equal(JSON.parse(await page.evaluate(() => document.body.dataset.asmdeckLastImportStats)).pending, 1);
    let saved = await stored();
    assert.equal(saved.groups[0].slides.length, 2);
    assert.equal(saved.groups[0].slides[0].animation.code, code);
    assert.match(saved.groups[0].slides[0].animation.rebuildError, /第 5 行.*@camera/);
    assert.deepEqual(saved.groups[0].slides[0].animation.rebuild, rebuild);
    let editor = await openEditor();
    assert.equal(await editor.evaluate(() => aceEditor.getValue()), code);
    assert.deepEqual(await editor.evaluate(() => ASMTraceEditor.snapshot().rebuild), rebuild);
    // Saving an uncorrected editor must not silently discard its settings.
    await page.locator('#saveAlgorithmEditorBtn').click();
    await page.waitForFunction(() => document.getElementById('algorithmEditorModal').hidden);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('section[data-slide-id="repair-slide"]'));
    saved = await stored();
    assert.deepEqual(saved.groups[0].slides[0].animation.rebuild, rebuild);
    editor = await openEditor();
    const repaired = code.replace('// @camera focus arr\n', '');
    await editor.evaluate(code => aceEditor.setValue(code, -1), repaired);
    await editor.locator('#runBtn').click();
    await editor.waitForFunction(() => ASMTracePlayer.getDocument()?.frames.length === 2,
      null, { timeout: 60000 });
    const settings = await editor.evaluate(() => ASMTraceEditor.snapshot());
    assert.equal(settings.rebuild, undefined);
    assert.equal(settings.traceDocument.studio.eventSettings.gapMs, 720);
    assert.ok(settings.traceDocument.studio.cameraRules.some(rule => rule.id === 'import-camera'));
    await editor.evaluate(() => ASMTraceStudio.close());
    await editor.locator('#nextBtn').click();
    await editor.waitForFunction(() => ASMTracePlayer.getCurrentFrame() === 1 && !ASMTracePlayer.getActivePlaybackPlan());
    await editor.locator('#prevBtn').click();
    await editor.waitForFunction(() => ASMTracePlayer.getCurrentFrame() === 0 && !ASMTracePlayer.getActivePlaybackPlan());
    for (const rate of [.75, 1.5]) {
      await editor.locator('#restartBtn').click();
      await editor.evaluate(rate => { window.asmGetAnimationPlaybackRate = () => rate; }, rate);
      await editor.locator('#playToggleBtn').click();
      await editor.waitForFunction(() => ASMTracePlayer.getCurrentFrame() === 1 && !ASMTracePlayer.getActivePlaybackPlan(),
        null, { timeout: 60000 });
      await editor.waitForFunction(() => !document.getElementById('playToggleBtn').classList.contains('playing'));
    }
    await editor.evaluate(() => ASMTraceStudio.open(ASMTracePlayer.getDocument()));
    await editor.waitForFunction(() => document.querySelector(
      '[data-frame-index="1"].is-current svg[data-thumbnail-rendered="true"]')
      && document.querySelector('.trace-studio-event-code-button'));
    await page.locator('#saveAlgorithmEditorBtn').click();
    await page.waitForFunction(() => document.getElementById('algorithmEditorModal').hidden);
    await page.waitForFunction(async () => {
      const saved = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
      return saved.groups[0].slides[0].animation.traceDocument?.frames.length === 2;
    });
    saved = await stored();
    assert.equal(saved.groups[0].slides[0].animation.rebuild, undefined);
    assert.equal(saved.groups[0].slides[0].animation.rebuildError, undefined);
    const savedCode = saved.groups[0].slides[0].animation.code;
    assert.equal(savedCode.replace(/\s*\/\* @asm-view[\s\S]*?@asm-view \*\/\s*$/, '').trimEnd(), repaired.trimEnd());
    assert.match(savedCode, /import-camera/);
    let reloadRuns = 0;
    page.on('request', request => {
      if (request.method() === 'POST' && /\/(trace\/analyze|compile)(?:\?|$)/.test(request.url())) reloadRuns++;
    });
    await page.reload();
    await page.waitForFunction(() => document.querySelector('section[data-slide-id="repair-slide"]'));
    assert.deepEqual((await stored()).groups[0].slides[0].animation.traceDocument,
      saved.groups[0].slides[0].animation.traceDocument);
    editor = await openEditor();
    await editor.waitForFunction(() => ASMTracePlayer.getDocument()?.frames.length === 2);
    assert.equal(reloadRuns, 0, 'Durable reload must not analyze or RUN again');
    assert.equal(await editor.evaluate(() => ASMTracePlayer.getDocument().studio.eventSettings.gapMs), 720);
    assert.deepEqual(errors, []);
    const result = { label: 'deck-import-repair', pass: true, sampleCount: 2,
      expectedAnalysisErrors: expectedErrors.length, checks: ['import', 'save-before-RUN', 'reload',
        'repair-RUN', 'settings', 'next-previous', 'autoplay-.75-1.5', 'Studio-thumbnail-events', 'save-after-RUN',
        'durable-reload-zero-RUN'] };
    fs.writeFileSync(path.join(output, 'deck-import-repair.json'), JSON.stringify(result, null, 2));
    console.log('PASS deck-import-repair');
    return result;
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'deck-import-repair.png') });
    fs.writeFileSync(path.join(output, 'deck-import-repair.json'), JSON.stringify({
      pass: false, message: error.message, errors, expectedErrors }, null, 2));
    throw error;
  } finally { await context.close(); }
}
module.exports = { runDeckImportBrowser };
