# 共用繪圖迴圈與註標選色整合核實

- 日期：2026-09-18；分支 intergration；前次 checkpoint 4ab5bc317c6e688eac620f12c03aadbbe219bbb9。
- Alpha 交付 4d8551b：冒號區間、具名實際迴圈值及共用 @for/@endfor style/arrow/text 區塊；Gamma 交付 800a357：annotationColor。Beta 無新增提交。
- Alpha 合併 5766e71；Gamma 合併／整合程式 bf26de154a67008e2b160d91f4e6a7faec9cd15a。
- 加入新版 iframe 驗證的完整受測版本：6aff1646283fe82d9d1e8342029d6f5838db6c9d。
- main 維持 ddfe5b6081261a05b437a61a546861151d4618e5；不合併 main、不發布 release 或部署。

## 差異與衝突核實

- C++ LoopScope 記錄實際本體入口、回合與 activation，支援 break/continue、空迴圈與重複值；記錄不是可播放事件，不重跑演算法。
- [start:end] 取代舊 ..；@loop 命名與候選消歧義採明確錯誤，不靠距離猜測。
- 共用繪圖區塊在 model 展開 drawLocals、drawSourceId 與穩定子 ID，Rules／renderer 沿用既有安全運算式與 style/arrow/text 元件。巢狀與候選上限 2048，非法內容報錯。
- Studio 依來源描述維持展開文字 binding 與格式控制；保留既有箭頭、preset 與稀疏幀契約。
- Gamma 沿用 iro 與 structureColorBindings 編輯註標箭頭／標籤邊框色，normalize／保存／重繪接入 annotationColor。
- Alpha delivery 衝突保留新交付，連結前輪核實紀錄；入口衝突統一 parallel-merge-190，保留最新 model/rules/arrow/renderer/studio 助手版本及 Gamma 設定欄位。
- 主代理把既有 iframe fixture 更新為 drawing-loop-sieve，使用匹配的 code/trace，核實箭頭 ID／目標、局部文字／binding、背景色與濃縮幀事件 steps。
- 分級：Alpha V2/E/F/J，Gamma V1/B/C；不啟動廣泛演算法集。

## 驗證與結果

目錄：intergration/algo-vis-backend。兩個本機 runner 使用獨立埠 62213、64249，ASM_REGRESSION=1、隨機 JWT secret 與隔離不可連線 Mongo URI，結束停止測試服務。

```powershell
node --test --test-concurrency=1 tests/events-batch-arrows.test.js tests/events-batch-arrows.browser.test.js tests/arrow-directives.test.js tests/event-defaults.test.js tests/preset-directives.test.js tests/iteration-summary.integration.test.js tests/entrypoints.test.js tests/directive-assist.test.js tests/style-layer.test.js tests/text-object-bindings.test.js tests/structure-annotations.browser.test.js tests/code-focus-entry.browser.test.js tests/slides-text-undo.browser.test.js
node --test --test-concurrency=1 tests/drawing-loops.test.js
```

- ASM_TEST_BASE_URL 各自指向隔離服務；第一批 68 pass、第二批 4 pass，合計 72 pass／0 fail／0 skip，兩批 exit 0，約 58 秒與 4 秒。
- 16 個不同 JS 語法檢查及 git diff --check 通過；本機 runner 的提示仍寫 11，陣列有 17 項，其中 drawing-loops.test.js 重複一次。
- 實際 C++ 編譯與 trace：迴圈前／內／後、遞迴 activation、無括號本體、while/do、break/continue、重複入口、具名消歧義、範圍與巢狀、非法區塊／上限、質數結果、JSON 重載及舊 iteration.last 契約通過。
- 真實 Edge Ace/RUN 最小三種線篩 fixture；共用區塊 i=9 的箭頭至 18/27、j=0/j=1 文字绑定格子 0/1、兩個背景色與可見紅色高亮、事件 steps=0；Studio 可選第二個文字運算式並顯示格式控制。
- 真實 slides.html algorithm-animation runtime iframe 保留共用區塊箭頭 ID／目標、文字內容／binding、背景色及事件關閉；與獨立演算法頁定點結果一致。
- 結構註標色板立即套用、保存重開保留顏色；既有索引／邊界／canvas 與單一 matrix/tree/heap 定位、code 關注行轉場、文字 undo 通過。
- 測試使用獨立 Edge context、合成 deck/mock，未操作私人資料或使用者分頁；未放寬斷言。test-results 腳本／TAP/log 不提交。
- 未執行完整 regression、所有演算法／幀／速度、完整 autoplay、Studio 全套互動、真實 Mongo、私人 deck、實機觸控、註標專項 undo/redo、透明度或大量多行排布。
- 子代理分類索引更新為 76 個檔案，drawing-loops.test.js 歸 E；逐檔比對無缺漏。

## 服務與推送

- 核實 3100 PID 41728 後重啟，新 PID 71180。
- slides.html/js、slide-structures.js、algorithm.html 與六個修改 trace 模組 HTTP 200，SHA-256 與受測內容相同；main 3000 HTTP 200，commit 未變。
- Docker 仍服務 main，本輪未重建或重啟；整合預覽：http://localhost:3100。
- 依使用者持續授權，推送本輪程式與紀錄至 https://github.com/bamboo20030309/AlgoShowMaker.git 的 origin/intergration；成功與否以最終遠端 SHA 核對及回報為準。
