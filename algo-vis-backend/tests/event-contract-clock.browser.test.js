'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');
const { loadManifest, directory } = require('./helpers/event-contract-oracle');
const { compile } = require('./helpers/compile');
const { observeCase } = require('./helpers/event-contract-observe');
const { runClockProbe } = require('./helpers/event-contract-clock');

test('fixed event clocks inspect SVG immediately before and at commit at 1x and 2x', { timeout: 180000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const manifest = loadManifest();
  const requested = (process.env.ASM_EVENT_CLOCK_CASES || 'E02,E03,E04,E05,E06,E07,E08,E09,E17,E19').split(',');
  const traces = {};
  const previousBase = process.env.ASM_TEST_BASE_URL;
  try {
    process.env.ASM_TEST_BASE_URL = base;
    for (const fixture of manifest.fixtures.filter(f=>manifest.cases.some(c=>requested.includes(c.id)&&c.fixture===f.id))) {
      if (process.env.ASM_EVENT_CLOCK_USE_CAPTURED_TRACES === '1') {
        traces[fixture.id] = JSON.parse(fs.readFileSync(path.resolve(__dirname,
          '../test-results/event-contracts/traces/' + fixture.id + '.json'), 'utf8'));
      } else traces[fixture.id] = (await compile(fs.readFileSync(path.join(directory, fixture.file), 'utf8'), fixture.input)).trace;
    }
  } finally {
    if (previousBase === undefined) delete process.env.ASM_TEST_BASE_URL;
    else process.env.ASM_TEST_BASE_URL = previousBase;
  }
  const browser = await chromium.launch({ headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  for (const item of manifest.cases.filter(item => requested.includes(item.id))) {
    await t.test(item.id, async () => {
      const trace = traces[item.fixture];
      const observation = observeCase({ trace, item, manifest });
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      try {
        await page.goto(base + '/algorithm.html?asmEmbed=runtime');
        await page.waitForFunction(() => window.asmApplyTraceDocument);
        const result = await runClockProbe({ page, trace, item, observation });
        const output = path.resolve(__dirname, '../test-results/event-clock');
        fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(path.join(output, item.id + '.json'), JSON.stringify(result, null, 2));
        assert.equal(result.applicable, true);
        assert.equal(result.pass, true, JSON.stringify(result.failures, null, 2));
      } finally { await page.close(); }
    });
  }
});
