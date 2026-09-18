# 多樣式與結構工具列整合核實

- 日期：2026-09-18；intergration 前次 checkpoint fc7c3c2。
- Alpha 交付 5066ca9，Gamma 85342ee；Beta 無新提交。
- 合併程式 9d2ce873ab509d32601ffb7a1a545cff5028dfc9；完整受測版本含 iframe 專項 eecb30951584ed8daaee5fb3470fc9cb2afd02e1。
- main 保留 ddfe5b6081261a05b437a61a546861151d4618e5，不合併 main、不發布 release。

## 本次具體更動

- @style 允許 highlight,point 等逗號多類型，共用顏色與 when；未指定色沿用每類預設。preset/defaults 維持按類型覆寫；未知、空或重複類型報錯，rgba 內逗號不混淆。
- 一般結構的註標箭頭預設白色，明確儲存的自訂色保留。
- 點擊結構格子顯示上方六種樣式工具列，切換同步側欄；註標支援共用預設文字及各格覆寫，留空回退，保存重開保留。
- 每次統合回報具體更動、驗證、推送與服務結果，已寫入整合分支與預覽設定.md。
- 快取衝突統一 parallel-merge-192；交付文件衝突保留新交付、白色預設補記與前輪核實連結。其餘舊功能保留。

## 驗證

在 intergration/algo-vis-backend 使用本機 test-results/integration-style-toolbar-validation.cjs，隨機埠 54896、ASM_REGRESSION=1、獨立 JWT 與不可連線隔離 Mongo URI。設定 ASM_TEST_BASE_URL 後執行：

```powershell
node --test --test-concurrency=1 tests/style-list.test.js tests/style-list.browser.test.js tests/style-segments.integration.test.js tests/preset-directives.test.js tests/entrypoints.test.js tests/directive-assist.test.js tests/structure-annotations.browser.test.js tests/slides-text-undo.browser.test.js
```

- 28 pass、0 fail、0 skip，exit 0，約 25 秒；18 個 JS 語法檢查及差異檢查通過（runner 提示仍寫 11，實際陣列 18）。
- 實際 SVG 同格可見 highlight 與 point、條件排除其他格子；主代理新增實際 algorithm-animation slide runtime iframe，四格樣式與獨立演算法頁一致，JSON 重載不變。
- 結構工具列位置／樣式切換／侧欄同步、各格 left/right 文字與預設 i、白色及自訂色、IndexedDB 重開保存通過；既有 preset、style segments 與文字 undo 通過。
- V2/E 的多樣式解析與實際呈現、V1/B/C 的一般元件操作；無完整 regression 或廣泛演算法集。獨立 Edge context、合成 deck，不操作使用者分頁或私人資料，不放寬斷言。
- 未專測工具列的右鍵／雙擊／切頁清理、工具列或註標 undo/redo、透明度、手機／實機、多結構並存與大量註標；真實 Mongo、私人 deck、完整 autoplay 未驗證。
- 索引更新 78 檔，style-list 兩檔列入 H，逐檔比對無缺漏。test-results、runner、TAP/log 不提交。

## 服務與推送

- 重啟前 3100 已無 listener，原 PID 71180 不在服務；沒有停止其他程序。啟動最新整合服務 PID 27260。
- slides.html/js/css、slide-structures.js、algorithm.html、trace-directive-assist.js HTTP 200 且 SHA-256 與受測版本一致。
- main commit 未變，但 3000 此時沒有可連線服務；本輪未啟動或修改 main／Docker。
- 預覽：http://localhost:3100。依使用者持續授權推送程式與紀錄至 https://github.com/bamboo20030309/AlgoShowMaker.git 的 origin/intergration，成功與否以最終遠端 SHA 核對為準。
