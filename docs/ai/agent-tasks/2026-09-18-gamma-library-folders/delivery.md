# gamma-library-folders 交付驗證紀錄

## 交付資訊

主代理更新：已合併 intergration，本次 V1 核實通過並重啟 3100。最新合併、驗證與限制見 [資料夾整合紀錄](../2026-09-18-library-folders-integration.md)。下方保留原交付時狀態；尚未合併 main。
- 狀態：小驗證通過，待主代理核實
- 分支：codex/2026-09-18-gamma
- 共同基準 commit：81d6b423a9ff5a4709d24613b522804d6d050f3e
- 程式修正 commit：7a94173351cd70a1d4b9012e2464d64dacb76744
- 驗證時版本：此程式 commit 的內容，提交前執行；提交後僅補交付文件，無程式修改。
- 驗證日期：2026-09-18

## 根因與修改
- 設計依據：使用者確認整份投影片檔案分類與拖曳整理，並補充範例與我的投影片使用橫線分隔、不使用資料夾完整外框。
- 新增單層資料夾、展開／收合、分類滾動導覽、新增／命名／移除資料夾、縮圖拖曳排序與移入資料夾。
- 拖曳到另一縮圖前方排序，拖到資料夾標題或空白區放到最後；選單與前後按鈕供鍵盤／窄螢幕替代操作；拖曳把手支援 pointer events。
- 移除資料夾把其投影片放回未分類，不刪任何投影片；新投影片自動加入未分類，刪除的檔案不留在整理資料。
- GET/PUT /api/slide-library 沿用 JWT 驗證，僅查當前帳號所有的 deck_uid；儲存到 preferences.slideLibrary，不覆蓋其他設定或修改投影片資料格式。
- 資料格式驗證限制資料夾數量／名稱、重複識別碼与投影片數量；拒絕未知與其他帳號的投影片。
- 儲存中阻止新的整理操作；失敗恢復原排序並顯示錯誤。讀取設定失敗時顯示檔案但禁止整理，避免覆蓋原設定。
- 修改檔案：home.js 抽出既有卡片建立函式接入 library-organizer；library-layout 共用格式與移動邏輯；slide-library API；server.js 僅掛載模組；index.html 與 home.css 更新兩處資料夾樣式與版本；相關測試。
- README 已補使用方式；不發布版本或部署。
- 與 task.md 的差異：無，樣式變更已記入 task.md。

## 驗收條件對照
| 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 建立／重新命名／移除資料夾 | 瀏覽器操作 | 成功且移除後檔案回未分類 | 通過 |
| 拖曳排序與移入資料夾 | 真實滑鼠 pointer 拖把手；DataTransfer 拖至收合標題／另一縮圖 | c,a,b 排序、跨資料夾 b,a 排序 | 通過 |
| 重開保留順序 | 重載頁面並改 metadata 回傳順序 | 自訂順序保留，新檔附加未分類 | 通過（mock API） |
| 分類滾動與搜尋 | 分類按鈕、搜尋 Alpha | 展開對應區塊，找到資料夾內卡片 | 通過 |
| 手機替代操作與版面 | 390px viewport，選單與前後按鈕 | 能移動、排序，頁面沒有水平溢出 | 通過 |
| 儲存錯誤恢復 | mock PUT 500 | 顯示失敗並恢復原排序 | 通過 |
| 帳號隔離與設定保存 | 實際 Express API 搭配記憶體模型 | 匿名 401，其他帳號檔案／重複資料 400；其他偏好保留；GET 可讀回 | 通過（記憶體模型） |
| 既有開啟／命名／拖入 | 導向 URL、命名表單、既有 file-drop 測試 | 入口与編輯後卡片正常、建立匯入檔案正常 | 通過 |
| 兩頁橫線分隔 | 工作區與 mock 空範例目錄的 computed style、截圖檢查 | 上邊線 1px，其餘 0、圓角 0，沒有資料夾外框 | 通過 |

## 驗證分級與選擇
- V1/B：工作區整理、儲存與失敗恢復；A：CSS 與入口檢查。
- 不影響 trace、動畫、runtime 或演算法；依使用者要求不跑大規模驗證。範例頁只檢查空目錄的區塊樣式，不執行演算法範例或 RUN。

## 小驗證與重跑方式
- 目錄：此 worktree 的 algo-vis-backend。
- 完整指令：node --test tests/slide-library.test.js tests/library-folders.browser.test.js tests/deck-file-drop.browser.test.js tests/entrypoints.test.js
- 實際結果：5/5 通過，0 skip，exit 0。
- 最後補開啟導向斷言後：node --test tests/library-folders.browser.test.js，1/1 通過，exit 0。
- 初次搜尋斷言包含隱藏訪客卡片而失敗；將斷言限定 #deckGrid 後重跑通過，未降低期望條件。
- 語法：node --check server.js、slide-library.js、public/home.js、public/library-layout.js、public/library-organizer.js 均 exit 0。
- git diff --check：exit 0。
- 隔離與 fixture：測試自建隨機埠服務與獨立 Edge context、合成三份投影片 metadata、mock API；API 測試独立 Express 與記憶體 User/SlideDeck 模型，無真實帳號或 MongoDB 寫入。
- 必要環境：npm dependencies、Edge；既有 CDN 依賴可連線。
- 證據：可提交的專屬測試；本機 algo-vis-backend/test-results/library-folders-mobile.png 與 sample-folder-dividers-mobile.png 已檢視，不提交且不保證永久保存。

## 剩餘事項與合併注意
- 未驗證：真實遠端 MongoDB 儲存、跨裝置登入、實機觸控拖曳；瀏覽器已測滑鼠拖曳及窄螢幕替代操作。
- 已知限制：單層資料夾，最多 200 個資料夾／10000 份整理項目；多分頁同時儲存採最後寫入的版本。
- 相依與衝突：server.js 為共用掛載點；home.js/index.html/home.css 與入口版本請主代理整合核對。舊 file-drop 測試新增 mock 整理 API 配合工作區載入。
- 主代理需補：真實帳號重新登入及跨裝置保存、完整回歸、整合後相關投影片實際操作。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：待填
- 差異審查與必要重跑結果：待填
- 合併 commit：待填
- 完整 regression：未執行，由主代理負責
- 演算法投影片實際驗證：未執行，由主代理負責
- 未完成或環境阻塞：無開發阻塞
- 本機服務重啟：未執行，由主代理負責
- Push／公開部署狀態：gamma 分支依使用者授權 push；公開部署未執行
