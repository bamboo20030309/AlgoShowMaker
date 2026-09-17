const assert = require('node:assert/strict');
const { createStore } = require('../cloud-content');
const fs = require('node:fs');
const path = require('node:path');

async function runCloudStorageBrowser(browser, baseURL, output) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage(), errors = [], rows = [];
  let current = { deck_uid: 'cloud-browser', updated_at: new Date(1), resource_keys: [] }, commits = 0, runs = 0;
  const bodies = [];
  const store = createStore({
    parts: async (id, key) => rows.filter(row => row.key === key).sort((a, b) => a.part - b.part),
    usage: async () => rows.reduce((sum, row) => sum + Buffer.byteLength(row.data), 0),
    put: async (id, key, part, total, data) => {
      if (!rows.some(row => row.key === key && row.part === part)) rows.push({ key, part, total, data });
    },
    pin: async () => {},
    deck: async () => ({ ...current }),
    commit: async (query, update) => { current = { ...current, ...update }; commits++; return current; },
    remove: async (id, keys) => {
      for (let index = rows.length - 1; index >= 0; index--) if (keys.includes(rows[index].key)) rows.splice(index, 1);
    }
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => {
    if (request.method() === 'POST' && /\/(compile|trace\/analyze)$/.test(new URL(request.url()).pathname)) runs++;
  });
  try {
    await page.goto(baseURL + '/algorithm.html');
    await page.waitForFunction(() => window.ASMTraceEditor && typeof aceEditor !== 'undefined');
    await page.evaluate(() => {
      aceEditor.setValue('#include <bits/stdc++.h>\nusing namespace std;\nint main(){\n vector<int> arr={2,1};\n // @frame arr\n swap(arr[0],arr[1]);\n // @frame arr\n}', -1);
      document.getElementById('inputArea').value = '';
    });
    await page.locator('#runBtn').click();
    await page.waitForFunction(() => ASMTracePlayer.getDocument()?.frames?.length > 1, null, { timeout: 60000 });
    const animation = await page.evaluate(() => ({ ...ASMTraceEditor.snapshot(), code: aceEditor.getValue(), input: '' }));
    animation.traceDocument.cloudRegressionPayload = 'x'.repeat(9 * 1024 * 1024);
    const source = { groups: ['a', 'b', 'c'].map(id => ({ id: 'group-' + id, slides: [{
      id, canvas: { objects: [] }, widgets: [],
      ...(id === 'a' ? { kind: 'algorithm-animation', animation } : {})
    }] })) };
    let loaded = source;
    await page.route('**/api/slides/cloud-browser**', async route => {
      const request = route.request(), url = new URL(request.url()), body = request.postData();
      if (body) bodies.push(Buffer.byteLength(body));
      try {
        const match = url.pathname.match(/resources\/([a-f0-9]+)(?:\/(\d+))?$/);
        let data;
        if (match && request.method() === 'GET') {
          const parts = rows.filter(row => row.key === match[1]);
          data = { parts: parts.map(row => row.part), total: parts[0]?.total };
        } else if (match) {
          const chunk = JSON.parse(body);
          await store.put('cloud-browser', match[1], Number(match[2]), chunk.total, chunk.data);
          data = { success: true };
        } else if (url.pathname.endsWith('/content')) {
          const content = JSON.parse(body);
          await store.commit('cloud-browser', { deck_uid: 'cloud-browser' }, content.snapshot, {});
          loaded = (await store.snapshot('cloud-browser', current.cloud_snapshot)).deck;
          data = { success: true };
        } else data = { success: true, slide: { title: 'Cloud browser', deck: loaded } };
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
      } catch (error) {
        await route.fulfill({ status: error.status || 500, contentType: 'application/json',
          body: JSON.stringify({ error: error.message }) });
      }
    });
    await page.addInitScript(() => localStorage.setItem('algo_jwt_token', 'isolated-test'));
    const runsBefore = runs;
    await page.goto(baseURL + '/slides.html?deck=cloud-browser');
    await page.waitForFunction(() => document.body.dataset.slideCount === '3');
    await page.locator('#slideOrderToggleBtn').click();
    await page.waitForFunction(() => document.querySelectorAll('.custom-overview-thumb').length === 3);
    const a = await page.locator('.custom-overview-thumb[data-slide-id="b"]').boundingBox();
    const b = await page.locator('.custom-overview-thumb[data-slide-id="c"]').boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width - 3, b.y + b.height / 2, { steps: 15 });
    await page.mouse.up();
    await page.waitForFunction(() => document.getElementById('cloudSaveStatus').dataset.state === 'saved');
    await page.waitForTimeout(1500);
    assert.ok(commits > 0, 'real editor autosave must commit cloud content');
    assert.deepEqual(loaded.groups.flatMap(group => group.slides.map(slide => slide.id)), ['a', 'c', 'b']);
    assert.deepEqual(loaded.groups[0].slides[0].animation.traceDocument, animation.traceDocument);
    assert.ok(bodies.every(bytes => bytes < 8 * 1024 * 1024));
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.slideCount === '3');
    assert.equal(runs, runsBefore, 'cloud reopen must not RUN or analyze again');
    assert.deepEqual(errors, []);
    const result = { label: 'cloud-storage-browser', pass: true, sampleCount: bodies.length,
      checks: ['real-editor-autosave-over-8MB', 'small-requests', 'exact-trace-restore', 'reopen-without-RUN'] };
    fs.writeFileSync(path.join(output, 'cloud-storage-browser.json'), JSON.stringify(result, null, 2));
    console.log('PASS cloud-storage-browser');
    return result;
  } finally { await context.close(); }
}
module.exports = { runCloudStorageBrowser };
