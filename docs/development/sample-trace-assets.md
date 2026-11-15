# 公開動畫資產

2026-11-16 起，`public/deck-traces/` 與預設動畫的 `.asmtrace` 檔已移除，不再發布 Trace JSON、索引或完整結果包。

- `guest-decks.json` 指向只有來源、輸入、設定與執行檔 ID 的教材封裝。
- `default-animation/manifest.json` 只包含線篩的獨立程式配方，不包含首幀或完整 Trace。
- 載入投影片後從第一個動畫依序重新執行，完整結果只留在本次頁面記憶體。
- 舊 `/deck-traces/*` URL 回傳 410，避免意外讀到部署目錄殘留的舊檔。

建置方式與相容性見 [執行檔與 Trace 的生命週期](../guides/trace-cache-updates.md)。
