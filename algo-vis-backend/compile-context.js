/**
 * 編譯請求的非同步執行環境。
 *
 * `/compile` 會經過多層 child_process、timer 與 Promise 回呼。若使用模組層級
 * 陣列保存除錯訊息，平行請求會互相重設或寫入對方的紀錄。AsyncLocalStorage
 * 讓同一請求衍生的非同步工作共用自己的 context，同時維持既有 debug_log
 * 陣列格式。
 */
const { AsyncLocalStorage } = require('node:async_hooks');

const compileContextStorage = new AsyncLocalStorage();

/**
 * 在獨立的編譯環境內執行工作。
 *
 * @template T
 * @param {(context: { debugMessages: Array<object> }) => T} callback
 * @returns {T}
 */
function runWithCompileContext(callback) {
  const context = { debugMessages: [] };
  return compileContextStorage.run(context, () => callback(context));
}

/**
 * 取得目前編譯請求的除錯紀錄。
 *
 * 正常情況下只會在 runWithCompileContext 內呼叫。回傳空陣列的 fallback 讓
 * 非編譯路徑誤用時不會把紀錄存進可跨請求共用的狀態。
 */
function getCompileDebugMessages() {
  return compileContextStorage.getStore()?.debugMessages || [];
}

/**
 * 將訊息加入目前編譯請求，保留既有 `{ time, msg, ...extra }` 格式。
 */
function logCompileDebug(msg, extra = {}) {
  const context = compileContextStorage.getStore();
  if (!context) return false;

  context.debugMessages.push({
    time: new Date().toISOString(),
    msg,
    ...extra,
  });
  return true;
}

module.exports = {
  getCompileDebugMessages,
  logCompileDebug,
  runWithCompileContext,
};
