# gamma-file-drop：電腦投影片檔案拖入匯入與新增入口

## 任務資訊
- 負責代理：gamma；狀態：待交付
- 共同基準：71bc35cbc9a06489d6553ce3e40f5c43503215ef
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
使用者希望將電腦上的投影片檔拖至匯入、新增投影片與相關新增按鈕，直接匯入整份內容。

## 需求確認與合理假設
- 待答問題：無；沿用 .asmdeck／JSON 格式。
- 編輯頁沿用原匯入行為，以整份檔案取代目前 deck；工作區新增入口建立另一份 cloud deck，不替換既有其他 deck。
- 一次一個完整檔案；不支援格式、無效投影片或多檔顯示錯誤，保留既有內容。
- 只增加外部投影片檔案處理，不更動既有元件拖曳／排序，也不在唯讀頁允許修改。

## 修改邊界
- public/deck-file-drop.js：外部檔案拖入、驗證、IndexedDB 暫存傳遞。
- home.js：兩個新增投影片入口建立新 deck 並導向匯入。
- slides.js：匯入按鈕、overview 新增、投影片旁加號；工作區跨頁檔案導入，雲端成功後清理暫存。
- index/slides HTML 與 CSS：腳本載入、拖入高亮、快取。
- tests：專項瀏覽器與 entrypoints 版本同步。
- 共用介面：沿用原 importDeckJsonFile 與 ASMDeck 重建；不修改 trace 與動畫資料契約。
- 依賴：無；只改 gamma worktree。

## 驗收條件
- [x] JSON 與 asmdeck 拖至匯入按鈕可得到檔案內完整投影片。
- [x] 投影片旁的新增加號可匯入整份，非新增一張空白。
- [x] 工作區新增投影片入口建立新 cloud deck，儲存後重新開啟內容完整。
- [x] 拖入可接受入口時高亮，內部拖曳資料不被外部檔案處理攔截。
- [x] 無效格式／資料／多檔不修改內容；唯讀觀賞不接受檔案修改。

## 驗證計畫
V1，A／C。語法與差異檢查、entrypoints、asmdeck 直接相關測試、單一 deck-file-drop.browser 專項。隔離隨機埠／Edge、合成兩張非動畫投影片、mock 私有雲端接口。不跑演算法大驗證。

## 變更紀錄
- 2026-09-18：初始定義；沿用既有匯入語意與動畫重建路徑。
