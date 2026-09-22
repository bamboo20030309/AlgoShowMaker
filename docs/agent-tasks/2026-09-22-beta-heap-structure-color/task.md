# 2026-09-22-beta-heap-structure-color：修正 structure 調色盤回彈

## 任務資訊
- 負責代理：beta
- 狀態：待交付
- 共同基準 commit：1f2adca5d2d064e56baa446da55a72859bd10701
- 分支：codex/2026-09-22-beta-heap-structure-color
- Worktree：C:\Users\user\.codex\worktrees\heap-structure-color\AlgoShowMaker

## 問題與預期結果
- 情境與操作：匯入使用者的 Heap 投影片，在第 7 頁選取第二個 heap structure，開啟 highlight 調色盤並拖動色相。
- 目前行為：拖動時顏色短暫變更，放開滑鼠後跳回紅色；編輯顏色也可能重算手動調整過的元件尺寸。
- 使用者希望的結果：所選顏色能保留，改色不應改變 structure 的選取框大小。
- 本次範圍與必要限制：只修投影片編輯器的 structure 調色盤事件；使用者檔案中過寬的 heap 選取框另以修訂檔調整。

## 需求確認
- 已從使用者或上下文確認：問題出現在 Heap 投影片第 7 頁第二個 structure；使用者先前指定 highlight 預設純紅，但仍要能自行改色。
- 尚待使用者回答：無。
- 代理採用的合理假設：改色後應保留手動設定的 w/h；不更動繪圖元件的自動尺寸規則。

## 重現與調查
- 最小操作步驟或 fixture：`C:\Users\user\Downloads\Heap｜堆積：原理與動畫－修訂版 (1).asmdeck`；匯入、切到第 7 頁、選第二個 heap、開 highlight 調色盤、拖至藍色並放開。
- 重現狀態：已重現。
- 已確認事實：`color:change` 先送出藍色；文件層 `mouseup` 對沒有 Fabric 物件的 structure 呼叫 `updateObjectToolbar`，繼而關閉 `iroPopup`；調色盤再送出原先的紅色。原本改色路徑還會呼叫 `updateSelectedStructure`，重算自然尺寸。
- 尚待調查：無。

## 修改邊界與依賴
- 預計修改檔案或模組：`algo-vis-backend/public/slides.js`。
- 共用檔案／介面與協調結果：僅改投影片編輯器的滑鼠事件與 structure 顏色更新；沒有資料格式變更。
- 依賴任務：無。

## 驗收條件
- [x] 第 7 頁第二個 heap 的 highlight 改成藍色，放開滑鼠及重新選取後仍是藍色。
- [x] 改色前後該 structure 的選取框寬高不變，瀏覽器沒有 JavaScript 錯誤。

## 驗證計畫
- 子代理小驗證：`node --check`、`git diff --check`、隔離瀏覽器匯入使用者 deck 並操作顏色。
- 主代理整合驗收：核對差異，於整合版本確認 structure 調色盤操作與尺寸。
- 測試隔離方式：獨立瀏覽器頁面與本機測試埠，不操作使用者分頁或原始檔。

## 變更紀錄
- 2026-09-22：依使用者提供的實際 deck 重現，新增調色盤與尺寸的局部修正。
