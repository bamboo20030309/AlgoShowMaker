# 固定行為規則：判斷畫面是否符合要求

更新：2026-10-06。整理本專案交付紀錄、已知回歸與使用者回報的 Trace 問題。
這是歷史問題的分類與驗收索引，不是宣稱所有問題已修好。表列「既有」代表已有相關測試入口，並不表示本輪重跑或完整覆盖；完整 V3 仍有未通過項目。

## 答案從哪裡來

1. **固定答案**：由輸入與程式語義手算，例如 `j=1` 時 `j+1=2`、`i++` 後索引為 1、比較 `8>7` 時左標籤較高。答案不能從 renderer 或 forwardReplay 計畫取得。
2. **實際畫面**：讀取 SVG 標籤、binding、位置、顏色與有效透明度。位置需在同一 canvas 座標系比較；有效透明度需包含文字／矩形到祖先的內層 motion wrapper，不能只看最外層 group。
3. **時序一致性**：錄影與 replay 計畫的提交時機比對，能抓提前更新或畫面未同步；這是共用計畫的答案，不能獨立證明計畫正確。需搭配前兩種證據。

共用固定答案入口為 `algo-vis-backend/scripts/trace-behavior-rules.js` 的 `validateBehavior(snapshot, contract)`；snapshot 來自 DOM，contract 由 fixture 提供。已指定的物件缺失、重複標籤或缺少幾何資料必須失敗。錄影不能空白、截斷後仍算通過。

## 歷史問題與固定規則

以下測試檔均位於 `algo-vis-backend/tests/`。只選受影響的分類；不要因為這份清單而一次執行全部。

| 編號／分類 | 過去遇到的問題 | 固定行為與判斷答案 | 對應驗證入口 |
|---|---|---|---|
| T01 指標運算 | 插入排序第 11 幀 `j+1` 飛到右側，數字字串被接成 11 | 依數值解算，`j=1` 必須指向索引 2；前進、後退、重開一致，運動不飛出相鄰格範圍 | `insertion-relative-index.browser.test.js`；本輪接入固定答案 |
| T02 指標生命週期 | 選擇排序第 2→3 幀 min_idx 提早退場；i 退場又在舊位置出現 | 指標綁定仍有效時不能因數字本體隱藏就退場；視覺退場不等於 C++ lifetime 結束，新一輪不得繼承舊的入場狀態 | `selection-lifecycle.test.js`、`selection-pointer-lifecycle.browser.test.js` |
| T03 指標順序 | min_idx/i 突然換位；兩標籤重疊 | 同錨點的穩定排列依作者 `arr[...]` 順序。`arr[min_idx,i]` 先 min_idx，下一輪 `arr[i,min_idx]` 可改先 i；不要求全域順序永不變 | `selection-pointer-lifecycle.browser.test.js`；本輪接入固定答案 |
| T04 下一輪／反向 | i++ 後指標仍在 0；切回後位置錯誤 | 下一輪固定索引 1；反向到前輪恢復 0；回放及儲存重開不得失去更新 | 同上；本輪接入固定答案 |
| T05 比較方向 | 冒泡第 2→3 幀左大反而下壓、右小抬升 | 固定輸入比較 8>7：j 在左且高於 j+1；先按邏輯操作數判斷，不被交換後物理 SVG 值誤導。2<5 的判定相反 | `bubble-compare-pointer.browser.test.js`、`retained-compare.browser.test.js`、`truthy-compare.integration.test.js`；本輪接入固定答案 |
| T06 標籤重疊 | 入場、退場、下一輪後標籤擠在一起 | 只查事件前後與幀前後穩定定點，實際可見 label rectangle 不能重疊；動畫交換中的交叉允許。不改交換路徑來躲測試 | `animation-assertions.test.js`、`pointer-model.browser.test.js`、選擇排序瀏覽器測試 |
| T07 綁定／未解析 | 指標指向錯格、陣列子指標丟失、無法解析的位置亂顯示 | binding 必須对应指定陣列與索引；未解析／越界依既有規格處理，不能把不存在格子當作正常錨點。負索引不可一律當 bug（例如 j=-1、j+1=0） | `pointer-directives.test.js`、`pointer-children.browser.test.js`、`unresolved-markers.test.js` |
| T08 呼叫與遞迴 | heap 隱藏 caller 後標籤不回來、指標重排／回傳錯位 | 區分呼叫者、當前函式與遞迴層，回到 caller 恢復正確 lifetime／索引；不能按名稱把不同層合併 | `heap-caller-marker-reentry.browser.test.js`、`heap-marker-assignment.integration.test.js` |
| T09 指標塗色／透明度 | 選取、事件／反向後顏色或透明度失同步 | 檢查實際 label／anchor 塗色、前後設定與有效透明度；被明確關閉的事件不動畫但 metadata 保留 | `pointer-anchor-paint.browser.test.js`、`pointer-opacity.browser.test.js`、`reference-alias-style.browser.test.js` |
| T10 style 與值同步 | 插入排序 value/index 著色在事件中不同步；swap 後 style 套錯值 | 固定比較條件與輸入獨立決定顏色，判斷索引 style 與 value style 的語義；事件前後及進度均需核對 | 大型 `insertion-style-labels`、`quick-style-swap`；既有 V3 有失敗，不能標完成 |
| T11 keep 不變 | keep 從側邊飛入、被後續值覆寫、反向後消失 | 凍結已保存的值與樣式；一般 keep 不重演入場，明確遞迴 growth 允許生長但不能消失；live 與 snapshot identity 分開 | `linear-keep-frozen.browser.test.js`、`keep-directives.test.js`、`animation-assertions.test.js` |
| T12 keep/layout | Merge Sort 最後一幀所有 keep 疊在一起；新增層箭頭／物件不同步 | layout 拓撲與各層順序正確，移動保持相對配置；不能以固定螢幕位置要求 keep 永不移動。新層生長與箭頭延伸遵循已有 layout 規格 | `linear-keep-layout.browser.test.js`、`layout-growth.browser.test.js`、`keep-arrow-layer.integration.test.js` |
| T13 相機 | 冒泡第 11 幀鏡頭停在舊 keep；切頁／展示鏡頭錯位 | focus 當前 live arr，不抓同名快照；比較 world 座標避免相機 easing 誤判物件移動；縮圖／嵌入保留相同規則 | `keep-camera-focus.browser.test.js`、`camera-embed-parity.test.js`、`presentation-camera.browser.test.js` |
| T14 完成畫面／裁切 | 最後 arr 提早退場；offscreen culling 被當作刪除 | 最後教學幀 arr 保留可見；自然 scope cleanup 預設不毀掉手動最終畫面，明確開關優先。裁切只豁免確實在 viewport margin 外、節點仍存在且 intrinsic opacity 完整的物件 | 選擇排序瀏覽器測試、`animation-assertions.test.js`、`trace-viewport-culling.browser.test.js` |
| T15 值提交／順序 | 賦值提前顯示新值、陣列操作首格漏出、事件被類型排序打亂 | 依 runtime order 逐一執行，每個 mutation 按自身 commit 提交；固定程式的輸出／中間值另作獨立答案 | `sequence-commit.browser.test.js`、`sequence-layout-timing.browser.test.js`、`assignment-detached-source.browser.test.js`、`animation-assertions.test.js` |
| T16 宣告與事件粒度 | assign 被拆太多、連續宣告未拆、vector 建構產生多餘呼叫 | `int n=0,m=0` 為 declare n/assign n/declare m/assign m；無初值不造 assign；容器 assign 是單一賦值，建構內部非需求呼叫不顯示多餘動畫 | 依指令／事件分類選最小解析 fixture；本文件記錄規則，不宣稱此次新增完整粒度測試 |
| T17 code／事件標籤 | 隱藏事件仍影響時間軸、code 標示與當前事件錯行 | 關閉僅停動畫、來源仍可編輯；目前 active event 與 code source 對齊，宣告／賦值、流程跳轉名稱與合併開關一致 | `code-only-events.browser.test.js`、`trace-code-snippet.test.js`、`trace-code-snippet.browser.test.js`、`auto-fixed-playback.browser.test.js` |
| T18 資料還原 | 新引擎拒絕舊 Trace、重開後位置／自訂設定不同、不同程式拿到舊結果 | 缺欄位採相容預設，保留明確 false/0 與自訂 style；來源指紋不同不能套旧 Trace，未來不支援格式須明確報錯。相容不能只測新建資料 | `trace-bundle-compatibility.test.js`、三個新歷史 bug 瀏覽器測試的 legacy/儲存重開模式 |

## 新增與仍待補強的差別

本輪新增 `trace-behavior-rules.test.js` 十個正反例，覆蓋固定索引、缺失／重複指標、作者順序、缺失幾何、下一輪／反向、左右比較方向、操作數錯位、相等值、最終可見性與固定值。三個歷史 bug 瀏覽器測試接入相同判定入口，仍保留原本連續 RAF、非重疊、運動範圍等額外斷言。

T10 的 style 中間進度、T12 完整 keep 配置，以及 T16 事件粒度的所有語法組合，不能因新增共用判定器便視為全面補齊。應把每次確認的歷史故障 fixture 加入相關分類，再提供固定答案與錯誤反例。已有 V3 失敗仍需追查第一個違規時間點；不得直接更改答案、放寬像素或略過缺失節點。

## 使用方式

T20「索引格子初始化純量」：`int key = arr[i]` 若來源格子可見，必須複製格子與數字共同移動，不能只有文字；來源保持原值與可見，複製格子沿用來源樣式，落地後清除副本。第一次插入排序的獨立答案為 `arr[1]=8`、`key=8`。明確關閉時不播放轉移，舊 Trace 經載入與 JSON 儲存重開仍適用。入口：`declaration-cell-copy.browser.test.js`；容器與算式初始化由 `arithmetic-assignment.browser.test.js` 保護。

新增 T19「明確停用的陣列插入」：`push_back` 開關關閉時，目的格的值、框、索引直接呈現，不另觸發通用入場淡入。固定輸入來源 `[27,38]`，先插入 27 再 `i++`；在後續遞增期間，值必須為 27，格子及索引有效透明度均至少 0.99，不能殘留轉移物件。入口：`sequence-commit.browser.test.js`，涵蓋正常／四倍速、手動／自動播放與明確關閉。它使用独立的小型 fixture，避免教材頁面增刪導致固定幀號失效。

在 `algo-vis-backend` 執行，第一個指令只驗證判定器，第二個只驗證三個歷史指標問題；第二個自行啟動隔離服務與 Edge，序列執行避免編譯資源互搶：

```sh
node --test tests/trace-behavior-rules.test.js tests/animation-assertions.test.js
node --test --test-concurrency=1 tests/insertion-relative-index.browser.test.js tests/selection-pointer-lifecycle.browser.test.js tests/bubble-compare-pointer.browser.test.js
```

交付記錄需寫：T 編號、fixture／輸入、人工推導答案、採樣幀／事件／速度、是否測新舊與重開、首個實際違規及報告路徑、執行環境與通過／失敗／未執行。只引用 replay 計畫時需注明「時序一致性」，不得寫成獨立標準答案。
