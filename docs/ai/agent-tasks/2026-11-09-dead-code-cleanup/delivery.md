# 2026-11-09-dead-code-cleanup 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：claude/2026-11-09-dead-code-cleanup
- 共同基準 commit：b54de290125185c7609513514945f0b985f164a9
- 程式修正 commit：91c344c4eb44eb5180040d6efab595250a3ede32
- 驗證時的 HEAD 與未提交修改：91c344c，無未提交修改（`node_modules` 為指向 main 相依的被忽略 junction）
- 驗證日期：2026-11-09

## 根因與修改
- 已確認根因與證據：功能演進後遺留的程式。全 repo `git grep -w` 確認無引用；14 個 Studio 表單變數無賦值。
- 修正方式與行為變化：只刪除，無行為變化。
- 修改檔案及用途（`algo-vis-backend/` 下）：
  - `public/trace-studio.js`：刪 14 個從未賦值的 `let`（arrow／tracking／binding-mode 表單）、`addArrow`、`saveTrackingEffect`、`setBindingMode`、`syncTrackingDefaults`、`trackingKey`；`syncTrackingFromBinding` 內同步表單的空操作與包住它們的 `suppressAutoSave` 切換；`suppressAutoSave` 旗標本身；畫布點擊中寫入 `trackingTarget` 的一行。`refreshVariableOptions` 原本處理 5 個選單，現只剩實際存在的 `targetVariable`，改寫為只填它，行為相同（原邏輯對 `targetVariable` 本就走「全部變數、不加空選項」分支）。
  - `public/front.js`：刪 `addEditorHighlights`、`removeEditorHighlight`、`csGetStopFrames`。
  - `public/slides.js`：刪 `slideTextEntries`、`pointHitsFabricObject`（`fabricObjectAtPoint` 仍在用，保留）。
  - `public/draw/draw_text.js`：刪 `transformTextForDisplayAndTTS` 與其說明區塊、`isFullWidth`；檔頭說明同步移除「顯示文字轉換／全形字估算」字樣。
  - `public/slide-structures.js`：刪 `treePositions` 及只被它使用的 `treeNodes`。
  - `public/trace-directive-assist.js`：刪 `cursorPosition`。
  - `public/trace-frame-tween.js`：刪 `markerForMotionSlot`（保留 `markersForMotionSlot`）。
  - 刪檔：`public/load-barcodes-deck.html`、`public/barcodes_dp_deck.json`、`lib/pch.hpp`。
  - 合計 10 檔，+7／−942 行。
- README／版本紀錄／使用說明更新：不適用，無使用者可見變化。`.dockerignore` 的 `lib/*.gch` 規則保留（無害）。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 語法與差異檢查 | `node --check` 每個修改檔；`git diff --cached --check` | 全部通過 | 通過 |
| 無新增孤兒函式 | 同一掃描腳本重掃 | 第一次重掃發現 `treeNodes` 變孤兒，已一併刪除；再掃為 0 | 通過 |
| 三頁無新錯誤 | 冒煙腳本，修改前（intergration b54de29）與修改後各跑一次 | 兩邊 home／algorithm／slides 皆 0 個 page／console error（排除 API 4xx 與資源載入失敗） | 通過 |
| Trace Studio 開關、選單、點擊 | 腳本內 `ASMTraceStudio.open()`、派送畫布物件點擊、`refresh()`、`close()` | 前後皆 `open:true`、點到物件、3 個有選項的 select | 通過 |
| 範例投影片載入與點選 | `/slides.html?sample=segment-tree-teaching`，點擊 Fabric 畫布 | 前後皆 36 頁、80 個 canvas、無錯誤 | 通過 |
| 舊有物件相容性 | — | 不適用（無持久化欄位變動） | 不適用 |

## 小驗證與重跑方式
### 冒煙比對
- 目的與對應條件：確認刪除未改變頁面行為。
- 執行目錄與必要環境設定：任一目錄；需 `algo-vis-backend/node_modules`（本 worktree 以 junction 指向 main 的 node_modules）與 Windows 上的 Edge。
- 測試資料／fixture：預設線篩動畫、公開範例 `segment-tree-teaching`。
- 完整指令或操作步驟：腳本位於 Claude 暫存目錄（未提交）；邏輯為：以 `tests/helpers/isolated-server.js` 相同方式在隨機埠啟動指定 worktree 的 `server.js`（`ASM_REGRESSION=1`、隨機 `JWT_SECRET`、暫存 `ASM_TEMP_DIR`／`ARTIFACT_CACHE_DIR`），Playwright `channel: 'msedge'` 依序開 `/index.html`、`/algorithm.html`（等預設動畫載入後操作 Studio）、`/slides.html?sample=segment-tree-teaching`，收集 pageerror 與 console error。
- 預期結果：修改前後結果相同且無錯誤。
- 實際結果與 exit code：前後相同，皆無錯誤，exit 0。
- 證據位置：本紀錄；未保留截圖。

## 舊有物件相容性
| 案例 | Fixture／建立方式 | 操作與持久化路徑 | 實際結果 | 判定 |
|---|---|---|---|---|
| 新建物件 | — | — | 不適用 | 不適用 |
| 缺少新欄位的舊物件 | — | — | 不適用 | 不適用 |
| 既有自訂值／明確關閉 | — | — | 不適用 | 不適用 |

## 剩餘事項與合併注意
- 未驗證項目及原因：未跑任何 `tests/*.test.js`（V1 依規則按需選用，冒煙比對已涵蓋）；手機版版面未測；未做 Trace Studio 每個面板的逐一手動操作。
- 已知問題或風險：若有外部頁面或使用者自訂腳本以全域名稱呼叫 `front.js` 的 `addEditorHighlights`／`removeEditorHighlight`／`csGetStopFrames`，會失效；repo 內與 `AV.hpp`／`ASMTrace.hpp` 產生的程式碼中都沒有這些呼叫。
- 相依與衝突注意：基準為 b54de29；若 intergration 之後改動上述檔案，合併時可能有文字衝突，按函式名稱重新定位即可。
- 主代理需補驗證的情境：無特別要求；可視需要補跑 Trace Studio 相關小測試。
- 本機服務：未重啟任何服務。3100 為主代理的整合服務，依規則不由開發代理重啟；冒煙用的隨機埠服務已結束。
- 未 push。

## 主代理核實與整合（由主代理填寫）
- 狀態：已核實並合入 intergration。
- 核實的程式 commit 與 diff 範圍：91c344c，7 個 JS 與 3 個刪除檔；確認保留 targetVariable、markersForMotionSlot 與舊 AV 流程。
- 差異審查與必要重跑結果：逐項檢查刪除區段，追蹤來源無殘留呼叫；在交付 worktree 及合併後各以獨立服務／隔離 Edge 核對首頁、Trace Studio 開關／刷新／物件點選、線段樹教材與 Fabric 點選，均無 pageerror。合併後相關 JS 語法與差異檢查通過。
- 合併 commit：029cdd71db91fdc391b8cd298f444a03ad472ede。
- 完整 regression：未執行，純廢碼清理不需動畫驗證。
- 演算法投影片實際驗證：只做上述介面冒煙，不宣稱完整動畫驗收。
- 未完成或環境阻塞：首次整合命令被自動審批拒絕；使用者後續明確批准此交付後才合併，現已解除。第一次冒煙測試因預設背景載入尚未穩定而未開啟 Studio，改用明確已保存 Trace 後通過，沒有降低斷言。
- 本機服務重啟：由主代理本輪整合統一重啟 3100，不動 3000。
- Push／公開部署狀態：由本輪整合提交推送 origin/intergration；不部署公開主機、不發布 Release。
