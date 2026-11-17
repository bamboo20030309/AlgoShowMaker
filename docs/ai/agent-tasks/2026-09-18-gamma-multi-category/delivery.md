# gamma-multi-category 交付驗證紀錄

## 交付資訊
- 主代理核實：已合併 intergration，受測程式 68b3cc847c7104c1f33cfeba56e8ee477e2be289；詳見 [整合驗證紀錄](../2026-09-18-library-category-focus-integration.md)。
- 狀態：小驗證通過，待主代理核實
- 分支：codex/2026-09-18-gamma
- 共同基準 commit：53c53776ebeb627cfaf72353fcbc1a45043dc6fc
- 程式修正 commit：32b0c97a3ea1f72ec5cc4eddb5925264b6cb10c5
- 驗證版本：此程式 commit 的內容，提交前執行；後續僅文件更新。
- 驗證日期：2026-09-18

## 根因與修改
- 使用者確認個人投影片與範例兩者均需多分類。
- 原 Layout 使用全域 deckIds 去重，現在允許不同分類引用同一 deck_uid，同分類內仍不能重複；未分類不能同時包含已分類檔案。
- 新增 assign 多分類；move 搭配來源分類只移動該分類引用，分類內排序不影響其他分類；拖至未分類清除全部分類。
- removeFolder 保留其他分類，沒有其他分類的檔案才回到未分類；不新增檔案複本、不改內容與所有權。
- 個人卡片新增分類複選 dialog，沿用 deck-dialog；顯示分類數，支援取消、儲存與失敗保留視窗重試。
- 範例支援 categories 陣列與舊 category 字串，去除重複分類，在對應區塊顯示同一案例，總份數不重複；thumbnail 快取仍共用。
- 線篩目錄改用 categories:[Math]，維持原分類，不任意增加分類。
- 修改檔案：library-layout／organizer、guest-gallery／guest-decks、index.html／home.css、入口版號與相關測試。
- README 補多分類及拖曳／移除語意。
- 與 task.md 差異：無。

## 驗收條件對照
| 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 個人複選與重開 | Beta 選兩分類、重開 dialog 與頁面 | 兩區各出現一張卡片，勾選保留 | 通過（mock API） |
| 獨立排序與跨分類拖曳 | 第一分類排序、拖到第三分類 | 只改來源／目的，第二分類保留原順序 | 通過 |
| 移除分類保留其他分類 | 移除第三分類、清空 Beta 分類 | Beta 留在第二分類；清空後回未分類 | 通過 |
| 儲存失敗保留視窗 | mock PUT 500 | 原排序恢復、dialog 可取消或重試 | 通過 |
| 範例多分類与相容 | mock Tree/Graph 同案例及 Basic 舊category | 各區各1案例、總數2份，重複 Tree 未重複卡片 | 通過 |
| API 多分類與所有權 | 實際 Express 配記憶體模型 | 可保存／讀回多分類；同分類重複／其他帳號拒絕，其他偏好保留 | 通過（記憶體模型） |

## 驗證分級與選擇
- V1/B 分類資料與工作區互動，A 入口與樣式。
- 不修改演算法、trace 或動畫；只用合成範例 metadata 檢查分類，不跑 RUN 或大型 regression。

## 小驗證與重跑方式
- 目錄：此 worktree 的 algo-vis-backend。
- 指令：node --test tests/library-folders.browser.test.js tests/slide-library.test.js tests/entrypoints.test.js
- 結果：4/4 通過、0 skip、exit 0。
- 補 dialog 勾選／手機截圖與本地格式錯誤處理後：node --test tests/library-folders.browser.test.js，1/1 通過、exit 0。
- node --check public/library-layout.js、public/library-organizer.js、public/guest-gallery.js 與 git diff --check：exit 0。
- 隔離：隨機埠／獨立 Edge、合成帳號與卡片、mock API；API 小測使用獨立 Express 記憶體模型，不寫使用者 MongoDB。
- 必要環境：npm dependencies 與 Edge。
- 證據：可提交的測試；本機 test-results/multi-category-dialog-mobile.png 已檢視，不提交且不保證永久保存。

## 剩餘事項與合併注意
- 未驗證：真實資料庫跨裝置保存、實機手機；本次 API 路由未改，使用新 validator。
- 已知限制：單層分類，最多200個資料夾、10000個分類引用；多分頁儲存採最後寫入。
- 不可只部署前端：伺服器亦須取得新版 library-layout.js，否則舊 validator 會拒絕多分類。
- 舊單分類設定與 category 目錄相容；catalog categories 陣列為後續範例維護方式。
- 主代理需補：整合完整回歸、真實帳號分類跨裝置、同檔在多分類下編輯／刪除及實機操作。

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
