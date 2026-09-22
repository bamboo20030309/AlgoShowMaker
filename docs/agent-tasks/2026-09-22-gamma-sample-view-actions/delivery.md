# 2026-09-22-gamma-sample-view-actions 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：68027b7fb7ebd6a8fe6ebcb5f39a3e7e463e1e06
- 程式修正 commit：77815e58d81b9fc8665c29b939b7959ab668e45f
- 驗證時的 HEAD 與未提交修改：HEAD `77815e58d81b9fc8665c29b939b7959ab668e45f`；只有本交付文件尚未提交。
- 驗證日期：2026-09-22

## 根因與修改
- 已確認根因與證據：範例觀賞模式共用 `shared-view-only`，其 CSS 隱藏了 `#exportDeckBtn` 與 `#shareDeckBtn`；分享處理器只會打開需 `deckUid` 的擁有者權限設定，範例沒有 `deckUid`。
- 修正方式與行為變化：公開範例解碼完成後，左欄顯示既有匯出與分享圖示。匯出沿用精簡 `.asmdeck` 流程；分享開啟範例專用視窗，可複製目前範例觀賞 URL。一般共享唯讀投影片仍不顯示這兩個範例專用入口。
- 修改檔案及用途：`public/slides.html` 增加範例分享視窗並更新資產版本；`public/slides.css` 僅在範例載入完成時顯示兩個按鈕；`public/slides.js` 啟用範例按鈕及複製連結；`tests/sample-view-actions.browser.test.js` 驗證局部操作；`tests/entrypoints.test.js` 核對版本。
- README／版本紀錄／使用說明更新：不適用；沿用左欄既有匯出／分享圖示，視窗已提供操作說明。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 範例載入後顯示匯出與分享，維持唯讀 | 隔離 Edge 載入虛構範例，檢查按鈕及編輯欄 | 兩按鈕可見；匯入按鈕、編輯欄隱藏；body 沒有 `asm-edit-mode` | 通過 |
| 匯出標題命名的可解碼 `.asmdeck` | 點擊匯出，讀取下載檔並用 `ASMDeck.decode` 解碼 | 下載 `Public Sample.asmdeck`，解碼後含一頁投影片 | 通過 |
| 分享公開觀賞連結且可複製 | 開啟範例分享視窗，檢查 URL 並點複製 | URL 為 `/slides.html?sample=fixture`；剪貼簿取得相同連結並顯示成功訊息 | 通過 |
| 一般共享唯讀投影片不顯示範例專用入口 | 隔離 Edge 載入模擬 `?share=fixture` | 匯出與分享按鈕不可見，範例分享視窗未開啟 | 通過 |

## 小驗證與重跑方式
### 範例觀賞模式按鈕專項
- 目的與對應條件：檢查範例與一般共享觀賞模式的按鈕可見性、分享與匯出實際行為。
- 執行目錄與必要環境設定：`algo-vis-backend`；測試自建隨機本機埠與獨立 Edge context。
- 測試資料／fixture：測試內建立單頁假範例 `.asmdeck`，攔截 `/guest-decks.json` 與 archive 請求；一般共享觀賞模式使用虛構 API 回應，不讀寫使用者投影片。
- 完整指令或操作步驟：`node --test tests/sample-view-actions.browser.test.js tests/entrypoints.test.js`
- 預期結果：兩個專項測試通過。
- 實際結果與 exit code：2 tests passed，0 failed，exit code 0。
- 證據位置：專項測試檔與終端摘要；未提交 `test-results`。

### 靜態與預覽服務
- 目的與對應條件：確認 JavaScript 語法、差異與本機預覽資產版本。
- 執行目錄與必要環境設定：本 worktree；gamma 專用 3104 預覽。
- 測試資料／fixture：無。
- 完整指令或操作步驟：`node --check public/slides.js`、`node --check tests/sample-view-actions.browser.test.js`、`git diff --check`；重啟已核對的 3104 服務後請求 `/slides.html?sample=fixture`。
- 預期結果：檢查成功，HTTP 200，入口包含新資產版本。
- 實際結果與 exit code：三項檢查 exit code 0；3104 已由原 PID 15748 重啟為 PID 13392，HTTP 200，含 `sample-actions-201` 與 `sample-actions-105`。
- 證據位置：終端摘要；服務 log 在系統 Temp，未提交。

## 剩餘事項與合併注意
- 未驗證項目及原因：未執行大規模 regression，符合 V1 前端功能修改與使用者先前指示。
- 已知問題或風險：無。
- 相依與衝突注意：若主代理整合時 `slides.html` 的資產版本已前進，保留新的快取值並同步入口測試。
- 主代理需補驗證的情境：整合後開啟任一真實公開範例，在左欄匯出並分享，確認 URL 指向該範例。

## 主代理核實與整合（由主代理填寫）
- 狀態：已核實並合併至 `intergration`。
- 核實的程式 commit 與 diff 範圍：`77815e5`、`3706489`；樣本觀賞介面的匯出／分享、CSS、入口版本與專項測試。
- 差異審查與必要重跑結果：解決 `slides.html`／`entrypoints.test.js` 的版本衝突，保留整合分支的漸進載入。實際三份教學範例暴露動畫尚未重建時無法匯出；合併時改為直接下載已驗證的原始範例 archive，並增加位元組一致性測試。`node --check`、`git diff --check` 與 `tests/sample-view-actions.browser.test.js`、`tests/entrypoints.test.js`、`tests/asmdeck.test.js` 共 15 案通過。
- 合併 commit：`9ab5870`。
- 完整 regression：未執行；本輪改動屬 V1 公開範例操作，已執行對應專項測試與隔離瀏覽器實測。
- 演算法投影片實際驗證：Heap、BIT、Segment Tree 三份真實範例的分享與複製連結通過；Heap 匯出檔重新解碼為 12 頁，隔離瀏覽器無 page error。
- 未完成或環境阻塞：無。
- 本機服務重啟：3100 已由 PID 11140 重啟為 PID 58152，HTTP 200，入口載入 `sample-actions-202`。
- Push／公開部署狀態：`9ab5870` 已推送到 `origin/intergration`；未合併 main，未公開部署。
