# 遞迴節點依宣告事件入場

## 行為

遞迴 layout 決定生長起點、路徑與終點，節點所屬的宣告事件決定開始時間與入場時間。對應宣告先反白並停留 200ms，節點才開始 220ms 的生長，不再於換幀時獨立提前長出。播放速度沿用整體事件時鐘。

以呼叫 activation 與變數 ID 精確找出宣告，不能把上一層同名參數的事件接過來。舊 Trace 若宣告缺 activation，以已記錄 lifetime 核實。明確關閉宣告動畫時直接顯示最終狀態，不額外播放自動生長。沒有對應 runtime 宣告的純繪圖快照，保留原本的 layout 生長行為，不杜撰事件。

整個節點、格子、名稱、索引與 mark／highlight／point 共用同一生長時鐘；新連線在節點入場前保持隱藏，之後跟著實際節點延伸。父節點仍在重新排版時，子節點從父節點當下的位置長出；主體外框決定縮放中心，裝飾不影響中心。keep 接手已存在節點不重播入場，既有邊維持 activation 身分。

這是播放器排程修正，不新增 Trace 欄位、不修改 runtime 執行順序或宣告／初始化語意，不需要重新 RUN 全部預建 Trace。

## 驗證

- recursion-declaration-clock.test.js：三項固定答案，核對同名祖先不能搶事件、舊 lifetime 回退、純繪圖快照與明確關閉；初始化的其他動作不延長節點入場。
- recursion-declaration-clock.browser.test.js：10 組資料／速度組合（已儲存教材、新編譯含 style、缺 activation 的舊資料、未預留樹位置、宣告關閉，各 1／2 倍速）。使用實際 SVG、多時間點及手寫 200／220ms 答案，核對入場前透明、反白、父節點中心、格子邊界、style 相對位置、箭頭、最終狀態與下一幀 keep。
- 原 merge-sort-recursive-layout.browser.test.js 僅續跑 retained recursive keep／existing recursion edge 兩項，均通過。
- JS 語法與差異檢查通過。未啟動全量 regression；未重新產生公開 Trace，因生成指紋與資料內容均未改變。

## 交付

前端 tween／iframe 版本同步更新，推送 intergration 並重啟 3100。main、Release 及公開 IP 部署不在此輪範圍。
