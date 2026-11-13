# LCS 欄指標事件定位修正

## 重現

- 使用者提供完整 LCS 程式，輸入為 `abcdedcba` 與 `edcbabcde`，指定第 1→2、4→5 幀。
- Trace 已正確記錄 j++：1→2、4→5；穩定終態的欄指標正確，但動畫中移往矩陣左方的 unresolved 停靠位置，最後再跳回。
- 播放事件快照將 S、T、i、j 作為 locals 傳入共用 resolveExpression。舊 parser 一遇到 locals 名稱就直接回傳，未處理 `.size()` 或 `[index]`。preset 的 `@let rows=S.size()`、`columns=T.size()` 因此解析失敗，連無關的 j 也回傳 null，造成指標目標被錯判 unresolved。

## 修正

- locals 與 frame 變數共用既有索引、size()/length 後綴解析；單純量仍保留原有局部值優先語意。未增加字串或 LCS 特例，不從幀末 DOM 猜指標位置。
- 不改 C++、插樁、Trace 格式或 max 樣式；相容既有 Trace。前端 trace-rules 更新 trace-35-locals1，slides-357、iframe trace-runtime-112。
- `max` 目前的深灰粗框是明確的選值效果：比較後對被選來源加入 #333333、5px 的 winner outline，再進行賦值；與使用者的 highlight 指令及讀取強調不同。本輪依使用者提問核實並保留，未自行換顏色。

## 驗證與標準答案

- tests/lcs-axis-events.browser.test.js：完整使用者程式與輸入；用實際矩陣第 0 列格子中心作獨立答案，指定兩段 j++ 都向右移一欄 40 世界座標單位。全程不可跑往左側停靠位置，後續事件前須抵達目標。1x／4x 通過。
- tests/expression-local-postfix.test.js：局部字串 size/length/index、陣列 size/index、局部值覆寫幀末值、相依 @let、0 與 false、未支援方法的拒絕，共用解析契約通過。
- tests/pointer-matrix-color.browser.test.js、tests/pointer-expression.browser.test.js 通過，包含新／舊指標、明確設定與 IndexedDB 保存重開。
- 共 4 個相關測試通過；改動 JS 語法與 git diff --check 通過。僅操作隔離服務與瀏覽器，不跑大型驗證、不改使用者分頁、不重建全站 Trace。

## 交付

intergration 提交並推送，重啟與核對 3100；main／3000 與 Release 不變。
