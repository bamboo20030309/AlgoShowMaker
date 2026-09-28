# gamma-range-performance 量測交付

## 交付資訊
- 狀態：指定範例量測完成，待主代理閱讀；本輪無程式修正 commit。
- 量測程式版本：6e070feba008f41d989a660c111652bf256e3500；正式程式工作目錄乾淨。
- 分支：codex/2026-09-22-gamma
- 日期：2026-09-28。

## 測試方式與範圍
- 保留使用者完整程式，包含空行、`grid[0:100][0:100]` 與 asm-view 明確 false。
- 獨立服務、Edge 1440×900、新 page context。RUN 成功，每轮 1 幀／96,013 事件／11,000 格。
- 探針僅透過隔離服務 preload 及測試頁 route 注入，沒有修改正式 JS/C++。
- 記錄函式 inclusive/self 時間，巢狀計時不可相加；native SVG 量測也計時，因此數字有小量探針負擔。
- 編譯完成 timestamp 與瀏覽器使用同一主機時鐘；終點為 compile-finished 後兩次 requestAnimationFrame，近似可見畫布而非 GPU presentation fence。
- 初次縮放：先到 simple，再 0.65→0.72 跨過 full（格子投影 28px）門檻。重試先到 0.5，繞過 full 的 24px 遲滯，再回 0.65。
- 額外實際滑鼠滾輪：畫布 (1000,550)，deltaY=-100，一格縮放 1.1 倍，0.65→0.715。與程式化鏡頭路徑結果一致。

## 編譯完成到畫布
| 階段 | 第 1 輪 ms | 第 2 輪 ms |
|---|---:|---:|
| 編譯完成 → 畫布可見 | 11857.9 | 12618.1 |
| C++ 執行／trace 寫出 | 3699.0 | 3864.8 |
| 後端 trace 整理（含分塊 gzip 讀寫） | 515.6 | 527.9 |
| 收到 headers → JSON 完整收到／解析 | 1251.2 | 1323.3 |
| JSON ready → 前端 handler 完成 | 6260.0 | 6772.1 |

前端處理內部 inclusive 耗時：
- updateEventAvailability：3025.1／3380.1 ms。
- normalizeTraceDocument：兩次合計 1084.6／1198.7 ms；其中 clone 768.7／811.6 ms（不要額外相加）。
- draw_2Darray：511.5／548.4 ms。
- code presenter renderFrame：407.2／418.8 ms。
- 條件樣式 evaluate：30.8／33.0 ms。

額外細測 availability 3124.5 ms：
- scopeExitVisualKeys：101 次，共 2702.8 ms（約 86.5%）。每個 scope-exit 反覆遍歷 elements 及 querySelectorAll 子節點，再比對 variable/lifetime。
- eventTargetVisualKeys：103 次，共 247.6 ms，宣告事件仍遍歷全部 elements 找 marker。
- eventOperand：60,408 次，共 69.9 ms；其內 eventTargetKey 15.3 ms、markerVisualKey 8.1 ms。先前 marker subset 优化有效，剩下的整場景掃描在 scope-exit 與 declare。

## 文字 LOD 跨門檻
| 指標 | 第一次（兩輪） | 快取已有資料（兩輪） |
|---|---:|---:|
| 放大 → 文字可見 | 584.9～640.4 ms | 207.6～221.1 ms |
| LOD paint 合計 | 420.2～475.0 ms | 42.6～46.0 ms |
| fitSvgText | 12,200 次，379.0～430.5 ms | 12,200 次，9.2～9.4 ms |
| getComputedTextLength | 3,386 次，355.5～406.6 ms | 0 次 |
| 最大 RAF 間隔 | 486.2～534.7 ms | 111.1～118.2 ms |

實際滾輪重現：首次 589.8 ms、LOD paint 427.8 ms、native 文字量測 359.0 ms、最大 RAF gap 486.0 ms；重試 208.5 ms、paint 42.8 ms、native 量測 0 次、RAF gap 111.2 ms。

- 當下可見 858 個內容文字，卻建立 11,000 格內容文字；額外 1,200 索引標籤使 textFor/fitSvgText 共 12,200 次。
- 畫面外的 10,142 格仍建立／適配文字。LOD paint 遍歷 group._asmLod.records，沒有 viewport 範圍過濾。
- 0/1 相同文字快取已命中許多次，但 0～999 等索引及格子尺寸／樣式鍵仍需量測。不能把 12,200 次 fit 函式呼叫當作 12,200 次真正 SVG 量測。
- 降回低細節時 text.remove，下一次進入 full 又重建節點；快取只省掉量測，不省 DOM 建立及排版。
- 相機穩定後另有 80ms LOD debounce，包含在操作到可見時間，並不是 80ms 的 CPU 運算。

## 建議修正順序（尚未實作）
1. 場景建立時建立 variable/lifetime/generation → visuals 索引，讓 scope-exit 和 declare 直接取候選節點；未繪製的迴圈變數立即判定缺少目標。
2. LOD 只建立視窗及少量緩衝範圍的內容／索引文字，平移時同步更新範圍。
3. 有界文字節點池與既有量測快取一起使用，避免門檻來回時全部刪除／重建。
4. 分批建立可見文字，每個 animation frame 留小量時間预算，避免整批同步阻塞。
5. 後續減少重複 normalize 與完整 events clone；將事件可用性依使用時機延後，不阻塞最終狀態先顯示。

## 證據與重跑
在 gamma worktree/algo-vis-backend 執行：
- `node test-results/culling-profile/range-performance.cjs`（兩輪 RUN、首次／快取縮放）
- `node test-results/culling-profile/range-detail.cjs`（事件細部熱點）
- `node test-results/culling-profile/range-wheel.cjs`（真實滑鼠滾輪）
- 產物：range-performance.json、range-detail.json、range-wheel.json 及對應 .log；preload 為 range-preload.cjs。
- 以上腳本與數據留在本機被忽略的 test-results，不會隨 Git 保存；清理後不可依賴。本文保存量測版本、步驟與摘要。
- 三個最後的量測程序 exit 0，無瀏覽器錯誤。早期重試停留 full 的等待逾時是測試未跨遲滯門檻，已改先縮至 0.5，未修改正式 LOD。
- 不涉及新持久化欄位，無資料遷移；無完整 regression、公開部署或服務重啟。

## 主代理核實與整合
- 狀態：尚未核實；此交付僅診斷，無待合併程式。
- 後續优化仍需另行實作與局部相容性驗證。
