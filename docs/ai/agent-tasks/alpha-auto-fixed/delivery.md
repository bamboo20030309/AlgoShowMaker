# alpha-auto-fixed 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實。
- 分支：codex/2026-09-18-alpha-events-arrows
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-alpha-events-arrows
- 共同基準 commit：2eaf50c13424834622727d03d75b256e96edc499
- 程式修正 commit：14f2a83ebbaa8579b80bdf63048eda4ce916f947
- 驗證時的HEAD與未提交修改：共同基準加本次已提交的程式差異；驗證後只整理task與交付文件，沒有額外程式修改。
- 驗證日期：2026-09-18
- Push：程式commit已push origin/codex/2026-09-18-alpha-events-arrows，git ls-remote核對完整SHA相同。本交付文件另行提交與推送。

## 根因與修改
- 已確認根因與證據：初次renderScene把Rules.evaluate與累積fixed事件合併，但切幀tween的prepareForwardValues只取得Rules.evaluate，updatePresentedHints會隱藏原有綠色mark。實際Edge重現靜態各幀標記為[]／[0]／[0,1]／[0,1,2]，動畫前進三次全為[]，開Studio後恢復[0,1,2]，回看與重載跳幀也消失。
- 修正方式與行為：renderer及tween共用evaluateFrameHighlights，保留累積fixedMark；更新style時重用靜態固定mark節點，保留既有當幀完成後揭露的opacity控制。使用目的幀累積狀態，返回較早幀不殘留未完成標記。
- 修改檔案及用途：trace-renderer.js（合併highlights與保留固定節點）；trace-frame-tween.js（取得完整樣式結果）；algorithm.html（renderer192／tween212快取）；auto-fixed-playback.browser.test.js與fixture（实际SVG回歸）；README／使用手冊／tests README與task（行為及重跑方式）。
- README／版本紀錄／使用說明：已更新本機行為說明，無Release或公開部署。
- 與task.md的差異：無；指定陣列指令僅提出設計，尚未實作，不宣稱可用。

## 驗收條件對照
| task.md條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 前進／後退／重載與靜態相同 | 實際SVG可見綠色mark節點與祖先display／opacity | 前進[0]／[0,1]／[0,1,2]；後退[0,1]／[0]／[]；重載跳幀[0,1,2] | 通過 |
| Studio一致與新標記揭露 | 開Studio前後比較；同步讀取轉場剛開始的可見狀態 | Studio前後均[0,1,2]；每次進場仍為[]／[0]／[0,1]，新mark在完成後出現 | 通過 |
| 關閉固定與手動樣式保留 | 複製trace關閉autoFixedEnabled並新增手動藍色mark；既有style-layer與event-defaults | 綠色mark為[]，手動藍色mark仍位於格0；既有focus／高亮位置及事件預設檢查通過 | 通過 |

## 小驗證與重跑方式
### 自動固定切幀專項
- 目的：核對切幀動畫與靜態繪圖／Studio的一致性，保留固定標記的時機和開關。
- 執行目錄：本worktree的algo-vis-backend。
- 必要環境：隔離服務PORT=57177、ASM_REGRESSION=1、隨機JWT secret（不輸出）；測試ASM_TEST_BASE_URL=http://127.0.0.1:57177。MONGO_URI指向127.0.0.1:1獨立測試URI，本案例不依賴MongoDB。重跑需重新選未占用埠，不能回落localhost:3000。
- fixture：tests/fixtures/auto-fixed-playback.cpp（3格陣列，每幀最後存取一格，附帶value條件focus）。
- 完整指令：node --test --test-concurrency=1 tests/auto-fixed-playback.browser.test.js tests/event-defaults.test.js tests/style-layer.test.js tests/entrypoints.test.js。
- 瀏覽器操作：獨立headless Edge，Ace放fixture後RUN；建立各幀靜態預期，再依序動畫前進／Studio開關／後退；JSON重載跳到末幀；最後關閉自動固定並檢查手動mark。透過同一/trace/analyze與/compile路徑建立trace，不修改使用者來源或deck。
- 預期結果：固定SVG狀態與靜態預期一致，Studio不恢復缺失標記；當幀新增的mark等完成後出現，關閉自動固定不關掉手動mark。
- 實際結果：10 tests／10 pass／0 fail／0 skip，11.72秒，exit0；無pageerror。服務與瀏覽器已停止。
- 靜態指令：node --check public/trace-renderer.js；node --check public/trace-frame-tween.js；node --check tests/auto-fixed-playback.browser.test.js；git diff --check。全部exit0。
- 證據：可提交測試與fixture；本機test-results/alpha-auto-fixed-reproduction.cjs／tap／server.log及alpha-auto-fixed-validation.cjs／tap／server.log未提交，可能被清理。reproduction tap保留修正前1 fail的原始差異，validation tap為修正後10 pass。

## 驗證分級與選擇
- 層級：V2 H/J，A只做入口快取；event-defaults涵蓋固定開關／runtime identity既有行為。
- 選擇依據：只改style刷新所用highlights與固定節點，不改最後存取分析、runtime資料或事件時間線。
- 未執行：完整regression、全部小測試、大規模演算法動畫或廣泛排序，依使用者分級規則不執行。
- 主代理需核實：將修正整合後在使用者線篩的定點切幀與投影片嵌入核對固定標記；視整合差異決定是否增加單次自動播放，不機械式啟動全套。

## 指定陣列指令設計提案（未實作）
- 建議：`// @autofix isprime` 表示本幀允許顯示自動固定標記的陣列白名單；`// @autofix isprime,prime` 可指定多個，`// @autofix none` 隱藏本幀的自動固定標記。
- 附屬最近@frame，preset/defaults可重用；沒有指令時沿用全域autoFixedEnabled與現有行為。指令只選對象，不強制啟用已被全域／幀開關關閉的固定狀態。
- 只過濾呈現，不刪分析資料；固定時機仍按最後一次存取，别名以runtime identity匹配。手動@style mark維持獨立，@events繼續處理事件控制。
- 使用者本次只問設計，不先加入未確認的指令介面。

## 剩餘事項與合併注意
- 未驗證：投影片嵌入、公開Docker與遠端資料庫，沒有操作使用者分頁。
- 已知問題或風險：本fixture直接重現使用者現象；未拿到最新使用者deck，不能宣稱其所有幀已通過。
- 相依與衝突：沿用alpha現有分支，共用renderer／tween與cache版本；主代理整合時核對此前文字與箭頭修正。
- 本機服務：未重啟主要開發服務，依分工由主代理整合後重啟。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式commit與diff範圍：
- 差異審查與必要重跑結果：
- 合併commit：
- 完整regression：未執行，按整合範圍決定。
- 演算法投影片實際驗證：
- 未完成或環境阻塞：
- 本機服務重啟：
- Push／公開部署狀態：

## 最新主代理核實（2026-09-18）
- 已核實合併intergration；受測版本58c15f71c5408400489b1a0c7186599825741fa4。
- 49個不同相關案例通過，含真正投影片iframe；初期fixture失敗與重跑詳見[核實紀錄](../2026-09-18-automark-text-integration.md)。
- 3100已重啟PID15136，其他四個埠均HTTP200；main未合併。
- 依授權push origin/intergration，結果以最終回報為準；未release或部署。
