const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

function freePort() {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });
}

test('slide Segment Tree uses the standard interval renderer and keeps zero-based editing',
  { timeout: 60000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const port = await freePort();
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
          if ((await fetch(base)).ok) break;
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      browser = await chromium.launch({
        headless: true,
        ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
      });
      const widget = {
        id: 'segment', type: 'structure', structureMode: 'segment_tree',
        content: '10, 20, 30, 40, 50, 60, 70', indexBase: 0, indexMode: 1, gap: 8,
        highlightIndices: '2', annotationIndices: '2', annotationText: 'R',
        x: 180, y: 120, w: 720, h: 390
      };
      const deck = {
        groups: [{ id: 'g1', slides: [{ id: 's1', canvas: { objects: [] }, widgets: [widget] }] }]
      };
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.stack || error.message));
      await page.addInitScript(value => {
        localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value));
      }, deck);
      await page.goto(`${base}/slides.html`);
      await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());

      const result = await page.locator('[data-widget-id="segment"] svg').evaluate(svg => {
        const group = svg.querySelector('[data-slide-structure="segment_tree"]');
        const nodes = [...group.querySelectorAll('[data-structure-item-index]')].map(cell => {
          const rect = cell.querySelector(':scope > rect');
          return {
            item: Number(cell.dataset.structureItemIndex),
            storage: Number(cell.dataset.segmentStorageIndex),
            left: Number(cell.dataset.segmentLeft),
            right: Number(cell.dataset.segmentRight),
            value: cell.querySelector(':scope > text')?.textContent,
            width: Number(rect?.getAttribute('width')),
            y: Number(rect?.getAttribute('y'))
          };
        }).sort((a, b) => a.item - b.item);
        return {
          renderer: svg.dataset.renderer,
          layout: group.dataset.layout,
          domain: [Number(group.dataset.segmentDomainStart), Number(group.dataset.segmentDomainEnd)],
          domainLength: Number(group.dataset.slideSegmentDomainLength),
          nodes,
          edges: group.querySelectorAll('.asm-segment-tree-edges line').length,
          rootLabel: group.querySelector('[data-segment-storage-index="1"] + [id$="-index"]')?.textContent,
          annotationStorage: Number(group.querySelector('[data-structure-annotation-index="2"]')
            ?.dataset.structureStyleSourceStorageIndex),
          highlights: group.querySelectorAll('.highlight-blink').length
        };
      });
      assert.equal(result.renderer, 'standard-segment-tree');
      assert.equal(result.layout, 'segment_tree_interval');
      assert.deepEqual(result.domain, [0, 3]);
      assert.equal(result.domainLength, 4);
      assert.equal(result.edges, 6);
      assert.deepEqual(result.nodes.map(node => [node.item, node.storage, node.value]), [
        [0, 1, '10'], [1, 2, '20'], [2, 3, '30'], [3, 4, '40'],
        [4, 5, '50'], [5, 6, '60'], [6, 7, '70']
      ]);
      assert.deepEqual(result.nodes.slice(0, 3).map(node => [node.left, node.right, node.width]), [
        [0, 3, 184], [0, 1, 88], [2, 3, 88]
      ]);
      assert.ok(result.nodes[3].y > result.nodes[1].y);
      assert.match(result.rootLabel, /1.*\[0,3\]/);
      assert.equal(result.annotationStorage, 3);
      assert.equal(result.highlights, 1);

      const object = page.locator('[data-widget-id="segment"]');
      await object.locator('[data-structure-item-index="2"] > text').dblclick();
      await object.locator('.structure-inline-value-input').fill('99');
      await object.locator('.structure-inline-value-input').press('Enter');
      await page.waitForFunction(() => document.querySelector('[data-widget-id="segment"]')?.textContent.includes('99'));
      const savedContent = await page.evaluate(async () => {
        const saved = await ASMSlideStorage.create(indexedDB, localStorage)
          .loadDeck('asm_reveal_fabric_deck_v5');
        return saved.groups[0].slides[0].widgets[0].content;
      });
      assert.equal(savedContent, '10, 20, 99, 40, 50, 60, 70');

      const oneBased = await page.evaluate(value => {
        const svg = AlgoStructureRenderer.createSvg({ ...value, indexBase: 1 });
        const group = svg.querySelector('[data-slide-structure="segment_tree"]');
        return {
          domain: [Number(group.dataset.segmentDomainStart), Number(group.dataset.segmentDomainEnd)],
          rootLabel: group.querySelector('[data-segment-storage-index="1"] + [id$="-index"]')?.textContent
        };
      }, widget);
      assert.deepEqual(oneBased.domain, [1, 4]);
      assert.match(oneBased.rootLabel, /\[1,4\]/);

      const sparseTen = await page.evaluate(() => {
        const values = [55, 15, 40, 6, 9, 21, 19, 3, 3, 4, 5, 13, 8, 9, 10, 1, 2,
          0, 0, 0, 0, 0, 0, 6, 7];
        const svg = AlgoStructureRenderer.createSvg({
          id: 'sparse-ten', type: 'structure', structureMode: 'segment_tree',
          segmentDomainLength: 10, content: values.join(', '), indexBase: 1,
          indexMode: 1, gap: 8, w: 900, h: 500
        });
        const group = svg.querySelector('[data-slide-structure="segment_tree"]');
        const nodes = [...group.querySelectorAll('[data-segment-storage-index]')].map(cell => ({
          storage: Number(cell.dataset.segmentStorageIndex),
          value: cell.querySelector(':scope > text')?.textContent,
          interval: [Number(cell.dataset.segmentLeft), Number(cell.dataset.segmentRight)]
        }));
        return {
          domain: [Number(group.dataset.segmentDomainStart), Number(group.dataset.segmentDomainEnd)],
          domainLength: Number(group.dataset.slideSegmentDomainLength),
          storageLength: Number(group.dataset.slideSegmentStorageLength),
          visible: nodes.map(node => node.storage).sort((a, b) => a - b),
          twentyFour: nodes.find(node => node.storage === 24),
          twentyFive: nodes.find(node => node.storage === 25)
        };
      });
      assert.deepEqual(sparseTen.domain, [1, 10]);
      assert.equal(sparseTen.domainLength, 10);
      assert.equal(sparseTen.storageLength, 25);
      assert.deepEqual(sparseTen.visible, [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,24,25]);
      assert.deepEqual(sparseTen.twentyFour, { storage: 24, value: '6', interval: [6, 6] });
      assert.deepEqual(sparseTen.twentyFive, { storage: 25, value: '7', interval: [7, 7] });

      await object.click();
      const lengthInput = page.locator('#structureLengthInput');
      assert.equal(await lengthInput.inputValue(), '4', 'legacy objects infer the prior four-leaf domain');
      await lengthInput.fill('10');
      await page.waitForFunction(() => {
        const group = document.querySelector('[data-widget-id="segment"] [data-slide-structure="segment_tree"]');
        return group?.dataset.slideSegmentDomainLength === '10'
          && group.querySelectorAll('[data-segment-storage-index]').length === 19;
      });
      const resized = await page.evaluate(async () => {
        const saved = await ASMSlideStorage.create(indexedDB, localStorage)
          .loadDeck('asm_reveal_fabric_deck_v5');
        const value = saved.groups[0].slides[0].widgets[0];
        const group = document.querySelector('[data-widget-id="segment"] [data-slide-structure="segment_tree"]');
        return {
          domainLength: value.segmentDomainLength,
          storageLength: value.content.split(',').length,
          visible: [...group.querySelectorAll('[data-segment-storage-index]')]
            .map(node => Number(node.dataset.segmentStorageIndex)).sort((a, b) => a - b)
        };
      });
      assert.equal(resized.domainLength, 10);
      assert.equal(resized.storageLength, 25);
      assert.deepEqual(resized.visible, [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,24,25]);

      const bundled = await page.evaluate(async () => {
        const response = await fetch('/guest-decks/segment-tree-teaching.asmdeck');
        const archive = await ASMDeck.decode(await response.blob());
        const slides = archive.deck.groups.flatMap(group => group.slides || []);
        return [5, 11, 15].map(pageNumber => {
          const widget = slides[pageNumber - 1].widgets.find(item => item.structureMode === 'segment_tree');
          const values = widget.content.split(',').map(value => value.trim());
          const svg = AlgoStructureRenderer.createSvg(widget);
          const visible = [...svg.querySelectorAll('[data-segment-storage-index]')]
            .map(node => Number(node.dataset.segmentStorageIndex)).sort((a, b) => a - b);
          return {
            pageNumber,
            domainLength: widget.segmentDomainLength,
            storageLength: values.length,
            twentyFour: values[23],
            twentyFive: values[24],
            visible
          };
        });
      });
      const visibleTen = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,24,25];
      assert.deepEqual(bundled, [
        { pageNumber: 5, domainLength: 10, storageLength: 25, twentyFour: '6', twentyFive: '7', visible: visibleTen },
        { pageNumber: 11, domainLength: 10, storageLength: 25, twentyFour: '6', twentyFive: '7', visible: visibleTen },
        { pageNumber: 15, domainLength: 10, storageLength: 25, twentyFour: '6', twentyFive: '7', visible: visibleTen }
      ]);
      assert.deepEqual(errors, []);
    } finally {
      if (browser) await browser.close();
      server.kill();
    }
  });
