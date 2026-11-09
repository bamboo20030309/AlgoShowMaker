# 交接：廢 code 盤點後續操作（2026-11-09）

本文件給接手的 AI（主代理或開發代理）。它說明如何把 Claude 的盤點紀錄收進 intergration，以及之後每項清理工作該怎麼做、誰做、要驗證什麼、哪些必須先問使用者。

盤點內容與證據在 [code-audit-2026-11-09.md](../agent-tasks/code-audit-2026-11-09.md)。本文件不取代 `AGENTS.md`、[開發驗收](../development-instructions.md)、[多代理協作](../collaboration.md)、[驗證分級](../validation-levels.md)、[整合與預覽](../integration-preview.md)；有衝突時以那些文件及使用者最新指示為準。

## 0. 目前狀態（接手時先核對）

- 盤點對象：intergration `b54de29`。盤點期間**沒有修改任何程式**，沒有動 3000／3100 服務。
- 兩份文件（盤點紀錄與本交接）在分支 `claude/project-overview-3e7a15` 上，worktree：
  `C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.claude\worktrees\project-overview-3e7a15`
- 這個分支是從 **main `682698a`** 開的，不是從 intergration。main 上的 `682698a`（Merge intergration for AV_V4.12.1）不在 intergration 歷史中。
- 沒有 push。

接手時先執行並核對：

```bash
git log --oneline main..claude/project-overview-3e7a15
```

預期只看到 Claude 的 docs commit（開頭為 `docs:`），且都只動 `docs/ai/agent-tasks/code-audit-2026-11-09.md` 與 `docs/ai/agent-handoffs/code-audit-2026-11-09.md`。若出現其他 commit 或其他檔案，停下來問使用者。

```bash
git diff --stat main claude/project-overview-3e7a15
```

## 1. 把文件收進 intergration（主代理，V0）

**不要 merge 整個分支**，否則會把 main 的 `682698a` 一起帶進 intergration。用 cherry-pick 只複製文件 commit。

在 intergration worktree（`.worktrees/intergration`）執行：

```bash
git status --short
```

確認沒有未提交修改後：

```bash
git cherry-pick main..claude/project-overview-3e7a15
```

- 兩個檔案都是新增，不應有衝突；若有衝突，`git cherry-pick --abort` 後回報使用者。
- 驗證：V0，`git diff --check HEAD~N`（N 為搬入的 commit 數）及確認只新增這兩個 md。
- 之後依 [整合與預覽](../integration-preview.md) 的既有授權處理 push 與 3100 重啟。純文件變更不需要演算法驗證；是否重啟 3100 依該文件規則判斷。
- 收進後，在盤點紀錄最後的「主代理核實與整合」填寫結果。

`claude/project-overview-3e7a15` 分支本身不用合併；確認文件已在 intergration 後，可請使用者決定是否刪除。

## 2. 待辦總表

| 代號 | 內容 | 層級 | 先問使用者？ | 執行者 |
| --- | --- | --- | --- | --- |
| A | 移除確定未使用的程式與檔案 | V1 | 否（使用者已要求整理專案），但開工前告知範圍 | 開發代理 → 主代理合併 |
| B | 查證兩處可能的動畫／座標 bug | V2 | 否；若要改既有行為才問 | 開發代理 → 主代理驗證 |
| C | 範例 Trace 保留規則與倉庫大小 | 資料決策 | **是，必須先問** | 主代理提方案，使用者決定 |
| D | 重複工具函式與快取參數整理 | V1／V2 | 問是否要做 | 開發代理 |
| E | 舊版 `AV.hpp` 動畫流程去留 | 產品決策 | **是，必須先問** | 使用者決定後再排 |
| F | 清理 `.git` 的 `tmp_obj_*` 殘檔 | 維護 | 是（會動共用 `.git`） | 主代理 |

每個任務依 [多代理協作](../collaboration.md) 在自己的分支維護 `docs/ai/agent-tasks/<任務代號>/task.md` 與 `delivery.md`。基準一律用當時 intergration 的完整 SHA，由主代理指定；不要沿用 `b54de29`，除非 intergration 沒動。

## 3. 任務 A：移除確定未使用的內容

**分支**：自 intergration 最新 commit 開 `codex/<日期>-dead-code-cleanup`，使用獨立 worktree。

**動手前**：逐項全文搜尋一次（含字串、`window[...]`、HTML `onclick`、tests），確認仍無引用；intergration 若已前進，行號會變，依名稱重新定位。若某項已有新引用，保留並在 delivery.md 註明。

**要移除的項目**（路徑相對 `algo-vis-backend/public/`）：

1. `trace-studio.js`：
   - 第 84–125 行附近 14 個從未賦值的 `let`：`arrowFrom`、`arrowTo`、`arrowColor`、`arrowFromIndex`、`arrowToIndex`、`trackingSource`、`trackingTarget`、`trackingEffect`、`trackingIndexExpression`、`trackingText`、`trackingAnchor`、`bindingTargetText`、`bindingModeValue`、`bindingModeRelative`。
   - 只為這些變數存在的函式：`addArrow`、`saveTrackingEffect`、`setBindingMode`。
   - 其他函式中只處理這些變數的分支（例如 `select === trackingSource`、`arrowTo?.options` 這類判斷）。**只刪對應分支，不刪整個函式**；函式還有其他用途時保留其餘邏輯。
   - 注意 `targetVariable` 有被賦值（約 3573 行），**不要刪**。
2. 無呼叫者的函式：
   - `front.js`：`addEditorHighlights`、`removeEditorHighlight`、`csGetStopFrames`
   - `slides.js`：`slideTextEntries`、`pointHitsFabricObject`
   - `draw/draw_text.js`：`transformTextForDisplayAndTTS`、`isFullWidth`（確認刪後該檔沒有只被它們使用的 helper；若有一併處理）
   - `slide-structures.js`：`treePositions`（同上，確認 `treeNodes` 等仍被其他地方使用才保留）
   - `trace-directive-assist.js`：`cursorPosition`
   - `trace-frame-tween.js`：`markerForMotionSlot`（**保留** `markersForMotionSlot`，那個有在用）
3. 檔案：
   - `load-barcodes-deck.html`、`barcodes_dp_deck.json`
   - `algo-vis-backend/lib/pch.hpp`（先確認 Dockerfile、`.dockerignore`、server、scripts 都沒提到 `pch`）

**不要動**：`code_script.js`、`animation.js`、`lib/AV.hpp`、`front.js` 的 CodeScript 系列函式。它們是舊版動畫流程，仍有 19 個範例在用（見任務 E）。

**驗證（V1，開發代理）**：

- 每個修改的 JS 執行 `node --check <檔案>`。
- `git diff --check`。
- 用自己的隔離服務（3101～3103 中自己負責的埠，或隨機埠）實際開啟：首頁、演算法頁（含 Trace Studio 開關、事件／效果清單、相機設定）、投影片編輯器（點選、拖曳物件、樹狀結構），確認瀏覽器 console 無新錯誤。
- 需要時只挑直接相關的小測試（可用 `npm run test:inventory` 查找，只列清單不執行），例如 Trace Studio 或 slides 相關的單一測試檔。
- **不得**執行 `npm run regression`、`npm test` 或任何動畫驗證集。

**交付**：commit 到自己的分支，寫 delivery.md，交主代理核實與合併。主代理合併後依規則決定整合驗證範圍；這是非動畫刪除，不需要演算法驗證集。

## 4. 任務 B：查證兩處可能的 bug

**先重現，再決定是否修改**。若無法重現，在 delivery.md 寫明重現方式與結果，不要為了「統一」而改動動畫行為。

1. **`objectKeyForVariable` 行為不一致**
   - `trace-renderer.js` 與 `trace-studio.js` 會先查 `frame.source.objectIds[variableId]`；`trace-frame-tween.js` 與 `trace-transitions.js` 不查。
   - 重現：找或寫一個同一幀有多個以 `@` 物件指令取別名的結構的範例（`server.js` 約 2611 行產生 `objectIds`），比較補間、轉場配對與實際 SVG 呈現是否對到同一個物件。
   - 若確認不一致：抽成共用函式，讓四處行為一致。涉及動畫，屬 V2：語法檢查加相關分類的最小測試，並做最小隔離重現；在 delivery.md 寫明希望主代理補做的動畫驗證案例。
   - 依 `AGENTS.md`，重疊只檢查事件前後與幀前後定點，不得改變既有指標交換路徑。
2. **`draw/draw_array_normal.js` 起始索引**
   - 約 213 行：`parseInt(..., 0)`（其他 draw 檔用 10）；`startIdx` 讀出後未使用，`localIndex = index` 未扣起始索引；範圍檢查被註解。
   - 重現：用索引範圍不從 0 開始的一般陣列（例如 `[5:10]`），檢查箭頭／指標指到的格子座標是否正確。
   - radix 改成 10 是無行為差異的小修正；扣不扣起始索引要先查呼叫端傳進來的是絕對索引還是相對索引，確認後再改。

## 5. 任務 C：範例 Trace 保留規則（必須先問使用者）

**現況**（以 `b54de29` 計）：`public/deck-traces/` 有 279 檔約 875MB，全部被 git 追蹤。現行 15 份公開投影片只引用 36 檔（約 119MB），另 242 檔（約 754MB）不被現行公開投影片引用。

**與文件不一致**：

- [範例 Trace 資產](../../development/sample-trace-assets.md) 記載「現行 36、歷史 80」，實際索引已 278 筆。
- 文件說舊結果會移到 `legacy/`，但非現行的 242 筆中只有 122 筆標 `legacy`；另外 120 筆留在根目錄、沒有標記，主要是 11/08、11/09 多次重建產生的。

**不能做的事**：不得依日期或「現行沒引用」直接刪除。舊結果可能仍被雲端投影片、使用者匯出檔或舊分享連結引用。

**主代理該做的事**：

1. 先修正文件中的數字，或說明為何數字不同（例如重建流程有沒有把舊結果移入 legacy）。
2. 查 `scripts/build/prebuild-guest-decks.js` 與 `registerDeckTraces`：為什麼 120 筆非現行結果沒有移到 legacy、也沒標 `legacy`。若是 bug，另開 V2 任務修正。
3. 準備方案給使用者選，至少包含：
   - 引用核對範圍（公開教材、本機草稿、本機 Mongo 雲端投影片；**唯讀**，不輸出帳號資料）。
   - 保留規則（例如只保留仍被引用者，其餘移到 repo 外備份）。
   - 是否把大型 Trace 移出 git（例如改由部署時產生或另存），以及對 Docker／Nginx／舊網址的影響。
4. 使用者決定前，不移動、不刪除任何 Trace。

## 6. 任務 D：重複與不一致的小整理（先問是否要做）

- `showToast`：`front.js` 約 2678 與 3238 行兩份完全相同，`gui_editor.js` 約 2417 行另一份（多一個 `duration` 參數）。可合併為一份共用版本。V1。
- `normalizeIndex`：5 個 draw 檔各一份，有的扣 `index_range[0]`，有的不扣（`draw_array.js` 不扣）。**不要直接統一**，先確認各結構的呼叫端傳入的是絕對還是相對索引；若要改行為屬 V2。
- `deck-thumbnail.js` 快取參數：`index.html` 用 `?v=2`，`slides.html` 用 `?v=4`。首頁可能拿到舊快取；統一成較新的版本號。V0。

## 7. 任務 E：舊版動畫流程去留（必須先問使用者）

38 個範例 `.cpp` 中有 19 個仍使用 `#include "AV.hpp"` 或 `//draw{}`，由 `server.js` 的 `usesLegacyAnimationCompiler` 走舊流程。相關程式：`lib/AV.hpp`、`public/code_script.js`、`public/animation.js`、`public/compile.js` 的 `asmApplyAnimationScript`、`front.js` 的 CodeScript 函式，以及 `draw_circle.js`／`draw_triangle.js`／`draw_word.js`。

- 這些**目前仍在使用，不是廢 code**。
- 若使用者想淘汰舊流程：先逐一把 19 個範例改寫成新指令並驗證動畫（V2／V3），全部完成後才移除舊流程。使用者自己存過的舊程式碼也會受影響，需要相容或遷移方案，不能默默失效。
- 使用者決定前不要動。

## 8. 任務 F：`.git` 殘檔（先問使用者）

共用 `.git/objects` 有十餘個 `tmp_obj_*`（2026-10-14～10-27），是過去中斷的 git 寫入殘留，不影響功能。`git gc` 或 `git prune` 可清，但會動到所有 worktree 共用的 `.git`；請在沒有其他代理正在操作 git 時執行，並先徵得使用者同意。

## 9. 回報使用者時

- 用繁體中文。
- 每個任務完成時說明：做了什麼、驗證到哪個層級、哪些未驗證、commit／分支、服務是否重啟。
- 不把未重現的 B 項說成已修正，不把 C／E 的方案說成已決定。
