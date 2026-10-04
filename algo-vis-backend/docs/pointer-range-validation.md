# Pointer 原始索引與 range（2026-10-05）

省略 pointer 位置時，解析器以指標變數名稱作為 indexExpression，沿用現有渲染器的原始索引查找，不改 range 定義或新增 mapped／index-origin。
`@pointer i at num` 與 `@pointer i at merge_tree.children[0]` 已支援。明寫運算式的舊 binding 繼續使用原式；缺少 implicitIndex 的舊資料不需要遷移。
Merge Sort 分裂與葉節點直接畫 num 的 range(L,R) 切片；合併過程畫 merged，copy 回 num 後以 num 切片 keep 合併節點，供上層 pointer 使用原始索引。移除只供繪圖的 part vector。

## V2 局部驗證

- 分類 E／G／H；獨立本工作樹 31992 服務及 headless Edge，未操作使用者分頁。
- 輸入：10；38 27 43 3 9 82 10 19 84 60。
- pointer-directives：4 案例，省略位置、舊位置運算式、preset、錯誤變數／layout。
- pointer-children.browser：2 案例，keep 切片原始索引、左右子節點、range 外隱藏、指標層高於箭頭、新舊混用、舊 binding 缺少 implicitIndex 與 trace 載入／儲存重開。
- pointer-anchor-paint.browser：1 案例，1／4 倍手動轉場及實際 Play 自動播放；不可見定位 rect 始終無填色。
- merge-arrow-motion.browser：1 案例，實際 SVG 端點與 node anchor 對齊，1／4 倍轉場及 keep handoff。
- entrypoints：1 案例，前端入口版本一致；directive assist 已升為 directive-31。
- 共 9 個不同案例通過，沒有 skip。語法、diff whitespace 檢查及 browser pageerror 檢查通過。
- 3102 重啟後 HTTP 200，sample API 確認提供 num range 與省略位置的 pointer 範例。
- 未執行完整 regression、其他演算法、Studio 縮圖或投影片嵌入驗證；本次未修改其流程。
