# 2026-09-28-gamma-frame-timeline-style 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：30a96602224a8077512dbaab2bdaa9718046d238
- 程式修正 commit：32d5141
- 驗證時的 HEAD 與未提交修改：32d5141；程式驗證後僅新增本交付文件
- 驗證日期：2026-09-28

## 根因與修改
- 已確認根因與證據：舊幀條以 24px 灰底和整格亮綠色呈現進度，現在位置、幀類型與進度共用同一視覺層，且顏色未沿用控制列的藍色互動語言。
- 修正方式與行為變化：改為 6px 淺灰軌道、藍色連續進度與獨立直立播放游標；一般幀、關鍵幀、停止幀使用圓形、菱形、方形；hover 顯示幀數與來源行；超過 80 幀時簡化普通刻度；時間拆成深色目前值與淡色預估值。
- 修改檔案及用途：`algorithm.html` 增加軌道層、進度層、游標及預覽；`style.css` 定義視覺；`front.js` 同步狀態與 hover／拖曳；相關測試核實行為。
- README／版本紀錄／使用說明更新：不適用；沒有新增操作入口。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 細軌道、藍色進度與獨立游標 | 隔離瀏覽器讀取實際計算樣式 | 軌道 6px、游標 18px，首幀進度位置為 25% | 通過 |
| 圓形／菱形／方形幀標記 | 合成兩幀 trace 並注入停止幀資料 | 2 個幀標記、1 個停止幀標記，類別正確 | 通過 |
| hover 顯示幀與來源行 | 滑鼠移至第一幀 | 顯示「第 1 幀・第 1 行」，標記放大 | 通過 |
| 點擊與拖曳仍可切換幀 | 從第一幀拖至第二幀，再點回第一幀 | 幀數依序為 2/2、1/2 | 通過 |
| 長動畫簡化普通刻度 | 載入 81 幀並保留首尾關鍵幀 | timeline 進入 dense，普通第 11 幀刻度透明 | 通過 |
| 播放時間既有行為維持 | 同一瀏覽器案例調速、播放、暫停、重播 | 語速估算與重播歸零仍通過 | 通過 |

## 小驗證與重跑方式
### 幀條局部瀏覽器驗證
- 目的與對應條件：核對實際 CSS、狀態標記、hover、拖曳、密集幀與播放時間。
- 執行目錄與必要環境設定：`algo-vis-backend`；測試自行啟動隨機埠與獨立 Edge。
- 測試資料／fixture：測試內兩幀與 81 幀合成 trace。
- 完整指令或操作步驟：`node --check public/front.js`；`node --test tests/playback-time.browser.test.js`。
- 預期結果：指定案例通過且無 skip。
- 實際結果與 exit code（適用時）：1 passed、0 failed、0 skipped；exit code 0。
- 證據位置：測試檔隨提交保存。

### 入口版本與載入順序
- 目的與對應條件：確認新版 CSS 與 front.js cache key 載入。
- 執行目錄與必要環境設定：`algo-vis-backend`。
- 測試資料／fixture：無。
- 完整指令或操作步驟：`node --test --test-name-pattern="all algorithm surfaces" tests/entrypoints.test.js`。
- 預期結果：指定案例通過。
- 實際結果與 exit code（適用時）：1 passed、0 failed、0 skipped；exit code 0。
- 證據位置：測試檔隨提交保存。

## 驗證分級與選擇
- 層級：V1
- 分類：A、J
- 選擇依據：修改播放控制列前端樣式、hover 及既有幀導覽操作，未修改 trace 解析、動畫繪圖或事件排程。
- 執行的測試檔／名稱篩選：`tests/playback-time.browser.test.js`；`tests/entrypoints.test.js` 的 `all algorithm surfaces`。
- 驗證環境與隔離服務：Windows、Node test、Playwright Edge、隨機埠與合成 trace。
- 驗證版本、完整指令、結果與證據：32d5141；2 個指定案例通過。
- 未執行的驗證及原因：純前端幀條設計，依使用者要求與分級規則未執行大型 regression 或演算法驗證集。
- 需要主代理做的 V3 驗證：無；整合版人工查看短動畫與長動畫的視覺密度即可。

## 舊有物件相容性
- 新建物件案例與結果：不適用；不新增持久化物件。
- 缺少新欄位的舊物件 fixture、載入路徑與結果：不適用；只讀既有幀與來源行資料，來源行缺少時顯示幀數。
- 既有自訂值／明確關閉設定保留結果：不改動畫或 deck 設定。
- 儲存／匯出後重開或重匯入結果：不適用；無資料格式變更。
- 不適用：是；純顯示與導覽介面。

## 剩餘事項與合併注意
- 未驗證項目及原因：未執行大型演算法回歸；本次不涉及動畫繪製。
- 已知問題或風險：非常窄的控制列仍可能需要後續針對手機版決定隱藏哪些輔助資訊。
- 相依與衝突注意：`style.css` cache key 更新為 `brand-shared-7`，`front.js` 更新為 `random-id-38`。
- 主代理需補驗證的情境：整合頁寬下查看短動畫、81 幀以上動畫與停止幀。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：
- 差異審查與必要重跑結果：
- 合併 commit：
- 完整 regression：
- 演算法投影片實際驗證：
- 未完成或環境阻塞：
- 本機服務重啟：
- Push／公開部署狀態：


## 第二版交付（取代第一版逐幀標記設計）
- 程式 commit：fd4ccc23d07fa1934594aea6f65b5e7509cdae73。
- 依使用者回饋移除所有逐幀圓形／菱形／方形 DOM 與 CSS，只保留單一位置圓點與連續進度。最大寬度 220px；hover 只顯示目標／總幀數。
- 未移除播放器原有關鍵幀導覽功能，本次僅調整幀條呈現。
- 驗證：node --check public/front.js；node --test tests/playback-time.browser.test.js tests/entrypoints.test.js；git diff --check。
- 結果：2 passed、0 failed、0 skipped。120 幀固定寬度、只有一個游標、首尾點選通過；既有拖曳與播放時間案例通過。
- 無持久化欄位變更；未跑大型 regression。待主代理整合核實。
- 3103 程序重啟仍沿用前次阻塞：未取得停止 PID 81256 的新授權，未再次嘗試強停。


## 控制列靠右修訂
- 使用者要求幀條、幀數、時間與語速控制整組靠右。
- 幀條取消填滿剩餘空間，左側使用自動間距；延續 180px 基準／220px 上限，右側資訊與語速控制依既有順序靠齊。
- 驗證：node --test tests/playback-time.browser.test.js tests/entrypoints.test.js，2 passed、0 failed；git diff --check 通過。純 CSS 版面修正，無資料格式變更，未跑大型驗證。


## 幀條提示遮蓋修正
- 提示原先位於畫布容器內，局部 z-index 無法跨越祖先的裁切／顯示層。
- 改放在 body 上的 fixed 浮層，z-index 10000；依幀條位置計算座標，上方不足則顯示下方，水平限制在視窗內。
- 滾動、視窗縮放及游標離開時隱藏提示，避免殘留。
- 驗證：語法與差異檢查；playback-time.browser.test.js 及 entrypoints.test.js 共 2 個案例通過，包含浮層脫離裁切容器、位於視窗範圍、hover 與拖曳操作。
- V1 局部修正，無儲存格式變更，未執行大型 regression。
