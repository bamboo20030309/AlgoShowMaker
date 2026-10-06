const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const source = path.join(__dirname, 'queens-teaching-benchmark.cpp');
const executable = path.join(os.tmpdir(), `algoshowmaker-queens-benchmark-${process.pid}.exe`);
const reportPath = path.join(root, 'docs', 'benchmarks', 'eight-queens-5s.json');

function run(command, args, timeout = 30000) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, timeout });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `${command} exited ${result.status}`);
  return result.stdout.trim();
}

function measure(method, n) {
  const output = run(executable, [method, String(n)], 8000);
  const result = JSON.parse(output);
  console.log(`${method} N=${n}: ${result.complete ? `${result.seconds.toFixed(3)}s` : '>5s'}`);
  return result;
}

try {
  const compilerVersion = run('g++', ['--version']).split(/\r?\n/)[0];
  run('g++', ['-O2', '-std=c++11', source, '-o', executable]);
  const summaries = [];
  const runs = [];
  for (const method of ['loop', 'array', 'bits']) {
    let completed = null;
    for (let n = 4; n <= 20; n++) {
      const result = measure(method, n);
      runs.push(result);
      if (!result.complete || result.seconds > 5) {
        if (!completed) throw new Error(`${method} 沒有在 5 秒內完成的 N`);
        const repeats = [completed];
        while (repeats.length < 3) repeats.push(measure(method, completed.n));
        const times = repeats.map(item => item.seconds).sort((a, b) => a - b);
        summaries.push({
          method, n: completed.n, seconds: times[1], solutions: completed.solutions,
          nextN: n, repeats: times
        });
        break;
      }
      completed = result;
    }
  }
  const report = {
    generatedAt: new Date().toISOString(), cpu: os.cpus()[0]?.model || 'unknown',
    logicalCores: os.cpus().length, compiler: compilerVersion,
    flags: '-O2 -std=c++11', limitSeconds: 5,
    protocol: '單執行緒、計算全部解、不使用對稱剪枝；邊界 N 重跑三次取中位數。計時不包含編譯、Trace、繪圖與 I/O。',
    summaries, runs
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`report: ${reportPath}`);
} finally {
  fs.rmSync(executable, { force: true });
}
