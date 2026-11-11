# 共用事件排程：漏接物件盤點與修正建議

2026-11-11：使用者已授權依建議修正；A／B／C2／D及線段樹同格多欄位修正已完成局部驗證。此處保留原稽核基準與實測紀錄，落地範圍及驗證結果見 [交付紀錄](2026-11-11-event-follow/delivery.md)。

## 任務資訊

- 負責代理：Claude（Claude Code 桌面版）
- 狀態：盤點與重現完成，**尚未修改程式**；修正方向需使用者確認
- 盤點基準：intergration `c811a49`（fix: align heap peer pointer entry and live arrow anchors）
- 分支：`claude/2026-11-10-event-follow-audit`（只新增本檔）
- 日期：2026-11-10

## 要回答的問題

「共用事件排程」指同一次 `play()` 的播放計畫與時鐘（`trace-frame-tween.js`），以及 2026-11-09 建立的 `createExecutionContext` 事件前／後狀態（見 [共用事件執行狀態](shared-event-execution-state-2026-11-09.md)）。規格要求物件在「改變它的那個事件」才變化，內部操作不能提前換值（[事件規格](../../reference/event-contracts.md)「單一事件流程」）。

本次檢查：指標以外，還有哪些會隨執行值改變的物件沒有接到這套排程。

## 方法

1. 讀程式：列出所有會動的物件與它們的時鐘（`setTimeout`、`requestAnimationFrame`、SVG SMIL、CSS transition），並確認每一種是否受暫停、倍速、取消控制。
2. 實測：在隨機埠啟動 `c811a49` 的 `server.js`，Edge 無頭瀏覽器以 1 倍速播放第 0→1 幀。每個 rAF 記錄目前作用中的事件（`root.dataset.traceActiveEventId`）與被追蹤物件的位置／文字，再依事件分段。

每個案例都是「先做一件無關的事 → 改變 i（或 k、j）→ 再做一件無關的事」，觀察物件是在第幾個事件變化。

探針腳本在 Claude 暫存目錄（未提交）：`follow-probe.js`、`follow-probe-text.js`；用法 `node follow-probe.js <algo-vis-backend 目錄>`。

## 結果總表

| 案例 | 物件 | 預期變化時機 | 實測 | 判定 |
|---|---|---|---|---|
| `i+k` 指標 | `@pointer i+k at a` | `i=1` 時移一次、`k=2` 時再移 | `i=1` 事件內 560→664；`k=2` 事件內 664→737；中間無關事件不動 | 正確 |
| 衍生指標 | `@pointer i,i-1 at a` | `i++` 時兩個同步移 | 只在 `write:i++` 事件內同步移動 | 正確 |
| 多目標指標 | `@pointer j at s,p` | `j=2` 時兩個同步移 | 只在 `j=2` 事件內同步移動 | 正確 |
| 文字值 | `@text "i = ${i}"` | `i=2` 事件後才顯示 2 | **幀一開始就顯示 `i = 2`**（i 有無顯示皆同） | 漏接 |
| 箭頭端點 | `@arrow from b[0] to a[i]` | `i=2` 事件時端點移到 a[2] | **在第一個無關事件 `b[0]=7` 期間就移到 a[2]**（i 有無顯示皆同） | 漏接 |
| 索引反白 | `@style a[i] highlight` | 見下方「政策」 | **幀一開始就在 a[2]** | 依現行規格屬幀語意 |

指標類（`@pointer`）已完整接上：位移時機、衍生運算式、多目標都由事件驅動，與 11-09 的修正一致。

## 發現

### F1（高）`@text` 的 `${運算式}` 用幀末值，幀一開始就換字

- 位置：`trace-renderer.js:4849` 起，`resolveTextExpression(document, frame, …)` 以整幀的 `frame`（幀末狀態）求值；renderer 在幀開始時一次畫好。
- 實測：`a[0]=7; i=2; a[2]=9;` 這一幀，從第 0 ms 起就是 `i = 2`，比 `i=2` 事件（約 1950 ms）早將近 2 秒。
- 影響：教材常用「目前是第 ${i} 格」「sum = ${sum}」說明文字。觀眾會先看到答案，再看到動畫做出這件事，與指標行為不一致。TTS 旁白也是幀開始就念出新值。

### F2（高）`@arrow` 端點用幀末位置，在第一個事件期間就滑到終點

- 位置：`trace-frame-tween.js:10554` `arrowProgress = easeOutCubic((elapsed - initialDelay) / duration)`，箭頭補間只跟整幀的 `duration`（預設 520 ms）走，不看是哪個事件改了端點。端點目標來自幀末 DOM。
- 實測：箭頭在第一個事件 `b[0]=7`（0–1440 ms）期間就從 a[0] 移到 a[2]；`i=2` 事件發生時已經在終點，什麼都不做。
- 影響：箭頭看起來像是被無關的操作帶走；`k=2` 之類的後續事件也不會再引起任何變化。

### F3（政策待定）`@style a[i]` 依幀語意，幀一開始就換格

- 共用執行狀態紀錄明確寫「作者的 style、camera 與 keep 仍依幀……處理，不改為每次內部狀態改變都執行整套指令」，所以這是**目前規格的刻意設計**，不算 bug。
- 但從使用者角度，指標跟著事件走、反白卻先跳到終點，兩者並排時很明顯（例如 `@pointer i` 加 `@style a[i] highlight`：反白先到 a[2]，指標約 2 秒後才到）。需要使用者決定是否改變政策，見下方「修正建議 C」。

### F4（中）程式碼面板捲動用獨立時鐘，不受暫停與倍速控制

- 位置：`trace-code-presenter.js:508`、`:680`，以 `setTimeout(codePanelScrollMs + 40)` 結束換頁，加上 CSS transition。
- `trace-player.js` 的完成條件是 `Promise.all([畫布轉場, 程式碼面板轉場])`，所以 4 倍速時一幀仍至少等滿約 500 ms 的捲動；暫停時捲動也不會停。
- 規格允許捲動「使用獨立時鐘」，但沒有說可以不理暫停與倍速。這不是漏接物件，是時鐘不一致。

### 已確認沒有問題

- 鏡頭（`canva.js` `animateCamera`）：自己的 rAF，但會看 `ASMTraceFrameTween.isPaused()` 平移起點；時長在 `trace-camera.js` 依倍速縮放，計畫保留的是未縮放值，再由排程時鐘縮放，兩者一致。
- `trace-renderer.js` 的 SMIL `beginElement` 與 ghost `setTimeout`、`draw_arrow.js` 的 rAF／CSS 淡出：只在沒有 frame tween 的舊路徑（舊版 CodeScript）使用，trace 播放不會走到。
- 換幀取消：`renderFrame` 每次先 `cancel()`。

## 根因

指標有專門的「事件跟隨」機制：`createExecutionContext` 提供事件當下的值，`markerAssignmentMotion` 依事件時間排位移，`markerMatchesEventTarget` 用 `traceSourceVariableIds` 找出依賴的變數。

文字、箭頭（以及 style）沒有對應的機制：renderer 在幀開始時以幀末狀態一次畫完，排程器只負責整幀共同的進場補間。它們的運算式裡用到的變數沒有被登記成「依賴」，所以事件發生時沒有人通知它們。

## 修正建議

### 設計：一個共用的「依賴跟隨」層

把指標已經在用的做法抽成通用層，讓任何「內容或位置取決於執行值」的作者物件都能掛上去：

1. **登記依賴**（renderer 畫物件時）
   - 解析物件運算式用到的變數，寫進 `data-trace-source-variable-ids`（指標已有同名欄位，可共用 `markerSourceVariableIds`）。
   - 文字：`${...}` 與 expression segment 裡的變數。
   - 箭頭：兩端的索引運算式（例如 `a[i]` 的 `i`、`b[j+1]` 的 `j`）。
   - 同時記下 lifetime／runtime identity，沿用 `markerMatchesEventTarget` 的比對規則。
2. **決定檢查點**（建立播放計畫時）
   - 對每個登記的物件，找出本幀內「寫入任一依賴變數」的事件，依序成為它的檢查點。沒有檢查點的物件從頭到尾不變。
   - 每個檢查點的值由 `createExecutionContext` 取得（事件後狀態），**不要**再用 `frame.state`。
   - 幀開始時物件顯示「第一個檢查點之前」的值，也就是事件前狀態。renderer 需要能用指定狀態求值，而不是固定用幀末 `frame`。
3. **在檢查點套用變化**（播放時）
   - 文字：在事件提交時間（該事件的 commit time，與賦值抵達同一刻）替換內容；可選 220 ms 淡入淡出，與一般入場同一個時長常數。
   - 箭頭：該端點以 `MOTION_TIME.move`（520 ms）從舊位置移到新位置，起點對齊事件的位移開始時間，與同事件的指標一致。多個檢查點就分段移動。
   - 時間全部放進播放計畫，跟隨暫停、倍速、取消；不得另開 `setTimeout`。
4. **關閉動畫與跳幀**
   - 事件被明確關閉時，仍依規格「停用動畫的事件仍按順序提交狀態」：在該事件位置直接換成新值，不播位移。
   - 跳幀、上一幀、穩定渲染：直接畫幀末狀態，不經過檢查點（與現在相同）。

### 修正建議 A：`@text`（對應 F1）

- 改動：`trace-renderer.js` 文字求值改為接受「求值用的狀態」，預設仍是幀末（穩定渲染用）；frame tween 播放時改用事件前狀態，並登記依賴與檢查點。
- 注意：
  - 文字寬度會隨內容改變；自動寬度與 `@text ... at x.bottom` 的定位要在每個檢查點重算，避免換字時位置跳動。
  - TTS 旁白目前在幀開始就念整幀文字。建議旁白仍念幀末內容（說明文字通常描述這一幀做完的結果），只有畫面上的字依事件換。是否要讓旁白也分段，交給使用者決定。
  - `@let` 別名、`when` 條件文字也走同一條求值路徑，要一起處理；條件由不成立變成立時，文字在該檢查點入場（220 ms）。

### 修正建議 B：`@arrow`（對應 F2）

- 改動：`trace-frame-tween.js` 箭頭補間從「整幀 `duration` 的單一進度」改成「依端點檢查點分段」。沒有依賴變數的端點（例如固定 `b[0]`）維持現狀。
- 注意：
  - 端點所在格子本身也可能在同一事件移動（交換、插入騰位）。端點位置要取該 tick 的實際 SVG 位置（目前 10560 行後的註解已是這個原則），檢查點只決定「指向哪一格」。
  - 目標格子在事件當下不存在（例如尚未 push）時，沿用 2026-11-10 `missing-pointer-target` 對指標的處理方式。
  - 遞迴樹新邊的 `recursionDeclarationClock` 已有自己的時鐘，保留不動。

### 修正建議 C：`@style a[i]` 的政策（對應 F3，需使用者決定）

| 選項 | 做法 | 優點 | 代價 |
|---|---|---|---|
| C1 維持現狀 | 幀語意，幀開始即套用 | 不動規格；手寫 style 可預期 | 與指標並排時不同步 |
| C2 只讓「含執行值索引」的 style 跟隨 | `a[i]` 這類依賴 i 的 style 走建議中的檢查點；`a[0]` 這類固定索引維持幀語意 | 與指標一致，影響範圍小 | 規格要改寫「style 依幀」一節；同一幀內 style 會移動 |
| C3 全部 style 依事件 | 所有 style 規則每次狀態改變都重算 | 最一致 | 與現行規格衝突；效能與相容風險最高 |

建議 **C2**：只有運算式含執行變數的 style 跟隨事件，其餘不變。這和 A、B 共用同一個依賴跟隨層，額外工作量小。

### 修正建議 D：程式碼面板時鐘（對應 F4）

- 改用與 `trace-frame-tween.js` 相同的倍率（`asmGetAnimationPlaybackRate`）縮放 `codePanelScrollMs`。
- 暫停時凍結：與鏡頭相同做法，rAF 內看 `ASMTraceFrameTween.isPaused()` 平移起點；或把捲動完成時間交給播放計畫。
- 範圍小，可獨立先做。

## 相容性

- 不需要改 Trace 或 `.asmdeck` 格式：依賴變數由 renderer 從既有的 directive 運算式解析，寫在 DOM metadata（與矩陣指標的列／欄運算式同一做法）。
- 舊 Trace 缺少事件 mutation 時，`createExecutionContext` 已有「單次 mutation 才沿用前後快照」的保守規則；無法確定中間值的物件應退回現行行為（幀開始即為幀末值），不猜中間值，並在除錯紀錄提示重新 RUN。
- 明確關閉的事件、`gapMs`、自訂顏色等設定不受影響。

## 驗證計畫（修正時）

- 固定答案（手寫，不由播放計畫產生）：本次 6 個案例各寫入預期的「在哪個事件、變成什麼值／哪一格」。
  - `@text "i = ${i}"`：`a[0]=7` 期間為 `i = 0`，`i=2` 提交後為 `i = 2`。
  - `@arrow ... to a[i]`：`b[0]=7` 期間指 a[0]，`i=2` 位移後指 a[2]。
  - `@text` 與 `@arrow` 依 `i+k` 兩段變化各一例。
  - C2 採用時，`@style a[i]` 同上。
- 實際 SVG 取樣：沿用本次探針的方法（每 rAF 取位置／文字，對照 `traceActiveEventId`），1 倍與 2 倍速、暫停續播各一次。
- 回歸：指標相關現有測試（`execution-state.browser.test.js`、`pointer-event-reflow.browser.test.js`）、文字自動寬度、箭頭相關測試、預建範例的播放檢查。涉及動畫，主代理依 V2／V3 決定範圍。
- 舊資料：缺少事件 mutation 的舊 Trace 載入後退回幀語意且無錯誤；儲存重開。

## 優先順序

1. **A（`@text`）與 B（`@arrow`）**，以及兩者共用的依賴跟隨層。先做 B 可最快驗證「檢查點」設計，因為它和指標位移最像。
2. **C 的政策決定**；若採 C2，在同一層上加入 style。
3. **D（程式碼面板時鐘）**，可平行獨立進行。

## 未驗證與限制

- 只測了 normal 陣列與單層 `main`；遞迴、keep 快照內的文字／箭頭、heap／tree 結構上的箭頭未測。
- 未測 `@let`、`when` 條件文字、`@camera` 綁定到 `a[i]` 的鏡頭跟隨。
- F4 只從程式碼推論，未實測。
- 探針以 `getBoundingClientRect` 取位置，未逐像素比對；變化時機的判斷以事件分段為準，誤差在一個 rAF 內。
