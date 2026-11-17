# gamma-visible-lod 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實。
- 分支：codex/2026-09-22-gamma。
- 共同基準：854d1ea62994967a564d3b9a126ea4cbf81ea35d。
- 程式修正 commit：00a40de329054c6a87c18a2002ecc0f278158ff1。
- 驗證版本：該 commit 的程式及測試內容；驗證時尚未提交，提交後只有任務文件修改。
- 日期：2026-09-28。

## 根因與修改
- 原 scope-exit availability 每個事件重掃場景與子節點；改成單次 probe 建立 variable → visual 索引，仍由原判斷核對 lifetime、generation、retained snapshot。普通事件的 marker 搜尋重用既有 marker 子集。
- 原 LOD full 為整個結構同步建立所有文字；改以實際螢幕寬度 ≥24px 及 SVG 可見區域外 48px 緩衝決定。每幀最多處理 128 筆／約 4ms，單次原生 DOM 呼叫仍可能超過軟性時間預算。
- 每 group 最多保留 256 個閒置 text 節點；已可見文字保留，移出畫面者回收。矩形、定位與獨立 style 不刪減。
- 純 ASCII 0–9 字串逐數字量測後相加；數字快取區分字型、字級、字距與字體特性，字型載入完成時清除。正負號、小數、混合字串仍做 SVG 整字量測。不宣稱逐字相加保留任意字型的跨字 kerning；這是使用者指定的數字估算方式。
- 檔案：trace-structure-lod.js、draw/draw_array_utils.js、trace-frame-tween.js；algorithm/index/slides 資產版本及兩個直接相關測試。
- README／版本紀錄：不新增操作或持久化格式；行為、重跑及限制記錄於本文件。
- 與 task.md 差異：無。

## 驗收條件對照
| 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 24px 門檻 | 相機 0.599／0.6；不同寬度 fixture | 23.96px 無文字、24px 有文字；scale 0.4 下 40px 格不顯示、80px 格顯示 | 通過 |
| 可見文字、平移 | 500＋50×50 場景，移到 30,30 | 可見格文字齊全，僅附近建立文字，幾何不變 | 通過 |
| 節點重用 | 縮小再放大，節點 identity 及 pool 上限 | 確實重用、閒置 pool ≤256 | 通過 |
| 舊資料／自訂樣式／false | trace 匯出 JSON、重新載入及既有 highlight、hidden | 舊 schema 正常使用，false、自訂樣式及縮圖 fallback 保留 | 通過 |
| 數字快取 | 攔截原生量測，字型字距變化與 fonts 失效 | 10 種數字只量單字、冷啟動 ≤40 次；重新排列不用量測；混合字串整字量測 | 通過 |
| 事件目標 | 現有 marker／scope-exit 小案例 | 隱藏變數不可用、marker 指向與前幀 lifetime 退場可用 | 通過 |
| 使用者棋盤範例 | 隔離 Edge，2 次新頁載入及滾輪核實 | 11,000 格、96,013 事件及紅綠棋盤保留，無頁面錯誤 | 通過 |

## 小驗證與重跑方式
執行目錄：此 worktree 的 algo-vis-backend；Node、Playwright、Edge、本機既有 C++ 編譯環境。測試自行建立隨機埠服務與獨立瀏覽器，不操作使用者頁面。

- `node --test tests/scene-load-performance.browser.test.js tests/trace-chunks.browser.test.js tests/entrypoints.test.js`：3/3 通過，exit 0。trace-chunks 另啟動 studio-availability-preflight.browser.test.js：1/1 通過。
- 增補不同寬度 fixture 後，`node --test tests/scene-load-performance.browser.test.js`：1/1 通過，exit 0。
- 對上述三個 public JS、兩個測試檔執行 `node --check`，及 `git diff --check`：全部 exit 0。
- 未執行完整 regression 或全部測試。

## 效能比較
前輪基準紀錄見 ../gamma-range-performance/delivery.md。相同使用者 1000 陣列＋100×100 棋盤、兩條 grid[0:100][0:100] 規則，headless Edge 1440×900。量測為本機觀察，不是效能保證；profile 也有額外負擔。

| 項目 | 修改前 | 修改後 |
|---|---:|---:|
| 編譯完成 → 畫布建立完成，兩輪 | 11,857.9／12,618.1ms | 11,186.2／10,612.7ms |
| 事件可用性檢查 | 3,025.1／3,380.1ms | 86.0／92.5ms |
| 首次跨文字門檻 → 附近文字全部呈現，兩輪 | 584.9／640.4ms | 160.9／127.8ms |
| 同段最大 RAF 間隔 | 486.2／534.7ms | 約14／14ms |
| 實際滾輪首次：全部呈現／最大間隔 | 589.8／486ms | 152.5／20.9ms |
| 實際滾輪再次：全部呈現／最大間隔 | 208.5／111.2ms | 106.6／14ms |

注意：原門檻是28px；本次改24px，故跨門檻時視窗內格數不同。原建立11,000個內容文字與1,200索引文字；本次直接縮放建立1,575內容文字（可見1,209，其他為緩衝），滾輪建立1,353（可見1,073）。本範例跨門檻階段 getComputedTextLength 為0次，文字／數字快取已有可重用項目；冷數字量測另由局部測試驗證。

剩餘耗時：本輪 C++ 執行約4.1～4.4秒，normalizeTraceDocument 兩次合計約1.29～1.38秒（包含 clone），仍有傳輸／JSON解析及場景建立成本。未改事件 transport 或做增量 normalization。

本機證據位於 backend/test-results/culling-profile/：visible-tests.log、visible-width-test.log、visible-performance.{cjs,json,log}、visible-wheel.{cjs,json,log}、各輪 JSON。未提交產物；其分析腳本需同目錄 range-preload.cjs，只在本機保留，不保證永久保存。可提交的局部測試與上述命令可獨立重跑。

## 剩餘事項與合併注意
- LOD 延用既有平面陣列／矩陣適用條件，不擴張為所有 structure 或動畫轉場 renderer。
- 文字分批完成有短暫漸次補字；4ms 是工作預算而非硬即時保證。
- 未新增 schema 或修改 deck；既有 trace 載入／使用／JSON儲存／重開已驗證，沒有操作私人投影片。
- 共用 draw_array_utils 影響其他使用 fitSvgText 的文字適配；主代理整合時留意自訂字型與不同格寬情境。
- gamma 3103 已核對舊 PID75240 的完整 server.js 來源後重啟，新 PID37440；HTTP200，trace-258／fit-4／lod-2 及 /trace/analyze success=true。
- Push：本輪程式及文件將推送 origin/codex/2026-09-22-gamma，結果以交付訊息為準。未合併 main／intergration，未公開部署。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實。
- 核實程式與差異：待填。
- 差異審查與重跑：待填。
- 合併 commit／整合 regression／演算法投影片驗證：待填。
- 未完成或環境阻塞：待填。
- 整合本機服務重啟／Push／公開部署：待填。
