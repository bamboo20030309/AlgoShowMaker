# 工作區資料夾整合驗證

- 日期：2026-09-18。
- 目標分支：intergration；整合前 d5f4ea7。
- Gamma 交付：6168bd8（程式 7a94173351cd70a1d4b9012e2464d64dacb76744），本輪新增兩個提交。
- 合併與受測程式 commit：b234d65f2a9b1d585d07c0df1e80d8fe90fdc5d0。
- Alpha、Beta 沒有尚未包含於 intergration 的提交；Gamma 全部交付已包含於整合版本。
- main 維持 ddfe5b6081261a05b437a61a546861151d4618e5，沒有合併 main、push 或發布。

## 修改審查

- 工作區新增单層資料夾、新增／命名／移除、展開／收合、搜尋與分类導覽、拖曳排序及手機替代操作。
- 新 API 保存 preferences.slideLibrary，以登入帳號查詢 deck 並拒絕未知／其他帳號 deck，沿用 Mixed preferences 並以子欄位 $set 保留其他偏好。
- 整理操作儲存中阻止新操作，失敗恢復原排序；移除資料夾不刪投影片。
- 無合併衝突。保留 intergration 預覽規範、parallel-merge-186 入口精確斷言，以及既有 Alpha／Beta／Gamma 功能。
- 本次 V1/A、C，前端工作區及偏好儲存，不修改動畫引擎或演算法；不執行演算法大驗證。

## 執行與結果

執行目錄：intergration worktree 的 algo-vis-backend。

```powershell
node --check server.js
node --check slide-library.js
node --check public/home.js
node --check public/library-layout.js
node --check public/library-organizer.js
node --check tests/library-folders.browser.test.js
node --check tests/slide-library.test.js
git diff --check
node --test --test-concurrency=1 tests/slide-library.test.js tests/library-folders.browser.test.js tests/deck-file-drop.browser.test.js tests/entrypoints.test.js
```

- 語法與差異檢查通過；5 pass、0 fail、0 skip，exit 0。
- 專項核實建立／命名／移除、滑鼠 pointer 拖曳、DataTransfer 移入資料夾、重載順序、新檔附加、失敗還原、390px 操作、橫線分隔樣式、既有開啟／命名與外部檔案拖入。
- API 核實其他偏好保留、帳號隔離、匿名拒絕、foreign deck／重複資料拒絕與 GET 讀回；使用獨立 Express 與記憶體模型。
- browser test 使用獨立隨機埠與 Edge context、mock API、合成 metadata；既有 CDN 正常讀取，無 pageerror，未放寬斷言。
- 可提交證據為上述 tests 內 fixture／斷言；截圖在整合後端 test-results，不提交，不保證永久留存。

## 服務與交付

- 核對 3100 程序 PID 50928 後重啟，新 PID 61536。
- 3100 的 index.html、home.js、home.css、library-layout.js、library-organizer.js HTTP 200，SHA-256 與受測檔案一致；新 API 匿名請求 401。
- 3000 main HTTP 200，沒有重啟或修改 main／本機 Docker。
- 真實 Mongo 持久保存、跨裝置登入與實機觸控未驗證；不能把 mock 通過當作實機資料庫驗收。
- 狀態：本次 V1 整合驗收通過，預覽 http://localhost:3100。
- 未 push、未合併 main、未發布 Release 或公開部署。
