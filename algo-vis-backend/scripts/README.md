# 開發腳本

腳本按用途分類；各檔案內的相對路徑以 algo-vis-backend 為工作根目錄。不要直接對使用者服務執行批次編譯或覆寫公開教材。

| 資料夾 | 用途 | 常用入口 |
| --- | --- | --- |
| build | 教材、封面與預建動畫資產 | `npm run prebuild:guest-decks`、`npm run prebuild:default-algorithm` |
| validation | 隔離驗證、瀏覽器檢查、依賴指紋與續跑 | `npm run test:inventory`；完整 regression 僅由主代理依風險執行 |
| benchmarks | 編譯壓力、載入時間與演算法效能比較 | `npm run loadtest:compile` |
| migrations | 舊指令與資料的一次性遷移 | 先備份，確認來源尚未遷移後才使用 |

公開範例 Trace 依投影片檔名及動畫序號命名，建置工具同步維護 ID 索引與舊結果，詳見 [資產規則](../../docs/development/sample-trace-assets.md)。
