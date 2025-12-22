// compile.js
// 前端：送 code ＋ input 給 /compile，並更新「輸出」與「debug log」

document.getElementById('runBtn').addEventListener('click', async () => {
  const out     = document.getElementById('outputArea');
  const dbg     = document.getElementById('debugArea');
  const inputEl = document.getElementById('inputArea');

  if (out) out.textContent = '編譯執行中⋯⋯';
  if (dbg) dbg.textContent = '等待 debug 訊息⋯⋯';

  // ✅ TLE 門檻（以後端實際執行時間為準）
  const TLE_MS = 5000;

  try {
    const t0 = performance.now();

    const res = await fetch('/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: aceEditor.getValue(),              // 保留原本欄位名 code
        input: inputEl ? inputEl.value : ''      // stdin
      })
    });

    const t1 = performance.now();
    const totalMs = (t1 - t0).toFixed(1);

    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      if (out) out.textContent = '伺服器回傳格式錯誤（非 JSON）';
      if (dbg) dbg.textContent = '無法解析伺服器回傳的 JSON。';
      throw e;
    }

    const compileTime = data.compileTime;
    const runTime     = data.runTime;
    const memoryKB    = data.memoryKB;
    const debug_log   = data.debug_log;

    // ✅ 唯一的 TLE 判斷來源
    const isTLE =
      (data && data.tle === true) ||
      (typeof runTime === 'number' && runTime > TLE_MS);

    // === 顯示輸出 ===
    if (res.ok) {
      if (isTLE) {
        if (out) {
          out.textContent =
            `執行失敗：Time Limit Exceeded（執行時間 ${runTime} ms，限制 ${TLE_MS} ms）`;
        }
      } else {
        const text = (data.output || '').toString();
        if (out) {
          out.textContent = text.trim() === '' ? '(程式沒有任何輸出)' : text;
        }
      }
    } else {
      const errMsg = data.error || `HTTP ${res.status}`;
      if (out) out.textContent = '執行失敗：\n' + errMsg;
    }

    // === 顯示 debug log ===
    if (dbg) {
      let header = '=== 編譯 / 執行統計資訊 ===\n';
      if (compileTime !== undefined && compileTime !== null) {
        header += `編譯時間：${compileTime} ms\n`;
      }
      if (runTime !== undefined && runTime !== null) {
        header += `執行時間：${runTime} ms\n`;
      }
      if (memoryKB !== undefined && memoryKB !== null) {
        header += `記憶體使用：${memoryKB} KB\n`;
      }
      header += `前端整體耗時（含請求）：約 ${totalMs} ms\n`;

      if (isTLE) {
        header += `\n⚠ 判定：TLE（以後端執行時間為準，門檻 ${TLE_MS} ms）\n`;
      }

      header += '\n';
      dbg.textContent = header;

      if (Array.isArray(debug_log) && debug_log.length > 0) {
        dbg.textContent += '=== Debug Log ===\n';
        debug_log.forEach(entry => {
          const time = entry.time || '';
          const msg  = entry.msg  || '';
          dbg.textContent += `[${time}] ${msg}\n`;
        });
      } else {
        dbg.textContent += '（沒有收到任何 debug 訊息）';
      }
    }

  } catch (err) {
    console.log(err);
    if (out) out.textContent = 'Request 失敗：\n' + err;
    if (dbg) dbg.textContent = 'Request 失敗，請確認伺服器是否有啟動。';
  }

  // 執行完自動切到「輸出」分頁
  const btn = document.querySelector(
    '.tab-btn[data-tab="tab-output"]:not([style*="display: none"])'
  );
  if (btn) activateTab(btn);

  // 重載動畫（重新載入 public/code_script.js）
  if (window.reloadAfterRun)
    window.reloadAfterRun();
  else
    reloadCodeScript();
});
