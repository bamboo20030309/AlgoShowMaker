# Studio 可見縮圖載入交付
## 交付資訊
- 狀態：小驗證通過，待主代理核實
- 分支：codex/2026-09-22-gamma
- 基準：1b0537ab55431f2c0b004eb3bb7848a05d0bfc61
- 程式提交：7d2877f03f25ef5316def73d41e579e320e0cc0e
- 日期：2026-09-28
- 驗證程式與此提交一致；交付文件另行提交。

## 根因與修改
原本只有 SVG culling，所有幀仍建立按鈕卡片 DOM。open 另在顯示前以隱藏 SVG 掃過全部幀檢查事件。
現在卡片也虛擬化，只建立視窗及前後各一張緩衝；其餘由上下 spacer 保留捲動距離。離屏卡片移除，SVG 沿用 24 筆上限快取與逐張排程。
開啟及切幀只檢查目前幀，必要時繪製前一幀提供退場目標；完整 preflight 函式仍保留給明確呼叫方。

## 驗收及小驗證
執行目錄：gamma worktree 的 algo-vis-backend。
- node --check public/trace-studio.js
- node --check public/trace-renderer.js
- node --test tests/studio-event-availability.test.js tests/entrypoints.test.js
  - 10 個通知、快取與排程案例通過；入口版本案例修正 renderer build 標記後另行重跑通過（1）。
- node -e "process.env.ASM_VERIFY_PREFLIGHT='1'; require('./tests/studio-virtual-rail.browser.test.js')"
  - 使用自行啟動的隨機埠隔離服務與 Edge。
  - 500 幀虛擬清單：1 passed，0 failed，0 skipped。
  - 既有 hidden event / marker / scope-exit 專項：1 passed，0 failed，0 skipped。
  - 1440×900 視窗實測初始 6 張卡片、6 個 SVG；容量上限依視窗計算為 8。
  - 捲至第 500 幀仍 6 張卡片；選取末幀、外部跳到第 251 幀、關閉重開到第 251 幀通過。
  - 簡單文字合成 trace 開啟同步耗時約 51.9ms；未作真實使用者 deck 效能保證。
- git diff --check：通過。

事件驗證曾發現僅檢查初始幀後，未訪問幀仍缺少可用性結果。修正為每次進入該幀檢查，並只讀取前一幀的物件資訊。原測試改為逐幀訪問後驗證，保留全部 hidden／marker／exit 原斷言，未放寬判定。
證據：上述測試原始碼可重跑；測試執行輸出在本對話，未提交 log 或暫存產物。

## 分級與限制
- V2 / J：Studio 卡片、事件可用性；未修改動畫指令或事件排程。
- 未執行大型 regression、全部 tests 或廣泛排序案例。
- 無新增持久化欄位；原 trace / studio 自訂值及明確關閉設定沿用原模型。
- 縮圖卡片的標題超長時單行省略，以維持虛擬清單行高。
- 底部輕量時間線仍建立每幀按鈕；本次針對昂貴場景繪製及左側卡片。
- 未訪問幀的事件可用性延至訪問時計算，開啟不再一次精查整份 trace；沒有刪除任何事件或改寫使用者開關。
- 主代理可補驗證真實大型 deck 的開啟體感、跨幀多選與批次修改。
- 3103 未強制重啟：先前 auto-review 因 PID 81256 來源無法核實拒絕停止，未獲新授權；本次僅前端靜態資產更新。

## 主代理核實與整合
- 狀態：尚未核實
- 合併／整合驗證：待主代理
- main／Release／公開部署：未執行
