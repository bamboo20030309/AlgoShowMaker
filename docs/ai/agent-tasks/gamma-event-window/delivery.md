# gamma-event-window 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實。
- 分支：codex/2026-09-22-gamma。
- 共同基準：603de09130f6fb5f6d593023571e039f7d0fff50。
- 程式修正 commit：721c9d16d7da4a5803078d183ea211bbcaf74628。
- 驗證版本：上述 commit 的工作目錄程式內容；驗證時未提交。程式提交後只有任務文件修改。
- 日期：2026-09-28。

## 根因與修改
原 runtime 會記錄所有初始化事件並附在第一幀；尾端事件雖不掛到顯示幀，仍可能寫出分塊並觸發限制。單幀棋盤因此有96,013個無需播放的前置事件。

- ASMTrace.hpp：第一個實際 capture 前不接受一般事件；事件欄位工廠延遲執行，未追蹤時不生成欄位 JSON。原程式運算、回傳值、變數初始化旗標、生命週期及遞迴堆疊仍執行。
- 每次 capture 確認自上次 capture 以來的資料並記錄檔案位置；正常結束時截斷到最後確認位置，同時丟棄尚在記憶體的尾端事件。尾端超限不影響既有幀；後續若真的再 capture，原超限錯誤仍保留並回報，沒有放寬限制。
- 首幀前 @keep 屬於場景建構指令。以可選 initialKeeps 欄位交付，server.js 沿用原 keep 富化及 snapshot 建構，不放入動畫事件列表。初始場景也有大小限制。
- 使用既有 MinGW 支援的 _open/_chsize，Linux 分支採 open/ftruncate；Linux 路徑未在本機實跑。首次 filesystem／fileno 編譯不相容已修正，之後 C++ 測試通過。
- 相關測試明確增加起始 frame，讓 marker／宣告測試仍覆蓋「幀間」原情境；單幀棋盤預期事件改為0，保留全部狀態與樣式斷言。
- 使用說明記錄在本文件：須重新 RUN 才採新邊界；既有已存 trace 的首幀事件不自動刪除。
- 與 task.md 差異：補充初始 @keep 場景資料例外，不改變使用者要剔除不可播放事件的目標。

## 驗收條件對照
| 條件 | 驗證 | 實際結果 | 判定 |
|---|---|---|---|
| 無幀／單幀 | C++直接 recorder；棋盤 RUN | 無幀只有 meta；單幀0事件，棋盤、輸出與11,000格完整 | 通過 |
| 首尾邊界 | 前置事件＋3幀＋尾端2050事件 | 前置與尾端 signature 均不在最終原始檔，最後一筆為 frame | 通過 |
| 分塊與順序 | 中段2050事件、300KB文字、明確false | 中段次序與內容逐筆相等，分塊仍≤1024事件 | 通過 |
| 真正中間超限不能隱藏 | 17MiB事件，分別有／無後續 capture | 尾端丟棄；被下一幀消費則明確報 Trace event limit exceeded | 通過 |
| 動態同一frame指令 | 迴圈兩次 capture | 三幀x=5/6/7，輸出999，前置x+=5及尾端x=999不在事件中 | 通過 |
| 初始 keep | keep x as seed，後續修改 | seed=5持續顯示，前後幀播放與儲存重开後仍=5 | 通過 |
| 舊 trace | 缺少initialKeeps，有舊首幀事件及關閉設定 | 載入、顯示、JSON存檔重開，原事件保留且持久化開關仍false | 通過 |
| 小排序與事件目標 | 3元素bubble＋既有marker／scope-exit fixture | 結果[1,2,3]、2個swap；前後幀可播放，目標判斷通過 | 通過 |

## 小驗證與重跑方式
目錄：本 worktree 的 algo-vis-backend。環境：Node、既有g++、Playwright Edge；browser測試自行啟動隨機埠，獨立瀏覽器。

- `node --test tests/trace-chunk-store.test.js tests/trace-chunks.browser.test.js`：7/7通過，exit0；含子程序 studio-availability-preflight 1/1通過。
- 後續擴增 browser 的多幀、keep、排序與舊事件往返；最終 `node --test tests/trace-chunks.browser.test.js`：1/1通過，含上述preflight 1/1，exit0。
- 舊檔測試最初只設event.enabled=false，被既有規則依預設重新計算；依實際存檔契約補上 studio.eventInstructionStates 的false後重跑，保持事件關閉斷言，未修改產品啟用邏輯。
- server.js及三個修改JS測試 `node --check`、`git diff --check`：exit0。
- 不執行完整regression、全部tests或廣泛排序整合。
- Browser fixture包含手動前後幀與stable最後幀。未新增全面autoplay及完整演算法投影片驗收。

## 使用者棋盤效能
同前輪1000陣列＋100×100棋盤，明確grid[0:100][0:100]紅綠規則；獨立Edge1440×900，兩次新頁。量測區間只算「編譯完成→畫布建立完成」，不含編譯。

| 指標 | 前一版 | 本次 |
|---|---:|---:|
| 區間事件數 | 96,013 | 0 |
| 編譯完成→畫布 | 11,186.2／10,612.7ms | 1,632.7／1,711.4ms |
| C++執行 | 4,125.8／4,400.7ms | 228.9／235.4ms |
| 去重後原始追蹤 | 18,049,262 bytes | 311,711 bytes |
| gzip追蹤 | 654,616 bytes | 1,625 bytes |
| 分塊索引 | 5,336 bytes | 118 bytes |

本案例只有單幀，故全部原事件都在可播放區間外；不能推論多幀演算法也有同樣降幅。字串／數字矩陣高度重複，因此gzip尤其小。全部格子資料及紅綠樣式未減少。

本機證據：backend/test-results/culling-profile/event-window-tests.log、event-window-browser-final.log、window-performance.{cjs,json,log}、window-initial-*.json；性能腳本依賴同目錄range-preload.cjs。這些產物未提交且不保證永久保存。可提交測試提供獨立重跑入口。

## 剩餘與合併注意
- 無法在執行中預知最後capture；尾端仍可能有暫存與編碼成本，結束時不保留。宣稱的是最終追蹤邊界，不是尾端零CPU。
- 截斷在正常程式結束的Recorder解構執行；被強制終止／abort不承諾清理，既有編譯／執行錯誤處理仍適用。
- 只在新RUN採用；不遷移或刪除私人投影片已存事件。新舊trace都已做載入／使用／儲存重開。
- 主代理需留意那些原本只在首個frame前放事件的測試，應依新需求調整fixture邊界，不得把真正幀間失敗忽略。
- 3103核對完整gamma server.js路徑後重啟，PID37440→13320；HTTP200，/trace/analyze success=true。沒有操作其他服務。
- 程式與文件將push至origin/codex/2026-09-22-gamma，以交付訊息確認結果；未merge main／intergration、未公開部署。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實。
- 核實commit／diff：待填。
- 必要重跑與合併commit：待填。
- 整合regression與演算法投影片驗證：待填。
- 未完成或環境阻塞：待填。
- 整合服務重啟／Push／公開部署：待填。
