# 資料夾對話框與縮圖拖曳整合驗證

- 日期：2026-09-18；分支 intergration；前次 checkpoint 5e45458662ac9007ff9340382a778a1d8ac34b19。
- Gamma 交付 b2aac34（8 個新提交、4 項任務）；Alpha、Beta 無新增待合併提交。
- 合併與受測程式 commit：eafa8a09c4ca960301b369ffcbdafaefe97abdea；無合併衝突。
- main 保持 ddfe5b6081261a05b437a61a546861151d4618e5，不合併 main、不發布 release 或部署。

## 差異核實

- 資料夾重新命名沿用 folderDialog；移除使用站內 deleteFolderDialog，預設焦點為取消。保存中禁止重複操作，失敗保留輸入與視窗供重試，移除不刪投影片。
- 返回工作區採用既有 quiet-btn 與 SVG 箭頭，保留文字與 href=/。
- 品牌圖示引用既有 favicon.svg，28×28 裝飾圖片，保留品牌首頁連結與名稱。
- 非同步建立縮圖時立即設 draggable=false，避免原生圖片拖曳干擾整卡 pointer 排序。
- 入口快取：home.css brand-favicon-16、home.js thumbnail-drag-8、library-organizer.js 7。保留整合 slides 的 parallel-merge-188。
- 本次 V0/V1，一般前端與資料夾儲存操作；不修改投影片動畫或演算法，不啟動演算法驗證集。

## 驗證

在 intergration/algo-vis-backend 執行：

```powershell
node --check public/home.js
node --check public/library-organizer.js
node --check tests/auth-center.browser.test.js
node --check tests/entrypoints.test.js
node --check tests/library-folders.browser.test.js
git diff --check 5e45458
node --test --test-concurrency=1 tests/auth-center.browser.test.js tests/entrypoints.test.js tests/library-folders.browser.test.js tests/slide-library.test.js tests/deck-file-drop.browser.test.js
```

- 語法及差異檢查通過；6 pass、0 fail、0 skip，exit 0，約 13 秒。
- 真實瀏覽器量測 favicon 載入與尺寸、返回按鈕樣式、既有登入置中；核實資料夾命名取消、失敗與 Enter 重試，移除預設取消、Esc、失敗後重試、多分類保留及手機 viewport。
- 延遲生成的合成縮圖 draggable=false，從圖片開始的實際滑鼠拖曳改變卡片順序且不開啟投影片或對話框；既有資料夾排序與失敗還原、外部檔案拖入通過。
- API 模型驗證順序、未知／跨帳號引用拒絕與偏好保存；使用獨立服务與無頭 Edge context、mock API、合成 metadata 與圖片，未操作使用者分頁或私人投影片。
- 未執行完整 regression、演算法動畫、真實私人投影片縮圖生成、Mongo 持久化或實機觸控；不能將合成 fixture 通過視為這些項目的驗收。
- 測試索引仍為 72 個檔案，沒有新增測試檔；不提交 test-results、log 或暫存產物。

## 服務與交付

- 確認 3100 舊程序 PID 27228 後重啟，新 PID 29956。
- index.html、home.css、home.js、library-organizer.js、favicon.svg、slides.html HTTP 200，SHA-256 與受測 worktree 相同。
- main 3000 HTTP 200；整合 slide-library 匿名 API HTTP 401；main 與 Docker 未重啟。
- 最新預覽：http://localhost:3100。
- 使用者已授權驗證後推送至 https://github.com/bamboo20030309/AlgoShowMaker.git 的 origin/intergration。推送結果以主代理最終回報及 origin/intergration 核對為準。
