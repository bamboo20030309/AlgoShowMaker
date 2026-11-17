# 2026-11-14-directive-only-editor：動畫編輯改為完全由指令驅動（規劃）

## 任務資訊
- 負責代理：Claude（Claude Code 桌面版）
- 狀態：已實作（見 delivery.md）
- 依據：使用者 2026-11-14 指示「刪除目前對物件的所有手動調整，全部用指令驅動，包含鏡頭；只保留事件和程式碼的按鈕調整」。
- 與介面改版階段 4（展開式編輯器，示意圖 https://claude.ai/artifact/3V4741nMm3dQa1b8qBvYc7）相關：右側屬性欄只剩「事件」與「程式碼」，示意圖的「顯示」頁要拿掉。

## 使用者已確認的決定（2026-11-14）
1. **舊動畫的手動調整全部清除**：已存動畫裡用 Trace Studio 調過的位置、樣式、鏡頭、規則等一律失效，外觀改回由指令（或自動）決定。屬於明確的不相容變更，需寫進版本說明。
2. **沒有對應指令的三種調整直接拿掉，不補新指令**：
   - 整個物件的填色／邊框／字級（`@style` 只作用在格子）；
   - 單一物件的幀間動畫開關與手動對應（例如「不做動畫」、指定上一幀物件 ID）；
   - 固定的鏡頭範圍（`@camera` 只有 `auto` 與 `focus`）。
3. **保留**：事件頁的程式碼按鈕、事件全域設定、畫布上的程式碼片段設定、程式碼行的收錄開關。

## 現況：手動調整存在哪裡
Trace Studio 的設定有兩份，內容相同：
- 動畫資料的 `trace.studio`、`trace.rules`、`trace.skins`；
- 程式碼裡的 `@asm-view` JSON 區塊（`trace-view-source.js` `fromTrace()`／`applyToTrace()`，Studio 自動寫回程式碼）。

| 資料 | 內容 | 處理 |
|---|---|---|
| `studio.positions` | 逐幀拖曳位置 | 清除 |
| `studio.bindings` | 位置綁定 | 清除 |
| `studio.objects` | Studio 新增的自訂物件（文字等） | 清除 |
| `studio.arrows` | 手動箭頭 | 清除 |
| `studio.objectStyles` | 物件填色、邊框、文字顏色／大小、粗斜體 | 清除 |
| `studio.visibility` | 逐幀顯示／隱藏 | 清除 |
| `studio.cameraRules` | 全域／逐幀鏡頭、固定鏡頭、追蹤物件、鏡頭範圍 | 清除 |
| `studio.transitions`、`transitionDefaults` | 物件幀間動畫模式與對應 | 清除 |
| `trace.rules` | Studio 建立的跨幀規則（樣式等）；`DEFAULT_RULES` 為空，指令不經這裡 | 清除 |
| `trace.skins` 的手動覆寫 | 變數呈現方式的手動修改 | 清除手動部分，保留由指令 `render`／`with` 產生的部分（實作時確認來源分界） |
| `studio.eventSettings`、`eventStates`、`eventInstructionStates`、`eventColors`、`eventSignatureColors`、`eventAnimations` | 事件開關、間隔、自動固定、迴圈邊界、讀取強調 | **保留** |
| `studio.codeSnippetOverrides`、`codeSnippetSourceOverrides`、`codePanelFontSize` | 畫布程式碼片段設定、收錄行 | **保留** |

## 要拿掉的介面
- Trace Studio 右欄：「物件與樣式」、「鏡頭設定」／「鏡頭範圍」／「追蹤物件」／「自動捕捉鏡頭」／「固定鏡頭」、「幀間動畫」、「跨幀規則」／「跨幀屬性」、「位置綁定」／「定位」、「箭頭」、「物件退場」、「物件狀態」（顯示／隱藏）。
- 畫布上的手動操作：拖曳物件改位置、拖曳綁定點、在畫布上框鏡頭範圍、新增自訂物件。
- 「作用時間線」（使用者 2026-11-14 追加）：Studio 畫布右鍵的範圍選單（目前指令／已選取幀／目前指令之後／所有幀）與對應的 `scopeSelect`、`frameIdsForScope()`。已確認它只服務手動調整（幀間動畫、物件顏色、文字樣式、顯示／隱藏、位置綁定、追蹤、鏡頭、拖曳），事件與程式碼設定沒有用到，整組刪除。
- 程式碼頁的手繪工具列（畫筆、橡皮擦、方形；與階段 4 相同）。
- 留下：右欄「事件」頁（程式碼結構按鈕、事件全域設定）、程式碼片段設定、收錄行開關、事件時間線。

## 改用的指令（給使用者的對照）
| 原本手動 | 改用 |
|---|---|
| 拖曳位置、位置綁定 | `at TARGET.ANCHOR`、`offset(x,y)`、`@place` |
| 手動箭頭 | `@arrow` |
| 自訂文字物件 | `@text ... as ID` |
| 格子樣式、跨幀樣式規則 | `@style`、`@defaults`、`@preset` |
| 鏡頭（全域、逐幀、追蹤） | `@camera auto`／`@camera focus TARGET zoom() offset()`，全域用 `@defaults` |
| 物件退場、逐幀隱藏 | `@exit`、`when` |
| 物件對應（同一物件跨幀） | `as ID` |
| 呈現方式 | `render TYPE with ...` |

拿掉後無法再做到：整個物件的填色／邊框／字級、單一物件關閉幀間動畫、固定鏡頭範圍（決定 2）。

## 不受影響
- 放映時的檢視操作（滑鼠拖曳平移、框選放大、滾輪縮放、雷射筆）：只影響觀看，不存進動畫，保留。
- `@asm-view` 區塊本身保留，但只寫入事件與程式碼片段設定。

## 實作步驟（每步各自可驗證）
1. **播放端忽略手動資料**：`trace-view-source.js` `applyToTrace()` 與 `trace-editor.js` 載入路徑只套用保留清單中的 studio 欄位；`rules` 與手動 skins 不再套用。三個播放介面（程式碼頁、投影片放映、投影片編輯）同時生效。
2. **寫回只留保留欄位**：`fromTrace()`／`compactTraceForSave()` 只輸出保留欄位；舊 `@asm-view` 區塊在下次寫回時自動去掉手動部分，載入時不改動使用者的程式碼。
3. **拿掉 Studio 手動介面**：刪除上表各面板與畫布拖曳／框選／綁定互動，連帶移除只服務這些面板的程式（`trace-studio.js` 大部分、`interaction.js` 的物件拖曳、相關 CSS）。
4. **渲染端清理**：`trace-renderer.js`／`trace-camera.js`／`trace-model.js` 中只為 studio 手動欄位存在的分支移除；鏡頭優先序改為「本幀／preset 的 `@camera` → defaults → 自動鏡頭」。
5. **文件**：更新 `docs/reference/algorithm-visualization-directives.md` 中所有提到 Trace Studio 覆寫、Studio 物件 ID、Studio 位置優先序的段落；在版本說明列出不相容變更與指令對照。
6. **測試**：刪除或改寫依賴手動調整的測試；新增「含手動資料的舊動畫載入後只剩指令結果」與「事件與程式碼片段設定照常保留」的測試。

## 驗證（V2，涉及動畫）
- 新建動畫、含 Studio 手動資料的舊動畫、缺少新欄位的舊動畫：載入→播放→修改→存→重開。
- 事件設定（含明確關閉的事件、`gapMs=0`、自訂事件顏色）與程式碼片段設定不得被清掉。
- 動畫相關的完整驗證集由主代理依影響範圍執行；開發端只跑相關小測試。

## 風險
- 公開範例與使用者既有投影片若依賴 Studio 手動調整，外觀會改變（決定 1 已接受）；實作前先統計範例教材中使用 `@asm-view` 手動欄位的份數，列給使用者看。
- `trace-studio.js` 約 4000 行，手動與事件功能交織，拆除時要逐段確認事件頁沒有被連帶移除。
