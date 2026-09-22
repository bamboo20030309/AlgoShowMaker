# marker-entrance-reflow-sync 交付驗證紀錄

## 交付資訊
- 狀態：整合驗收通過
- 分支：intergration
- 共同基準 commit：0074069
- 程式修正 commit：5171903a72993dfc07f838d308235018cb362f32
- 驗證時的 HEAD 與未提交修改：001a82f；核實後僅更新本交付紀錄
- 驗證日期：2026-09-23

## 根因與修改
- 已確認根因與證據：播放排程對 marker group reflow 預留 80ms lead，使既有 `now` 在新 `i` 入場前先移動。
- 修正方式與行為變化：移除 marker entrance 的提前讓位 lead，讓同格重排與由上方淡入在同一時間開始；後續事件仍等待兩者完成。
- 修改檔案及用途：`trace-frame-tween.js` 調整排程並更新前端 build ID；`unresolved-markers.test.js` 更新同步起點與總時間斷言。
- README／版本紀錄／使用說明更新：不適用；本次是既有動畫時間修正。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 入場前既有 marker 保持原位 | 檢查 object-entrance 與 frame-transition 起點 | 兩者皆為 0ms，不再有 80ms 提前重排 | 通過 |
| 入場與讓位同步開始 | Node 專項測試 | object-entrance 與 marker group reflow 同時開始 | 通過 |
| 完成後才開始 trace 事件 | Node 專項測試 | 同步動畫於 220ms 完成，後續事件依排程開始 | 通過 |

## 小驗證與重跑方式
### 指標同格入場排程專項
- 目的與對應條件：確認新指標入場與既有指標讓位同步。
- 執行目錄與必要環境設定：`algo-vis-backend`；使用既有 Node 環境。
- 測試資料／fixture：`tests/unresolved-markers.test.js` 內的 same-cell marker reflow 案例。
- 完整指令或操作步驟：`node --test --test-name-pattern="same-cell marker reflow starts" tests/unresolved-markers.test.js`
- 預期結果：專項案例通過。
- 實際結果與 exit code（適用時）：1/1 通過，exit code 0。
- 證據位置：終端測試摘要；未提交額外產物。

### JavaScript 語法與差異
- 目的與對應條件：排除語法錯誤與空白錯誤。
- 執行目錄與必要環境設定：`algo-vis-backend` 與 worktree 根目錄。
- 測試資料／fixture：不適用。
- 完整指令或操作步驟：`node --check public/trace-frame-tween.js`；`git diff --check`
- 預期結果：exit code 0。
- 實際結果與 exit code（適用時）：兩者 exit code 0。
- 證據位置：終端摘要；未提交額外產物。

## 剩餘事項與合併注意
- 未驗證項目及原因：未執行完整 regression，依驗證分級只跑直接相關專項。
- 已知問題或風險：完整 `heap-marker-assignment.integration.test.js` 重跑至第 9 案例後受到本機編譯 API 頻率限制；此前 8 案例通過，失敗皆為「請求過於頻繁」，並非斷言不符。
- 相依與衝突注意：無。
- 主代理需補驗證的情境：在整合預覽重播 bottom-up heapify 第 5 到第 6 幀，確認 `now` 與 `i` 同步開始移動。

## 主代理核實與整合（由主代理填寫）
- 狀態：整合驗收通過
- 核實的程式 commit 與 diff 範圍：5171903a72993dfc07f838d308235018cb362f32；播放排程、前端 build ID 與同格入場專項測試。
- 差異審查與必要重跑結果：JavaScript 語法、`git diff --check` 與同格 marker reflow 專項皆通過。
- 合併 commit：不適用；直接在 intergration 修正。
- 完整 regression：未執行；依 V2 分級採相關專項驗證。
- 演算法投影片實際驗證：在隔離的 3100 瀏覽器分頁載入使用者提供的 bottom-up heapify 程式與輸入，成功產生 34 幀並重播第 5 到第 6 幀；排程專項另確認入場與讓位起點同為 0ms。
- 未完成或環境阻塞：完整指標測試檔曾因本機編譯 API 頻率限制中止；直接相關專項獨立重跑通過。
- 本機服務重啟：3100 已啟動，`slides.html` 與 `trace-frame-tween.js` 皆回傳 HTTP 200，腳本 build 為 `trace-227`。
- Push／公開部署狀態：intergration 已推送至 origin；未公開部署。
