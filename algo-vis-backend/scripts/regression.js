/**
 * 主代理使用的完整回歸入口。
 *
 * 此命令會自行配置隨機埠與 JWT secret，啟動專用 server，再依參數執行全部
 * Node 測試及／或實際動畫驗證。它只管理自己建立的子程序，不得停止 3000、
 * 3100 或其他代理的預覽服務。
 */

const { spawn, spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const root = path.resolve(__dirname, '..');
const manifest = require('./validation-manifest');
const { captureEvidence, reconcileEvidence } = require('./validation-evidence');
const REGRESSION_JWT_SECRET = randomBytes(32).toString('base64url');
const TEST_RESULTS_DIR = path.join(root, 'test-results');
const TEST_STATE_FILE = path.join(TEST_RESULTS_DIR, 'regression-state.json');
const REGRESSION_LOCK_FILE = path.join(TEST_RESULTS_DIR, 'regression-state.lock');
const ANIMATION_PREREQUISITES = new Set(manifest.prerequisites.map(item => item.label));
const ANIMATION_CASES = manifest.animationCases.map(item => item.name);
const EXPECTED_ANIMATION_ITEMS = [...ANIMATION_PREREQUISITES, ...ANIMATION_CASES];

function now() {
  return new Date().toISOString();
}

function writeTestState(state, stateFile = TEST_STATE_FILE) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const temporary = `${stateFile}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n');
    fs.renameSync(temporary, stateFile);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function acquireRegressionLock(lockFile = REGRESSION_LOCK_FILE) {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const token = randomBytes(12).toString('hex');
  const claim = () => {
    const descriptor = fs.openSync(lockFile, 'wx');
    try {
      fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, token, startedAt: now() }) + '\n');
    } finally {
      fs.closeSync(descriptor);
    }
  };
  try {
    claim();
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let owner = null;
    try { owner = JSON.parse(fs.readFileSync(lockFile, 'utf8')); } catch {}
    if (processIsRunning(owner?.pid)) {
      throw new Error(`另一個 regression 正在執行（PID ${owner.pid}）；請等待完成後再試。`);
    }
    fs.unlinkSync(lockFile);
    claim();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      const owner = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      if (owner.token === token) fs.unlinkSync(lockFile);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  };
}

function readTestState(allFiles, { fresh = false, stateFile = TEST_STATE_FILE } = {}) {
  if (fresh || !fs.existsSync(stateFile)) {
    const startedAt = now();
    return {
      evidence: captureEvidence(root, allFiles),
      version: 1,
      cycleId: startedAt.replace(/[:.]/g, '-'),
      status: 'running',
      startedAt,
      updatedAt: startedAt,
      completedAt: null,
      testFiles: [...allFiles],
      passedFiles: [],
      failedFiles: [],
      remainingFiles: [...allFiles],
      attempts: [],
      animation: {
        status: 'pending',
        expectedItems: [...EXPECTED_ANIMATION_ITEMS],
        passedItems: [],
        failedCases: [],
        failedPrerequisites: [],
        retryAll: false,
        attempts: []
      }
    };
  }
  let state;
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (error) {
    throw new Error(`無法讀取續跑狀態 ${path.relative(root, stateFile)}：${error.message}。請用 --fresh 開始新一輪。`);
  }
  if (state.version !== 1 || !Array.isArray(state.testFiles) || !Array.isArray(state.failedFiles)) {
    throw new Error(`續跑狀態格式不相容：${path.relative(root, stateFile)}。請用 --fresh 開始新一輪。`);
  }
  const added = allFiles.filter(file => !state.testFiles.includes(file));
  state.testFiles = [...allFiles];
  for (const field of ['passedFiles', 'failedFiles', 'remainingFiles']) state[field] = (Array.isArray(state[field]) ? state[field] : []).filter(file => allFiles.includes(file));
  if (added.length) {
    state.remainingFiles = [...new Set([...state.remainingFiles, ...added])];
    state.status = 'running'; state.completedAt = null;
  }
  state.passedFiles = Array.isArray(state.passedFiles) ? state.passedFiles : [];
  state.remainingFiles = Array.isArray(state.remainingFiles) ? state.remainingFiles : [];
  state.attempts = Array.isArray(state.attempts) ? state.attempts : [];
  if (!state.animation || typeof state.animation !== 'object'
    || !Array.isArray(state.animation.expectedItems)
    ) {
    throw new Error('動畫驗證案例清單已改變；請用 --fresh 開始新一輪，避免沿用不完整的通過結果。');
  }
  const addedAnimationItems = EXPECTED_ANIMATION_ITEMS.filter(item => !state.animation.expectedItems.includes(item));
  state.animation.expectedItems = [...EXPECTED_ANIMATION_ITEMS];
  state.animation.passedItems = Array.isArray(state.animation.passedItems) ? state.animation.passedItems : [];
  state.animation.failedCases = Array.isArray(state.animation.failedCases) ? state.animation.failedCases : [];
  state.animation.failedPrerequisites = Array.isArray(state.animation.failedPrerequisites)
    ? state.animation.failedPrerequisites : [];
  state.animation.attempts = Array.isArray(state.animation.attempts) ? state.animation.attempts : [];
  state.animation.passedItems = state.animation.passedItems.filter(item => EXPECTED_ANIMATION_ITEMS.includes(item));
  state.animation.failedCases = state.animation.failedCases.filter(item => ANIMATION_CASES.includes(item));
  state.animation.failedPrerequisites = state.animation.failedPrerequisites.filter(item => ANIMATION_PREREQUISITES.has(item));
  if (addedAnimationItems.length && state.animation.status !== 'pending') {
    state.animation.status = 'failed';
    state.animation.failedCases.push(...addedAnimationItems.filter(item => !ANIMATION_PREREQUISITES.has(item)));
    state.animation.failedPrerequisites.push(...addedAnimationItems.filter(item => ANIMATION_PREREQUISITES.has(item)));
  }
  return reconcileEvidence(state, captureEvidence(root, allFiles));
}

function prepareTestState(allFiles, { fresh = false, stateFile = TEST_STATE_FILE } = {}) {
  const state = readTestState(allFiles, { fresh, stateFile });
  writeTestState(state, stateFile);
  return state;
}

function filesForAttempt(state) {
  if (state.status === 'complete') return [];
  const wanted = new Set([...state.failedFiles, ...state.remainingFiles]);
  return state.testFiles.filter(file => wanted.has(file));
}

function recordFileResult(state, file, passed) {
  state.remainingFiles = state.remainingFiles.filter(candidate => candidate !== file);
  state.failedFiles = state.failedFiles.filter(candidate => candidate !== file);
  state.passedFiles = state.passedFiles.filter(candidate => candidate !== file);
  (passed ? state.passedFiles : state.failedFiles).push(file);
  state.passedFiles.sort();
  state.failedFiles.sort();
  state.updatedAt = now();
}

function applyAnimationSummary(animation, results) {
  const failedCases = new Set();
  const failedPrerequisites = new Set();
  const passedItems = new Set(animation.passedItems || []);
  for (const result of results) {
    if (!result || typeof result.label !== 'string') continue;
    const caseMatch = result.label.match(/^(.*)-(setup|runtime)$/);
    const item = caseMatch ? caseMatch[1] : result.label;
    if (result.pass) passedItems.add(item);
    else {
      passedItems.delete(item);
      if (ANIMATION_PREREQUISITES.has(item)) failedPrerequisites.add(item);
      else failedCases.add(item);
    }
  }
  for (const item of animation.expectedItems || EXPECTED_ANIMATION_ITEMS) {
    if (passedItems.has(item)) continue;
    if (ANIMATION_PREREQUISITES.has(item)) failedPrerequisites.add(item);
    else failedCases.add(item);
  }
  animation.passedItems = [...passedItems].sort();
  animation.failedCases = [...failedCases].sort();
  animation.failedPrerequisites = [...failedPrerequisites].sort();
  animation.retryAll = false;
  animation.status = failedCases.size || failedPrerequisites.size ? 'failed' : 'complete';
  return animation;
}

function hasManualAnimationScope(environment = process.env) {
  return Object.hasOwn(environment, 'ASM_ANIMATION_CASES')
    || Object.hasOwn(environment, 'ASM_ANIMATION_PREREQUISITES');
}

async function runAnimationAttempt(baseURL, state) {
  const animation = state.animation;
  if (hasManualAnimationScope()) {
    console.log('執行手動指定的局部動畫驗證；結果不會標記完整 release 動畫輪次。');
    await require('./animation-browser').runAnimationBrowser(baseURL);
    return { scoped: true };
  }
  if (animation.status === 'complete') {
    console.log(`動畫驗證已完整通過；沿用 ${animation.passedItems.length} 項結果。`);
    return { scoped: false, reused: true };
  }
  const retrying = animation.status !== 'pending' && !animation.retryAll;
  const selectedCases = retrying ? animation.failedCases : null;
  const selectedPrerequisites = retrying ? animation.failedPrerequisites : null;
  const previousCases = process.env.ASM_ANIMATION_CASES;
  const previousPrerequisites = process.env.ASM_ANIMATION_PREREQUISITES;
  if (selectedCases) process.env.ASM_ANIMATION_CASES = selectedCases.length ? selectedCases.join(',') : 'none';
  else delete process.env.ASM_ANIMATION_CASES;
  if (selectedPrerequisites) process.env.ASM_ANIMATION_PREREQUISITES = selectedPrerequisites.length
    ? selectedPrerequisites.join(',') : 'none';
  else delete process.env.ASM_ANIMATION_PREREQUISITES;
  const attempt = {
    startedAt: now(),
    completedAt: null,
    cases: selectedCases || 'all',
    prerequisites: selectedPrerequisites || 'all',
    summary: null,
    error: null
  };
  state.updatedAt = now();
  writeTestState(state);
  let runError = null;
  let animationResult = null;
  try {
    animationResult = await require('./animation-browser').runAnimationBrowser(baseURL);
  } catch (error) {
    runError = error;
    animationResult = error.result || null;
  } finally {
    if (previousCases === undefined) delete process.env.ASM_ANIMATION_CASES;
    else process.env.ASM_ANIMATION_CASES = previousCases;
    if (previousPrerequisites === undefined) delete process.env.ASM_ANIMATION_PREREQUISITES;
    else process.env.ASM_ANIMATION_PREREQUISITES = previousPrerequisites;
  }
  if (animationResult && Array.isArray(animationResult.results) && animationResult.summary) {
    applyAnimationSummary(animation, animationResult.results);
    attempt.summary = path.relative(root, animationResult.summary).replaceAll('\\', '/');
  } else {
    animation.status = 'failed';
    animation.retryAll = true;
  }
  if (runError && animation.status === 'complete') {
    animation.status = 'failed';
    animation.retryAll = true;
  }
  attempt.completedAt = now();
  attempt.error = runError?.message || null;
  animation.attempts.push(attempt);
  state.updatedAt = attempt.completedAt;
  writeTestState(state);
  if (animation.status !== 'complete') {
    const failed = [...animation.failedPrerequisites, ...animation.failedCases];
    throw new Error(failed.length
      ? `動畫驗證失敗：${failed.join(', ')}；下次預設只續跑這些項目。`
      : `動畫驗證在產生摘要前失敗；下次將重新執行完整動畫階段。${runError ? ` ${runError.message}` : ''}`);
  }
  if (runError) throw runError;
  return { scoped: false, reused: false };
}

// -----------------------------------------------------------------------------
// 同步命令與原始碼掃描工具
// -----------------------------------------------------------------------------
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', 'vendor', '.git'].includes(entry.name)) return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : file.endsWith('.js') ? [file] : [];
  });
}

// -----------------------------------------------------------------------------
// 隔離服務生命週期與測試／動畫階段編排
// -----------------------------------------------------------------------------
async function runRegression() {
  if (process.argv.includes('--animation-only') && process.argv.includes('--tests-only')) {
    throw new Error('不能同時略過測試與動畫驗證');
  }
  for (const file of walk(root)) run(process.execPath, ['--check', file]);
  run('git', ['diff', '--check']);
  const port = await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); });
  });
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      ASM_REGRESSION: '1',
      JWT_SECRET: REGRESSION_JWT_SECRET
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let diagnostic = '';
  server.stdout.on('data', chunk => { diagnostic = (diagnostic + chunk).slice(-4000); });
  server.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk).slice(-4000); });
  const stop = () => { if (server.exitCode === null) server.kill(); };
  process.once('exit', stop);
  process.once('SIGINT', () => { stop(); process.exit(130); });
  const url = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null) throw new Error('Test server exited: ' + diagnostic);
      try { ready = (await fetch(url + '/trace-provenance.js', { signal: AbortSignal.timeout(500) })).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!ready) throw new Error('Test server did not start: ' + diagnostic);
    const files = fs.readdirSync(path.join(root, 'tests')).filter(f => f.endsWith('.test.js')).sort().map(f => 'tests/' + f);
    // Async child keeps draining server output during integration tests.
    const state = prepareTestState(files, { fresh: process.argv.includes('--fresh') });
    if (!process.argv.includes('--animation-only')) {
      const selectedFiles = filesForAttempt(state);
      if (selectedFiles.length === 0) {
        console.log(`測試輪次 ${state.cycleId} 已完整通過；沿用 ${state.passedFiles.length} 個測試檔結果。使用 --fresh 可開始新一輪。`);
      } else {
        fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
        state.status = 'running';
        state.remainingFiles = [...selectedFiles];
        state.failedFiles = state.failedFiles.filter(file => selectedFiles.includes(file));
        state.updatedAt = now();
        writeTestState(state);
        const attempt = {
          startedAt: now(),
          completedAt: null,
          files: [...selectedFiles],
          passedFiles: [],
          failedFiles: []
        };
        const transcript = fs.createWriteStream(path.join(TEST_RESULTS_DIR, 'regression.tap'));
        console.log(selectedFiles.length === files.length
          ? `開始新測試輪次 ${state.cycleId}：共 ${selectedFiles.length} 個測試檔。`
          : `續跑測試輪次 ${state.cycleId}：只執行 ${selectedFiles.length} 個未通過測試檔，沿用 ${state.passedFiles.length} 個通過結果。`);
        for (const file of selectedFiles) {
          transcript.write(`\n# test-file: ${file}\n`);
          const code = await new Promise((resolve, reject) => {
            const tests = spawn(process.execPath, ['--test', '--test-concurrency=1', file], {
              cwd: root,
              env: {
                ...process.env,
                ASM_TEST_BASE_URL: url,
                JWT_SECRET: REGRESSION_JWT_SECRET
              },
              stdio: ['ignore', 'pipe', 'pipe'],
              windowsHide: true
            });
            tests.stdout.on('data', chunk => { transcript.write(chunk); process.stdout.write(chunk); });
            tests.stderr.on('data', chunk => { transcript.write(chunk); process.stderr.write(chunk); });
            tests.once('error', reject);
            tests.once('close', resolve);
          });
          const passed = code === 0;
          recordFileResult(state, file, passed);
          (passed ? attempt.passedFiles : attempt.failedFiles).push(file);
          writeTestState(state);
        }
        attempt.completedAt = now();
        state.attempts.push(attempt);
        state.updatedAt = attempt.completedAt;
        state.remainingFiles = [];
        if (state.failedFiles.length === 0) {
          state.status = 'complete';
          state.completedAt = attempt.completedAt;
        } else {
          state.status = 'failed';
          state.completedAt = null;
        }
        writeTestState(state);
        await new Promise(resolve => transcript.end(resolve));
        if (state.failedFiles.length > 0) {
          throw new Error(`${state.failedFiles.length} 個測試檔失敗；下次預設只續跑這些檔案。詳見 test-results/regression-state.json 與 regression.tap`);
        }
      }
    }
    const animationResult = !process.argv.includes('--tests-only')
      ? await runAnimationAttempt(url, state) : null;
    console.log(process.argv.includes('--tests-only')
      ? '單元／整合測試通過；本次未執行瀏覽器驗證。'
      : animationResult.scoped
        ? '手動指定的局部動畫驗證通過；完整 release 動畫輪次未標記完成。'
      : process.argv.includes('--animation-only')
        ? '實際動畫驗證通過；本次未重跑單元／整合測試。'
        : '測試與實際動畫驗證通過。額外目視驗收步驟：tests/README.md');
  } finally {
    stop();
    process.removeListener('exit', stop);
  }
}

async function main() {
  const releaseLock = acquireRegressionLock();
  process.once('exit', releaseLock);
  try {
    await runRegression();
  } finally {
    releaseLock();
    process.removeListener('exit', releaseLock);
  }
}
if (require.main === module) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = {
  acquireRegressionLock,
  applyAnimationSummary,
  filesForAttempt,
  hasManualAnimationScope,
  prepareTestState,
  readTestState,
  recordFileResult,
  writeTestState
};
