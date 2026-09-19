# 2026-09-19-beta-heap-animation-timing：Heap 跨幀動畫時機修正

## 任務資訊
- 負責代理：beta
- 狀態：待交付
- 共同基準 commit：fa278c87b3d7fedef11b0b2af4f3fc8b3a0994e4
- 分支：codex/2026-09-18-beta
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-beta

## 問題與預期結果
- 情境與操作：執行 `algorithm_sample/Tree/heap.cpp`，觀察第 1→2 幀、第 4→5 幀，以及第 13→14 幀的指標生命週期動畫與比較 highlight。
- 目前行為：目標 heap 在 `push_back` 前已採用新層級寬度；先前只延後 rect 寬度後，value/index 文字與部分 index 位置仍會提早跳到目標幾何。一般 highlight 曾被縮成只框 value；舊 lifetime 的 `now = parent` 賦值框先後因近似高度計算而偏低或偏高。第 13→14 幀的舊 `parent` 雖尚未實際退場，排版已提早釋放其位置，導致移入同一格的 `now` 與它重疊。heap 內縮時，最外層容器又沿用一般跨幀時序而提早移動，早於 outerframe 的 sequence resize。
- 使用者希望的結果：新格正式加入前，既有 value 框、index 框及框內數字都維持原位與原尺寸；outerframe 擴張時，完整格子才同步向右延伸，數字移到新中心；內縮時也要在 outerframe 開始縮小前保留所有剩餘格子與數字的位置，之後與 outerframe 同步收縮到新位置；一般 highlight 包含 index，compare highlight 啟動時暫停一般 highlight，且 compare 只框 value；不同 lifetime 的 `now` 不互相觸發讓位；舊 `now = parent` 依 heap 父子節點的完整 x/y 幾何移動；新 `now` 入場箭頭朝下。
- 本次範圍與必要限制：修正 heap 繪圖與共用 trace tween；不改 heap 範例內容；只做 V2 專項小驗證，不跑完整 regression。

## 需求確認
- 已從使用者或上下文確認：三個畫面問題及指定的第 4→5 幀；完成後 commit 並 push。
- 尚待使用者回答：無。
- 代理採用的合理假設：`push_back` 的 sequence slot 是 heap 擴張開始點；比較動畫沿用獨立的 value-only compare highlight。

## 重現與調查
- 最小操作步驟或 fixture：以既有 heap sample input 編譯範例，跳至第 4 幀後播放到第 5 幀並記錄 SVG 幾何與事件時間。
- 重現狀態：已重現。
- 已確認事實：序列事件順序正確，但只有 outerframe 延後 resize；heap 節點仍使用目標幀寬度。舊 `now` 的 assign 缺少 lifetime，依 variable id 誤選了同幀稍後宣告的新 lifetime。第 13→14 幀先執行 `now = parent`，稍後才有舊 `parent` 的 scope exit；原本的退場 reflow 只看 `now` 的前一個 target，因此漏掉它已移入即將退場 target 的情況。內縮跨層時，子格已綁定 sequence slot，但 top-level heap 容器仍從 frame transition 起點開始移向目標 origin，造成整組格子早於 outerframe 移動。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`public/trace-frame-tween.js`、array draw renderer、`public/trace-renderer.js`、直接相關測試。
- 共用檔案／介面與協調結果：不改 trace 格式；以既有 declare/scope-exit lifetime metadata 判斷事件當下有效指標。
- 依賴任務：無。

## 驗收條件
- [x] 跨層 `push_back` sequence slot 前，既有 value、index 與其中數字維持前一幀幾何；擴張時兩種框與文字跟 outerframe 同步向右展開並移到新中心。
- [x] `labels(value,index)` 下的一般 heap highlight 包含 40px value 與 12px index；比較動畫 highlight 只包含 value。
- [x] `now = parent` 使用舊 `now` lifetime 的位置，賦值框位於可見 `now` 指標上方；下一輪 `now = heapSize` 不受前一 lifetime 汙染。
- [x] 第 13→14 幀的舊 `parent` 在 scope exit 開始前持續保留同格排版空間，`now` 不與它重疊；scope exit 開始時，`parent` 退場與 `now` 回填同時開始。
- [x] heap 跨層內縮時，outerframe resize 開始前，剩餘 value/index 格與數字保持前一幀位置；resize 開始後，容器、outerframe、格子與數字同步移到新幾何。
- [x] compare highlight 可見期間，一般 highlight 暫時隱藏，compare 結束後恢復。
- [x] 第 1→2 幀的新舊 `now` 不產生跨 lifetime 讓位；第 4→5 幀舊 `now` 從子節點完整移到父節點，新 `now` 入場箭頭維持朝下。
- [x] 既有 declaration initializer、sequence、outerframe 與 style layer 專項測試仍通過。

## 驗證計畫
- 子代理小驗證：JS 語法與 diff；相關 Node 測試；beta 的 3102 服務實際播放第 4→5 幀並檢查事件前後 SVG 幾何、highlight 與 marker 路徑。
- 主代理整合驗收：合併後重看 heap 第二次與跨層插入，並決定是否補做更廣泛的動畫驗證。
- 測試隔離方式：使用 beta worktree、既有隔離埠 3102 與獨立 headless browser，不操作使用者分頁。

## 變更紀錄
- 2026-09-19：依使用者回報建立初始定義；範圍限定為 heap 跨幀幾何、highlight 與 marker lifetime。
- 2026-09-19：實際重現確認 highlight 的共用 style layer 也會補回 index 高度，因此同步修正 normal／heap／segment tree／BIT 的值格 highlight 契約。
- 2026-09-19：依使用者更正，一般 highlight 恢復包含 index，compare highlight 維持 value-only；heap resize 改為左緣隨 outerframe、向右擴張，並將舊 lifetime 賦值框移至 `now` 指標上方。
- 2026-09-19：依使用者補充，resize 前須保留完整舊格，而非只保留 rect 寬度；將 value/index 的 rect、文字中心與字級統一綁到 outerframe resize slot。
- 2026-09-19：依使用者回報賦值框偏高，移除「完整 marker 高度再加間距」的近似值，改用 marker 標籤框實際 `y` offset 重建 detached lifetime 的錨點。
- 2026-09-20：依使用者回報第 13→14 幀重疊，讓即將退場的 marker 在退場前繼續參與同格排版；退場開始時同步執行淡出／上移與剩餘 marker 回填。
- 2026-09-20：依使用者回報內縮仍沿用舊時序，將 top-level heap 容器移動也綁定 sequence resize slot，使 outerframe、所有剩餘格子、index 與數字同時開始收縮。
- 2026-09-20：依使用者回報補充分離 compare 與一般 highlight；阻止不同 runtime lifetime 參與同格退場 reflow，並讓前一幀 ghost marker 依 heap 目標節點的完整二維幾何執行賦值位移。
