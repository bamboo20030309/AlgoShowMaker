# 多分類與投影片元件整合驗證

- 日期：2026-09-18；目標分支：intergration。
- 整合前：6237b2e；Gamma 交付：2d338a23fa025ad9c1f6fcc7d6c2c8dedb4cae3b，共 16 個新增提交、8 項任務。
- 合併與受測程式：68b3cc847c7104c1f33cfeba56e8ee477e2be289。
- Alpha、Beta 沒有新增待整合提交；既有文字 undo、清單編輯與外部檔案拖入功能保留。
- main 維持 ddfe5b6081261a05b437a61a546861151d4618e5；本次沒有合併 main、push 或 release。

## 修改與衝突處理

- code 元件進入投影片時沿用既有關注行對齊，快速切頁取消舊排程，配對轉場保留起點與終點。
- 登入區域置中；資料夾建立改用既有介面風格的對話框；卡片整張可拖曳；資料夾操作圖示移到標題旁。
- 投影片可加入多個分類，保留未分類互斥、刪除資料夾與重載一致性；公開目錄沿用 categories 並相容 category。
- 文字游標改為二元閃爍，輸入後立即顯示；移除固定拖曳提示，保留儲存／錯誤狀態。
- slides.html 與 entrypoints.test.js 快取版號衝突統一為 parallel-merge-188，保留既有拖入入口與腳本。
- 分級：一般介面與投影片邏輯 V0/V1；code 配對轉場定點 V2，分類 B。沒有修改演算法 trace/runtime，不啟動廣泛演算法驗證。

## 驗證指令與結果

執行目錄：intergration worktree 的 algo-vis-backend。

```powershell
node --test --test-concurrency=1 tests/auth-center.browser.test.js tests/code-focus-entry.browser.test.js tests/cursor-blink.browser.test.js tests/entrypoints.test.js tests/library-folders.browser.test.js tests/slide-library.test.js tests/slides-text-undo.browser.test.js tests/list-backspace.browser.test.js tests/deck-file-drop.browser.test.js
```

- 10 pass、0 fail、0 skip，exit 0；執行約 34 秒。
- 修改的 slides.js、guest-gallery.js、library-layout.js、library-organizer.js 與六個相關測試檔 node --check 通過；git diff --check 6237b2e 通過。
- 核實登入置中、初次／再次／快速切頁關注行、無關注保留捲動、配對轉場定點、二元游標與退出編輯停止計時、資料夾與多分類持久化模型、API 帳號隔離與拒絕非法資料，以及既有 undo／清單／拖入功能。
- 瀏覽器測試使用獨立服務與 context、合成投影片及 mock API；API 測試使用記憶體模型。CDN 可用；沒有操作使用者分頁或私人投影片，也未放寬斷言。
- 沒有執行完整 regression 或廣泛排序動畫。真實 Mongo 跨裝置持久化、實機觸控、OS IME 與總覽選頁操作未另行驗證。
- 更新子代理通知的索引為 72 個測試檔，逐檔比對無缺漏；三個新測試分類為 A（登入）、B（code 關注行／游標）。

## 預覽服務

- 核實 3100 原程序 PID 61536 後重啟，新 PID 27228。
- index.html、home.css、slides.html、slides.js、guest-gallery.js、library-layout.js、library-organizer.js 均 HTTP 200，SHA-256 與受測檔案一致。
- slide-library 匿名 API 回傳 401；main 3000 回傳 200，main commit 未變動。
- 預覽：http://localhost:3100；本次未重啟 main 或 Docker。
- 所有八份交付紀錄補上主代理核實與本文件連結；不提交 test-results、server log 或暫存產物。
