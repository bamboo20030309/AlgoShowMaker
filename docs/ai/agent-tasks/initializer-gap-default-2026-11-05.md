# 初始化宣告缺少實際事件間隔

## 原因與前次驗證漏項

使用者澄清黃色反白正常，問題是兩個初始化宣告接得太快。前次公開範例驗證在套用 Trace 前直接寫入 gapMs=500，所以只能證明明確設定正常，沒有涵蓋正式載入的缺欄位情況。

播放器的缺欄位回退值是 0，編輯器預設也是 0，與後端偏好及 Studio 的 500ms 不一致。載入的有效 Trace 即使有其他 eventSettings 旗標，只要沒有 gapMs，兩個宣告就會零間隔串接。

新增測試使用合併排序公開 Trace，移除 gapMs，透過 ASMTraceEditor.loadAnimation 正式載入，再播放第 25→26 幀。修正前量到 0ms，固定答案 500ms 失敗；不是只憑畫面快慢推測。

## 修正

- 共用 normalizeEventGapMs／eventGapMs：缺少或無效值回退 500ms，明確 0、自訂值及合法範圍限制保留。
- 播放排程、編輯器與前端時間估計使用同一個規則；沒有 Trace 的舊手寫動畫不因此增加等待。
- 對齊後端既有 500ms 預設，不修改使用者帳號偏好，不把明確 0 覆蓋成 500。
- 不增加初始化內部的停頓；完整初始化與下一個事件之間才套用間隔，不修改宣告入場的 220ms。

## 驗證

- event-gap-default.test.js：缺值、null、空白、無效值回退 500；明確 0、自訂值及邊界值。
- merge-declaration.browser.test.js：新增正式載入缺欄位案例；合併排序第 26 幀的兩個初始化間量到 500ms。既有 0/500ms、1/2 倍、明確關閉賦值、面板重建與全程反白仍通過。
- event-gap.browser.test.js：編輯器預設 500，明確改為 0 或 600 的播放、跨幀與保存重開仍通過。
- JS 語法及 Git 差異檢查；只跑相關小驗證，不執行全量 regression。

## 交付

events trace-69、tween trace-317、editor trace-39、front frame-endpoints-59、slides-310、runtime-66。推送 intergration，重啟並核實 3100；不合併 main、不發布 release。
