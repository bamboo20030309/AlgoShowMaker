# RUN 首幀名稱錯位

- 基準：intergration b49c6e4；使用者 KMP 程式，輸入 abababca。
- 重現：從輸入頁籤 RUN，畫布隱藏時 SVG label.getBBox() 回傳零尺寸；fitObjectNames 重複將名稱區中心加到座標。自動切回畫布後，p／pat 名稱向右偏約 336px、向下偏約 158px；從畫布 RUN 沒有這個大幅錯位。
- 修正：無有效文字尺寸時保留既有名稱座標；畫布頁籤可见後重新調整名稱，不重建物件、不播放事件，也不修改持久化位置與鏡頭。renderer trace-268、front random-id-52。
- 新增 first-frame-name.browser 與 KMP fixture，逐一從畫布／輸入／除錯頁籤 RUN，核對 stdout 0 0 1 2 3 4 0 1 及兩個名稱的實際 SVG 邊界中心；修正前明確失敗，修正後通過。
- 隔離驗證 4/4 通過：首幀、name-fit（窄名稱、keep、舊資料、自訂字體／顏色與明確 false、保存重開）、tab-camera-syntax-tree、entrypoints。JS 語法及差異檢查通過，未跑大型動畫驗證。
- 只更新 intergration，重啟 3100 並核對最新腳本；未合併 main 或發布 Release。
