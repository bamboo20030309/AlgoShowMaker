# 倍增 Merge Sort 最後一幀 keep 重疊

- 線性 layout 的一般物件快照，因目前 frame 與 snapshot 都沒有 recursionActivationId，空字串相等而被誤認為活躍的遞迴節點。
- 快照因此讀取当前 frame 的值與來源 style 混合。最後一幀的 width 已不在 scope，保存的 @for step width*2 無法求值，renderSnapshots 拋錯；applyLineLayouts 尚未執行，快照重疊於初始位置。
- 修正為只有 recursion layout 的物件快照會跟隨活躍節點；linear、舊 line／group 與無 layout 的快照維持保存資料／樣式。未新增持久化欄位，無需重新編譯舊 Trace。
- 獨立 31995／headless Edge：linear-keep-layout.browser.test.js 通過。10 筆倍增排序共 61 幀，最後 5 排以 70px gap 排列；1x／4x 相鄰播放、直接跳幀、Studio、縮圖與 JSON 往返後 legacy line 排版一致，原始數列及最後排序結果保持各自資料，無 pageerror。
- 同次局部驗證 merge-focus-layout.browser.test.js 通過：遞迴版 focus／auto、1x／4x、手動／自動播放與 Studio／縮圖保留。未重跑已通過的不相關測試。
- 更新 renderer cache build 為 trace-265，入口與測試一致；JS 語法、entrypoints、diff check 通過。
- 僅重啟 intergration 3100，核對 HTTP 與本 worktree 檔案一致；推送 intergration，不合併 main 或發布。
