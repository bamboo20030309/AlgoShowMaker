# 廢 code 與可疑邏輯盤點（唯讀）

## 任務資訊

- 負責代理：Claude（Claude Code 桌面版）
- 狀態：盤點完成，尚未修改任何程式；清理需使用者另行授權
- 盤點對象：intergration `b54de29`（fix: restrict pointer color to label background）
- 本紀錄所在：分支 `claude/project-overview-3e7a15`，worktree `.claude/worktrees/project-overview-3e7a15`，基於 main `682698a`。本分支只新增本檔；要收進 intergration 請 **cherry-pick 本檔的單一 commit**，不要 merge 整個分支（會帶入 main 的 `682698a` 合併 commit）。
- 日期：2026-11-09

## 做了什麼

使用者要求找出廢 code、用不到的內容與奇怪的邏輯設計。程式碼方面全程唯讀：

- 在 intergration worktree 只執行 `git ls-files`／`git status`／`git diff --stat`、`find`、`md5sum`，以及只讀檔案的 node 小腳本；沒有修改檔案、沒有 commit、沒有碰 3000／3100 服務。
- 對共用 `.git` 執行過一次 `git fetch --all`，`FETCH_HEAD` 時間未變，判斷沒有實際更新。
- 曾短暫建立 `claude/code-audit-2026-11-09` 分支與空的 docs-only worktree，因工具限制未使用，已移除，沒有留下 commit。
- 分析腳本放在 repo 外的 Claude 暫存目錄，不屬於專案。
- 先誤掃 main `682698a`，經使用者指正改掃 intergration；main 版的結論已作廢，以下只依 `b54de29`。

方法是自動掃描（未被引用的檔案、定義後無呼叫者的函式、宣告後從未賦值的 `let`、跨檔重複的工具函式、trace 資產與索引／投影片引用比對），再逐項打開確認。**沒有逐行閱讀全部程式碼**；未列出不代表沒有問題。

## 一、確定未使用，可直接移除（低風險）

路徑相對於 `algo-vis-backend/public/`。

1. `trace-studio.js` 第 84–125 行 14 個 `let` 從未賦值，永遠是 `undefined`：
   `arrowFrom`、`arrowTo`、`arrowColor`、`arrowFromIndex`、`arrowToIndex`、`trackingSource`、`trackingTarget`、`trackingEffect`、`trackingIndexExpression`、`trackingText`、`trackingAnchor`、`bindingTargetText`、`bindingModeValue`、`bindingModeRelative`。
   使用處被 `?.`／`if (!x) return` 擋住，不報錯也不執行，約 60 行引用。連帶死碼：`addArrow`（2798）、`saveTrackingEffect`（2731）、`setBindingMode`（1311）。推測 UI 已移除、處理器殘留。
2. 無任何呼叫者的函式：

   | 位置 | 函式 |
   | --- | --- |
   | `front.js:513`、`:528`、`:932` | `addEditorHighlights`、`removeEditorHighlight`、`csGetStopFrames` |
   | `slides.js:1666`、`:9533` | `slideTextEntries`、`pointHitsFabricObject` |
   | `draw/draw_text.js:26`、`:125` | `transformTextForDisplayAndTTS`、`isFullWidth` |
   | `slide-structures.js:269` | `treePositions` |
   | `trace-directive-assist.js:294` | `cursorPosition` |
   | `trace-frame-tween.js:5537` | `markerForMotionSlot` |

3. 未被引用的檔案：`load-barcodes-deck.html` 及只被它使用的 `barcodes_dp_deck.json`；`algo-vis-backend/lib/pch.hpp`（`.gch` 已刪，server／Dockerfile／scripts 都未使用預編譯標頭）。

移除後只需語法檢查與局部確認，不涉動畫驗證集。

## 二、範例 Trace 資產膨脹（需使用者決定）

`public/deck-traces/` 279 檔約 875MB，全部被 git 追蹤，且都在 `index.json` 中。

| 類別 | 數量 | 大小 |
| --- | --- | --- |
| 15 份現行公開投影片與預設動畫 manifest 引用 | 36 | 約 119MB |
| 現行公開投影片未引用 | 242 | 約 754MB |

依 `docs/development/sample-trace-assets.md`，舊結果刻意保留供雲端／舊投影片引用，**不可直接刪除**。但與文件不一致：

- 文件記載「現行 36、歷史 80」；實際索引 278 筆，11/08、11/09 多次重建後持續累加（例如 `eight-queens-teaching-01-*.json` 三份，各 36.5MB）。
- 文件說舊結果移到 `legacy/`；242 筆非現行中只有 122 筆標 `legacy`，另 120 筆留在根目錄且無標記。

建議另立任務：重做雲端／本機引用核對、制定保留期，評估大型 Trace 是否移出 git。此盤點沒有讀取雲端資料。

## 三、行為不一致，可能是 bug（未重現）

1. `objectKeyForVariable` 有四份實作：`trace-renderer.js:1245` 與 `trace-studio.js` 會先查 `source.objectIds[variableId]`（`server.js` 產生），`trace-frame-tween.js:2010` 與 `trace-transitions.js:53` 不查。同幀多個帶別名物件時，渲染與補間可能配對到不同 key。需用此類範例重現後再抽成共用函式；涉及動畫，修正須按動畫驗證分級。
2. `draw/draw_array_normal.js:213`：`parseInt(..., 0)`（其他 draw 檔用 10）；讀出的 `startIdx` 未使用，`localIndex = index` 未扣起始索引，旁邊的範圍檢查被註解。非 0 起始索引時座標可能偏移，未重現。

## 四、重複與不一致（不急）

- `showToast` 三份：`front.js` 2678 與 3238 完全相同，`gui_editor.js:2417` 另一份。
- `normalizeIndex` 在 5 個 draw 檔各寫一份，有的扣 `index_range[0]`，有的不扣。
- `deck-thumbnail.js` 快取參數：`index.html` 為 `?v=2`，`slides.html` 為 `?v=4`。
- 新舊動畫流程並存：38 個範例 `.cpp` 中 19 個仍用 `AV.hpp`／`//draw{}`，因此 `code_script.js`、`animation.js`、`lib/AV.hpp`、`front.js` 的 CodeScript 函式**仍在使用，不可當廢 code 刪除**。若要淘汰需先遷移這 19 個範例。
- 共用 `.git/objects` 有十餘個 `tmp_obj_*`（10/14–10/27，早於本次），為中斷寫入殘留，`git gc` 可清。

## 未驗證與注意

- 第三節兩項僅靜態判斷，未實際重現。
- 動態組字串呼叫的函式可能被誤判為未使用；第一節各項已逐一打開確認，但移除前仍應全文搜尋一次。
- 本盤點未讀 `tests/`、`node_modules/`、`vendor/` 內部邏輯。

## 主代理核實與整合（由主代理填寫）

- 狀態：尚未核實
