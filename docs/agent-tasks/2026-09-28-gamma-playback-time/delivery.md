# 2026-09-28-gamma-playback-time 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：84faff7834b6bdd788ebd8fb572ad6f8a040c6f3
- 程式修正 commit：d6b4bde
- 驗證時的 HEAD 與未提交修改：d6b4bde；程式驗證時工作樹僅待加入本交付文件
- 驗證日期：2026-09-28

## 根因與修改
- 已確認根因與證據：原播放器沒有時間模型；瀏覽器 SpeechSynthesis 也不提供播放前的精確音訊長度，只提供開始、結束與錯誤事件。
- 修正方式與行為變化：新增可測試的播放時間模型，以中日韓字元、英文詞、數字與標點建立初始估算；依 voice／lang／rate 保存實際朗讀校正；已播放幀改用實際幀耗時。畫面在幀條右側顯示目前時間與預估總時間，播放中以 `performance.now()` 更新，重播目前幀時重設到該幀起點。
- 修改檔案及用途：`public/playback-time.js` 負責解析各幀朗讀文字、估時、校正、時間軸與格式；`public/front.js` 串接播放生命週期；`public/algorithm.html` 與 `public/style.css` 新增顯示；兩個 playback-time 測試驗證計算與實際介面。
- README／版本紀錄／使用說明更新：不適用；介面直接顯示且無新操作步驟。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 幀條右側顯示目前／總時間 | 隔離瀏覽器檢查 DOM 相鄰位置、寬度與等寬數字 | 顯示於 `frameTimeline` 後，寬度至少 90px 且使用 tabular nums | 通過 |
| 語速、文字及標點影響估算 | 純模型測試及瀏覽器調整語速 | 2.0x 的總時間小於原速；標點增加停頓估算 | 通過 |
| 實際朗讀校正估算 | 純模型測試記錄 1.5 倍實測樣本 | 校正係數套用後續幀，已完成幀採實際耗時 | 通過 |
| 重播目前幀重設時間 | 瀏覽器播放至 00:01、暫停、重播 | 重播後立即顯示 00:00 | 通過 |
| 無 TTS 時依估時等待 | 差異審查及語法檢查 | fallback 使用各行估算總和作為延遲 | 通過 |

## 小驗證與重跑方式
### 播放時間模型與介面
- 目的與對應條件：驗證估算、文字解析、校正、格式、畫面位置、語速與重播語意。
- 執行目錄與必要環境設定：`algo-vis-backend`；瀏覽器測試自行啟動隨機埠服務及獨立 Edge 頁面。
- 測試資料／fixture：測試內建立兩幀合成 trace，不讀寫使用者 deck。
- 完整指令或操作步驟：`node --check public/playback-time.js`；`node --check public/front.js`；`node --test tests/playback-time.test.js tests/playback-time.browser.test.js`。
- 預期結果：5 個案例全數通過，無 skip。
- 實際結果與 exit code（適用時）：5 passed、0 failed、0 skipped；exit code 0。
- 證據位置：測試檔隨提交保存；執行輸出僅存於本次工作階段。

### 共用入口載入順序
- 目的與對應條件：確認新時間模組先於 front.js 載入，並核對新版 front.js cache key。
- 執行目錄與必要環境設定：`algo-vis-backend`。
- 測試資料／fixture：無。
- 完整指令或操作步驟：`node --test --test-name-pattern="all algorithm surfaces" tests/entrypoints.test.js`。
- 預期結果：指定案例執行並通過。
- 實際結果與 exit code（適用時）：1 passed、0 failed、0 skipped；exit code 0。
- 證據位置：測試檔隨提交保存。

## 驗證分級與選擇
- 層級：V2
- 分類：J（Studio／播放／鏡頭一致性）
- 選擇依據：修改 TTS 自動播放時間、幀切換及介面顯示，未修改 trace 指令解析或繪圖資料。
- 執行的測試檔／名稱篩選：`tests/playback-time.test.js`、`tests/playback-time.browser.test.js`、`tests/entrypoints.test.js` 的 `all algorithm surfaces`。
- 驗證環境與隔離服務：Windows、Node test、Playwright Edge；隨機本機埠與合成 trace。
- 驗證版本、完整指令、結果與證據：d6b4bde；上述 6 個指定案例通過。
- 未執行的驗證及原因：依使用者指示未執行完整 regression、全部 tests 或大規模演算法動畫驗證。
- 需要主代理做的 V3 驗證：以實際含多幀 TTS 的投影片確認不同系統聲音下總時間逐幀收斂，以及 stop／skip／fast 路徑。

## 舊有物件相容性
- 新建物件案例與結果：不適用；功能讀取既有 trace 的文字資料，不建立持久化物件。
- 缺少新欄位的舊物件 fixture、載入路徑與結果：不適用；沒有新增 trace 或 deck 欄位。
- 既有自訂值／明確關閉設定保留結果：TTS 靜音仍使用 volume 0 且維持原播放長度；事件間隔沿用既有 `gapMs`。
- 儲存／匯出後重開或重匯入結果：不適用；校正資料只存於瀏覽器本機，未改投影片內容。
- 不適用：是；本功能不改持久化投影片物件格式。

## 剩餘事項與合併注意
- 未驗證項目及原因：未在使用者實際投影片與作業系統真實 TTS 聲音上長時間播放；由主代理整合驗收。
- 已知問題或風險：首次播放前仍是估算；瀏覽器或系統聲音不同時，需播放幾句後才會逐步校正。播放前若尚未建立轉場計畫，初始總時間不含未知的轉場時間，抵達該幀後會以實測更新。
- 相依與衝突注意：`algorithm.html` 的 `front.js` cache key 更新為 `random-id-37`，並新增 `playback-time.js?v=1`。
- 主代理需補驗證的情境：實際聲音、不同語速、長文、多個 stop 點、skip 與 fast 播放。

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
