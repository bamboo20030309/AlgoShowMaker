# 保留子樹中的比較來源

比較事件共用賦值來源的 retainedSourceOperand。num[i] <= num[j] 使用
runtime 已捕捉的 resolvedIndex 與 payload.left/right，不重新求值幀末 i/j。
createCompareEffect 與事件可播放性判定傳入相同事件和值。

遞迴 layout 中保留來源限定到當前呼叫的直接子樹；分支預覽中尚未執行的
資料不能作為來源。索引及來源值必須同時符合，缺少格子不猜測祖先。
比較只讀取 keep 格子，swap／賦值的寫入目標仍不能修改凍結快照。
沒有新指令或持久化欄位，原本 as／range／pointer 指令不變。

## 驗證

2026-10-05，V2／G、H；獨立 31992 與 headless Edge，不操作使用者分頁。
輸入為 10 / 38 27 43 3 9 82 10 19 84 60。
retained-compare.browser.test.js 選三個區間，1x/4x 切幀檢查真實比較
highlight 的來源 snapshot、直接父呼叫、resolvedIndex；兩種速度也測試
Play 自動播放。可播放性與 SVG 實際呈現一致，沒有 browser pageerror。
舊 trace JSON 載入、設定關閉、儲存重開維持關閉；隱藏來源仍不可播放。
alias-source-continuity.browser.test.js 保持九次跨來源延續通過。
entrypoints.test.js 核實快取版 Tween trace-285。
共 3 案例通過，0 fail/skip；JS 語法與差異檢查通過。
未執行完整 regression／全面演算法測試；本次為局部讀取定位修正。

## 保留格子的實際運動（Tween trace-287）

保留格子沒有一般 Tween entry，因此比較效果以既有 adjustment 暫時投影
到實際 SVG。root／parent 矩陣先轉成 DOMMatrix，避免舊 SVGMatrix 混乘
導致 requestAnimationFrame 中斷。進事件效果層時只提升資料格，不移動
整個 snapshot／外框；結束先恢復原 transform、來源 parent 與 DOM 順序，
再交給下一個事件查找來源。source snapshot 資訊在暫時升層期間仍可查詢。
不改寫凍結 trace state，不新增持久化欄位。

2026-10-05，V2／G、H，獨立 31992／headless Edge。
retained-compare.browser.test.js 新增實際 rect CTM 與 root 座標檢查：三個
區間、1x／4x 都提起超過 10px，包含放大 >1.1 與縮小 <0.9；結束座標
與尺寸回到基準（0.5px 內），不留下臨時 motion 標記。Play 兩種速度也
觀察到實際縮放。關閉比較指令且儲存重開後，不產生 motion。
alias-source-continuity.browser.test.js 維持九次交接正常；entrypoints.test.js
核對版本。共 3 案例通過，0 fail／skip；修改 JS 語法與差異檢查通過。
沒有執行完整 regression；未更動 pointer 的交換路徑。

## 比較事件的 pointer 與生命週期（Tween trace-288）

比較格與 pointer 的錨點以同一個 snapshot＋資料索引配對，不用靜態
C++ variable ID 配對不同遞迴節點。標籤跟隨格子移動，但不縮放；其
位置包含格子放大／縮小後的頂緣位移，箭頭瞄準格子的轉換後中心。
事件捕捉的索引優先於之後 postfix ++ 所改變的幀狀態。

本幀末端走出陣列的 pointer 仍要在前面的比較中出現，因此退場副本也
使用同一個比較效果的 adjustment。副本留在 pointer layer，直到相關
比較／位置事件完成再退出；不改寫 keep 內容或新增持久化欄位。
箭頭路徑與事件位移在結束時還原，不留下比較狀態。

V2／G、H、J；獨立 31992／headless Edge。retained-compare.browser
測三個合併區間，1x／4x 手動切幀與 Play；斷言兩個 pointer 實際提起、
不縮放、與格子間距保持、比較期間可見且在 pointer layer。原有比較
來源、格子還原、明確關閉及 JSON 儲存重開斷言保留。
pointer-anchor-paint 驗證來源格升層時仍存在且錨點不被塗色；
pointer-model 的兩個局部案例驗證倍增進退場及 11→12 單指標置中。
後者沿用目前範例 ++ 在 @frame 前的事件分段，依序驗證第 11 幀移動
與第 12 幀退出，不放寬原本幾何斷言。沒有執行完整 regression。
