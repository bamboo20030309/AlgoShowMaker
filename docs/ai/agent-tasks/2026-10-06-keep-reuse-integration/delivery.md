# 2026-10-06 整合驗收

- 基準 intergration 939f000；納入 Beta codex/2026-10-01-merge-sort 的 00a2002。其他本機／遠端已提交分支都已是整合基準的祖先。
- 快照重用共用 placements／elements／子節點與 keep 箭頭登錄，修正重用路徑漏箭頭；使用捕捉時的局部幾何，避免累加已排版的 DOM 位移。
- 快照資料、名稱、renderer options、來源樣式及當幀 Studio 設定改變時重建外觀；沒有新持久化必填欄位，DOM 私有快取缺少時正常重建。
- 活躍快照僅匹配 recursion layout、非空 activation 且同變數的最新節點；linear／line／group 與無 layout 快照保持歷史資料及樣式。
- 解決 renderer 活躍快照判斷與入口測試兩處衝突，採用較完整判斷並保留 Alpha tween trace-295、賦值來源幾何、八皇后候選列上色、14px LOD v6、slides-265。renderer／入口同步升為 trace-266。
- V2：獨立 31995、headless Edge，6 檔共 7 項通過，0 fail／skip：entrypoints、linear-keep-frozen（2 項）、linear-keep-layout、merge-focus-layout、assignment-detached-source、queens-array-dead-end。總計約 67 秒。
- 涵蓋 1x／4x 手動與 autoplay、五條箭頭的語意 ID／端點、新建與 JSON 重開、legacy line／缺少 activation、明確 false／gridlines(0)、樣式／隱藏／位置移除、Studio／縮圖及相關遞迴與賦值回歸；未跑完整 regression 或全部 tests。
- 語法與 diff check 通過。重啟 3100 並核對 HTTP／renderer／tween 與整合工作目錄一致；推送 intergration，不合併 main 或發布 release。
- 私人 Merge Sort 原稿／修訂版及 Alpha 未發布八皇后範例草稿保留，不加入公開範例，不提交 test-results 或 log。
