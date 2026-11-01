'use strict';

const options = Object.fromEntries(process.argv.slice(2).map(argument => {
  const [key, ...value] = argument.replace(/^--/, '').split('=');
  return [key, value.join('=')];
}));
const baseUrl = String(options.base || '').replace(/\/$/, '');
const scenario = String(options.scenario || 'cache').toLowerCase();
const clients = Number(options.clients || (scenario === 'limits' ? 4 : 50));
const timeoutMs = Number(options.timeout || 420_000);
const rampMs = Number(options['ramp-seconds'] || 0) * 1000;
const scenarios = new Set(['cache', 'cold', 'mixed', 'isolation', 'limits']);
if (!/^https?:\/\//.test(baseUrl)) throw new Error('請使用 --base=http://127.0.0.1:3100 指定測試服務');
if (!scenarios.has(scenario)) throw new Error(`--scenario 必須是 ${[...scenarios].join('、')}`);
if (!Number.isInteger(clients) || clients < 1 || clients > 150) throw new Error('--clients 必須介於 1 到 150');
if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw new Error('--timeout 必須是正整數毫秒');
if (!Number.isFinite(rampMs) || rampMs < 0) throw new Error('--ramp-seconds 不可小於 0');

const sharedSource = `
#include <iostream>
using namespace std;
int main() {
  int value = 0;
  cin >> value;
  // @frame value
  cout << value << "\\n";
  return 0;
}
`;

function requestFor(index) {
  const marker = `ASM_LOAD_OWNER_${String(index + 1).padStart(3, '0')}_END`;
  if (scenario === 'isolation') {
    return {
      code: `#error ${marker}\nint main() { return 0; }\n`,
      input: '', trace: { enabled: false, watches: [] },
      expected: { verdict: 'CE', marker },
    };
  }
  if (scenario === 'limits') {
    const kind = ['normal', 'tle', 'ole', 'mle'][index % 4];
    const code = {
      normal: '#include <iostream>\nint main(){std::cout << "normal";}',
      tle: 'int main(){for(;;){} }',
      ole: '#include <iostream>\nint main(){for(int i=0;i<100000;i++)std::cout << "0123456789";}',
      mle: '#include <vector>\n#include <iostream>\nint main(){std::vector<char> x(400ULL*1024*1024);std::cout << x[0];}',
    }[kind];
    return { code, input: '', trace: { enabled: false, watches: [] }, expected: { verdict: {
      normal: 'OK', tle: 'TLE', ole: 'OLE', mle: 'MLE',
    }[kind], marker: kind } };
  }
  const unique = scenario === 'cold' || (scenario === 'mixed' && index % 5 === 0);
  return {
    code: unique ? sharedSource.replace('int value = 0;', `int value = 0; // cold-${index + 1}`) : sharedSource,
    input: `${index + 1}\n`,
    trace: { enabled: true, watches: [] },
    expected: { verdict: 'OK', output: String(index + 1), marker },
  };
}

function createClient() {
  let cookie = '';
  return async (url, init = {}, allowHttpError = false) => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
          ...(init.headers || {}),
        },
      });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';', 1)[0];
      const body = await response.json().catch(() => ({}));
      if (response.status === 429 && attempt < 29) {
        const retrySeconds = Math.min(2, Number(response.headers.get('retry-after')) || 0.1);
        await new Promise(resolve => setTimeout(resolve, retrySeconds * 1000));
        continue;
      }
      if (!response.ok && !allowHttpError) {
        throw new Error(`${response.status} ${body.error || JSON.stringify(body)}`);
      }
      return { status: response.status, body, headers: response.headers };
    }
    throw new Error('重試編譯 API 仍未成功');
  };
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

async function queueSnapshot() {
  const response = await fetch(`${baseUrl}/api/compile/queue`);
  if (!response.ok) throw new Error(`佇列狀態端點回應 ${response.status}`);
  return response.json();
}

async function main() {
  const initialQueue = await queueSnapshot();
  const startedAt = Date.now();
  const jobs = await Promise.all(Array.from({ length: clients }, async (_, index) => {
    if (rampMs > 0 && clients > 1) {
      await new Promise(resolve => setTimeout(resolve, Math.round(index * rampMs / (clients - 1))));
    }
    const client = createClient();
    const request = requestFor(index);
    const submittedAt = Date.now();
    const accepted = await client(`${baseUrl}/api/compile/jobs`, {
      method: 'POST',
      headers: { 'X-Compile-Purpose': index < 2 ? 'manual' : 'background' },
      body: JSON.stringify(request),
    });
    if (accepted.status !== 202) throw new Error(`工作 ${index + 1} 未被接受`);
    return { index, client, request, submittedAt, ...accepted.body };
  }));

  const pending = new Set(jobs);
  const peak = { active: 0, pending: 0, asyncRunning: 0, asyncQueued: 0 };
  while (pending.size > 0) {
    if (Date.now() - startedAt > timeoutMs) throw new Error(`${pending.size} 個工作在 ${timeoutMs}ms 後仍未完成`);
    const queue = await queueSnapshot();
    peak.active = Math.max(peak.active, queue.active || 0);
    peak.pending = Math.max(peak.pending, queue.pending || 0);
    peak.asyncRunning = Math.max(peak.asyncRunning, queue.asyncJobs?.running || 0);
    peak.asyncQueued = Math.max(peak.asyncQueued, queue.asyncJobs?.queued || 0);
    await Promise.all([...pending].map(async (job) => {
      const response = await job.client(`${baseUrl}${job.statusUrl}`);
      const status = response.body;
      if (status.state === 'failed' || status.state === 'cancelled') throw new Error(JSON.stringify(status));
      job.maxQueuePosition = Math.max(job.maxQueuePosition || 0, status.queuePosition || 0);
      if (status.state === 'completed') {
        job.completedAt = Date.now();
        pending.delete(job);
      }
    }));
    if (pending.size > 0) await new Promise(resolve => setTimeout(resolve, 100));
  }

  const results = await Promise.all(jobs.map(async (job) => {
    const response = await job.client(`${baseUrl}${job.resultUrl}`, {}, scenario === 'isolation');
    const result = response.body;
    const expected = job.request.expected;
    if (result.verdict !== expected.verdict) {
      throw new Error(`工作 ${job.index + 1} 預期 ${expected.verdict}，實際 ${result.verdict}: ${result.error || ''}`);
    }
    if (expected.output !== undefined && result.output?.trim() !== expected.output) {
      throw new Error(`工作 ${job.index + 1} 回傳錯誤輸出`);
    }
    if (scenario === 'isolation') {
      const text = `${result.error || ''}\n${(result.debug_log || []).map(item => JSON.stringify(item)).join('\n')}`;
      if (!text.includes(expected.marker)) throw new Error(`工作 ${job.index + 1} 缺少自己的錯誤標記`);
      const foreign = jobs.find(other => other !== job && text.includes(other.request.expected.marker));
      if (foreign) throw new Error(`工作 ${job.index + 1} 混入工作 ${foreign.index + 1} 的訊息`);
    }
    return { verdict: result.verdict, status: response.status };
  }));
  const endedAt = Date.now();
  const finalQueue = await queueSnapshot();
  if (finalQueue.active !== 0 || finalQueue.pending !== 0
      || finalQueue.asyncJobs?.running !== 0 || finalQueue.asyncJobs?.queued !== 0) {
    throw new Error('測試完成後佇列沒有排空');
  }
  const durations = jobs.map(job => job.completedAt - job.submittedAt);
  const verdicts = results.reduce((counts, item) => {
    counts[item.verdict] = (counts[item.verdict] || 0) + 1;
    return counts;
  }, {});
  process.stdout.write(`${JSON.stringify({
    scenario, clients, completed: jobs.length, verdicts,
    elapsedMs: endedAt - startedAt,
    jobsPerSecond: +(jobs.length / ((endedAt - startedAt) / 1000)).toFixed(2),
    latencyMs: {
      min: Math.min(...durations), p50: percentile(durations, 0.5),
      p95: percentile(durations, 0.95), max: Math.max(...durations),
    },
    maxQueuePosition: Math.max(...jobs.map(job => job.maxQueuePosition || 0)),
    peak,
    configuration: {
      compileConcurrency: initialQueue.concurrency,
      asyncDispatchConcurrency: initialQueue.asyncJobs?.queue?.concurrency,
      traceAnalysisWorkers: initialQueue.traceAnalysis?.workers,
    },
    finalQueue,
  }, null, 2)}\n`);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
