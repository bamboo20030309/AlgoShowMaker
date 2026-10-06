# V3 與發布準備紀錄（2026-10-06）

首次 V3 結果：**未通過**，當時尚未合併 main、建立 release、提交或推送本輪修正。以下保留原始紀錄；後續修復與整合提交另見增量紀錄。發布草稿位於 `docs/releases/v4.12-draft.md`；README 的穩定版本仍為 AV_V4.11。

以上與下列數字保留首次 V3 的歷史失敗，不是修復後狀態。後續產品修正、舊測試／mock 清理及最後增量核實見 [V3 失敗修復紀錄](2026-10-06-v3-failure-repairs.md)。修復輪已通過 41 個相關檔案／94 個具名案例；完整發布驗收仍依最終依賴證據及 Linux 項目另行確認。

## 基準與環境

- 整合基準：intergration `0ff4b375457ca5e05259043f00304d5fee99060c`。
- main：`9ddf3991048779730f08a78e553e3f8e8e0dfb93`，本輪沒有變更。
- Windows、獨立測試服務、headless Edge；未操作使用者分頁、私人投影片或正式資料庫。
- 舊通過紀錄沒有依賴指紋，不能作為目前版本的發布證據，因此執行全部 247 個小測試檔與 20 個動畫／3 個前置案例。
- Windows 沙箱命令帳號曾回報 CreateProcessWithLogonW 1909；其後使用獲核准的命令程序繼續。已啟動的驗證未因此中止。

> 本文件以下保留首次 V3 與早期續跑的歷史紀錄，不是目前尚未修复故障的清單。後續修復結果见 [V3 失敗修復](2026-10-06-v3-failure-repairs.md)、[初始化完整格子修復](2026-10-06-declaration-cell-copy.md)；最新候選、驗收缺口與發布步驟集中在 [發布準備](2026-10-06-release-preparation.md)。正式 runner 尚未彙整完整 V3 通過，Linux 驗收尚未完成。

## 小測試

`npm run regression` 的第一輪完成 247 個檔案：192 通過、55 失敗。runner 在小測試失敗後停止，沒有自動進入動畫階段；主代理另以隔離服務執行完整動畫矩陣。數字是「測試檔」，不是檔內 assertion 或子案例數。

修正並局部重驗通過的原失敗檔：

| 測試檔 | 通過子案例 | 修正的測試準備 |
|---|---:|---|
| algorithm-draft-storage.test.js | 4 | 補齊 Ace mock 的 change 訂閱 API |
| arrow-directives.test.js | 20 | 載入 camera 相依；箭頭在主要物件上方，不要求它位於新增 caption 層之後 |
| asmdeck.test.js | 16 | 將 12 套舊正式範例預建 Trace 更新為目前引擎，更新資產快取版本 |
| auto-fixed-playback.browser.test.js | 1 | 依來源指紋等待真正 RUN；明確關閉 fixture 最後一幀的退場以隔離標記行為 |
| automark.browser.test.js | 1 | 同上，仍檢查手動標記、全域關閉、Studio 與 JSON 重開 |
| binary-addition-slide.browser.test.js | 1 | 檢查目前 checkout 的 tween／runtime build，保留實際數值動畫斷言 |
| code-only-events.browser.test.js | 1 | 使用正式事件設定啟用 call/output，保留高亮行為斷言 |

另有已更新 build 檢查的指標測試通過；arithmetic-assignment、layout-growth、LCS DFS 與 reference-alias-style 局部重驗仍失敗。沒有放寬像素、重疊、值提交或顏色容許值。

上述局部重驗沒有改写完整 runner 的通過計數或依賴指紋。**不能將 192 加上局部通過數當作完整有效通過數**；後续須由正式續跑入口重算受影響證據。未修正的失敗項目尚需區分過期 fixture／契約、等待條件與實際產品問題。

## 實際動畫

完整矩陣第一輪以 3 個工作者執行。只將其中失敗的 6 個動畫與雲端前置項目以 1 個工作者續跑，沒有重跑已通過的動畫。快速排序遞迴、倍增 Merge Sort、LCS 與八皇后位元案例的截圖逾時在續跑中排除。

合併各報告的最新結果：**動畫 18／20 通過，前置契約 2／3 通過。**

| 阻擋 | 第一個違規／錯誤 | 下一步 |
|---|---|---|
| insertion-style-labels-runtime | 第 6 幀，index 1 的 value/index 背景顏色進度不同（value-index-color-progress） | 從事件／style 排程追到 SVG 值格及索引格的填色提交 |
| selection-runtime | frame-7，約 14,416.7ms，i 與 min_idx 指標標籤重疊；4.6px × 16.56px | 核對定點的 pointer lane／座標提交；保留既有交換路徑 |
| cloud-storage-browser | waitForFunction 30 秒逾時；增加正確 RUN 指紋等待後仍失敗 | 定位大型 deck 匯入、asset 保存及雲端 saved 狀態的未完成步驟 |

## 報告位置

以下均位於 `algo-vis-backend/test-results/`，是本機產物，不提交 Git：

- `regression-state.json`：完整小測試第一輪及續跑状态。
- `regression.tap`：247 個檔案的第一輪原始輸出。
- `v3-release-readiness.json`：第一輪小測試失敗摘要、動畫與前置項目的最新合併结果。
- `animation/2026-10-05T18-56-09-736Z-e73ea1aa/summary.json`：完整 20 案例與 3 前置項目。
- `animation/2026-10-05T19-04-13-715Z-bc51a7bc/summary.json`：僅失敗項目、單工作者續跑。
- `animation/2026-10-05T19-06-15-201Z-f2006076/summary.json`：雲端等待準備修正後的單項重驗。
- 各動畫目錄中的 `*-failure-window.json` 與 `*-runtime.json`：第一個違規及完整取樣。

## 合併條件與預覽

### 所有範例動畫重載（使用者補充驗收）

已逐一開啟 15 套正式範例的全部 36 個動畫頁，再實際重載每個 runtime iframe。36／36 通過：預建 Trace ID 可解析，重載後幀數、來源與輸入指紋符合封裝資料，SVG 根節點有內容，沒有 pageerror，也沒有重新呼叫編譯 API。

使用獨立服務与全新瀏覽器 context，不操作使用者頁面與私人資料。報告：`algo-vis-backend/test-results/guest-animations-reload.json`。此項證明保存動畫可以重新載入，不代表所有幀的動畫行为都正確；V3 的既有阻擋仍保留。最後引擎／動畫修正完成後，以最終候選再核實這項發布前驗收。

本輪未提交修正包含共用 build helper、測試準備、雲端 fixture 等待，以及 12 套舊正式範例的預建 Trace；使用者既有未追蹤教學草稿保留。

3100 已從整合 worktree 重啟。HTTP 200，served trace-player.js 與工作目錄內容一致，範例目錄包含 15 套教材。未停止 main 3000 或其他代理服務。

修正上述動畫及小測試阻擋後，依指紋續跑失敗／未完成／失效項目；取得完整有效通過證據，再提交整合修正、更新正式版本資訊、核對 main 基準並執行合併／發布。這份紀錄與 v4.12 草稿均不代表可以發布。
