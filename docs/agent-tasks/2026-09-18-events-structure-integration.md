# 每幀事件、批次箭頭與結構註標整合驗證

- 日期：2026-09-18；目標 intergration；整合前 97d36136eb9929bed98aa5d71589a7528b4208a6。
- Alpha 分支 codex/2026-09-18-alpha-events-arrows：f6fe2a1；Gamma：6d42352。Beta 及既有 Alpha 分支無新增待整合提交。
- 兩次合併後程式 commit：2763b0922b72ca3e05024b82cc3d5c72fc38df94。
- 新增投影片 iframe 驗證 commit／完整受測版本：5a358dfa30c96879fa510d8a00cd1c8085feb287。
- main 保持 ddfe5b6081261a05b437a61a546861151d4618e5；不合併 main、不發布 release 或部署。

## 審查與整合

- Alpha 的 @events 依目前幀條件控制事件呈現，保留計算與事件 metadata；來源規則優先於 Studio 保存開關。
- @arrow for 展開繪圖局部索引，保留每支子 ID、範圍、步長與條件；2048 候選上限及非法範圍報錯，不靜默截斷。
- parser/server/model 欄位映射一致；疏幀 scalar 生命週期從既有事件補 iteration.last，保留已捕捉 snapshot 行為。Studio 與助手同步新指令。
- Gamma 的一般 structure 新增 annotationIndices，沿用 draw_block 與既有持久化；明確保存的舊顏色保留。
- slides.html 與 entrypoints.test.js 衝突仅為 slides.js 快取名稱，統一 parallel-merge-189；保留 model trace-28、結構新欄位、既有拖入與文字 undo。
- Alpha 歸 V2/E/F/J，Gamma 歸 V1/B/C；本輪不需要全套排序或完整 regression。

## 執行與結果

在 intergration/algo-vis-backend 使用隔離 runner：test-results/integration-events-validation.cjs。
Runner 為既有 Alpha 隔離腳本加上結構註標、code 關注行及文字 undo 專項；使用隨機埠 58370、ASM_REGRESSION=1、隨機 JWT secret 與不可連線的獨立 Mongo URI，finally 停止測試服務。腳本與 TAP/log 不提交。

```powershell
node --test --test-concurrency=1 tests/events-batch-arrows.test.js tests/events-batch-arrows.browser.test.js tests/arrow-directives.test.js tests/event-defaults.test.js tests/preset-directives.test.js tests/iteration-summary.integration.test.js tests/entrypoints.test.js tests/directive-assist.test.js tests/structure-annotations.browser.test.js tests/code-focus-entry.browser.test.js tests/slides-text-undo.browser.test.js
```

- 設定 ASM_TEST_BASE_URL 為獨立服務；52 pass、0 fail、0 skip，exit 0，約 51 秒。
- 14 個相关 JS 的 node --check 與 git diff --check 通過。Runner 提示文字仍寫 11，實際檢查陣列已加上 slides.js、slide-structures.js 與 structure-annotations.browser.test.js 三檔。
- parser、條件與 preset 次序、批次展開、空／反向／非法／超量範圍、穩定 ID、iteration.last 與舊箭頭契約通過；編譯 helper 檢查事件 order 數字與排序。
- 真實 Ace/RUN 最小線篩：詳細幀仍有事件計畫；i=8 一支、i=9 兩支箭頭指向 18/27，SVG 合數值為 0；濃縮幀事件 steps=0，回看與 JSON 重載結果一致。
- 主代理新增實際 slides.html 的 algorithm-animation slide fixture；runtime iframe 收到同份 trace，i=9 的子箭頭 ID／來源／目標與獨立演算法頁相同，事件 steps=0。
- 結構註標編輯、範圍與無效索引、清空、保存重開、舊自訂色、SVG 邊界與 canvas 繪製通過；matrix/tree/heap 只驗證單一索引 SVG 定位。既有 code 關注行／配對轉場及文字 undo 專項通過。
- 測試使用獨立無頭 Edge/context 與合成 deck，不操作使用者分頁或私人投影片；既有 CDN 可用，無放寬斷言。
- 未驗證完整 autoplay、所有演算法／所有幀、Trace Studio 全套互動、真實 Mongo、私人 deck、實機觸控、註標專項 undo/redo 與大量多行註標。此結果只代表上述定點與契約範圍。
- 小測試索引更新為 75 檔，三個新檔分類 E（事件／批次箭頭）與 B（結構註標），逐檔比對無缺漏。

## 服務與推送

- 3100 原程序 PID 29956 核實後重啟，新 PID 41728。
- slides.html、slides.js、slide-structures.js、algorithm.html 及六個修改的 trace 模組 HTTP 200，SHA-256 與受測版本一致。
- main 3000 HTTP 200、commit 未變；Docker 仍服務 main，本輪未重啟或重建。
- 預覽：http://localhost:3100。依持續授權推送本輪程式與紀錄至 https://github.com/bamboo20030309/AlgoShowMaker.git 的 origin/intergration；推送結果以最終遠端 SHA 核對與回報為準。
