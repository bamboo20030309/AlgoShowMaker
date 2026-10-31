# 2026-09-28-gamma-structure-name 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：b368f0b1e54efadde21f768a8e0f38e52c9fbef1
- 程式修正 commit：ca3c30a2b0d749d08bd424386f07a409a5c5034e
- 驗證時的 HEAD 與未提交修改：ca3c30a2b0d749d08bd424386f07a409a5c5034e；程式驗證時無未提交修改，之後新增本交付紀錄
- 驗證日期：2026-09-28

## 根因與修改
- 已確認根因與證據：Structure renderer 將 `MODE_LABELS` 的固定文字直接傳入 outerframe，widget 資料與左側編輯欄都沒有名稱欄位。
- 修正方式與行為變化：新增可保存的 `structureName` 與「外框名稱」輸入欄，輸入時立即重繪。舊物件缺少欄位時採用模式預設名稱；自訂值及空字串完整保留。切換模式時只有仍等於舊模式預設值者改用新模式預設名稱。
- 修改檔案及用途：`slides.html` 增加欄位與更新資源版本；`slides.js` 處理預設值、相容載入、編輯與保存；`slide-structures.js` 將名稱傳入既有 outerframe renderer；新增專項瀏覽器測試並更新入口測試。
- README／版本紀錄／使用說明更新：不適用；欄位直接出現在 Structure 左側編輯介面，相容規則記錄於任務文件。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 新建 Structure 有預設名稱且可修改 | 從 Structure 選單新增 Array，讀取 outerframe 名稱 | 新物件顯示 `Array` | 通過 |
| 修改後立即更新且保存重開 | 輸入自訂名稱，等候儲存後重載 | outerframe 立即更新，重載後仍為自訂名稱 | 通過 |
| 舊物件缺少欄位相容 | 載入無 `structureName` fixture | 顯示 `Array`，可編輯並保存 | 通過 |
| 自訂與空名稱保留 | 載入自訂值與空字串 fixture，切換模式並重載 | 兩者皆未被預設值覆蓋 | 通過 |
| 預設名稱隨模式更新 | 將仍使用 `Array` 的物件切換為 Queue | 名稱與輸入欄同步變為 `Queue` | 通過 |

## 小驗證與重跑方式
### Structure 外框名稱專項
- 目的與對應條件：涵蓋新建、舊資料、即時編輯、模式切換、自訂值、空值及保存重開。
- 執行目錄與必要環境設定：`algo-vis-backend`；隨機埠與 headless Edge。
- 測試資料／fixture：測試內建立四個隔離 Structure widget。
- 完整指令或操作步驟：`node --test tests/structure-name.browser.test.js`
- 預期結果：專項通過。
- 實際結果與 exit code（適用時）：1 項通過，exit code 0。
- 證據位置：`tests/structure-name.browser.test.js`；未保留暫存產物。

### 語法、入口與差異
- 目的與對應條件：確認兩個修改的 JavaScript 可解析、資源版本入口一致且無空白錯誤。
- 執行目錄與必要環境設定：`algo-vis-backend`（diff 檢查於 worktree 根目錄）。
- 測試資料／fixture：不適用。
- 完整指令或操作步驟：`node --check public/slides.js`；`node --check public/slide-structures.js`；`node --test tests/entrypoints.test.js`；`git diff --check`。
- 預期結果：全部通過。
- 實際結果與 exit code（適用時）：語法、入口 1 項及 diff 全部通過，exit code 0。
- 證據位置：對應程式與測試檔；未保留暫存產物。

## 剩餘事項與合併注意
- 未驗證項目及原因：未執行完整 regression 或演算法驗證；本次屬 V1 前端 Structure 編輯與保存，依分級只執行直接相關專項。
- 已知問題或風險：Binary Tree renderer 本身沒有 outerframe 底部名稱區，因此欄位會保存但該模式不顯示名稱；其餘使用既有 outerframe 的 Structure 模式會顯示。
- 相依與衝突注意：整合 `slides.js` 的 widget normalization、Structure mode change 及 `syncWidgetElementInPlace` 時需保留 `structureName`；整合入口時保留最新 cache key。
- 主代理需補驗證的情境：實際操作 Array／Heap 的名稱修改、清空、切換模式與投影片儲存重開。

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
