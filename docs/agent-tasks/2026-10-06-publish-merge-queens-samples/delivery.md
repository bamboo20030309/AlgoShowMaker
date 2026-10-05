# 新增合併排序與八皇后公開範例

- 依使用者本次明確授權，複製 Downloads 的「合併排序.asmdeck」與「八皇后問題 (8queen).asmdeck」至 public/guest-decks，不使用其他代理的未發布草稿；複製內容與來源逐 byte 相同。
- 名稱：合併排序、八皇后問題 (8queen)。分類與 hints 合併後分別顯示「排序／分治／合併」及「回溯／遞迴／剪枝」。
- 堆積排序移除「原地排序」hint；費式數列遞迴移除「呼叫樹」hint。
- V1／內容驗收：JSON／diff check、ASMDeck.decode 雜湊與預建動畫核實；合併排序 33 頁、4 段 83/83/61/61 幀，八皇后 23 頁、3 段 257/54/145 幀。原始內容、動畫 code／input／Trace 未修改。
- 隔離 31995 與 headless Edge：實際載入首頁範例清單，核對四張卡片名稱與標籤、新增兩份的有效縮圖、各自公開 sample 入口開啟 ready，沒有 POST compile／analyze，無 pageerror。
- 未執行大型動畫驗證或重新編譯範例；私人投影片與脚本保留，不提交 test-results。
- 完成後重啟 intergration 3100、核對索引與兩份 HTTP 回應檔案，推送整合分支；未合併 main 或發布 release。
