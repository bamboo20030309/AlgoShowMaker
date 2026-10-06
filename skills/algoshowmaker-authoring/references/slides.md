# 原生教學投影片

## 教學與版面

每頁以一個問題或推理步驟為主，動畫旁交代變數意義及程式位置。先介紹狀態表示與不變量，再展示程式與動畫。安排「預測下一步 → 操作／播放 → 解釋原因」活動。

文字用可編輯文字物件；程式用 `code` widget；公式用 `latex` widget；陣列、樹與表格用現有 `structure` widget；動畫用既有演算法動畫投影片。避免把程式、公式或整頁教材烘焙成圖片。原生結構 widget 的設定與 C++ 註解語法是不同介面。

使用 repo 的既有版型；沒有指定模板時可採 1280×720，以清楚的標題、主要示意區和短說明組成。這是設計建議，不是硬性格式限制。檢查文字溢出、重疊、對比、程式字級與動畫可見範圍。

## 實際格式與查證位置

製作 structure 時，沿用 `AlgoStructureRenderer.getNaturalSize(widget)`／`getWidgetGeometry(widget)` 的實際量測結果，依自然比例適配版面；不要另外猜格子總寬高或手動修選取框。舊容器比例不同時，選取框仍應對齊實際主體。point／外部註標不參與主體縮放，詳見專案根目錄 `docs/structure幾何計算.md`；完成後實際選取、縮放、編輯並儲存重開確認。

repo 範例來源：

- `algo-vis-backend/scripts/build-eight-queens-teaching-deck.js`：可編輯文字、code、latex、structure 和動畫頁。
- `algo-vis-backend/scripts/build-teaching-decks.py`：組裝既有動畫與教學頁。
- `algo-vis-backend/public/asmdeck.js`：原生封裝與匯入檢核。
- `algo-vis-backend/public/trace-provenance.js`：當前引擎版本與 trace 格式。
- `algo-vis-backend/public/guest-decks/`：可參考的已建置教材。

這些 builder 有特定輸入／輸出路徑；先閱讀，再複用需要的 helper，不直接執行並覆蓋現有教材。沒有 repo 時可從上述固定 commit 的 GitHub 路徑取得來源；不能取得時只交付故事板。

原生資料包含 `deck.groups`，每個 group 有 `id` 與 `slides`。普通頁有 `id`、`canvas.objects`、`widgets`、`ttsScript`、`ttsOrder`；畫布物件是 Fabric 序列化資料。Widget 使用 `id/type/x/y/w/h/content` 等欄位，其他必填與預設欄位應依當前 helper 建立，不自行猜測。

動畫頁使用 `kind: 'algorithm-animation'`，其 `animation` 包含 `mode: 'trace'`、`code`、`input` 及相應重建設定；複用既有頁时保留 trace provenance 與設定。建立頁面後要在實際應用載入，不能只看 JSON 是否能解析。

`.asmdeck` 是 `ASMDECK1\n` 檔頭加 gzip 壓縮的套件，不是純 JSON。套件包含 manifest 與 body；body 包含 deck、assets 及可選 prebuiltTraces。manifest 有格式、套件／引擎版本、body 的 SHA-256 等資料。使用既有 serializer／經閱讀的 builder 產生，勿手填 hash 或版本。JSON 序列化順序也會影響內容雜湊。

## 驗證與交付

原生檔要核對套件解碼、頁數、物件可編輯性、動畫輸入、實際匯入、播放與版面。修改既有檔時另存新檔，保留原檔。無法匯入時列出未驗證部分，交付逐頁故事板及建立步驟，勿宣稱原生檔已驗收。

故事板至少包含：頁標題、學習／操作目標、文字、元件類型、動畫／程式對照、講者提示、練習任務及預計時間。

## 150 分鐘工作坊範例

| 時間 | 活動 |
| --- | --- |
| 0–10 | 目標、完成品展示與操作入口 |
| 10–25 | 河內塔：觀看結果、修改輸入、體驗播放 |
| 25–45 | 指令、frame、事件與文字／程式對照 |
| 45–65 | 教師示範 KMP 建表與回退 |
| 65–95 | 參與者用不同輸入製作 KMP，保留作品與遇到的問題 |
| 95–105 | 休息 |
| 105–130 | AC code 加 AI：理解實作、加註解、修正及核對 |
| 130–140 | 成果分享與問題整理 |
| 140–150 | 完成後問卷 |

研究重點若是可完成性、好用與效率，另記錄任務完成率、耗時、求助與修正次數；問卷放最後並區分熟悉度、易用感受及開放意見。沒有對照条件時，「比較快」只能視為主觀感受，不能由滿意度推論客觀效率或學習成效。
