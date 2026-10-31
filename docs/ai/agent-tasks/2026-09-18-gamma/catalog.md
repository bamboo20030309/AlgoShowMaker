# 訪客投影片收錄

首頁未登入時顯示 `public/guest-decks.json` 的精選案例。分類键與 `algorithm_sample` 的八個資料夾一致，中文名稱由 `guest-gallery.js` 顯示。

新增案例：
1. 把已整理好、允許公開的 `.asmdeck` 放進 `public/guest-decks/`。
2. 在 `guest-decks.json` 的 `decks` 陣列新增唯一 `id`、`title`、`category`、`archive`（站內路徑）。
3. 未登入開啟首頁，確認縮圖與分類，點選後確認觀賞頁載入。

訪客連結為 `/slides.html?sample=<id>`。檔案使用既有 ASMDeck 解碼與動畫重建，縮圖使用 AlgoDeckThumbnail。動畫仍可能需要既有編譯服務；本機通過不代表公開服務已部署。

公開案例會提供原始檔案下載存取，僅放允許公開的資料。既有私人雲端投影片權限保持原流程。公式與程式碼沿用檔案內既有元件，不轉成普通文字。
