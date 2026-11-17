# 投影片滑鼠控制交付

## 定義與實作

- 使用者要求畫布真實拖曳後才取得滾輪縮放；原地按住不算選取。沿用既有 pan 行為，加入 4px 拖曳門檻，選取狀態只存在該畫布記憶體。
- slide-presentation-controls 在子畫布尚未選取時攔截滾輪切頁；選取後交給 canva.js 縮放。離開投影片／切換動畫／重新整理清除選取，不修改 deck、Trace 或持久化欄位。
- 使用者最新限定：滑鼠播放快捷鍵僅在雷射筆展示狀態 asm-slide-laser-frame 啟用。編輯模式、Studio、繪圖模式及獨立 algorithm.html 均不啟用。
- front.js 將原按鈕處理函式註冊為 invokeButton；滑鼠直接呼叫同一份動作，沒有第二套播放引擎或事件排程。終點沿用既有 finishBtn 處理函式；Trace 播放器跳到最後，舊 AV 的停靠規則未變更。
- 中鍵播放／暫停、左單擊上一步、左雙擊起點、右單擊下一步、右雙擊終點。單擊等待 320ms 分辨雙擊；真實拖曳取消待執行點擊。背景分頁／失焦取消待執行點擊。

## 驗證

- canvas-mouse-shortcuts.browser.test.js：正式父投影片頁與正式子播放器 iframe，核對未選取切頁、原地按住／1px 抖動不選取、實際左右拖曳才選取縮放、不觸發步進、切頁清除選取、所有單雙擊對應、真實父頁展示／編輯切換、Studio 排除。
- 同檔第二案例以最小四幀動畫驗證實際幀號：下一步 1→2、上一步 2→1、終點→3、起點→0，中鍵切換播放／暫停；獨立頁無雷射狀態時右鍵不步進。
- slide-presentation-controls.browser.test.js：維持垂直優先翻頁、已選畫布縮放、編輯游標、雷射筆及既有物件設定保存／重開。
- 全部 3 個相關 browser 案例通過；JS 語法與差異檢查通過。獨立服務、瀏覽器及資料，未操作使用者分頁、未執行大型動畫驗證、未重建公開 Trace。
- 前端資源：canva trace-22、front frame-endpoints-63、presentation controls v3、slides-355、iframe trace-runtime-110。

## 交付

- intergration 提交／推送並重啟 3100，main 與 3000 不變。
