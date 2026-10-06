---
name: algoshowmaker-authoring
description: 為 AlgoShowMaker 撰寫 C++ 演算法視覺化註解、設計幀與事件，以及製作可編輯的原生教學投影片。適用於將 AC code 改成教學動畫、解釋程式與畫面對照、KMP 或河內塔教材、工作坊教材及 asmdeck 製作。
---

# AlgoShowMaker 教材製作

將 C++ 演算法做成可修改、可核對的教學動畫與原生投影片。使用者的題目、程式、格式與教學目標優先。

## 按任務讀取資料

只讀本次需要的指南，不預先載入全部 references。

| 任務 | 閱讀入口 |
| --- | --- |
| 加入繪圖指令、安排幀與事件 | [核心語法](references/directives.md)、[幀與事件](references/frames-events.md) |
| 共用場景、條件、別名、批次與前幀值 | [場景設定與繪圖計算](references/scene-setup.md) |
| 字元、位元、格子文字、矩陣標籤、節點欄位 | [資料呈現與格式](references/data-presentation.md) |
| 遍歷指標、矩陣列欄、顏色、focus | [指標與樣式](references/pointers-styles.md) |
| 遞迴／線性排版、keep、相對定位 | [排版與歷史快照](references/layout-history.md) |
| 輔助繪圖、原始變數、事件目標或箭頭 | [繪圖邏輯與事件呈現](references/event-presentation.md) |
| 選結構或教學輸入 | [結構與範例](references/structures-examples.md) |
| 製作 asmdeck | [原生投影片](references/slides.md)；含動畫時再讀相關指令指南 |

只能提供單檔提示時使用 [QUICKSTART.md](QUICKSTART.md)。本包核心語法依 `cda1219` 整理；`char(s)`、矩陣獨立指標與 pointer color 已在 intergration 的 `cde8028` 實作。遇到版本差異，查專案根目錄 `ALGORITHM_VISUALIZATION_DIRECTIVE_MANUAL.md` 與 parser；無 repo 時查 [核心版本手冊](https://github.com/bamboo20030309/AlgoShowMaker/blob/cda1219eb407845e8ebbae22d7a30580b0ec7f1f/ALGORITHM_VISUALIZATION_DIRECTIVE_MANUAL.md)，不要假設舊部署具備新功能。

## 教材與元件

- 先確認輸入、輸出、索引起點、變數意義及關鍵分支，再設計「畫面／程式位置／原因／預期結果」。小輸入涵蓋正常與重要例外路徑。
- 保留演算法、型別、邊界及 stdout；必要的邏輯修改說明原因與差異。投影片依「問題 → 狀態表示 → 規則／不變量 → 程式 → 動畫 → 練習 → 檢核」安排，沿用使用者指定模板。
- 使用既有可編輯元件：文字用 text、程式用 code、公式用 LaTeX、資料結構用 structure、動畫用既有播放元件；不將程式、公式或整頁烘焙成圖片。

## 原始資料與繪圖邏輯

- 優先顯示演算法實際讀寫的變數，不另建無關展示副本；相同值不代表相同事件目標。字串逐字顯示用 `char(s)`，一般 `@frame s` 不會自動拆字。
- 繪圖條件、暫時計算與批次操作優先用 when、let、for；let 是幀內唯讀別名。必要的 C++ 繪圖輔助區段用 code hide 隱藏，保留解法本身的重要步驟。
- 重要比較、賦值、交換與指標移動應能對應可見物件。難以用事件表達的對應關係可補 arrow；不以箭頭、style 或關閉事件掩飾解析與綁定錯誤。

## 指標、樣式與連續性

- 陣列遍歷優先用指標，少用逐格改色替代移動；新增游標優先用獨立 pointer，保留物件既有設定。
- background、point、mark、focus 省略顏色，沿用預設效果；pointer 需要區分角色時可指定 color。這是教材偏好，不覆蓋舊物件自訂值。
- 用 focus 保留已處理範圍，尚未走到的後段變灰且保持可見；範圍依實際進度更新，不提早表示完成。
- 預設符合需求就省略設定，保留必要自訂與明確關閉值。後續仍需要的物件保持相同身分、位置與指標關係，避免不必要的退場、重現或跳位；歷史 keep 不冒充目前狀態。

## 驗證與交付

- 用小輸入核對 stdout、關鍵分支、首末幀、索引邊界、事件與實際畫面；不將幀的最終狀態當作每個事件的當下值。按 AGENTS.md 的分級驗證，使用獨立服務、資料與瀏覽器，不覆蓋使用者教材。
- 現代 `// @...` 不混用舊 AV.hpp API，不發明指令或檔案欄位；asmdeck 使用既有封裝，實際匯入確認，不以改 JSON 副檔名充當成品。
- 提供完整程式／可套用修改或原生投影片、輸入與預期答案、關鍵幀對照、驗證結果及限制。沒有執行能力時標明尚未編譯／播放／匯入，投影片只能交付故事板時清楚標示。
- 不憑未驗證結果宣稱保留 AC 身分或改善學習成效。需比較不同 AI 的教材產出時，讀 [教材核對提示](references/authoring-checks.md)。
