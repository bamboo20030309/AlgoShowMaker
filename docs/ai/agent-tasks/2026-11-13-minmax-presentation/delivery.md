# max/min 選值動畫調整

## 任務與結果

依使用者要求移除選值動畫自動加入的深灰 5px 粗框。max/min 不再借用一般比較的結果框；兩方先同時抬起，再只縮放 Trace 實際選中的來源，最後一起放下。max 選中格子為 1.25 倍，min 為 0.8 倍；同值不猜測左右，由 selectedSourceRole 決定。

縮放由整個幀的事件排程保存，包含後續賦值與其他事件；幀完成或取消時清除，不寫入 Trace 或作者的 style。格子數字保持字形比例，指標箭頭與格子縮放保持對應。保存的排版節點使用相同的幀級生命週期補上 SVG 投影及清理。

一般比較動畫及使用者自行設定的框線不改。前端 tween 更新至 trace-355，投影片 iframe 更新至 trace-runtime-113；不需要重新編譯既有 Trace。

## 驗證與標準答案

- 新增 tests/minmax-presentation.browser.test.js：實際編譯 max/min 不等值與同值案例，在 1x、4x 逐時取樣 SVG。固定答案包含兩方抬起、僅選中格子縮放、一起回到原高度、後續事件仍維持縮放、幀結束還原，以及沒有深灰 winner 框。另包含指標及 mark 的物件。
- tests/lcs-axis-events.browser.test.js：LCS 完整原測資，1→2、4→5 幀指標及單一黑色箭頭驗證通過；更新舊 winner 框的斷言為不得出現。
- tests/assignment-baseline.browser.test.js：線段樹輸入、運算及不可見來源的賦值落位基線通過。
- tests/retained-compare.browser.test.js：核對既有保存節點比較、指標跟隨及明確關閉設定，驗證通過。
- node --check 與 git diff --check；不執行完整 regression，不提交 test-results。
