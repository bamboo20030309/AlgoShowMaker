# 展示模式操作與數字寬度修正

## 使用者要求

- 滑鼠快捷鍵顯示對應按鈕按壓效果；展示預設一般游標，可原生反白文字，右鍵選單可切換「簡報模式」（雷射筆＋動畫快捷鍵）。
- 移除雙擊起點／終點及單擊 320ms 等待，放開滑鼠即執行。
- 線段樹第 26 頁第 71→72 幀多欄數字溢出；內容與可用寬度變動時重新計算字級。

## 實作

- 快捷鍵沿用 invokeButton 的原按鈕函式，並套用與 :active 共用的按壓樣式；只有簡報模式的動畫畫布啟用，不修改播放排程。
- 右鍵模式選單支援鍵盤上下選擇與 Escape 關閉。Escape 在捕獲階段消化，避免關閉選單同時開啟 Reveal 總覽。iframe 一般游標的右鍵也可開父頁選單；簡報模式畫布內保留右鍵下一步，背景／播放列仍可開模式選單。
- 一般游標的 Fabric 文字選取層使用物件既有 SVG 匯出與 viewport/group 矩陣，保留樣式與幾何，不另建字形排版；攔住 Fabric 容器的 selectstart 禁選攔截，讓瀏覽器原生反白／複製。編輯、總覽、簡報模式關閉選字層；它不進入 deck、undo 或雲端儲存。
- 移除待判斷雙擊的計時器。兩次單擊只執行兩次步進，沒有起點／終點映射。
- fitSvgCellValueText 共用 fitSvgText 計算格子全部可見欄位與逗號的字級。renderer 與事件 replay 的值／欄位顯隱、矩形寬度變更接上重算。保留原始字級上限與明確 0、自訂字級，較短內容可恢復。
- 多欄動畫先測量該次操作的完整文字並限制字級，避免新數字落入時溢出；保留原欄位中心，不因縮字讓後方欄位提前騰位。只在數字落位後沿用既有重排，結束時移除暫時字級上限。

## 驗證入口

- tests/canvas-mouse-shortcuts.browser.test.js
- tests/slide-presentation-controls.browser.test.js
- tests/presentation-mode-selection.browser.test.js
- tests/cell-value-fit.browser.test.js
- tests/assignment-baseline.browser.test.js
- tests/multi-field-replay.browser.test.js

指定寬度案例在修正前已用實際 SVG 重現溢出；不放寬原先落點與延後重排的答案。測試使用隔離服務與瀏覽器，不操作使用者資料。純前端修改不重建 Trace、不執行全套驗證。

## 驗證結果與交付

- 上述 7 個相關 browser 案例通過（滑鼠控制 2、切頁／游標 1、模式／選字 1、指定溢出幀 1、文字落點 1、多欄時序 1）。
- 指定線段樹案例在 1x／4x 核對全部已顯示欄位文字寬度，必須落在格子寬度減 8px 的範圍內；不是靠隱藏、裁切或擴大容許值讓它過。
- 維持既有獨立答案：字形落點一致、後方欄位在落位後才騰位、欄位依實際事件順序提交、零與逗號同步退場。曾發現縮字會讓後方欄位提前移動，修正為保留初始中心後重跑通過。
- 選字案例使用真實滑鼠拖曳及畫面截圖核對，並經本機儲存／重新開啟確認文字、顏色、粗體與 scale 不變；一般游標是新開頁面的預設。
- 改動 JS 語法與 git diff --check 通過。整合分支提交／推送後重啟 3100；不合併 main、不發布 Release。
- 前端版本：canva trace-23、front frame-endpoints-64、presentation controls JS v4/CSS v3、slides-356、iframe trace-runtime-111、draw fit-5、renderer trace-287、tween trace-354。
