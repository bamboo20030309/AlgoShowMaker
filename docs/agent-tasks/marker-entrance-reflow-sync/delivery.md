# marker-entrance-reflow-sync 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：intergration
- 共同基準 commit：0074069
- 程式修正 commit：5171903a72993dfc07f838d308235018cb362f32
- 驗證時的 HEAD 與未提交修改：5171903a72993dfc07f838d308235018cb362f32；交付文件尚未提交
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
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：
- 差異審查與必要重跑結果：
- 合併 commit：
- 完整 regression：
- 演算法投影片實際驗證：
- 未完成或環境阻塞：
- 本機服務重啟：
- Push／公開部署狀態：
