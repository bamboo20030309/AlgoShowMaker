# 工作坊投影片暫時專屬入口

## 任務與結果

使用者提供 AlgoShowMaker-workshop-renumbered.asmdeck，要求網頁上的暫時專屬入口，「回到首頁」仍回到原首頁／登入入口。提供 /workshop.html，轉至 /slides.html?temporary=workshop；使用固定註冊資料載入 /temporary-decks/workshop-renumbered.asmdeck，不接受任意檔案路徑，也不加入範例目錄。

檔案原封複製，SHA256 C9CF23DC2FEA7FD45270EF80DF705E18C196A2ECE40424949746BA5032626910，共 48 頁、13 份預建動畫。沿用既有投影片介面與本機保存，草稿 key 與個人／範例投影片隔離；分享網址保留 temporary 參數。返回首頁使用 /，不強制登出；未登入者顯示登入介面，已登入者維持原首頁登入狀態。

## 驗證（V1）

workshop-entry.browser 與 entrypoints 通過：實際開啟、48 頁本機載入、重開不重複下載檔案、回首頁登入介面、無遠端投影片寫入且開啟不發 compile。未更動 Trace 語意，不跑大型動畫集；不宣稱逐幀驗收本教材全部動畫。原 asmdeck 雜湊相同、slides.js 語法與差異檢查通過。

## 交付与撤除

交付 intergration、重啟 3100；預覽 http://localhost:3100/workshop.html。未合併 main 或部署公開站。往後合併部署後同一路徑即可使用。結束使用時移除 workshop.html、temporary-decks/workshop-renumbered.asmdeck 與 slides.js 的 workshop 註冊資料；刪除專屬入口不影響個人投影片。
