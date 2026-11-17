'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');
const { compile } = require('./helpers/compile');
const { loadManifest, directory } = require('./helpers/event-contract-oracle');
const { runControlCase } = require('./helpers/event-contract-controls');

test('event control contracts use fixed answers against DOM, navigation and reopened storage', { timeout: 180000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const manifest = loadManifest();
  const traces = {};
  const previousBase = process.env.ASM_TEST_BASE_URL;
  try {
    process.env.ASM_TEST_BASE_URL = base;
    for (const id of ['assignment', 'visibility']) {
      const fixture = manifest.fixtures.find(fixture => fixture.id === id);
      traces[id] = (await compile(fs.readFileSync(path.join(directory, fixture.file), 'utf8'), fixture.input)).trace;
    }
  } finally {
    if (previousBase === undefined) delete process.env.ASM_TEST_BASE_URL;
    else process.env.ASM_TEST_BASE_URL = previousBase;
  }
  const browser = await chromium.launch({ headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const selected = new Set((process.env.ASM_EVENT_CONTROL_CASES || '').split(',').filter(Boolean));
  for (const item of manifest.cases.filter(item => item.assertionKind === 'control' && (!selected.size || selected.has(item.id)))) {
    await t.test(item.id + ' ' + item.title, async () => {
      const page = await browser.newPage();
      try {
        await page.goto(base + '/algorithm.html?asmEmbed=runtime');
        await page.waitForFunction(() => window.asmApplyTraceDocument);
        await page.addScriptTag({ url: base + '/slides-storage.js' });
        await page.addScriptTag({ url: base + '/slide-trace-store.js' });
        const result = await runControlCase({ page, trace: traces[item.fixture], item, allTraces: traces });
        const output = path.resolve(__dirname, '../test-results/event-controls');
        fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(path.join(output, item.id + '.json'), JSON.stringify(result, null, 2));
        assert.equal(result.pass, true, JSON.stringify(result, null, 2));
      } finally { await page.close(); }
    });
  }
});
