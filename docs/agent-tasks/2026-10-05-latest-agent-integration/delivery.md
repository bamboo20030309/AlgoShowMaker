# 2026-10-05 子代理整合驗收

- 基準：intergration b1441b9。納入 alpha 4f05216、beta fa7bd65；合併提交 64dc873、1ee2938，無衝突。
- 賦值動畫保存移動來源的舊外觀與脫離 DOM 前的幾何；一般賦值背景於值提交後更新，保留交換／位元運算時序與自訂顯示文字。
- 八皇后修正新皇后的左右斜向攻擊，補上無候選位置時的返回說明；整合驗收發現數字陣列範例缺少候選列 style，補齊當前列與下一列的紅／綠上色。N=4 維持 2 解、17 snapshots、4 個死路說明。
- keep 整幀快照先重建再排版，修正 Merge Sort 遞迴樹座標累加與相機 focus 漂移；僅物件快照仍沿用增量重用。
- 合併後快取識別：renderer trace-264、tween trace-295；保留 slides trace-265 與 LOD v6／14px 數字門檻。
- 獨立服務與 headless Edge，9 個相關測試檔共 13 項：首次 12 通過／1 失敗；修正八皇后上色後僅重跑失敗項，1/1 通過。包括 detached assignment、兩種 queens 死路、merge focus layout、sequence layout timing、effect layer、presented style values、bitwise commit timing、entrypoints。沒有完整 regression 或大型演算法驗證。
- JS 語法與 git diff --check 通過；未增加持久化欄位，賦值測試涵蓋 JSON round-trip 的既有資料。
- 八皇后未發布的教學 deck、範例清單與建置腳本留在來源工作目錄；Merge Sort 私人投影片草稿保留，均未加入公開範例。
- 重啟且核實 intergration 3100 的 HTTP 與前端腳本來自本工作目錄。main／3000、其他代理服務未操作；不發布 release、不合併 main。
