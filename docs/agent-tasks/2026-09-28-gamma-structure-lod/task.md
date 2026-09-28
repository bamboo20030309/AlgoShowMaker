# Gamma：結構 LOD 與字型批次讀取

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準：cdc5f94（接續上一輪 gamma 已推送版本；完整 SHA 見交付紀錄）
- 分支：codex/2026-09-22-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 問題與預期結果
- 使用者要求依前一輪建議：同一結構共用字型設定、建立前略過低細節文字、概覽合併底層繪製。
- 耗時只看收到編譯回應至畫布呈現，不含編譯。
- 普通陣列／矩陣按實際螢幕尺度切換 full/simple/overview。預設界線 28px／8px；回程 24px／10px 防抖。
- simple 無數值及索引文字；overview 將基底色塊合併為每色 path，隱藏逐格底層的 stroke/fill，保留定位與點選 rect。
- highlight/point/mark 與指標繼續獨立繪製。
- 未明確要求擴及其他結構 renderer；复杂格式、獨立 Fabric table 與播放轉場本次保留完整細節。

## 調查與邊界
- fitSvgText 命中快取前每次仍讀 computed style；改為 renderer callback 內每個群組一份不可變字型快照。
- 在初次 renderer 前以 model 長度估計普通結構尺度；鏡頭穩定後用 getScreenCTM 校正。
- 不在動畫鏡頭的中途恢復全部文字；transform 停止 80ms 後按 rAF 更新。
- LOD 僅暫存 DOM 資料，不寫進 trace／投影片；不直接刪除格子的定位資料。
- 修改：trace-structure-lod.js、trace-renderer.js、draw_block.js、draw_array_utils.js、入口資產版本及相關小測試。

## 驗收條件
- [x] 500 格陣列／50×50 矩陣初始 overview 不建立格內文字。
- [x] 1x 放大後 3000 格數值都是 0，0.4x 與 0.1x 分別回到 simple／overview。
- [x] 3000 格 placement 前後相同。
- [x] highlight 紅框獨立保留，不被納入底層合併。
- [x] 縮圖保留 LOD 恢復資料與唯一 ID，原 RUN／儲存重開／false 設定斷言仍通過。
- [x] 前端同口徑三次效能量測。

## 驗證計畫與範圍
- V2；隔離服務及瀏覽器，單一使用者 fixture 與既有小型事件可用性案例。
- 不跑完整 regression，主代理補複合結構與動畫中途操作。
- 普通投影片入口僅共享字型工具與 draw_block 版本；未載入 LOD 模組，因此不改普通投影片 LOD。

## 變更紀錄
- 2026-09-28：初始定義。保留格子定位節點，不宣稱全面 DOM 虛擬化。
