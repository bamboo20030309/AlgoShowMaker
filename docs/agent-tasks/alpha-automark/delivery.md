# alpha-automark 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實。
- 分支：codex/2026-09-18-alpha-events-arrows
- 共同基準 commit：6660b4f2c017a7092fd5a5881eba33cdc5bd51d8
- 程式修正 commit：92950b65fc63a2cc30e7cfbc65de888409c784f0
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-alpha-events-arrows
- 驗證時的HEAD與未提交修改：共同基準加已提交至上述commit的程式差異；驗證後只整理文件，沒有額外程式修改。
- 驗證日期：2026-09-18
- Push：程式commit已push origin/codex/2026-09-18-alpha-events-arrows，git ls-remote核對完整SHA相同。交付文件另行提交與推送。

## 根因與修改
- 設計依據：使用者採用先前自動固定對象白名單設計，命名改為@automark。
- 修正方式與行為變化：附屬最近@frame，接受單／逗號多陣列或none；defaults／preset／本地按順序覆寫，最後指令生效，不從前幀繼承。null表示未指定，[]表示none；只過濾累積fixedMark呈現，最後存取分析與事件metadata保留。runtime identity使同物件別名匹配，已有全域／幀關閉設定不被強制啟用。
- 手動mark：白名單過濾亦套用在當幀固定揭露延遲的目標，防止none或未選中陣列的手動mark被自動固定時機隱藏。
- 修改檔案及用途：trace-instrumenter（解析、scope、preset／defaults與捕捉依賴）；server（analyze、compile與runtime frame映射）；trace-model（新欄位正規化／舊trace相容）；trace-renderer（呈現與延遲目標過濾）；directive-assist（指令與frame／preset提示）；algorithm.html／slides.html／entrypoints（model32、renderer193、directive13）；兩個automark測試與fixture（證據）。
- README／版本紀錄／使用說明：README、使用手冊、tests README及task已更新。無Release或公開部署。
- 與task.md差異：無；不增加範圍、when或@for內的automark，現有自動固定不支援的matrix／scalar明確拒絕。

## 驗收條件對照
| task.md條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 單／多陣列、none與覆寫 | parser案例與實際SVG | defaults a、preset b、本地a,b／none、下一幀恢復defaults；未指定時維持null | 通過 |
| 分析與事件保留／別名 | VM共享highlights及實際compile | 選alias同時匹配a；不選b時不加fixedMark，fixed事件JSON不變；compile仍有兩陣列共6個完成target | 通過 |
| 切幀／重載／Studio与手動mark | 隔離EdgeRUN與可見SVG路徑 | 單陣列只a#0、多陣列兩者0/1、none無綠mark且手動b#0藍mark在切換剛開始即可見；下一幀恢復兩者0/1/2，回看／Studio／重載一致 | 通過 |
| 錯誤與相容 | parser與model案例 | 空／重複／索引／不可見／scalar／額外when報錯；舊trace缺欄位變null，JSON重載保留null與[]差別 | 通過 |

## 小驗證與重跑方式
### automark專項與直接相關小驗證
- 目的：核對來源語法、欄位映射及當幀固定呈現，保留已修復的固定切幀行為。
- 執行目錄：本worktree的algo-vis-backend。
- 環境：獨立隨機埠56181，PORT=56181、ASM_REGRESSION=1、隨機JWT secret（不輸出），ASM_TEST_BASE_URL=http://127.0.0.1:56181；MONGO_URI指向127.0.0.1:1獨立測試URI，案例不依賴Mongo。重跑請重新選未占用埠，不回落主要服務。
- fixture：tests/fixtures/automark.cpp；舊問題fixtures/auto-fixed-playback.cpp。
- 完整指令：node --test --test-concurrency=1 tests/automark.test.js tests/automark.browser.test.js tests/auto-fixed-playback.browser.test.js tests/directive-assist.test.js tests/entrypoints.test.js。
- 操作：在独立headless Edge設定Ace fixture後RUN，取得五幀的靜態狀態並逐幀前進／後退比較；JSON重載到none幀並開Studio；關閉全域自動固定確認選擇不強制啟用。檢查實際SVG mark與祖先display／opacity；沒有操作使用者分頁或投影片。
- 預期：白名單只改可見自動固定，none不影響手動mark，重載與Studio一致，原自動固定切幀修正保持。
- 實際結果：11 tests／11 pass／0 fail／0 skip，23.58秒，exit0；無pageerror。隔離服務與瀏覽器已停止。
- 靜態指令：node --check trace-instrumenter.js／server.js／public/trace-model.js／public/trace-renderer.js／public/trace-directive-assist.js／tests/automark.test.js／tests/automark.browser.test.js／tests/entrypoints.test.js（每檔獨立執行），共8檔通過；git diff --check通過。
- 證據：提交的測試／fixture；本機test-results/alpha-automark-validation.cjs／tap／server.log未提交，可能被清理或覆蓋。

## 驗證分級與選擇
- 層級：V2 E/H/J；A僅指令提示與入口cache。
- 選擇依據：新語法及per-frame model欄位，僅過濾固定呈現，不更改runtime事件分析或動畫排程。
- 未執行：完整regression、全部tests、廣泛排序與大規模動畫；依使用者分級不啟動。
- 主代理需補：整合後核對使用者線篩preset的@automark isprime及演算法投影片保存／載入，按整合差異決定驗證範圍。

## 剩餘事項與合併注意
- 未驗證：演算法投影片嵌入與asmdeck匯出／匯入、公開Docker、遠端資料庫。
- 已知限制：只接受目前固定分析支援的一維陣列與序列容器；none為保留字。不新增型別的最後存取分析。
- 相依與衝突：共享server／model／renderer與入口cache；主代理需帶入alpha此前陣列文字、箭頭及固定切幀修正。main尚未整合，後端須整合並重啟才可使用新來源語法。
- 未merge或重啟主要開發服務，依既定分工由主代理完成。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式commit與diff範圍：
- 差異審查與必要重跑結果：
- 合併commit：
- 完整regression：本次未執行，按整合差異決定。
- 演算法投影片實際驗證：
- 未完成或環境阻塞：
- 本機服務重啟：
- Push／公開部署狀態：
