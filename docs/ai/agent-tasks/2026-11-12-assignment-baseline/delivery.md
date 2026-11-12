# 數字下落定位修正交付

## 問題與修正

- 使用者指定：線段樹投影片第 23 頁，動畫第一幀開始的數字下落。
- 原本普通值格的 SVG text 以字型基線定位，下落副本卻在同一個 y 強制使用 dominant-baseline=middle，造成落點偏下。
- 常數／不可見來源下落共用路徑改為讀取目標文字的實際 typography，保留 dominant-baseline、alignment-baseline、baseline-shift、字型、字級、字距與顏色，並投影完整座標矩陣；不使用固定像素補丁。
- 維持原本下落時間、提交時機與多欄橫向排版。前端 tween 識別更新為 trace-352。

## 驗證與標準答案

- 新增 tests/assignment-baseline.browser.test.js：直接讀公開線段樹第 23 頁的程式與輸入，重新執行，再核對 frame 0→1 的第一筆輸入 1；從實際 SVG 量測飛入文字與同內容目標文字的落點與字高。
- 固定答案：第一筆輸入為 1；落位前最後一個畫面垂直差 <0.5px、全程字高差 <0.1px。實測 1x/4x 垂直差均 <0.001px。
- 同時載入既有 Trace，核對首個 tree 賦值（frame 10→11），通過 JSON 載入往返及兩種速度，未要求使用者重建舊資料。
- constant-assignment-drop.browser.test.js、formatted-assignment.browser.test.js 通過，涵蓋常數、不可見來源、複合賦值與多欄格式。
- 三個相關測試通過；JS 語法與 git diff --check 通過。測試使用隔離服務與瀏覽器；未執行完整 regression 或重跑全站 Trace。

## 範圍

- intergration 預覽，完成後重啟 3100。未合併 main、未發布 release。
- 純播放定位修正，不改 Trace 資料格式，也不需要為此重新編譯範例。
