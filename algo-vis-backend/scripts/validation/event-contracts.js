#!/usr/bin/env node
'use strict';
// This runner consumes hand-authored answers. It never accepts the renderer's
// own output as an expected value and never updates the answer manifest.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const vm = require('node:vm');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('../../tests/helpers/isolated-server');
const { loadManifest, locateCase } = require('../../tests/helpers/event-contract-oracle');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'test-results/event-contracts');
const args = process.argv.slice(2), option = name => args[args.indexOf(name) + 1];
const hash = files => {
  const h = crypto.createHash('sha256');
  for (const file of files) { h.update(file); h.update(fs.readFileSync(path.join(root, file))); }
  return h.digest('hex');
};
function sourceFiles(directory, pattern) {
  const files=[];
  for(const entry of fs.readdirSync(path.join(root,directory),{withFileTypes:true})) {
    const relative=directory+'/'+entry.name;
    if(entry.isDirectory()) files.push(...sourceFiles(relative,pattern));
    else if(entry.isFile()&&pattern.test(entry.name)) files.push(relative);
  }
  return files.sort();
}
function normalize(raw) {
  const c = vm.createContext({ queueMicrotask() {}, console }); c.window = c;
  for (const name of ['trace-view-source.js', 'trace-model.js', 'trace-rules.js', 'trace-events.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'public', name), 'utf8'), c);
  }
  return JSON.parse(JSON.stringify(c.ASMTraceModel.normalizeTraceDocument(raw)));
}
async function main() {
  const manifest = loadManifest();
  if (args.includes('--list')) {
    for (const item of manifest.cases) console.log(`${item.id}\t${item.fixture}\t${item.expression || item.assertionKind}`);
    return;
  }
  if (!['--all', '--failed', '--case', '--group'].some(flag => args.includes(flag))) {
    console.log('用法：node scripts/validation/event-contracts.js --list | --case E03 | --group assignment | --all | --failed\n可加 --data-only、--fresh；只使用獨立服務與瀏覽器。'); return;
  }
  fs.mkdirSync(path.join(output, 'traces'), { recursive: true });
  const recordPath = path.join(output, 'records.json');
  const previous = fs.existsSync(recordPath) ? JSON.parse(fs.readFileSync(recordPath)) : {};
  const manifestHash = hash(['tests/fixtures/event-contracts/manifest.json',
    'tests/helpers/event-contract-observe.js', 'tests/helpers/event-contract-oracle.js',
    ...manifest.fixtures.map(f => 'tests/fixtures/event-contracts/' + f.file)]);
  const compilerHash = hash([...fs.readdirSync(root).filter(name=>name.endsWith('.js')).sort(),
    ...sourceFiles('lib',/\.(?:hpp|h|cpp)$/),'package-lock.json',
    'public/source-normalization.js','public/trace-provenance.js','public/trace-view-source.js',
    'public/trace-model.js', 'public/trace-rules.js','public/trace-events.js']);
  const visualHash = hash([...sourceFiles('public',/\.(?:js|css|html)$/),
    'tests/helpers/event-contract-visual.js', 'tests/helpers/event-contract-controls.js',
    'tests/helpers/event-contract-clock.js']);
  const dataOnly = args.includes('--data-only'), fresh = args.includes('--fresh');
  let cases = manifest.cases.filter(item => !args.includes('--case') || option('--case').split(',').includes(item.id));
  if(args.includes('--case')) for(const id of option('--case').split(',')) {
    if(!manifest.cases.some(c=>c.id===id))throw Error('找不到事件案例：'+id);
  }
  if(args.includes('--group')&&!manifest.fixtures.some(f=>f.id===option('--group')))throw Error('找不到事件分組：'+option('--group'));
  if (args.includes('--group')) cases = cases.filter(item => item.fixture === option('--group'));
  if (args.includes('--failed')) cases = cases.filter(item => !previous[item.id]?.pass
    || previous[item.id].compilerHash !== compilerHash || (!dataOnly && previous[item.id].visualHash !== visualHash)
      || previous[item.id].manifestHash !== manifestHash || (!dataOnly && !previous[item.id].visual?.pass));
  if (!cases.length) { console.log('沒有需要續跑的案例。'); return; }
  const cleanups = [], traces = {}, compileResults = {}, results = [];
  let browser;
  try {
    const { base } = await startIsolatedServer({ after: fn => cleanups.push(fn) });
    async function post(url, body) {
      const r = await fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
      const result = await r.json();
      if (!r.ok) throw Error(`${url} HTTP ${r.status}: ${result.error || JSON.stringify(result)}`);
      return result;
    }
    const needed = new Set(cases.map(item => item.fixture));
    if (cases.some(item => item.assertionKind === 'control')) { needed.add('assignment'); needed.add('visibility'); }
    for (const fixture of manifest.fixtures.filter(f => needed.has(f.id))) {
      const code = locateCase(manifest, manifest.cases.find(c => c.fixture === fixture.id)).code;
      const key = crypto.createHash('sha256').update(compilerHash + code + fixture.input).digest('hex');
      const cache = path.join(output, 'traces', fixture.id + '-' + key + '.json');
      let compiled;
      if (!fresh && fs.existsSync(cache)) compiled = JSON.parse(fs.readFileSync(cache));
      else {
        const analysis = await post('/trace/analyze', { code });
        const watches = [...new Set((analysis.frameDirectives || []).flatMap(f => f.variableIds || []))];
        try {
          compiled = await post('/compile', { code, input: fixture.input, forceRecompile: true,
            trace: { enabled: true, watches, sliceMode: 'manual' } });
        } catch (error) { compiled = { error: error.message, verdict: 'CE' }; }
        fs.writeFileSync(cache, JSON.stringify(compiled));
      }
      const trace = compiled.traceDocument || compiled.trace;
      compileResults[fixture.id] = compiled;
      if (trace?.frames?.length) {
        traces[fixture.id] = normalize(trace);
        fs.writeFileSync(path.join(output, 'traces', fixture.id + '.json'), JSON.stringify(traces[fixture.id]));
      }
      console.log('RUN ' + fixture.id + ': ' + (trace?.frames?.length || 0) + ' frames' + (compiled.error ? ' ERROR' : ''));
    }
    const { observeCase } = require('../../tests/helpers/event-contract-observe');
    if (!dataOnly) browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    for (const item of cases) {
      const started = Date.now(), key = item.id;
      if (!fresh && previous[key]?.pass && previous[key].compilerHash === compilerHash
        && previous[key].manifestHash === manifestHash && (dataOnly || previous[key].visualHash === visualHash && previous[key].visual?.pass)) {
        results.push({ ...previous[key], reused: true }); console.log('REUSE ' + key); continue;
      }
      const result = { id: key, fixture: item.fixture, compilerHash, visualHash, manifestHash,
        data: null, visual: null, clock: null, pass: false, reused: false };
      try {
        const compiled = compileResults[item.fixture];
        const stdout = String(compiled.output ?? compiled.stdout ?? '').replace(/\r\n?/g, '\n');
        const fixture = manifest.fixtures.find(f => f.id === item.fixture);
        if (compiled.error || compiled.verdict && !['OK', 'AC'].includes(compiled.verdict)) {
          throw Error(`RUN ${compiled.verdict || ''}: ${compiled.error || '執行失敗'}`);
        }
        if (stdout !== fixture.stdout) throw Error('stdout 不符合固定答案: ' + JSON.stringify({ expected: fixture.stdout, actual: stdout }));
        const dataItem = item.assertionKind === 'control'
          ? manifest.cases.find(c => c.id === item.eventSpec.marker) : item;
        const dataFixture = dataItem.fixture;
        const observation = observeCase({ trace: traces[dataFixture], item: dataItem, manifest,
          compileOutput: compileResults[dataFixture] });
        result.data = observation.data; result.actual = observation.actual;
        if (!dataOnly) {
          const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
          try {
            await page.goto(base + '/algorithm.html?asmEmbed=runtime');
            await page.waitForFunction(() => window.asmApplyTraceDocument && window.ASMTraceFrameTween?.eventActionPlan);
            await page.addScriptTag({ url: base + '/slides-storage.js' });
            await page.addScriptTag({ url: base + '/slide-trace-store.js' });
            if (item.assertionKind === 'control') {
              const { runControlCase } = require('../../tests/helpers/event-contract-controls');
              result.visual = await runControlCase({ page, trace: traces[item.fixture], item, manifest, allTraces: traces });
            } else {
              const { runVisualCase } = require('../../tests/helpers/event-contract-visual');
              result.visual = await runVisualCase({ page, trace: traces[item.fixture], item, observation, manifest });
              const { runClockProbe } = require('../../tests/helpers/event-contract-clock');
              result.clock = await runClockProbe({ page, trace: traces[item.fixture], item, observation });
            }
            if (!result.visual.pass) await page.screenshot({ path: path.join(output, key + '-failed.png') });
          } finally { await page.close(); }
        }
        result.pass = result.data.pass && (dataOnly || result.visual?.pass === true
          && (result.clock?.applicable !== true || result.clock.pass === true));
      } catch (error) { result.error = error.stack || error.message; }
      result.ms = Date.now() - started;
      previous[key] = result; results.push(result);
      fs.writeFileSync(recordPath, JSON.stringify(previous, null, 2));
      console.log((result.pass ? 'PASS ' : 'FAIL ') + key + (result.error ? ': ' + result.error.split('\n')[0] : ''));
      if (!result.pass) for (const failure of [...(result.data?.failures || []), ...(result.visual?.failures || []),
        ...(result.clock?.failures || [])].slice(0, 3)) console.log('  ' + JSON.stringify(failure).slice(0, 500));
    }
  } finally {
    await browser?.close(); for (const cleanup of cleanups.reverse()) await cleanup();
    const summary = { generatedAt: new Date().toISOString(), mode: dataOnly ? 'data' : 'data+visual',
      selected: cases.map(c => c.id), pass: results.length === cases.length && results.every(r => r.pass),
      counts: { selected: cases.length, passed: results.filter(r=>r.pass).length,
        dataPassed: results.filter(r=>r.data?.pass).length, visualPassed: results.filter(r=>r.visual?.pass).length,
        clockCases: results.filter(r=>r.clock?.applicable).length, clockPassed: results.filter(r=>r.clock?.pass).length,
        reused: results.filter(r=>r.reused).length }, results };
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
    if (!summary.pass) process.exitCode = 1;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
