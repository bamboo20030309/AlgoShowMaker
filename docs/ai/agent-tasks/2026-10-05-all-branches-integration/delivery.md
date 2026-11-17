# 2026-10-05 全分支統合驗收

## 範圍
- 目標 intergration；main 保留既有驗收版本，不發布 release。
- 本輪先以 0897f95 保存近期投影片編輯與延後載入 Trace 的工作，再合併 main 的版本紀錄。
- 新開發提交 e21eb60（Merge Sort）尚未包含，其餘本機開發分支均已包含；外部兩個 worktree 唯讀 status 為乾淨。
- 保留八皇后草稿於 drafts，不重新公開上傳範例。

## 新增／修正
- 遞迴及迭代 Merge Sort 範例；共用 layout 節點定位、獨立 pointer、箭頭快照交接、比較及來源格轉移、名稱自動適配、程式碼面板設定。
- 保留分析 worker pool、編譯佇列／快取／獨立訊息、位元動畫與 silent keep；分析 worker 補傳 drawingEnabled。
- Trace 尾端採明確 tail 記錄，同時支援前一版沒有 tail 的檔案；保留 captureOrder 與 afterCapture，不改 captured state。無任何幀的事件不提供播放。錯誤與事件上限保持原有強制失敗。
- 合併驗證發現 scope-exit opacity 覆蓋 keep 生長淡入；改為組合兩個階段。
- 第二個預覽幀增量重用時，來源 key 對到已保留父節點，誤刪其內容；移除 live replacement 前排除 snapshot 子物件。
- 引擎 generation 13 使新執行使用新快取；格式仍為 1，既有 Trace 可讀並保留原自訂設定。
- 前端版本 slides-264／tween trace-293／renderer trace-262，共享 model／arrow 入口同步；嵌入入口亦更新。

## 驗證（V1／V2，獨立 31994 與 headless Edge）
通過：
- 新分支與既有位元動畫交界：bitwise.integration（2 案例）。
- compile-cache.integration（共享快取、另一輸入、owner-scoped 非同步工作）。
- frame-renderer-options.integration（5 案例）。
- trace-chunk-store（7 案例；含 count/byte chunk、尾端、舊格式、false/0、自訂值、大小限制）；舊版尾端案例按已授權保留尾端的新契約新增 captureOrder/afterCapture 斷言。
- trace-analysis-pool、cloud-content、slide-storage、slide-trace-store（連同入口共 30 案例）。
- no-drawing-trace（3 案例）；layout-targets；reserved-root-intro。
- merge-sort-recursive-layout：branch preview、已保留節點、既有 edge、leaf-to-keep、箭頭交接、父槽位，共 6 案例。
- merge-exact-frames：1×／4× 預覽父子幾何、空宣告、來源格與目的格交接。
- sequence-layout-timing：插入與 layout 位移使用同一事件時鐘。
- keep-camera-focus：生長、淡入、延伸箭頭及目前物件鏡頭。
- mixed-object-paste（3 案例）、empty-text-deselection（含 undo/redo／儲存重開）。
- slide-trace-lazy（按需載入、ID 保存、匯出／重新匯入、undo/redo、大投影片重開）。
- provenance（6 案例）、入口依賴／build 契約、所有本輪 JS 語法與 git diff --check。

測試修正只針對 fixture 已演進的前提：固定生命週期情境移除新增介紹幀、使用固定 8 個輸入與 part；箭頭交接另加同一葉節點的中性 capture，避免下一個葉節點合法的新箭頭被當成重複。範例本身未因此改寫。合併插入驗證依事件選幀，使用實際物件別名；來源必須是目前 activation 的完成子節點，搬移值／格數／目的格隱藏仍嚴格核對。重新整理已按使用者要求停在原頁，延後載入測試同步核實。

未執行完整 regression、所有排序或三環境動畫；只重跑失敗項目及修正直接影響項目。使用者分頁與私人資料未操作。測試產物／log 未納入提交。
