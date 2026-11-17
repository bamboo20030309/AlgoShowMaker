# 廢碼交接後續交付

## 文件與清理

原交接不在 intergration 工作目錄，從本機分支歷史找到；核對 `main..claude/project-overview-3e7a15` 只有兩個 docs 提交，cherry-pick 為 640e501、77a4394，未合併該分支。

清理分支原已交付 91c344c／6b800d3。審查刪除、確認保留舊 AV 流程與有效 targetVariable，重跑原分支的隔離介面冒煙。自動審批首次拒絕整合，使用者明確批准後才合併為 029cdd7。刪除函式的名稱在追蹤程式、腳本及 tests 中無殘留引用；不把第三方 vendor 的同名函式視為專案引用。

## B：可重現 bug 與修正

1. 同一幀主物件 a、副物件 b；b 由 right_before 改名 right_after，runtime identity 沒變。實際 SVG 具有 right_before，但 transitions 原本回傳空來源。將身分解析集中到 `ASMTraceModel.objectKeyForVariable`，renderer／Studio／tween／transitions 使用共同規則：先查 objectIds 映射，再查舊 primary objectId，再用變數 ID。獨立載入、未帶完整 model 的相容入口保留同樣的 fallback。
2. drawArray 範圍 [5:10]、每列 3 格；resolvePos 收到的是絕對索引 5，原本卻當局部索引 5，定位 (208,180)，實際首格 (128,128)。修正成 index−startIdx，十進位讀取起點；保留越界既有政策，未改其他 renderer。

## 驗證與限制

- `tests/audit-object-alias-range.browser.test.js` 通過：使用實際分析／編譯產生的雙物件別名，核對物件與格子來源配對、實際播放後的新值；舊 primary-objectId 缺少 objectIds 時仍可解析。
- 索引定位以實際 SVG 格子中心為獨立答案，測起點 0／5、同列／換列、非零間距及拖曳偏移；不拿定位函式自己產生預期答案。
- `tests/execution-state.test.js` 七項通過。
- 合併後獨立服務／隔離 Edge 的首頁、Studio 開關／刷新／點選與線段樹投影片 Fabric 點選通過，無 pageerror。連同上面共 9 項通過。
- 所有本輪修改 JS 語法及差異檢查通過。未執行完整 V3、逐幀演算法驗證或手機版驗收；A 不啟動動畫驗證，B 只測相關範圍。
- Trace 產生依賴未變，不重跑全部公開 Trace。前端 cache URL 已更新，避免清理後仍使用舊腳本。

## C 與後續決策

唯讀核對索引 280、現行 36（114.34 MiB）、歷史 244（722.66 MiB），其中 legacy 122、未標記 122。查明不可變檔名不觸發舊同名搬移，補正資產文件；沒有以未引用或未標 legacy 為理由刪檔。

使用者選擇評估全部 Trace 移出 Git，已交付 `docs/development/trace-storage-migration-plan.md`：建議專用持久化目錄、完整校驗資產包、保留 ID／網址、backend 與 Nginx 同步掛載、先備份還原再取消追蹤，另說明 Git 歷史不會因此自動縮小。尚未執行搬移、上傳、刪除或歷史改寫；D／E／F 未收到批准，本輪暫緩。

## 整合

本輪推送 origin/intergration、重啟並核對 3100；main／3000、公開部署與 Release 保持原狀。交付中的自動審批阻擋已由使用者明確批准解除，沒有繞過。
