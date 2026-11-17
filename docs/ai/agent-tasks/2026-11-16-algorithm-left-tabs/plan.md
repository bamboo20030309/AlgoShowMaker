# 2026-11-16-algorithm-left-tabs：程式碼頁改為左側三標籤，移除 Trace Studio（規劃）

## 任務資訊
- 負責代理：Claude（Claude Code 桌面版）
- 分支：`claude/2026-11-16-algorithm-left-tabs`（從 intergration `faa26c6` 開出）
- 狀態：已實作（見 delivery.md）。實作依使用者 2026-11-16 的決定調整，與下文規劃不同處以「使用者決定」為準：
  - 標籤名稱：原始碼／**程式碼框**／事件動畫（D6）。
  - 標頭：三個標籤放左側；原本的「C++」字樣移到 RUN 左邊；RUN 維持原位置（D1）。
  - 「輸入」維持在右側分頁（D2，不搬）。
  - 程式碼框與事件動畫按鈕的邏輯、寫入程式碼的邏輯保持不變。
  - 兩個設定標籤都會改動 `@asm-view`，所有調整（含整份動畫的事件設定）都要記入復原歷史（D3：保留歷史並加上 ↶ ↷ 與 Ctrl＋Z／Y）。
  - D4 事件時間線：不做。D5 程式碼片段「放大檢視」按鈕：刪除。
  - 設計風格與原本樣式一致。
  - 實作沿用 `trace-studio.js`／`.css` 檔名與 `window.ASMTraceStudio` 名稱（未另建 `trace-side-panel.js`），減少其他模組與測試的改動。
- 依據：使用者 2026-11-16 指示「重新規劃 algorithm.html 的版面，把 Trace Studio 和編輯動畫改掉。目前只留下程式碼顯示和事件顯示開關，整個編輯動畫可以精簡；把這兩個分開放在左邊，左邊有原始碼、程式碼、事件動畫三個標籤可供調整，就不用 Trace Studio 了。」
- 前提：動畫已完全由指令驅動（`2026-11-14-directive-only-editor`），Studio 只剩「事件」與「程式碼」兩頁。

## 1. 目標
1. 程式碼頁只有一種狀態：左邊調整、右邊看動畫。不再有「進入 Studio／返回程式碼」的切換。
2. 左側面板三個標籤：
   - **原始碼**：寫 C++ 與指令；
   - **程式碼**：畫布上程式碼框要顯示哪些行、外觀；
   - **事件動畫**：哪些事件要播、間隔、自動固定、迴圈邊界。
3. 右邊永遠是正常播放器。左邊的調整都作用在播放器目前那一幀，或者作用在整份動畫；改完立刻在畫布上看到。
4. 資料格式不變：仍寫入 `trace.studio` 保留欄位，並寫回程式碼的 `@asm-view`。舊程式、舊投影片不需轉換。

## 2. 現況盤點（intergration `faa26c6`）

### 版面
```
頂部列： 投影片 程式碼 │ 演算法範例集 我的程式碼 畫布設定 編輯器 [編輯動畫] [事件設定]   帳號
┌ #codePanel ─────┐┃┌ #vizPanel ─────────────────────────────┐
│ C++  ▶RUN  ◀    │┃│ 畫布 | 輸入 | 輸出 | 除錯記錄 | 語法樹   │
│ Ace 編輯器       │┃│ 播放列（⏮◀⏯▶⏭ 進度條 時間 語速 🔴）    │
│                 │┃│ 畫布 + 手繪工具列                        │
└─────────────────┘┃└──────────────────────────────────────────┘
```

按「編輯動畫」進入 Trace Studio：
```
┌ 切片縮圖（rail）┐┌ 畫布 ───────────────┐┃┌ 事件與程式碼（inspector）┐
│ ↶ ↷ 返回程式碼  ││                     │┃│ [事件] [程式碼]           │
│ 每幀縮圖，可多選 ││                     │┃│                          │
│                 │├ 事件時間線 ─────────┤┃│                          │
└─────────────────┘└─────────────────────┘┃└──────────────────────────┘
```
程式碼面板被縮圖列取代；鏡頭改為 Studio 本地鏡頭；按 RUN 會先關閉 Studio。

### 目前的功能與新位置

| 功能 | 現在的位置 | 新位置 |
|---|---|---|
| Ace 編輯器、RUN、摺疊面板 | `#codePanel` | **原始碼**標籤 |
| 程式輸入（stdin） | 右側「輸入」分頁 | **原始碼**標籤下方，可收合（決定 D2） |
| 事件程式碼（程式碼結構按鈕：逐行開關事件） | Studio 事件頁 | **事件動畫**標籤「這一幀」 |
| 自動固定（本幀批次開關） | Studio 事件頁 | **事件動畫**標籤「這一幀」 |
| 事件間隔 | Studio 事件頁＋「事件設定」浮窗（兩處） | **事件動畫**標籤「整份動畫」（只留一處） |
| 自動固定、迴圈邊界總開關；各事件類型的預設動畫／列入事件線 | 頂部「事件設定」浮窗 | **事件動畫**標籤「整份動畫」 |
| 程式碼片段（本幀顯示哪些行、恢復自動篩選、放大檢視） | Studio 程式碼頁 | **程式碼**標籤「這一幀」 |
| 程式碼框外觀（字體大小、滾動時間、最大寬高） | Studio 程式碼頁 | **程式碼**標籤「整份動畫」 |
| 點畫布上的程式碼框 → 切到程式碼設定 | Studio | 切到左側**程式碼**標籤 |
| 切片縮圖列、多選幀 | Studio 左欄 | **刪除**：多選已無作用，跳幀用播放器進度條 |
| 事件時間線 | Studio 畫布下方 | **刪除**；需要的話把事件標記畫在播放器進度條上（決定 D4） |
| 復原／重做 | Studio 縮圖列標題 | 見決定 D3 |
| 右欄寬度拖曳 | Studio inspector | **刪除**；改為左側面板與畫布之間原有的 `#divider` |
| Studio 本地鏡頭、Studio 模式 | `asm-trace-studio-open` | **刪除**：一律使用播放器鏡頭 |
| 頂部「編輯動畫」「事件設定」按鈕 | 頂部列 | **刪除** |

## 3. 新版面

```
頂部列： 投影片 程式碼 │ 演算法範例集 我的程式碼 畫布設定 編輯器                帳號
┌ 左側面板 ───────────────────┐┃┌ #vizPanel ──────────────────────────────┐
│ [原始碼] [程式碼] [事件動畫] ◀│┃│ 畫布 | 輸出 | 除錯記錄 | 語法樹            │
│─────────────────────────────│┃│ 播放列（⏮◀⏯▶⏭ 進度條 時間 語速 🔴）     │
│ （目前標籤的內容）            │┃│                                          │
│                             │┃│ 畫布                                      │
│                             │┃│                                          │
│ ▶ RUN                       │┃│                                          │
└─────────────────────────────┘┃└──────────────────────────────────────────┘
```

- 左側面板沿用 `#codePanel` 的位置、寬度、`#divider` 拖曳與 ◀ 摺疊。摺疊後整個左側收起，三個標籤一起隱藏。
- 標籤列放在面板頂端，取代目前的「C++」標題。RUN 在三個標籤下都看得到：放在標籤列右側，或面板底部（決定 D1）。
- 沒有動畫時，「程式碼」「事件動畫」兩個標籤仍可點，內容顯示「按 RUN 產生動畫後可調整」。
- 記住上次選的標籤（localStorage，讀寫包 try/catch；讀不到就回「原始碼」）。RUN 不會自動切換標籤。

## 4. 三個標籤的內容

每個設定都標明作用範圍：**這一幀**（跟著播放器目前幀）或**整份動畫**。標籤內分兩段，「這一幀」在上（標題顯示「第 12 幀」並跟著播放更新），「整份動畫」在下。

### 4.1 原始碼
- Ace 編輯器（行為不變：Ctrl＋Enter 執行、字體大小選單、`@asm-view` 區塊）。
- 下方「輸入」：可收合的 stdin 區（決定 D2）。
- 左側面板只有這個標籤可直接改程式文字。另外兩個標籤的設定照舊自動寫回 `@asm-view`，原始碼標籤會即時看到區塊內容改變。

### 4.2 程式碼（畫布上的程式碼框）
- **這一幀**：
  - 程式碼片段清單：每行一個勾選框，代表是否收錄到畫布的程式碼框；目前執行行與事件行有標記。
  - 「恢復自動篩選」「放大檢視」（放大檢視＝現在的 snippet focus，決定 D5）。
- **整份動畫**：
  - 在畫布上顯示程式碼框（開關）；
  - 字體大小、片段滾動時間、最大寬高。
- 在畫布上點程式碼框：左側切到本標籤並捲到「這一幀」。

### 4.3 事件動畫
- **這一幀**：
  - 事件程式碼：本幀相關的程式碼結構按鈕，可逐行開關該指令的事件動畫，作用於該指令的所有幀（現行規則不變）；
  - 自動固定：本幀的固定批次開關。
- **整份動畫**：
  - 事件間隔（0–2000 ms）；
  - 自動固定、迴圈邊界事件總開關；
  - 各事件類型的「預設動畫」「列入事件線」（目前「事件設定」浮窗的內容，含帳號層級預設）。
- 改動後立刻以穩定渲染重畫目前幀；播放中調整時先暫停，避免與正在播放的事件衝突。

## 5. 與播放、資料的關係
- **沒有 Studio 模式**：刪除 `asm-trace-studio-open`。
  - `trace-player.js`、`compile.js`、`canva.js`、`trace-editor.js`、`trace-debug-recorder.js` 中「Studio 開著時改走另一條路」的分支一併移除。
  - 鏡頭一律由播放器與 `@camera` 決定。
- **跟隨目前幀**：左側面板監聽 `asm:trace-frame`，更新「這一幀」段落；不另外保存一份 currentIndex。
- **資料**：
  - 沿用 `trace.studio` 的保留欄位：`eventSettings`、`eventStates`、`eventInstructionStates`、`eventColors`、`codeSnippetOverrides`、`codeSnippetSourceOverrides`、`codePanel*`。
  - 沿用 `ASMTraceViewSource.fromTrace`／`applyToTrace` 寫回 `@asm-view`。
  - 寫回時機：現在是關閉 Studio 時寫回。改為每次調整後去抖動（約 400 ms）寫回，另外在 RUN、存檔、匯出前強制寫回。
- **對外 API**：`slides-embed.js` 呼叫 `ASMTraceStudio.flushSourceSettings()`，`trace-editor.js` 呼叫 `refresh()`。新模組提供同名方法；保留 `window.ASMTraceStudio` 別名一個版本，避免投影片頁與快取的舊頁面出錯。
- **相容性**：
  - 舊程式的 `@asm-view`、舊投影片的 trace 照常載入。
  - 明確關閉的事件、`gapMs=0`、自訂事件顏色、程式碼片段覆寫在載入→調整→RUN→存檔→重開後保留。

## 6. 投影片中的動畫編輯器與嵌入頁
- 投影片的動畫編輯器就是 `algorithm.html?asmEmbed=editor`，會直接得到新版面：投影片裡編輯動畫時，同樣在左側三個標籤調整。
- `asmEmbed=runtime`：`slides-embed.css` 目前隱藏 `#codePanel`、`#traceStudioRail`、`.trace-studio-inspector`、`#traceStudioTimeline`。改成隱藏新的左側面板，刪掉三個 Studio 選擇器。
- 介面改版階段 4（展開式編輯器，示意圖 https://claude.ai/artifact/3V4741nMm3dQa1b8qBvYc7）的「右側屬性欄」要改成本規劃的左側三標籤；示意圖於本規劃確認後同步更新。

## 7. 程式結構
- 新增 `public/trace-side-panel.js`（`window.ASMTraceSidePanel`）與 `public/trace-side-panel.css`：
  - 標籤列與切換；
  - 「程式碼」「事件動畫」兩個標籤的內容，從 `trace-studio.js` 搬入：`renderEventCodeEditor`、`renderFrameEventsEditor`、`renderCodeSnippetEditor`、程式碼框外觀、`writeSourceSettings` 等；
  - 「事件設定」浮窗的內容，從 `trace-editor.js` `buildEventSettingsPanel` 搬入。
- 刪除：
  - `trace-studio.js` 的縮圖列、縮圖快取與 culling、事件時間線、inspector 寬度、Studio 鏡頭、多選；
  - `trace-studio.js`、`trace-studio.css` 全檔（搬完後）；
  - `trace-editor.js` 的「編輯動畫」「事件設定」按鈕與浮窗；
  - `algorithm.html` 的兩個頂部按鈕；
  - `local-camera.js` 的 `setLocalCameraStudio`（確認無其他使用者後）。
- `algorithm.html`：
  - `#codePanel` 內加入標籤列與三個標籤容器，Ace 編輯器移到「原始碼」容器；
  - 「輸入」從右側分頁移到「原始碼」標籤（決定 D2）；
  - 版本號更新。
- 手機版（`mobile-ui.css`／`mobile-ui.js`）：左側面板在窄螢幕已是上下堆疊或抽屜；標籤列改為可橫向捲動，維持現有切換方式。

## 8. 實作步驟（每步各自可驗證）
1. **左側標籤殼**：在 `#codePanel` 加入三個標籤。原始碼放 Ace，另兩個先放空狀態；RUN、摺疊、divider、手機版照常。
2. **事件動畫標籤**：搬入 Studio 事件頁與「事件設定」浮窗。「整份動畫」與「這一幀」都可用並寫回 `@asm-view`；頂部兩個按鈕暫時保留。
3. **程式碼標籤**：搬入程式碼片段與程式碼框外觀；點畫布程式碼框切到此標籤。
4. **移除 Studio**：
   - 刪除「編輯動畫」「事件設定」按鈕與 Studio 模式分支；
   - 刪除 `trace-studio.js`／`.css`、縮圖列、事件時間線；
   - `slides-embed.css` 改隱藏新面板；
   - 保留 `ASMTraceStudio` 別名。
5. **輸入搬到原始碼標籤**（D2 確認後）。
6. **文件**：
   - 更新 `docs/reference/algorithm-visualization-directives.md` 中「Trace Studio」的說明與入口描述；
   - 更新 `docs/guides/` 相關操作說明；
   - 更新介面改版規劃 3.4 與階段 4 示意圖。
7. **測試**：見第 10 節。

## 9. 待使用者決定

| # | 問題 | 建議 |
|---|---|---|
| D1 | RUN 放在哪 | 標籤列右側（三個標籤都看得到，位置固定） |
| D2 | 「輸入」放哪 | 搬到「原始碼」標籤下方、可收合；右側只剩 畫布／輸出／除錯記錄／語法樹 |
| D3 | 復原／重做 | 拿掉 Studio 自己的歷史。設定都寫進 `@asm-view`，在原始碼標籤按 Ctrl＋Z 即可還原，載入時會重新套用區塊。另一個選項是在兩個標籤頂部保留 ↶ ↷ |
| D4 | 事件時間線 | 不保留獨立時間線；先不加。若需要，再把事件類型的色點畫在播放器進度條上 |
| D5 | 程式碼片段「放大檢視」 | 保留，放大的是左側清單本身 |
| D6 | 標籤名稱 | 依使用者用語：原始碼／程式碼／事件動畫。若怕「原始碼」「程式碼」混淆，可改為「原始碼／程式碼框／事件動畫」 |

## 10. 測試
- 31 個測試檔引用 Studio（`ASMTraceStudio`、`asm-trace-studio-open`、`trace-studio-*`、`editAnimationBtn`、`eventSettingsBtn`）。
- 改寫為新面板：
  - `trace-code-snippet.browser`、`directive-only-studio.browser`、`studio-availability-preflight.browser`、`code-panel-settings.browser`、`event-settings-source.browser`、`event-gap.browser`、`read-highlight-defaults.browser`、`auto-fixed-playback.browser`、`events-fixed-state.browser`；
  - `event-code-tree`、`studio-event-availability`、`entrypoints`、`mobile-ui`。
- 刪除：`studio-virtual-rail.browser`（縮圖列）。
- 只把 `ASMTraceStudio.open()` 當作「打開以檢查事件按鈕」的測試，改成檢查左側事件動畫標籤：
  - `presentation-camera`、`scene-load-performance`、`automark`、`events-batch-arrows`、`keep-camera-focus`、`linear-keep-layout`、`merge-focus-layout`、`heap-caller-marker-reentry`、`text-arrays`、`source-newlines`、`trace-chunks`、`reserved-root-intro`、`canvas-mouse-shortcuts`、`algorithm-default-sieve`；
  - 整合測試 `playback-parity`、`eight-queens-or-sample`。
- 新增 `trace-side-panel.browser.test.js`：
  - 三個標籤切換與記憶；
  - 播放時「這一幀」跟著更新；
  - 關閉一個事件後立刻重畫並寫回 `@asm-view`；
  - 調整程式碼片段後 RUN、存檔、重開仍保留；
  - 沒有動畫時的空狀態；
  - 摺疊左側面板。
- 投影片：
  - `asmEmbed=runtime` 不顯示左側面板；
  - `asmEmbed=editor` 可在左側調整，並由 `flushSourceSettings` 存回投影片。

## 11. 驗證（V2，涉及動畫設定與 Trace 還原）
- 三種情況都要經過「載入→在兩個標籤調整→RUN→存檔→重開」：新程式、含 `@asm-view` 的舊程式、缺少新欄位的舊投影片。
- 明確關閉的事件、`gapMs=0`、自訂事件顏色、程式碼片段覆寫不得被清掉。
- 動畫完整驗證集由主代理依影響範圍執行；開發端只跑第 10 節相關測試。

## 12. 風險
- **寫回時機改變**：從「關閉 Studio 才寫回」改為「調整後去抖動寫回」，會更頻繁地改動 Ace 內容與 freshness 指紋。要確認 `@asm-view` 的變動不會讓紅點誤亮，也不會觸發不必要的重新編譯。現行規則是區塊變動只影響呈現，需以 `trace-freshness` 測試確認。
- **播放中重畫**：目前 Studio 會先停住播放器並使用自己的渲染深度（`studioRenderDepth`）；新面板直接在播放器上重畫，需處理播放中與事件動畫進行中的調整。
- **測試量大**：31 個測試檔依賴 Studio。建議第 2、3 步先保留 `ASMTraceStudio.open()` 為「切到事件動畫標籤」的相容 API，讓舊測試逐步遷移，第 4 步再刪除。
- **兩個代理共用**：本工作會大改 `algorithm.html`、`trace-editor.js`，並刪除 `trace-studio.js`。實作期間避免其他代理同時修改這些檔案。
