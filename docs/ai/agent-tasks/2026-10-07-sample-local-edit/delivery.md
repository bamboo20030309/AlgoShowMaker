# 範例投影片本機編輯

## 需求與範圍
- 撤回展示模式專用的編輯程式碼按鈕、控制列、訊息橋接與獨立動畫覆蓋儲存模組。
- 範例投影片直接沿用一般投影片 Edit / Present 與編輯演算法動畫視窗。
- 每個 sample ID 使用各自 IndexedDB 草稿，重開優先保留本機修改；雲端投影片和帳號事件偏好不得寫入。
- 匯出產出修改後的副本；分享連結仍指向公開範例，並不傳送本機副本。
- 原有獨立 algorithm.html 與一般共享權限維持既有流程。

## 實作
- sample 只開放前端本機編輯，不賦予任何伺服器寫入權限。canSaveRemoteDeck 明確排除 sample。
- sample 編輯 iframe 加上 localOnly=1，阻止登入使用者的事件設定回寫帳號偏好。
- 移除 runtime-local-editor.js 及其專用測試，以新 sample-local-edit.browser.test.js 驗收新的產品流程。
- 保留快照明確 null Trace 與無動畫結果清除播放器的正確性修正。
- 既有範例不需新欄位或重建物件。

## 驗證
- V1：編輯入口、儲存與匯出；沒有修改動畫解析或排程，不執行大型演算法驗證。
- entrypoints.test.js：入口與快取版本契約通過。
- guest-gallery-contract.browser.test.js：正式範例、縮圖與預建動畫免編譯載入通過。
- sample-local-edit.browser.test.js：隔離服務／瀏覽器驗證舊動畫載入、編輯、RUN、保存、重開、自訂字體與 false 設定、匯出、新建物件持久化、不同 sample 隔離及唯讀分享權限。
- 瀏覽器攔截觀察：允許 analyze / compile，投影片與帳號偏好遠端寫入為零。
- JS 語法與 git diff --check 通過。

## 整合
- 保留無關教材與腳本草稿；僅提交本次修改。
- 整合到 intergration，不合併 main 或發布 release。
- 完成後只重啟核對來源的 3100，並推送 origin/intergration。

- 3100 已核對原 PID 14496 與整合 worktree 後重啟，新 PID 56108；HTTP 200、slides-268、embed trace-14，展示編輯覆蓋模組已移除。3000 HTTP 200 且維持 slides-266。
