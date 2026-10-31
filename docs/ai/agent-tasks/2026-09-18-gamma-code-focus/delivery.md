# gamma-code-focus 交付驗證紀錄

## 交付資訊
- 主代理核實：已合併 intergration，受測程式 68b3cc847c7104c1f33cfeba56e8ee477e2be289；詳見 [整合驗證紀錄](../2026-09-18-library-category-focus-integration.md)。
- 狀態：小驗證通過，待主代理核實
- 分支：codex/2026-09-18-gamma
- 共同基準 commit：6168bd8b989632643c06c673a75d3f177f3634ac
- 程式修正 commit：b34bc9a54ca9275f33f7079ff64f49147152c392
- 驗證版本：此 commit 的程式內容，提交前執行；後續只有文件更新。
- 驗證日期：2026-09-18

## 根因與修改
- highlightCodeWidget 與配對動畫會呼叫舊有對齊函式，但一般 slidechanged 沒有對齊。隱藏 code 的初始化量測無法代替顯示後的對齊，手動改動過的捲動位置也未重設。
- 修正前案例：切到設定 55-58 關注行的 c2，scrollTop 仍為 0，斷言失敗。
- 新增 scheduleCurrentSlideCodeFocus，在兩次 requestAnimationFrame 後處理目前投影片；舊排程可取消，避免快速切頁操作舊頁面。
- 沿用 scrollCodeWidgetToFocus／codeFocusScrollTop，關注範圍中心置中並限制捲動邊界，沒有重新建立計算邏輯。
- 只有有效關注行、已顯示的 code 物件對齊；沒有關注設定保留原捲動位置。跳過 codeAutoAnimating 物件與總覽，讓配對動畫沿用既有起點與終點。
- ready、slidechanged、slidetransitionend、overviewhidden 接入排程。
- slides.js：排程；slides.html 與 entrypoints.test.js：快取版號；code-focus-entry.browser.test.js：最小瀏覽器案例。
- README／版本紀錄：不適用，既有關注行對齊的修正；操作與資料格式不變。
- 與 task.md 的差異：無。

## 驗收條件對照
| 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 第一次／再次切頁對齊 | 真實 Reveal.slide，量測關注列中心與 pre 中心 | 55-58 行中心偏差 <2 邏輯 px，scrollTop >0 | 通過 |
| 初始與快速切頁對齊 | 初始 10-12；連續切換 1→3→1 | 目前頁關注列中心偏差 <2 邏輯 px | 通過 |
| 配對動畫保留起終點 | code transitionId=pair，autoanimate 事件定點與動畫結束後 | 起點來源／目的捲動差 <1 px，目的取得動畫標記；結束後 30-33 行置中 | 通過 |
| 無關注保留手動捲動 | c4 手動 scrollTop=250，離開再返回 | 仍為 250 | 通過 |
| 編輯／觀賞模式切頁 | 普通切頁在編輯模式、配對及後續切頁在觀賞模式 | 皆對齊且無 pageerror | 通過 |

## 驗證分級與選擇
- V2/C，最小 code 物件切頁／配對自動動畫案例，僅核對進入事件與結束後定點。
- 不修改 trace、runtime、動畫路徑或原對齊公式；不執行完整 regression、動畫 suite 或演算法 RUN。

## 小驗證與重跑方式
- 目錄：此 worktree 的 algo-vis-backend。
- 完整指令：node --test tests/code-focus-entry.browser.test.js tests/entrypoints.test.js
- 結果：2/2 通過、0 skip、exit 0。
- 補配對動畫起點斷言後：node --test tests/code-focus-entry.browser.test.js，1/1 通過，exit 0。
- node --check public/slides.js 與 git diff --check：exit 0。
- Fixture：80 行合成 code、四份投影片、兩個有相同 transitionId 的 code 物件；10-12、55-58、30-33 關注範圍及無關注物件。
- 隔離：隨機埠服務、獨立無頭 Edge 與本地 draft；不讀寫使用者帳號或私人投影片。
- 必要環境：dependencies、Edge、既有 Reveal CDN 依賴可連線。
- 證據：可提交專屬瀏覽器測試及本文件摘要；無提交 test-results 或 log。

## 剩餘事項與合併注意
- 未驗證：實機手機、真實既有 deck、所有行數邊界／多個離散範圍組合；範圍解析與邊界沿用舊函式。
- 已知風險：Reveal 與共用 slides.js 由多分支修改，主代理需確認掛載事件與快取版號。
- 主代理需補：整合後真實 code 投影片切換、總覽選頁、配對自動動畫与完整回歸。

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
