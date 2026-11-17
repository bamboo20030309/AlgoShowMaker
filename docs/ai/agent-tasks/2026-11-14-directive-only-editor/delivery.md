# 交付紀錄：2026-11-14-directive-only-editor

## 任務資訊
- 分支：`claude/2026-11-14-directive-only-editor`（從 intergration `5a8a7d9` 開出）
- 依據：同資料夾 `plan.md`；使用者 2026-11-14 決定：舊動畫手動調整全部清除、沒有對應指令的三種調整直接拿掉、保留事件與程式碼的設定，「作用時間線」一併刪除。

## 修改內容

### 資料：手動調整一律捨棄（載入、套用、寫回、存檔四個入口）
- `public/trace-model.js`：新增 `MANUAL_STUDIO_KEYS`（positions、bindings、objects、arrows、objectStyles、visibility、cameraRules、transitions、transitionDefaults）與 `directiveStudio()`；`normalizeTraceDocument()` 一律 `rules: []`、studio 去掉手動欄位（含 `@asm-view` 壓縮格式的 frameMaps）。asmView 只處理原本就有的 `studio`／`rules`（見下方「實作中發現」）。
  - 採「只列要捨棄的欄位」：事件、程式碼片段與之後新增的設定都不會被意外丟掉。
- `public/trace-view-source.js`：同一份 `MANUAL_STUDIO_KEYS`／`directiveStudio()`（測試檢查兩份相同）。`fromTrace()` 只寫出保留欄位且 `rules: []`；`applyToTrace()` 不再套用 rules 與手動欄位；`compactTraceForSave()` 同樣捨棄。移除只服務手動欄位的 helper（鏡頭規則、轉場、綁定壓縮等 8 個函式）。
- `server.js`：新產生的 trace `rules: []`、studio 經 `directiveStudio()`；回傳的 asmView 經 `directiveAsmView()`。
- `public/trace-editor.js`：編譯設定不再送出 rules。
- `public/asmdeck.js`：匯出核對只檢查逐幀事件設定（eventStates），不再因手動欄位「無法還原」而擋下匯出；globals 去掉 transitionDefaults。
- `public/trace-camera.js`：鏡頭優先序改為「本幀／preset／defaults 的 `@camera` → 自動捕捉」。
- `public/trace-transitions.js`：手動幀間動畫規則一律為空（同一 ID 自動補間）。

### 介面：拿掉 Trace Studio 的手動調整
- `public/trace-studio.js`（4008 → 約 1660 行）：
  - 右欄只剩「事件」「程式碼」兩頁；標題改為「事件與程式碼」。原本藏在物件頁的「程式碼框外觀」（字體大小、片段滾動時間、最大寬高）移到程式碼頁，點畫布上的程式碼框會切到程式碼頁。
  - 刪除：物件與樣式、文字格式、物件狀態、幀間動畫、位置綁定、鏡頭（含畫布上框鏡頭範圍）、此物件已建立效果、跨幀規則、作用時間線（右鍵範圍選單與 `scopeSelect`／`frameIdsForScope()`）、物件狀態右鍵選單、文字區段選取、拖曳掛勾與縮圖拖曳同步。共刪 98 個函式與 66 個狀態變數。
  - `ensureStudioData()` 不再建立手動欄位並清掉舊值；復原／重做只記 studio。
- `public/interaction.js`（1264 → 783 行）：動畫（trace）物件不再能用滑鼠選取或拖曳（任何帶 `data-trace-object-key` 的元素都排除）；刪除綁定、trace 選取框、對齊吸附等 13 個方法。傳統 `AV.hpp` 繪圖物件仍可拖曳。
- CSS：`trace-studio.css`、`trace.css` 刪除已無 JS／HTML 使用的手動調整樣式（86 個選擇器）；刪除會把程式碼框外觀設定藏起來的兩條舊規則（只為舊物件頁存在，否則程式碼頁的設定會被隱藏）。
- 版本：`trace.css?v=trace-40`、`trace-studio.css?v=trace-65`、`interaction.js?v=trace-42`、`trace-view-source.js?v=trace-19`（兩頁）、`trace-model.js?v=trace-49`（兩頁）、`trace-transitions.js?v=trace-8`、`trace-camera.js?v=trace-11`、`trace-editor.js?v=trace-43`、`trace-studio.js?v=trace-143`、`slides.js?v=slides-370`（iframe `trace-runtime-125`）。

### 文件
- `docs/reference/algorithm-visualization-directives.md`：移除「Studio 覆寫優先」「Studio 物件 ID」「Studio 拖曳位置」等段落；鏡頭優先序更新；「事件動畫與 Trace Studio」開頭說明新規則與指令對照；更新紀錄新增 2026/11/14。

## 實作中發現並修正
- 第一版過濾採「只留清單內的欄位」，`source-newlines` 測試的自訂欄位被丟掉；改為「只捨棄手動欄位」，未知與日後新增的設定都保留。
- 第一版在 asmView 上一律寫入 `studio: {}`；程式沒有 `@asm-view` 時，載入會用這個空 studio 蓋掉已存的事件設定（`autoFixedEnabled`、`gapMs` 等遺失）。改為只處理原本就有的欄位，並加測試。

## 驗證
- 公開範例影響：9 支含 `@asm-view` 的範例程式與 172 份範例 trace 都沒有使用手動欄位，公開範例外觀不變。只有使用者自己用 Studio 手動調過的動畫會改變（不相容變更，使用者已確認）。
- 新增 `tests/directive-only-studio.test.js`（7 項：兩份清單一致、載入／套用／寫回／存檔捨棄手動資料、保留事件與程式碼設定、未知設定保留、無 studio 的 asmView 不會蓋掉事件設定、伺服器同樣過濾）與 `tests/directive-only-studio.browser.test.js`（實際編譯：右欄只有事件與程式碼、程式碼框外觀設定可見、右鍵無選單、拖曳動畫物件不移動且不寫入手動欄位、程式碼不出現手動設定）。
- 依新規則改寫：`asmdeck`、`view-source-compaction`（刪 2 項只測 Studio 鏡頭的案例，改寫 3 項）、`camera-directives`、`slide-animation-parity`（改用程式碼框字體大小作為 asm-view／存檔優先序的探針）、`object-inspector-font-size`（刪 2 項物件字級案例）、`event-code-tree`（定位 `open()` 的方式）。刪除 `relative-placement-drag.browser.test.js`（測試已移除的拖曳）。
- 與未修改的 intergration（`5a8a7d9`，暫時 worktree）逐一比對：
  - 單元：`keep-directives` 12 項、`slide-animation-parity` 1 項（outdated 重編譯）在 intergration 同樣失敗，屬既有。
  - 瀏覽器（需 `ASM_TEST_BASE_URL` 者以 3187／3188 隔離服務執行）：`event-settings-source`、`events-fixed-state`、`events-batch-arrows`、`auto-fixed-playback`、`presentation-camera` 在 intergration 同樣失敗，屬既有。其餘相關測試通過（見下方最終結果）。
- 最終結果（修正後重跑）：單元 `directive-only-studio` 7／7、`view-source-compaction` 10／10、`asmdeck` 16／16、`camera-directives` 5／5、`event-code-tree` 6／6、`object-inspector-font-size` 2／2、`slide-animation-parity` 16／17（失敗者屬既有）；瀏覽器 `code-panel-settings` 2／2、`studio-availability-preflight`、`linear-keep-frozen` 2／2、`keep-camera-focus`、`studio-virtual-rail`、`trace-code-snippet`、`canvas-mouse-shortcuts` 2／2、`source-newlines`、`directive-only-studio` 皆通過。
- 未執行完整 regression 與動畫驗證集：依專案規範由主代理依影響範圍執行。

## 第二批：渲染端清理（使用者 2026-11-14「剩下順便改一改」）
- `public/trace-renderer.js`（7342 → 約 7030 行，`build: 'trace-291'`）：拆除所有讀取 Studio 手動欄位的分支。
  - 刪除函式：`studioPosition`、`styledTextPieces`（文字區段樣式）、`applyStoredPartPositions`、`applyVisibilityStates`、`applyObjectColorStyles`、`renderStudioArrows`、`renderDecorations`（只服務 Studio 跨幀規則 `repeat-cells`，rules 已一律為空）。
  - `snapshotStudioPosition` → `snapshotPlacementOffset(snapshot)`：只回傳自動排版記下的位移；`snapshotAutomaticBinding(snapshot)` 只用快照自己的指令綁定。
  - `applyBindings` 只用指令綁定；`applyDefaultLiveObjectPlacement`、遞迴排版只把指令綁定視為「明確定位」；`keepUnionPlacement`／`keepAnchorPlacement`、快照、即時變數、相鄰幀重用與縮圖重用都不再看逐幀隱藏。
  - `@text` 樣式只來自指令段落（顏色、背景、字級、粗體）；物件字級覆寫與斜體／底線／刪除線（只有 Studio 能設）移除，`data-trace-text-base-key／source-start／source-end` 屬性一併移除。
  - 保留 renderScene 最後一次 `applyBindings`：它讓指令綁定在文字與標記排版後維持最終位置。
  - 自動標記（`renderStudioObjects`）仍使用，只是不再讀 `studio.objects`。
- `public/trace-studio.css`：刪除 `.trace-studio-hidden-object` 與 `body.asm-trace-camera-framing`（已無使用者）。
- 版本：`trace-renderer.js?v=trace-291`、`trace-studio.css?v=trace-66`、`slides.js?v=slides-371`（iframe `trace-runtime-126`）。
- 測試：`keep-directives`（改測 `snapshotPlacementOffset`／指令綁定）、`text-object-bindings`（keep 聯集不再有隱藏快照；預設位置改以指令綁定判斷）、`scene-load-performance`（刪除逐幀隱藏段落）；刪除 `object-inspector-font-size.test.js`（剩下的 2 項都只測 Studio 字級覆寫）。
- 驗證：與 `adcb77c`（暫時 worktree）逐一比對 —— 單元 `keep-directives`、`text-object-bindings`、`entrypoints`、`arrow-directives`、`layout-directives`、`place-directives`、`matrix-renderer`、`unresolved-markers`、`keep-arrow-layer` 的失敗項目與基準完全相同（皆為既有，多數需編譯器或釘死舊版本號）；`directive-only-studio` 7／7。瀏覽器 16 個相關測試（隔離服務）：scene-load-performance、directive-only-studio、linear-keep-frozen、keep-camera-focus、source-newlines、layout-targets、nested-pointer、matrix-renderer、retained-hint-owner 通過；name-fit、alias-display-name、initializer-visibility、directive-follow（1 項）、restored-comparison、pointer-model（2 項）、eight-queens-loop-playback 在 `adcb77c` 上同樣失敗，屬既有。scene-load-performance 在基準上失敗的就是已刪除的逐幀隱藏段落，現在通過。

## 示意圖
- 展開式編輯器示意圖 https://claude.ai/artifact/3V4741nMm3dQa1b8qBvYc7：右側屬性改為「事件」「程式碼」兩頁（拿掉「顯示」「旁白」），並註明位置、樣式與鏡頭改用指令。

## 剩餘事項與合併注意
- `trace-rules.js` 的 `decorations()` 已無呼叫者（rules 一律為空）；留著不影響行為，可之後一起清。
- 完整 regression 與動畫驗證集由主代理執行。
- 合併：在 intergration worktree 執行 `git cherry-pick 5a8a7d9..claude/2026-11-14-directive-only-editor`。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
