# 2026-09-28-gamma-text-auto-width 交付驗證紀錄

## 交付資訊
- 狀態：有失敗或阻塞
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：926ffb91a0ff3bfcec73376d312eba221ce15d8d
- 程式修正 commit：7692ff3e81dc328e80a0e5b479b1c031d1a1f01f
- 驗證時的 HEAD 與未提交修改：7692ff3e81dc328e80a0e5b479b1c031d1a1f01f；程式驗證時無未提交修改，之後新增本交付紀錄
- 驗證日期：2026-09-28

## 根因與修改
- 已確認根因與證據：Fabric Textbox 只會在內容超過既有寬度時提高 `dynamicMinWidth`，內容縮短時不會回復，因此物件寬度只增不減。
- 修正方式與行為變化：新增可保存的 `asmTextWidthMode`。預設 `auto` 使用一個 Fabric Text 量測物件取得目前最長邏輯行的實際寬度；手動縮放後改為 `fixed`。舊 Text 若已有寬度限制造成的換行則推定為 `fixed`，否則推定為 `auto`。
- 修改檔案及用途：`slides.js` 實作寬度模式、量測、文字與樣式變更同步及手動縮放切換；`slides.html` 更新快取版本；新增瀏覽器專項並更新入口測試。
- README／版本紀錄／使用說明更新：不適用；行為與相容規則記錄於 task 與 delivery。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 新建及 auto Text 自動縮緊 | headless Edge 新建 Text，長句改短句 | 新建寬度小於 150；長句改短後寬度縮小超過 150 | 通過 |
| 多行以最長行為準 | 將內容改為 `tiny\nx` | 寬度小於 100，以 `tiny` 為準 | 通過 |
| 手動縮放後固定 | 模擬 Fabric scaling，再輸入 `z` | 模式為 fixed，寬度維持手動值 | 通過 |
| 舊物件相容 | 載入未換行與受限換行兩種舊 Text | 前者為 auto；後者維持 fixed 與換行 | 通過 |
| 明確模式保存重開 | Fabric JSON 序列化後重新匯入 | auto／fixed 值完整保留 | 通過 |

## 小驗證與重跑方式
### Text 自動與固定寬度
- 目的與對應條件：涵蓋新建、長短文字、多行、手動縮放、舊資料推定及保存重開。
- 執行目錄與必要環境設定：`algo-vis-backend`；隨機埠與 headless Edge。
- 測試資料／fixture：四個不同模式的 Text 與一個由介面新建的 Text。
- 完整指令或操作步驟：`node --test tests/text-auto-width.browser.test.js`
- 預期結果：專項通過。
- 實際結果與 exit code（適用時）：1 項通過，exit code 0。
- 證據位置：`tests/text-auto-width.browser.test.js`。

### 文字復原與入口
- 目的與對應條件：確認寬度同步未破壞編輯中復原、保存節流及入口快取版本。
- 執行目錄與必要環境設定：`algo-vis-backend`。
- 測試資料／fixture：既有文字復原 fixture。
- 完整指令或操作步驟：`node --test tests/slides-text-undo.browser.test.js`；`node --test tests/entrypoints.test.js`；`node --check public/slides.js`；`git diff --check`。
- 預期結果：全部通過。
- 實際結果與 exit code（適用時）：瀏覽器 1 項與入口 1 項通過；語法與 diff 通過，exit code 0。
- 證據位置：對應測試檔；未保留暫存產物。

### Inline scripts 既有專項
- 目的與對應條件：額外檢查上下標樣式與寬度量測的交界。
- 執行目錄與必要環境設定：`algo-vis-backend`。
- 測試資料／fixture：既有 `A_2 x^{n+1}` fixture。
- 完整指令或操作步驟：`node --test tests/inline-scripts.browser.test.js`
- 預期結果：專項通過。
- 實際結果與 exit code（適用時）：失敗，exit code 1；剛進入編輯且尚未輸入時，既有 runtime 已保留 `deltaY: 4.4`，測試期待 `undefined`。失敗點位於本次文字寬度計算之前，未修改斷言或宣稱通過。
- 證據位置：`tests/inline-scripts.browser.test.js:70`。

## 剩餘事項與合併注意
- 未驗證項目及原因：未執行完整 regression，依 V2 分級及使用者既有要求不執行。
- 已知問題或風險：既有 inline scripts 測試對「進入編輯時是否立即顯示上下標」的預期與目前 runtime 行為不一致，需由主代理依產品預期判定應改 runtime 或測試。
- 相依與衝突注意：`asmTextWidthMode` 必須保留在 `FABRIC_CUSTOM_PROPS`；整合文字輸入與縮放事件時需保留 `fitAutoTextWidth` 與 `fixed` 切換。
- 主代理需補驗證的情境：決定 inline scripts 進入編輯時的正確顯示時機；整合後實際拖曳 Text 寬度並儲存重開。

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
