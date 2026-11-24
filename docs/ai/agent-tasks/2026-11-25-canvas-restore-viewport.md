# 縮放與復原後畫布空白

- 主因：`loadSlideCanvas` 還原物件時固定將 viewport 平移設成 180；縮小後實際 bleed 已達 960，內容被畫到可見頁面外，頁面取樣像素透明。改為在非同步載入完成當下讀取該畫布的實際 bleed。
- 最小案例修正前確實失敗：縮放 50% → 修改文字色 → 復原，`bleed=960`、`viewport=180`。不是物件資料被刪除。
- V1：`slide-canvas-restore.browser.test.js`、`selection-control-zoom.browser.test.js`、`slide-workspace-bleed.browser.test.js` 共 3 項通過，核對復原／重做、一般／停用快取重整、第五頁位置、實際像素、選取框及頁外物件。
- 使用指定 34 頁投影片的獨立副本再核對第五頁：21 物件保留，縮放復原及兩種重新整理均有實際像素且無頁面例外；未寫回使用者投影片。單純重新整理在隔離環境原先未重現空白，確切重現點是縮放後復原。
