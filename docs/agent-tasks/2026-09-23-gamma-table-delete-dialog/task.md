# 2026-09-23-gamma-table-delete-dialog：投影片表格物件與刪除確認彈窗

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：dc62fb1fe6be8234dc387d3d6b421c474082c698
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期結果
- 情境與操作：使用者在投影片編輯器新增資料展示物件，或在投影片總覽刪除一或多張投影片。
- 目前行為：第一版把表格實作成 `structureMode: table`，Table 入口與編輯控制也放在 Structure 內；刪除投影片原先使用瀏覽器原生確認介面，與網站設計不一致。
- 使用者希望的結果：Table 必須是獨立物件，具有主工具列入口、獨立編輯面板與 `type: table` 儲存型別；仍可直接編輯、調整列欄與表頭樣式。刪除投影片改用網站自有彈出視窗。
- 本次範圍與必要限制：前端功能；只跑相關局部驗證，不跑大規模 regression。表格第一版不含合併儲存格、公式、試算表貼上解析、每格富文字或專用演算法動畫。

## 需求確認
- 已從使用者或上下文確認：在一般投影片新增獨立的表格物件，不做在 Structure 裡；刪除投影片需使用彈出視窗；完成後 push；前端修改不需大規模驗證。
- 尚待使用者回答：無。
- 代理採用的合理假設：表格對外使用獨立型別與介面；內部沿用已驗證的格子選取與 SVG 排版能力，以及共用的拖曳、縮放、圖層、複製、復原、儲存與匯出管線。第一版提供 1–20 列、1–12 欄與首列／首欄表頭設定。

## 重現與調查
- 最小操作步驟或 fixture：編輯模式點主工具列 Table；確認新增物件與儲存資料型別為 `table`，且 Structure 選單及模式下拉選單沒有 Table。總覽選取投影片後按 Delete；原先沒有網站自有確認視窗。
- 重現狀態：已重現。
- 已確認事實：既有 Structure renderer 已提供共同的選取、尺寸、層級、儲存與每格編輯入口；總覽刪除已有選取與 220ms 過場，可在刪除前插入 dialog。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`public/slides.html`、`public/slides.css`、`public/slides.js`、`public/slide-structures.js`、局部瀏覽器測試與入口資源版本測試。
- 共用檔案／介面與協調結果：新增獨立 `type: table` 與二維 `tableData`；載入舊 `type: structure, structureMode: table` 時自動正規化成新型別。更新 slides 資源 query 版本避免舊快取。
- 依賴任務：無。

## 驗收條件
- [ ] 從主工具列獨立 Table 按鈕新增後，畫布顯示可拖曳縮放的 3×3 表格，首列採表頭樣式；Structure 選單與模式下拉選單不含 Table。
- [ ] Table 顯示自己的左側編輯面板並以 `type: table` 保存；舊 `structureMode: table` 資料載入後仍正常顯示並轉換。
- [ ] 可直接編輯單格內容，內容含逗號時仍完整保存；可調整列欄、首列表頭、首欄表頭與表格顏色。
- [ ] 新增／刪除列欄後每格樣式索引正確移動，並可復原、重做與重新載入保存結果。
- [ ] 在總覽按 Delete 時先顯示自有刪除確認彈窗；取消、Escape 與點擊背景均不刪除，確認後刪除且可復原。
- [ ] 最後一張投影片仍不可刪除，多選刪除仍至少保留一張。

## 驗證計畫
- 子代理小驗證：JavaScript 語法檢查；Table 專用 Playwright 測試；投影片刪除 dialog 專用 Playwright 測試；入口資源版本測試；兩個介面的實際截圖檢查；`git diff --check`。
- 主代理整合驗收：核對資料格式相容性與 UI；在整合版本重跑兩個局部瀏覽器測試並檢查投影片匯出；本任務不要求演算法投影片 regression。
- 測試隔離方式：測試以隨機埠或 3199 臨時服務、獨立 headless Edge 與 localStorage fixture 執行，不操作使用者分頁或資料。

## 變更紀錄
- 2026-09-23：建立表格物件第一版與自有投影片刪除確認 dialog；依使用者指示採前端局部驗證。
- 2026-09-23：使用者確認 Table 應是獨立物件而非 Structure；調整入口、編輯面板與持久化型別，並保留舊資料遷移。
