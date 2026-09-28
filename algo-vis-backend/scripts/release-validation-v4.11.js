/**
 * v4.11 發布候選增量驗證。
 *
 * 上一輪完整 regression 已保存於 test-results/regression-state.json；本入口只涵蓋
 * 之後加入的效能、相容性與右鍵畫布互動。每個測試檔獨立記錄，修正後再次執行
 * 只會重跑失敗或尚未完成的檔案。使用 --fresh 可明確開始全新的 v4.11 候選輪次。
 */

const { spawn, spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const resultsDir = path.join(root, 'test-results');
const stateFile = path.join(resultsDir, 'release-v4.11-state.json');
const definition = 'v4.11-performance-rc1';
const fresh = process.argv.includes('--fresh');

const syntaxFiles = [
  'server.js',
  'trace-chunk-store.js',
  'public/canva.js',
  'public/compile.js',
  'public/draw/draw_array_utils.js',
  'public/draw/draw_block.js',
  'public/trace-editor.js',
  'public/trace-events.js',
  'public/trace-frame-tween.js',
  'public/trace-renderer.js',
  'public/trace-rules.js',
  'public/trace-structure-lod.js',
  'public/trace-studio.js',
  'scripts/release-validation-v4.11.js'
];

const testFiles = [
  'tests/entrypoints.test.js',
  'tests/event-defaults.test.js',
  'tests/matrix-renderer.test.js',
  'tests/trace-chunk-store.test.js',
  'tests/scene-load-performance.browser.test.js',
  'tests/trace-chunks.browser.test.js',
  'tests/presentation-camera.browser.test.js'
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: options.env || process.env,
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  return result;
}

function writeState(state) {
  fs.mkdirSync(resultsDir, { recursive: true });
  const temporary = `${stateFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(temporary, stateFile);
}

function newState() {
  return {
    definition,
    status: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    testFiles: [...testFiles],
    passedFiles: [],
    failedFiles: [],
    results: {}
  };
}

function readState() {
  if (fresh || !fs.existsSync(stateFile)) return newState();
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (state.definition !== definition
    || JSON.stringify(state.testFiles) !== JSON.stringify(testFiles)) {
    throw new Error('v4.11 驗證集定義已改變，請使用 npm run validate:release-v4.11:fresh。');
  }
  return state;
}

function countTests(output) {
  const matches = [...String(output).matchAll(/^# tests (\d+)$/gm)];
  return matches.length ? Number(matches.at(-1)[1]) : null;
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(baseURL, processRef, output) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (processRef.exitCode != null) {
      throw new Error(`隔離服務提前結束。\n${output.join('')}`);
    }
    try {
      const response = await fetch(`${baseURL}/algorithm.html`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`隔離服務未在期限內就緒。\n${output.join('')}`);
}

async function main() {
  for (const file of syntaxFiles) {
    const checked = run(process.execPath, ['--check', file]);
    if (checked.status !== 0) throw new Error(`${file} 語法檢查失敗。`);
  }
  const whitespace = run('git', ['diff', '--check']);
  if (whitespace.status !== 0) throw new Error('git diff --check 失敗。');

  const state = readState();
  if (fresh || !fs.existsSync(stateFile)) writeState(state);
  const pending = testFiles.filter(file => !state.passedFiles.includes(file));
  if (!pending.length) {
    console.log(`v4.11 增量驗證已完成；沿用 ${state.passedFiles.length} 個通過檔案。`);
    return;
  }

  const port = await availablePort();
  const baseURL = `http://127.0.0.1:${port}`;
  const serverOutput = [];
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      ASM_REGRESSION: '1',
      JWT_SECRET: randomBytes(32).toString('hex')
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', chunk => serverOutput.push(chunk.toString()));
  server.stderr.on('data', chunk => serverOutput.push(chunk.toString()));

  try {
    await waitForServer(baseURL, server, serverOutput);
    const testEnv = { ...process.env, ASM_TEST_BASE_URL: baseURL };
    for (const file of pending) {
      console.log(`\n[v4.11] ${file}`);
      const startedAt = new Date().toISOString();
      const result = run(process.execPath, ['--test', '--test-concurrency=1', file], { env: testEnv });
      const passed = result.status === 0;
      state.results[file] = {
        passed,
        tests: countTests(result.stdout),
        startedAt,
        completedAt: new Date().toISOString()
      };
      state.passedFiles = state.passedFiles.filter(item => item !== file);
      state.failedFiles = state.failedFiles.filter(item => item !== file);
      (passed ? state.passedFiles : state.failedFiles).push(file);
      state.passedFiles.sort();
      state.failedFiles.sort();
      writeState(state);
    }
  } finally {
    server.kill();
  }

  if (state.failedFiles.length) {
    state.status = 'failed';
    writeState(state);
    throw new Error(`v4.11 驗證失敗：${state.failedFiles.join(', ')}。下次只會重跑失敗檔案。`);
  }
  state.status = 'complete';
  state.completedAt = new Date().toISOString();
  writeState(state);
  const testCount = Object.values(state.results).reduce((sum, item) => sum + (item.tests || 0), 0);
  console.log(`\nv4.11 增量驗證通過：${state.passedFiles.length} 個檔案，${testCount} 個測試，0 失敗。`);
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
