# 事件依賴跟隨與同格多欄位修正

## 範圍與結果

依使用者要求實作2026-11-10-event-follow-audit的A、B、C2及D。原稽核檔位於Claude工作目錄、未出現在整合分支，已複製納入文件；未合併其他Claude分支或介面修改。

- 共用依賴層按宣告ID、@let別名及既有事件mutation建立檢查點，使用createExecutionContext的事件前／後值，向播放計畫輸出directiveCheckpoints。只在依賴變化時重建相關呈現，不逐tick重跑完整scene。
- 文字在提交點更新，重新測量自動寬度與相對定位；when由假變真用220ms入場，保留自訂字級與Studio隱藏設定。旁白保留幀末內容。
- 動態索引箭頭按對應事件的motionStart分段移動520ms；停用事件立即更新。每tick仍讀正在移動的SVG端點，遞迴／keep邊的原有生長時鐘保留。
- style採C2，只重算含執行變數的索引／範圍選取；固定索引、其他條件樣式及快照規則保留。嵌套索引透過既有運算式求值器凍結為當下選取，避免把陣列塞入純量locals而破壞解析。
- 舊事件缺少完整前後值時，該依賴物件回退幀末畫面，在除錯紀錄提示重新RUN。穩定渲染、反向與重新載入直接還原目的幀。
- 程式碼面板以rAF邏輯時間控制實際CSS動畫，支援倍速、暫停及取消；取消會清除動畫與後續callback，不再等待獨立setTimeout。

## 使用者補充：線段樹第24→25幀

沿用先前附件及10個元素、5筆操作的輸入。這一幀依序執行tree[17]的2→5及lazy[17]的0→3。

附加欄位為tspan，原本部分路徑只辨識text，且動畫前景層將tspan當整格抽離到g下，造成無效SVG、數字消失。比較重排也可能改變同一text內的欄位順序。修正為：

- 主值與附加欄位都各自取得重播目標及提交值，不覆蓋同格其他欄位。
- 最終被hide隱藏的欄位仍保留語意目標與節點幾何回退，以支援幀內出現再隱藏。
- hide／format共用renderer原規則，包含LM與signed／assign；分隔符只出現在可見欄位之間。
- tspan始終保留text父層；前景動畫提升它的整個格子，比較不重新排列文字欄位。

## 固定答案與驗證

共28個不同的定向測試最終通過；不將重跑次數重複計數，未跑完整V3。

1. directive-follow.browser.test.js兩項：i+k的0→1→3，首段無關事件保持0，對應提交才換字；箭頭分段到正確格子，C2反白同步，固定mark保留；@let、when、自動寬度、22px自訂字級、明確停用事件、JSON重開及缺值警告。1／2倍速及暫停續播。另以實際CSS動畫驗證程式碼捲動1／4倍速、128ms暫停凍結與取消後沒有殘留。
2. multi-field-replay.browser.test.js一項：附件新編譯與既有範例Trace第24→25幀，1／4倍速依序為tree=2→5，lazy隱藏→+3，sets持續隱藏。另以單節點依序加入lazy=+3、sets==7，再移除兩欄，檢查重複回到同一狀態、分隔符及合法text/tspan父層，儲存JSON後重開。
3. 既有execution-state、pointer-event-reflow、code-panel-settings、arrow-index-label、text-object-bindings、drawing-arrow-animation共19項；新依賴測試兩項加上這19項構成初次選定的21項。
4. merge-arrow-motion、style-cell-motion兩項、cell-text-scale兩項、recursive-parameter-pointer一項，另6項確認遞迴／keep、style跟隨、BIT數字縮放及遞迴參數修正不回歸。

初次驗證失敗已追查並修正：測試事件字串的空白不一致導致未真正停用／刪除payload，現改以明確匹配並核對一筆；批次箭頭測試以CRLF原檔與Ace的LF輸出嚴格比較而逾時，準備資料統一換行並取消預設範例載入，原動畫斷言未放寬。欄位重播另查出tspan提升父層、最終隱藏欄位未登記及分隔符問題。連續狀態斷言使用相鄰去重，保留「出現後再回到先前狀態」的必要答案。

語法、git diff --check通過。測試使用隔離服務與瀏覽器；未操作使用者分頁。test-results、探針及log不提交。

## 交付與限制

播放修正不改Trace／asmdeck格式與後端生成指紋，既有完整Trace直接受益；缺資料則提示重新RUN。同步快取版本：tween trace-337、renderer trace-286、code-37、slides-340、runtime-95。沒有重跑全部公開Trace，沒有改寫範例教材內容。

按整合規則推送intergration並重啟核對3100。main／3000、Release與公開部署不變。沒有把所有繪圖指令改為每次事件都重新執行；動態@for的展開數量、camera跟隨與TTS分段不屬於本次新增行為。
