# Bottom-up Heap 同格指標入場

## 原因

公開 Heap 教材的 Bottom-up 第3→4幀，largest 的執行初值為5，後續 largest=left 才改為10。但畫面有三個交接缺口：

- appearanceStart=0 被略過，未建立暫時的視覺入場時鐘，所以 now 未按新增同格指標補位。
- 事件通知等待 microtask 時，箭頭先更新但位移輸出尚未公布，largest 的第一個可見畫面會先在目的幀最終第10格出現，下一次更新才回到第5格。
- label 錨點只在 outgoing 指標使用，存續的 now 讓位時仍用另一套端點計算，因此箭頭朝左偏。

## 修正

接受0毫秒的合法入場時間，沿用共用指標排程加入群組；通知尚未可用時也先公布初始位移。largest 從第一次可見就由第5格上方入場，now 同步讓位。label 錨點模式同時作用於存續及離場指標，維持其垂直方向；target 錨點仍沿用格子中心行為。

不改 C++、Trace 格式、生成指紋、事件順序或播放速度，也不新增持久化的假 runtime 事件。既有資料載入新版播放器即可生效。

## 驗證

- 新增 heap-pointer-peer-entry.browser.test.js：實際載入及序列化公開 Bottom-up Trace，1／4倍速核對第3→4幀。largest 首次可見位置為原 now 中心右側13px、從同一列上方入場；兩標籤完成入場後以第5格為中心分槽。now 在 largest 出現之後所有可見採樣中，箭頭水平位移絕對值小於0.001、垂直位移大於0。修改前可重現失敗。
- 定向核對 initializer-visibility、pointer-event-reflow、pointer-exit-arrow 三份既有瀏覽器驗證，涵蓋新建／舊資料初始化、快速排序讓位、列指標、延後入場與正常退場。
- 僅相關V2，不跑完整V3；測試產物及log不提交。同步獨立動畫頁及投影片 runtime／編輯器快取版本。

上述10個定向瀏覽器案例全部通過，JavaScript語法及差異檢查通過。

完成後推送 intergration、重啟核對3100；main／3000及Release不變。
