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

## 後續補強：左右孩子相加的多欄數字

- 使用者指出 `tree[now]=tree[now*2]+tree[now*2+1]` 仍偏下。實際重現多欄 `fields(tree,sets,lazy)` 的計算副本落點偏下約 4.148px。
- 主因：計算來源的 tspan 轉為獨立 text 時，以父元素屬性缺省值 middle 覆蓋原本繼承的字型基線；前次只改常數路徑，未涵蓋這條來源副本路徑。
- 新增共用 assignmentTextTypography，讓普通數字副本、多欄來源副本、常數下落與備援下落讀取相同的實際文字設定。常數與備援下落另共用 assignmentValueTextInRoot 投影目標基線與矩陣。無可量測文字時才保留幾何備援，不把估算當作已知文字的定位。
- 擴充同一個 assignment-baseline.browser.test.js：固定孩子為 2、3、結果為 5，逐個來源檢查，避免只核對最後一個來源；另測舊 Trace 缺少來源描述的計算備援。修正前固定落點斷言失敗（約 4.148px），修正後兩個來源落點差均為 0（1x、4x）。原常數案例仍檢查全程字高；計算來源允許既有來源到目標字級內插，但落點的字高必須一致。
- 保留第 23 頁第一筆輸入與既有 Trace 賦值驗證；版本識別更新 trace-353，無需重編譯 Trace。
- 本輪共 5 個相關測試通過：基線落點、常數下落、完整格式下落、多欄欄位提交／替換／退場、指定的二元及複合算術賦值案例。未執行全套驗證。
