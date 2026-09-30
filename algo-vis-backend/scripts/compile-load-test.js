'use strict';

const options = Object.fromEntries(process.argv.slice(2).map(argument => {
  const [key, ...value] = argument.replace(/^--/, '').split('=');
  return [key, value.join('=')];
}));
const baseUrl = String(options.base || '').replace(/\/$/, '');
const clients = Number(options.clients || 50);
const timeoutMs = Number(options.timeout || 120_000);
if (!/^https?:\/\//.test(baseUrl)) throw new Error('請使用 --base=http://127.0.0.1:3100 指定測試服務');
if (!Number.isInteger(clients) || clients < 1 || clients > 150) throw new Error('--clients 必須介於 1 到 150');

const source = `
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

function createClient() {
  let cookie = '';
  return async (url, init = {}) => {
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
      if (!response.ok) throw new Error(`${response.status} ${body.error || JSON.stringify(body)}`);
      return body;
    }
    throw new Error('重試編譯 API 仍未成功');
  };
}

async function main() {
  const startedAt = Date.now();
  const jobs = await Promise.all(Array.from({ length: clients }, async (_, index) => {
    const client = createClient();
    const accepted = await client(`${baseUrl}/api/compile/jobs`, {
      method: 'POST',
      body: JSON.stringify({
        code: source,
        input: `${index + 1}\n`,
        trace: { enabled: true, watches: [] },
      }),
    });
    return { index, client, ...accepted };
  }));

  const pending = new Set(jobs);
  while (pending.size > 0) {
    if (Date.now() - startedAt > timeoutMs) throw new Error(`${pending.size} 個工作在 ${timeoutMs}ms 後仍未完成`);
    await Promise.all([...pending].map(async (job) => {
      const status = await job.client(`${baseUrl}${job.statusUrl}`);
      if (status.state === 'failed' || status.state === 'cancelled') throw new Error(JSON.stringify(status));
      if (status.state === 'completed') pending.delete(job);
    }));
    if (pending.size > 0) await new Promise(resolve => setTimeout(resolve, 100));
  }

  const completedAt = Date.now();
  await Promise.all(jobs.map(async (job) => {
    const result = await job.client(`${baseUrl}${job.resultUrl}`);
    if (result.output.trim() !== String(job.index + 1)) throw new Error(`工作 ${job.index + 1} 回傳錯誤輸出`);
  }));
  const queue = await fetch(`${baseUrl}/api/compile/queue`).then(response => response.json());
  process.stdout.write(`${JSON.stringify({
    clients,
    completed: jobs.length,
    elapsedMs: completedAt - startedAt,
    requestsPerSecond: +(jobs.length / ((completedAt - startedAt) / 1000)).toFixed(2),
    queue,
  }, null, 2)}\n`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
