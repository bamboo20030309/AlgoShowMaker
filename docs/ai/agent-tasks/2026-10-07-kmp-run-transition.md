# KMP 連續 Run 與舊動畫清理

- 分支：intergration；基準 cda1219。未發布或合併 main。
- 使用者案例：同頁先移除 KMP 繪圖指令 Run，再加回指令 Run，認為持續使用舊編譯結果。
- 重現：獨立服務、獨立 Edge 頁面，不操作使用者頁面。原本無指令 Run 輸出正確且沒有 Trace，但 UI 仍保留預設線篩的 116 幀。
- 未重現：加回完整 KMP 指令後不啟用追蹤。這個操作原本就能產生 34 幀；不能把所有使用者現象都歸因於已確認的清理問題。

## 修改

- 無動畫的編譯結果清除播放器文件、SVG、箭頭、播放排程、程式碼呈現面板與影格導覽，編輯器快照也移除舊 Trace。
- 向嵌入投影片送出本次一般執行結果，避免繼續匯出舊動畫。
- 回傳 Trace 若明確帶有不同原始碼，拒絕套用並清理舊場景、顯示錯誤；缺少原始碼的既有回傳仍沿用本次來源補值。
- 執行檔快取仍保留。快取鍵原本包含編譯來源、編譯旗標及引擎；沒有證據顯示不同 KMP 程式碼錯誤命中同一執行檔。
- algorithm.html 更新 compile syntax-10、player trace-29、editor trace-32。

## 驗證

- `node --test tests/no-drawing-transition.browser.test.js tests/entrypoints.test.js`：2 pass / 0 fail。
- 同頁預設動畫 → 無指令 KMP → 完整指令 KMP → 修改來源 KMP → 無指令 KMP，不重新整理。
- ababaca 的獨立答案為 `0 0 1 2 3 0 1`；aaaa 的答案為 `0 1 2 3`。
- 無指令時 player / editor snapshot 均沒有 Trace，0 幀、0 SVG Trace 根節點、0 影格條碼；下一步／上一步／reset 不復活旧動畫。
- 完整指令 34 幀，UI Trace 原始碼與當次送出原始碼完全相同；修改來源後 executableId 不同。
- 注入不同來源的 Trace 回傳，確認拒絕套用、清空舊動畫且出現明確錯誤。沒有放寬答案。
- JavaScript 語法及 git diff --check 通過；瀏覽器 pageerror 為空。
- 第一次隔離服務啟動逾時，未執行案例；重試與正式測試均成功。測試暫存位於被忽略的 test-results，不提交。
- 驗證範圍為 Run 的來源隔離及播放文件清理；沒有執行大型演算法驗證，也未聲稱已核實使用者現存瀏覽器的完整狀態。
