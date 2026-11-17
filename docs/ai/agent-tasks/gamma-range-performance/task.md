# gamma-range-performance：棋盤載入與 LOD 文字門檻效能診斷

## 任務資訊
- 負責代理：gamma
- 狀態：待交付（量測完成，未修改正式程式）
- 驗證共同基準：6e070feba008f41d989a660c111652bf256e3500
- 分支：codex/2026-09-22-gamma
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-22-gamma

## 問題與预期結果
- 使用者提供 arr(1000)、grid(100×100) 棋盤，兩條 grid[0:100][0:100] background when value 條件樣式。
- 要求：實測目前效能瓶頸，另量測放大到文字出現瞬間。
- 計時邊界：編譯完成到畫布可見，不把編譯耗時包含進來；包含 C++ 執行及 trace 產生。
- 需求已清楚，無待回答問題。本輪僅調查，不自行套用後續优化。

## 修改邊界與依賴
- 正式程式無修改；診斷腳本及數據在被忽略的 test-results/culling-profile。
- 無其他代理相依、未重啟 3103、未操作使用者分頁。

## 驗收條件
- [x] 使用完整範例並確認 1 幀、96,013 事件、11,000 格。
- [x] 區分 runtime、後端整理、傳輸解析及前端處理時間。
- [x] 比較首次和快取命中時的文字門檻成本。
- [x] 核對畫面內文字數及實際建立量，確認畫面外是否仍計算。

## 驗證計畫
- V2 局部效能診斷：兩輪相同案例、一次事件細部計時、一次真實滾輪驗證；不執行大回歸。
- 隔離 Node 服務隨機埠，獨立 headless Edge 1440×900 context；每次結束回收自己的程序。
- 以 server debug 編譯完成 timestamp 到前端 compile-finished 後兩次 requestAnimationFrame 作畫布可見近似值；非 GPU 硬體呈現時間。

## 變更紀錄
- 2026-09-28：初始定義與量測完成。
