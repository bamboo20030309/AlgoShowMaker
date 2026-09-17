// One command; owns only its isolated server, never stops the user's server.
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const root = path.resolve(__dirname, '..');
const REGRESSION_JWT_SECRET = randomBytes(32).toString('base64url');
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
async function main() {
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
    const files = fs.readdirSync(path.join(root, 'tests')).filter(f => f.endsWith('.test.js')).map(f => 'tests/' + f);
    // Async child keeps draining server output during integration tests.
    if (!process.argv.includes('--animation-only')) await new Promise((resolve, reject) => {
      fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
      const transcript = fs.createWriteStream(path.join(root, 'test-results/regression.tap'));
      const tests = spawn(process.execPath, ['--test', '--test-concurrency=1', ...files], {
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
      tests.on('error', reject);
      tests.on('close', code => { transcript.end();
        code === 0 ? resolve() : reject(new Error('Regression tests failed; see test-results/regression.tap')); });
    });
    if (!process.argv.includes('--tests-only')) await require('./animation-browser').runAnimationBrowser(url);
    console.log(process.argv.includes('--tests-only')
      ? '單元／整合測試通過；本次未執行瀏覽器驗證。'
      : process.argv.includes('--animation-only')
        ? '實際動畫驗證通過；本次未重跑單元／整合測試。'
        : '測試與實際動畫驗證通過。額外目視驗收步驟：tests/README.md');
  } finally {
    stop();
    process.removeListener('exit', stop);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
