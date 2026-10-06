'use strict';
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs'), os = require('node:os'), net = require('node:net'), path = require('node:path');
const root = path.resolve(__dirname, '../..');

// Each test owns its port, temporary executions and disposable artifact cache.
async function startIsolatedServer(t, environment = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'asm-isolated-'));
  if (process.platform !== 'win32') fs.chmodSync(directory, 0o755);
  const port = await new Promise((resolve, reject) => {
    const probe = net.createServer(); probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => { const value = probe.address().port; probe.close(error => error ? reject(error) : resolve(value)); });
  });
  const logs = [];
  const child = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true,
    env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex'),
      ASM_TEMP_DIR: path.join(directory, 'executions'), ARTIFACT_CACHE_DIR: path.join(directory, 'artifacts'), ...environment },
    stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => logs.push(chunk.toString())); child.stderr.on('data', chunk => logs.push(chunk.toString()));
  const exit = new Promise(resolve => child.once('exit', resolve));
  t.after(async () => {
    if (child.exitCode === null) { child.kill(); await exit; }
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
  });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`隔離服務結束：${logs.join('')}`);
    try { if ((await fetch(base)).ok) return { base, child, directory, logs }; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`隔離服務未就緒：${logs.join('')}`);
}
module.exports = { startIsolatedServer };
