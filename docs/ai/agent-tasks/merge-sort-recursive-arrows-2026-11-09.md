# 合併排序遞迴範例與 Trace 更新

兩份遞迴動畫改為使用者指定的完整版本，與上一版差異為新增 `// @layout merge_tree arrow-direction down`。各自的原測資及全部非動畫頁內容保持原樣。

隔離服務以 `prebuild-guest-decks --only merge-sort --rerun` 重新執行本教材四份 Trace（兩份遞迴各 83 幀、兩份倍增各 61 幀），確認全部成功才切換公開清單；投影片仍僅保存引用 ID，canonical 編製來源同步更新，舊資源保留。

局部驗證：兩個遞迴程式移除新增指令後逐字等於前版；測資未變，新 ID 不同；兩份最終 num 均為 1～10 遞增，明確關閉的 autoFixedEnabled 保留。獨立瀏覽器在第 21 與最後一幀讀取實際 SVG，merge_tree 的箭頭有效方向皆往下，無頁面例外。其他頁面及倍增程式碼未改。未跑大型驗證或其他教材。

交付 intergration 並重啟 3100；未合併 main 或發布 Release。
