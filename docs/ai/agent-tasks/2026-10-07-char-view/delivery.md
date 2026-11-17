# char(s) 字串字元視圖

需求：比照 bits() 提供 char(s)，字元格及名稱沿用原始字串；不建立展示用 C++ 陣列。

## 實作

- @frame char(s)、@object char(s) 與 char(s)[i,j] 共用原始變數 ID；preset/defaults 沿用既有展開路徑。
- renderer 以唯讀 presentationItems 展開字串，原 trace state 保持 kind:string/value；指標、style 與 segment 讀取同一視圖格子。
- 名稱與 arrow/place/style/camera 目標仍為 s。keep 與 JSON 儲存重開保留轉換設定；普通舊字串仍整串單格顯示。
- 空字串不畫字元格；錯誤參數與非字串來源明確報錯。UTF-8 沿 std::string 位元組索引，完整字形只畫在起始位元組格。
- 更新指令提示範例、核心指令手冊及共用腳本快取版本。

## V2 驗證

固定答案：aba 為 a/b/a 三格；寫入 s[1]='z' 後為 a/z/a；普通 s 為單格 aza。每格 key 為原 s 的 ID 加 #索引；外框名稱為 s，i/j 指標可見。

- char-view.test.js：2/2，解析、原身分、pointer、preset/object、錯誤來源。
- char-view.browser.test.js：2/2。實際 SVG 與比較／賦值播放效果；keep、舊單格字串、空字串、自訂索引關閉、序列化重開；使用者 KMP 移除 pat 後輸入 abababca，輸出 0 0 1 2 3 4 0 1，s 比較事件無 missing-target。
- pointer-directives：5/5；defaults-directives：9/9；directive-assist：3/3；entrypoints：1/1；bits-eight-queens 僅資料轉換解析案例：1/1。
- 合計 23 案例通過。初次 defaults 編譯案例漏設隔離 URL，補上隔離服務後只重跑失敗的 3 案例。快取版本斷言同步更新後入口測試通過。
- KMP 預設縮放觸發既有 14px LOD，測試以正常鏡頭放大核對字形，未修改 LOD 規則。
- JavaScript 語法與 git diff --check 通過。未跑完整 V3 或全範例；未操作使用者分頁／私人投影片。

交付分支 intergration；完成後重啟 3100，保持 main/3000。
