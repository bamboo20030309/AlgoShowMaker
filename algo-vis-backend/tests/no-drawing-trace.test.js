const { test } = require('node:test');
const assert = require('node:assert/strict');
const { instrumentSource } = require('../trace-instrumenter');
const { chromium } = require('playwright');

const plain = '#include <iostream>\nint main(){ int n=5; n++; std::cout << n; }';
const settings = '\n/* @asm-view\n{"version":1,"rules":[],"skins":{},"studio":{"eventSettings":{"autoFixedEnabled":true}}}\n@asm-view */';

test('no drawing comments means untouched source and no event/animation metadata', () => {
  for (const code of [plain, plain + settings,
    plain.replace('n++;', 'const char* text="// @frame n"; n++;'),
    plain.replace('n++;', '// @let t = 2\n// @code hide\nn++;\n// @code show\n')]) {
    const result = instrumentSource(code, ['main:n']);
    assert.equal(result.code, code);
    assert.equal(result.drawingEnabled, false);
    for (const key of ['variables', 'frameDirectives', 'keepDirectives', 'layoutDirectives', 'branchDirectives', 'sourceDeclarations', 'sourceStructure']) assert.deepEqual(result[key], []);
    assert.deepEqual(result.eventSources, {});
  }
});

test('an actual frame still enables existing trace instrumentation', () => {
  const result = instrumentSource(plain.replace('n++;', 'n++;\n// @frame n\n'));
  assert.equal(result.drawingEnabled, true);
  assert.match(result.code, /ASMTrace.hpp/);
  assert.equal(result.frameDirectives.length, 1);
});

test('plain RUN ignores requested watches/settings and frontend disables trace config', { timeout: 45000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'use isolated test service');
  const post = async (path, body) => {
    const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    assert.equal(response.ok, true, JSON.stringify(data));
    return data;
  };
  const code = plain + settings;
  const analysis = await post('/trace/analyze', { code });
  assert.equal(analysis.drawingEnabled, false);
  assert.deepEqual(analysis.variables, []);
  const compiled = await post('/compile', { code, trace: { enabled: true, watches: ['main:n'], sliceMode: 'auto' } });
  assert.equal(compiled.error, '');
  assert.equal(compiled.output.trim(), '6');
  assert.equal(compiled.traceDocument, null);
  assert.equal(compiled.scriptContent, '');
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/algorithm.html');
    const config = await page.evaluate(code => ASMTraceEditor.getCompileConfig(code), code);
    assert.equal(config.enabled, false);
    assert.deepEqual(config.watches, []);
    assert.deepEqual(config.skins, {});
    const enabled = await page.evaluate(code => ASMTraceEditor.getCompileConfig(code), plain.replace('n++;', 'n++;\n// @frame n\n'));
    assert.equal(enabled.enabled, true);
    assert.ok(enabled.watches.length);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
