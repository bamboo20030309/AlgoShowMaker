# 2026-09-23-gamma-special-text-cursor 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：bd9a4af388431ab68fb4538e6ecac2fecd179369
- 程式修正 commit：b8aea4759d14bff5b17edb9dc88ebd420b0b7168
- 驗證時的 HEAD 與未提交修改：b8aea4759d14bff5b17edb9dc88ebd420b0b7168；程式驗證時無未提交程式修改
- 驗證日期：2026-09-23

## 根因與修改
- 已確認根因與證據：Fabric 5 內建 splitter 只合併 UTF-16 代理對，不合併組合字與 ZWJ 序列；可見字元數與游標／樣式索引不同步。
- 修正方式與行為變化：使用 `Intl.Segmenter` 將 Unicode grapheme cluster 作為 Fabric 的文字單位；舊版逐碼位樣式索引載入時遷移，行內上下標也改用同一分段；輸入法組字底線先由 UTF-16 textarea 範圍換成字素範圍。
- 修改檔案及用途：`public/slides.js` 負責 Fabric 字素切分、舊樣式遷移與序列化版本；`public/slide-inline-scripts.js` 共用字素切分；`public/slides.html` 更新快取版本；`tests/special-text-cursor.browser.test.js` 驗證點擊、方向鍵、樣式與上下標；`tests/entrypoints.test.js` 更新入口版本斷言。
- README／版本紀錄／使用說明更新：不適用；屬既有文字編輯行為修正。
- 與 task.md 的差異：無

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 點擊 `②` 左右半部定位 | `special-text-cursor.browser.test.js` 實際點擊 | 左半為索引 1、右半為索引 2 | 通過 |
| 組合字、ZWJ emoji 與後方樣式 | 同一專項檢查 `_text`、遷移樣式及上下標 | family emoji、`é` 各為單一字素，紅色樣式與 `A_2` 位置正確 | 通過 |
| 舊文字載入與字素版本 | 匯入無版本的舊 JSON 後檢查 Fabric 物件 | `asmGraphemeVersion` 為 2 | 通過 |

## 小驗證與重跑方式
### 特殊文字游標瀏覽器專項
- 目的與對應條件：核實 `②` 點擊邊界、可見字素移動及舊樣式遷移。
- 執行目錄與必要環境設定：`algo-vis-backend`；測試自啟隨機埠與獨立 Edge headless。
- 測試資料／fixture：測試內建立 `A②B 👨‍👩‍👧‍👦 é A_2` 臨時 deck。
- 完整指令或操作步驟：`node --test tests/special-text-cursor.browser.test.js`
- 預期結果：1 個 test 通過。
- 實際結果與 exit code：1/1 通過，exit code 0。
- 證據位置：已提交測試檔；TAP 僅留於本次執行輸出。

### 文字編輯相容性
- 目的與對應條件：確認單一 emoji、中文輸入法、undo/redo 與儲存選取範圍不回歸。
- 執行目錄與必要環境設定：`algo-vis-backend`。
- 測試資料／fixture：測試內臨時 deck。
- 完整指令或操作步驟：`node --test tests/slides-text-undo.browser.test.js`
- 預期結果：1 個 test 通過。
- 實際結果與 exit code：1/1 通過，exit code 0。
- 證據位置：TAP 僅留於本次執行輸出。

### 行內上下標與入口版本
- 目的與對應條件：確認字素切分不破壞上下標，並核對 cache bust 入口。
- 執行目錄與必要環境設定：`algo-vis-backend`。
- 測試資料／fixture：既有專項 fixture。
- 完整指令或操作步驟：`node --test tests/inline-scripts.browser.test.js`；`node --test tests/entrypoints.test.js`；`node --check public/slides.js`；`node --check public/slide-inline-scripts.js`；`git diff --check`。
- 預期結果：各專項及語法／差異檢查通過。
- 實際結果與 exit code：各測試 1/1 通過；語法及 diff check exit code 0（僅有既有 CRLF 提示）。
- 證據位置：TAP 與檢查輸出僅留於本次執行輸出。

## 剩餘事項與合併注意
- 未驗證項目及原因：未跑完整 regression，依 V1 分級與使用者指示不需要。
- 已知問題或風險：不支援 `Intl.Segmenter` 的舊瀏覽器會退回碼位切分；目前支援的 Chromium／Edge 路徑已驗證。
- 相依與衝突注意：`slides.js`、`slides.html` 為共用檔案，整合時需保留較新的資源版本。
- 主代理需補驗證的情境：整合版實際點擊 `②` 前後並以方向鍵越過組合字。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：
- 差異審查與必要重跑結果：
- 合併 commit：
- 完整 regression：不需要（V1 文字編輯修正）
- 演算法投影片實際驗證：不適用
- 未完成或環境阻塞：
- 本機服務重啟：
- Push／公開部署狀態：
