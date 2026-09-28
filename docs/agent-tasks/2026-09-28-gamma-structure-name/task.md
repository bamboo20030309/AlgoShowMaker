# 2026-09-28-gamma-structure-name：Structure 外框名稱編輯

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：b368f0b1e54efadde21f768a8e0f38e52c9fbef1
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期結果
- 情境與操作：選取投影片中的 Structure 物件，修改外框底部顯示的名稱。
- 目前行為：外框名稱由結構模式固定為 `Array`、`Heap` 等文字，編輯介面沒有名稱欄位。
- 使用者希望的結果：可在 Structure 左側編輯欄直接修改 outerframe 底部名稱，並隨投影片保存。
- 本次範圍與必要限制：Structure 物件；Table 是獨立物件且沒有 outerframe 名稱，不在本次範圍；只做前端局部驗證。

## 需求確認
- 已從使用者或上下文確認：outerframe 底部名稱應可修改；使用既有介面元件；不執行大規模驗證。
- 尚待使用者回答：無。
- 代理採用的合理假設：空字串為有效自訂值；切換模式時，僅原本仍為模式預設名稱者自動換成新模式名稱，自訂名稱保持不變。

## 重現與調查
- 最小操作步驟或 fixture：載入一般 Array Structure，選取物件並檢查左側欄；目前只能看到結構模式、長度等欄位，SVG 的 `.outerframe-label` 固定為 `Array`。
- 重現狀態：已重現。
- 已確認事實：`slide-structures.js` 的 `MODE_LABELS` 直接傳入既有 outerframe renderer；widget 資料目前沒有名稱欄位。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`public/slides.html`、`public/slides.js`、`public/slide-structures.js`、入口測試及 Structure 名稱專項瀏覽器測試。
- 共用檔案／介面與協調結果：新增 Structure widget 欄位 `structureName`；缺少欄位時以模式名稱相容載入。
- 依賴任務：沿用既有 Structure renderer、儲存及左側編輯欄。

## 驗收條件
- [x] 新建 Structure 顯示目前模式的預設名稱，左側欄可直接修改。
- [x] 名稱修改後立即更新 outerframe，並在儲存與重開後保留。
- [x] 缺少 `structureName` 的舊物件仍顯示原模式名稱，載入、修改、儲存與重開正常。
- [x] 既有自訂名稱及明確空名稱不被相容處理覆蓋。
- [x] 切換模式時預設名稱跟著模式更新，自訂名稱維持不變。

## 驗證計畫
- 子代理小驗證：JS 語法、Structure 名稱專項 headless Edge、入口快取版本與 diff 檢查。
- 主代理整合驗收：整合後實際建立 Structure，修改與清空名稱、切換模式、儲存重開。
- 測試隔離方式：專項瀏覽器測試使用隨機埠與臨時 deck，不操作使用者分頁或既有投影片。

## 變更紀錄
- 2026-09-28：依使用者要求新增 Structure outerframe 名稱編輯與保存。
