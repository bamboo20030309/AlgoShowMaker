/**
 * 測試模組：compile
 *
 * 驗證重點：compile 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const publicDir = path.join(__dirname, '../../public');
function load(c, name) { vm.runInContext(fs.readFileSync(path.join(publicDir, name), 'utf8'), c); }
async function compile(code, input = '') {
  const baseURL = process.env.ASM_TEST_BASE_URL;
  if (!baseURL) throw new Error('請設定 ASM_TEST_BASE_URL 指向隔離服務；禁止回落到使用者的 3000。');
  async function post(endpoint, body) {
    const response = await fetch(`${baseURL}${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    });
    const result = await response.json();
    assert.equal(response.ok, true, JSON.stringify(result));
    assert.ok(!result.error, result.error);
    return result;
  }
  const analysis = await post('/trace/analyze', { code });
  const watches = [...new Set(analysis.frameDirectives.flatMap(frame => frame.variableIds))];
  const result = await post('/compile', { code, input, trace: { enabled: true, watches, sliceMode: 'manual' } });
  const c = vm.createContext({ queueMicrotask() {} });
  c.window = c;
  for (const name of ['trace-view-source.js', 'trace-model.js', 'trace-rules.js', 'trace-events.js', 'trace-frame-tween.js']) load(c, name);
  const trace = c.ASMTraceModel.normalizeTraceDocument(result.traceDocument || result.trace);
  for (const frame of trace.frames) {
    const orders = Array.from(frame.events, event => event.order);
    assert.ok(orders.every(Number.isFinite));
    assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
  }
  return { trace, window: c, context: c };
}
module.exports = { compile, load };
