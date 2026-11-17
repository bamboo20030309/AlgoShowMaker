# 合併排序公開範例程式更新

## 範圍

依使用者提供的完整程式，替換 merge-sort.asmdeck 的兩份遞迴動畫。保留原測資、頁面及物件排版；兩份倍增動畫與其他頁面逐項比對保持不變。本次沒有改寫靜態程式解析頁或引擎。

新版本加入葉節點及合併完成區段的 mark，補齊剩餘元素時保留已處理部分的 mark；事件設定沿用提供的 autoFixedEnabled=false、autoLoopBoundaryEnabled=false、readHighlightEnabled=false、readHighlightColor=red。

## 執行與驗證

- 使用獨立服務重新執行兩份動畫，各 83 幀；兩組測資最終皆為 1～10 遞增。
- 用獨立瀏覽器載入新 Trace，核對第 3、11、12、26、27、82、83 幀有 SVG 內容，實際幾何屬性無 NaN／Infinity，沒有頁面例外。這是關鍵幀定點檢查，未宣稱全時間軸動作驗證。
- 初版檢查掃描整份 SVG 字串，誤將合法 data-outerframe-columns="Infinity"（不限欄數）判錯；追查後改為檢查實際幾何屬性，未更改產品或放寬幾何判定。
- 重新編碼再解碼 asmdeck，核對程式碼、測資、新引用 ID 與明確關閉設定；確認不內嵌完整 Trace，兩份倍增動畫及其他頁面內容不變。
- 新 Trace 寫入 merge-sort-01／02.json，原 ID 對應資料保留在 legacy，避免破壞既有引用。更新公開教材 URL 的快取版本。
- 差異檢查通過。未啟動全量 regression 或重跑其他演算法。

## 交付

推送 intergration 並重啟 3100；不合併 main、不發布 release。既有瀏覽器若仍開著先前教材，不會被強制覆蓋，需重新從範例清單開啟。
