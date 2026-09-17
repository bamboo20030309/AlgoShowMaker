const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function runSlideOrderBrowser(browser, baseURL, output) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    if (localStorage.getItem('slide-order-test-seeded')) return;
    localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify({ groups: ['a', 'b', 'c'].map(id => ({
      id: 'group-' + id, slides: [{ id, canvas: { objects: [] }, widgets: [] }]
    })) }));
    localStorage.setItem('slide-order-test-seeded', 'yes');
  });
  try {
    await page.goto(baseURL + '/slides.html');
    await page.waitForFunction(() => document.body.dataset.slideCount === '3');
    const button = page.locator('#slideOrderToggleBtn');
    const visual = await button.evaluate(node => ({
      width: node.getBoundingClientRect().width,
      color: getComputedStyle(node).color,
      iconWidth: node.querySelector('svg').getBoundingClientRect().width,
      fill: getComputedStyle(node.querySelector('svg')).fill,
      stroke: getComputedStyle(node.querySelector('svg')).stroke
    }));
    const sharedStyle = await page.locator('#exportDeckBtn').evaluate(node => ({
      width: node.getBoundingClientRect().width,
      color: getComputedStyle(node).color
    }));
    assert.equal(visual.width, sharedStyle.width);
    assert.equal(visual.iconWidth, 24);
    assert.equal(visual.color, sharedStyle.color);
    assert.equal(visual.fill, 'none');
    assert.equal(visual.stroke, sharedStyle.color);
    assert.equal(await button.locator('svg rect').count(), 3);
    assert.deepEqual(await button.evaluate(node => {
      const svg = node.querySelector('svg').getBoundingClientRect();
      const reference = document.querySelector('#modeToggleBtn .mode-icon-edit').getBoundingClientRect();
      return [svg.width, svg.height, reference.width, reference.height];
    }), [24, 24, 24, 24], 'icon inset matches the adjacent mode button');
    assert.deepEqual(await button.evaluate(node => {
      const own = getComputedStyle(node);
      const other = getComputedStyle(document.querySelector('#exportDeckBtn'));
      const keys = ['width', 'height', 'padding', 'border', 'backgroundColor', 'boxShadow', 'borderRadius', 'color'];
      return keys.filter(key => own[key] !== other[key]);
    }), [], 'sorting button must use the same shared button style');
    assert.equal(await page.locator('#deckCacheBtn, #deckCacheDialog').count(), 0);
    assert.equal(await button.evaluate(node => node.closest('#controlChrome') !== null), true);
    await page.setViewportSize({ width: 900, height: 900 });
    assert.equal(await button.isVisible(), true, 'narrow editor must retain the left toolbar button');
    await button.click();
    await page.waitForFunction(() => document.body.classList.contains('custom-overview-open'));
    await button.click();
    await page.setViewportSize({ width: 1600, height: 900 });
    assert.equal(await button.getAttribute('aria-pressed'), 'false');
    await button.click();
    await page.waitForFunction(() => document.body.classList.contains('custom-overview-open')
      && document.querySelectorAll('.custom-overview-thumb').length === 3);
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    await page.mouse.move(600, 400);
    assert.equal(await button.evaluate(node => getComputedStyle(node).backgroundColor),
      await page.locator('#modeToggleBtn').evaluate(node => getComputedStyle(node).backgroundColor),
      'opened sorting button uses the mode button selected fill');
    assert.equal(await button.evaluate(node => getComputedStyle(node).color), sharedStyle.color);
    assert.equal(await button.getAttribute('aria-label'), '返回投影片編輯');
    await page.keyboard.press('Escape');
    assert.equal(await button.getAttribute('aria-pressed'), 'false');
    await button.focus();
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.body.classList.contains('custom-overview-open'));
    await page.locator('.custom-overview-thumb[data-slide-id="b"]').click();
    await button.click();
    await page.waitForFunction(() => document.querySelector('section.asm-slide.present')?.dataset.slideId === 'b');
    await button.click();
    const source = await page.locator('.custom-overview-thumb[data-slide-id="b"]').boundingBox();
    const target = await page.locator('.custom-overview-thumb[data-slide-id="c"]').boundingBox();
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width - 3, target.y + target.height / 2, { steps: 15 });
    await page.mouse.up();
    await page.waitForFunction(async () => {
      const saved = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
      return saved.groups.flatMap(group => group.slides.map(slide => slide.id)).join(',') === 'a,c,b';
    });
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'false');
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
    assert.deepEqual(await page.evaluate(async () =>
      (await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5'))
        .groups.flatMap(group => group.slides.map(slide => slide.id))), ['a', 'c', 'b']);
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.slideCount === '3');
    await button.click();
    assert.deepEqual(await page.locator('.custom-overview-thumb').evaluateAll(nodes => nodes.map(node => node.dataset.slideId)),
      ['a', 'c', 'b']);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(output, 'slide-order-toggle.png') });
    const result = { label: 'slide-order-toggle', pass: true, sampleCount: 3,
      checks: ['cache-controls-removed', 'left-toolbar-placement', 'narrow-button-visible', 'button-toggle', 'Escape-sync', 'keyboard-toggle', 'selection-return', 'drag-reorder', 'save-reload'] };
    fs.writeFileSync(path.join(output, 'slide-order-toggle.json'), JSON.stringify(result, null, 2));
    console.log('PASS slide-order-toggle');
    return result;
  } catch (error) {
    console.error('slide-order diagnostics', await page.evaluate(async () => ({
      url: location.href,
      saved: (await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5'))?.groups.map(group => group.slides.map(slide => slide.id)),
      saveState: document.body.dataset.localDeckSave,
      sections: [...document.querySelectorAll('section.asm-slide')].map(node => node.dataset.slideId),
      seeded: localStorage.getItem('slide-order-test-seeded')
    })).catch(() => null));
    await page.screenshot({ path: path.join(output, 'slide-order-toggle-failure.png') }).catch(() => {});
    throw error;
  } finally { await context.close(); }
}
module.exports = { runSlideOrderBrowser };
