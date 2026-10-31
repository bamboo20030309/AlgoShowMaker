# 2026-09-28-gamma-structure-selection 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：033f52b50af17652b35c8ba3afcd9aa351222dc0
- 程式修正 commit：4b163028a6dd646cca0257680a7b131de8c60533
- 驗證時的 HEAD 與未提交修改：4b163028a6dd646cca0257680a7b131de8c60533；程式驗證時無未提交修改，之後新增本交付紀錄
- 驗證日期：2026-09-28

## 根因與修改
- 已確認根因與證據：Structure／Table／Code／LaTeX 使用 DOM widget 選取，Text／Shapes 使用 Fabric 選取，而 Structure／Table 的格子另有第三層選取。第一次點格子時 pointer-down 先選整體，隨後 click 又立即選格子；Fabric 建立或更新選取時則無條件清除 widget 選取，因此 Shift 無法保留完整 Structure。
- 修正方式與行為變化：保存按下當下的 widget 選取狀態，只有操作開始前已選取完整 Structure 時，click 才能進入格子層級。任何加選操作先退出格子層級，但保留完整 Structure；Fabric 選取事件在 Shift／Ctrl／Command 手勢中不再清除 widget 選取。
- 修改檔案及用途：`slides.js` 調整選取流程；`slides.html` 更新快取版本；`widget-marquee-selection.browser.test.js` 驗證兩階段與 DOM／Fabric 混合多選；`entrypoints.test.js` 驗證入口版本。
- README／版本紀錄／使用說明更新：不適用；互動行為修正已記錄於 task 與 delivery。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 第一次點格子只選完整 Structure | headless Edge 直接點第一格 | Structure 為完整物件選取，格子框未顯示 | 通過 |
| 第二次點格子才選取格子 | 對同一格再次點擊 | 顯示半透明藍色格子框 | 通過 |
| Shift 點其他 DOM widget 時保留完整 Structure | 從格子狀態 Shift 點 Code | Structure 與 Code 同時選取，格子框關閉 | 通過 |
| Shift 點 Fabric 物件時保留完整 Structure | 從格子狀態 Shift 點 Text | Structure 保留、Fabric Text 選取，混合對齊工具列顯示 | 通過 |
| 舊有格子拖曳與樣式操作仍正常 | 重跑兩項既有瀏覽器專項 | 拖曳與樣式選色皆通過 | 通過 |
| 空白處清除選取 | headless Edge 點畫布空白處 | widget 與格子選取皆清除 | 通過 |

## 小驗證與重跑方式
### 選取階層與混合多選
- 目的與對應條件：驗證完整 Structure、格子與其他 DOM／Fabric 物件的選取順序。
- 執行目錄與必要環境設定：`algo-vis-backend`；測試自行啟動隔離隨機埠及 headless Edge。
- 測試資料／fixture：內建 LaTeX、Code、Structure 與 Fabric Text 的臨時 deck。
- 完整指令或操作步驟：`node --test tests/widget-marquee-selection.browser.test.js`
- 預期結果：兩階段選取、兩類 Shift 多選與空白清除皆通過。
- 實際結果與 exit code（適用時）：1 項通過，exit code 0。
- 證據位置：`tests/widget-marquee-selection.browser.test.js`。

### 既有 Structure 互動
- 目的與對應條件：確認格子選取後仍可拖曳完整 Structure，樣式工具列仍可操作。
- 執行目錄與必要環境設定：`algo-vis-backend`；隔離隨機埠及 headless Edge。
- 測試資料／fixture：各測試內建 Structure deck。
- 完整指令或操作步驟：`node --test tests/structure-cell-drag.browser.test.js`；`node --test tests/structure-cell-style-hover.browser.test.js`
- 預期結果：兩項通過。
- 實際結果與 exit code（適用時）：2 項通過，exit code 0。
- 證據位置：對應測試檔；未保留暫存瀏覽器產物。

### 語法、入口與差異
- 目的與對應條件：確認前端語法、入口快取版本與差異格式。
- 執行目錄與必要環境設定：`algo-vis-backend` 或專案根目錄。
- 測試資料／fixture：不適用。
- 完整指令或操作步驟：`node --check public/slides.js`；`node --test tests/entrypoints.test.js`；`git diff --check`。
- 預期結果：全部通過。
- 實際結果與 exit code（適用時）：語法通過；入口測試 1 項通過；diff 通過，exit code 0。
- 證據位置：命令輸出僅保留於本次任務紀錄。

## 剩餘事項與合併注意
- 未驗證項目及原因：依 V2 分級及使用者既有要求未執行完整 regression；Table、LaTeX 與 Shape 共用已驗證的 DOM widget／Fabric 分支，本輪未為每個型別重複建立相同案例。
- 已知問題或風險：混合選取仍由 DOM widget 與 Fabric 各自保存狀態，相關命令必須持續同時讀取兩邊的選取集合。
- 相依與衝突注意：整合 `slides.js` 時需保留 Fabric `selection:created`／`selection:updated` 的加選判斷，以及 `bindSlideDrop` 的 pointer 起始狀態。
- 主代理需補驗證的情境：整合後交叉測試 Structure、Table、Code、LaTeX、Text 與各 Shape 的 Shift 加選、刪除、移動與對齊。

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
