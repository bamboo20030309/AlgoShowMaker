# char(s) 索引標籤修正

## 原因與修正

labels(value,index) 已解析成 indexMode=1。renderOriginal 將 char(s) 轉成序列後會建立索引，但 live／snapshot 外層清理仍依來源 variable.kind=string 呼叫 removeScalarIndexLabels，刪除已建立的索引。隔離重現於相機比例 1、2、3 都沒有索引節點，排除僅為 LOD 的推測。

讓單格索引清理接受 rendererOptions，辨識 char 轉換並保留其序列索引；一般字串、純量維持原先行為，明確關閉索引仍由 renderer 設定處理。前端版本 trace-271。

## 驗證

V2 最小相關範圍；獨立隨機埠服務與瀏覽器，不操作使用者頁面。

- char-view.browser.test.js：preset object char(s) with labels(value,index) 的 live 與 keep snapshot 索引各三個；序列化重開仍保留；一般 string 單格不顯示索引；明確 showIndex=false／indexMode=0／indexLabels=none 保留；字元比較、賦值動畫與 KMP stdout 正確。
- char-view.test.js：char 來源身分、索引綁定、preset object 與非法來源。
- entrypoints.test.js、JS 語法、git diff --check 通過。共五個相關案例，補上 preset fixture 後僅重跑受影響案例，通過。

## 預覽

3100 已重啟，PID 85600，HTTP 200、trace-271 與整合 worktree 一致。不合併 main，不發布 release。
