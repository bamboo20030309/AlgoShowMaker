# Gamma 結構 LOD 交付紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準：cdc5f940c49aa1dc02a1ffcad2730ed60b7ed34d
- 程式修正 commit：500c119a64f58c1b55c546469428980b086349fb
- 驗證日期：2026-09-28；驗證內容與此程式提交一致，文件另提交。

## 實作
- 字型批次快照：每個 renderer 群組只讀一次繼承文字樣式，finally 清除批次狀態；共用字串快取仍依字型等完整設定區分。
- 新 LOD 模組以 model 粗估初始大小，後續使用實際 screen CTM；28/8px 分層、24/10px 回程防抖。
- 放大補建數值與索引，縮小移除；原值保存在暫存 records。定位 rect 保留，明確 metadata bounds 不依賴文字。
- 概覽每色合成 path，原 base rect 的 fill/stroke 不繪製但保留 hit target；style/pointer 獨立保留。
- 相機 transform 停止 80ms 後才切 LOD，避免自動縮放途中先建全文字。使用 rAF 批次刷新。
- 縮圖 clone 同步複製 LOD 暫存資料，縮圖鏡頭變化仍能恢復文字。非當前縮圖 renderer 可直接選低細節。
- 不改模型／持久化資料格式。轉場、複雜顯示模板／多欄 fields、自訂文字樣式等不適用者保留完整 renderer；本次不是全面 DOM 虛擬化。

## 驗證分級與重跑
- V2；執行目錄：本 worktree/algo-vis-backend。
- node --check public/trace-structure-lod.js
- node --check public/trace-renderer.js
- node --check public/draw/draw_array_utils.js
- node --check public/draw/draw_block.js
- git diff --check
以上通過。
- node --test tests/scene-load-performance.browser.test.js：1 pass，0 fail/skip。
- node --test tests/entrypoints.test.js：1 pass，0 fail/skip。
- node -e "process.env.ASM_VERIFY_PREFLIGHT='1'; require('./tests/studio-virtual-rail.browser.test.js')"：內層事件可用性與外層縮圖各 1 pass，0 fail/skip。
- 隔離隨機埠服務／Edge headless 1440×900；未操作使用者分頁。

## 驗收對照
- RUN 不開 Studio、3000 格、overview 初始無值文字：通過。
- 放大 1x 恢復 3000 個 0；縮到 0.4x simple／0.1x overview：通過。
- 全部 cell placement 前後比較相等：通過。
- 矩陣紅色 highlight 維持獨立，未套 base-rect suppression／batch：通過。
- 目前縮圖複製保留3000格、無重複 ID／culling 殘留：通過。
- 原始資料無新欄位，JSON 保存再載入後原明確 false 設定保留：通過。
- 自訂字型／字距測試與原事件可用性斷言：通過。
- 本機截圖核實矩陣與陣列 full／overview；早先任意鏡頭位置未對準物件，改為實際 SVG 矩陣中心後確認。

## 效能
- 使用者原例：500 格陣列＋50×50 矩陣，單幀。
- 起點：前端收到 /compile 回應；終點：handler 完成後兩個 rAF。包含 JSON，不含編譯。這是呈現完成近似，非精確螢幕像素提交時刻。
- 前一版三次：785.5 / 407.5 / 434.3 ms。
- 本版三次：198.1 / 198.7 / 201.3 ms。
- renderScene：143.2 / 142.4 / 140.7 ms。
- 初始 fitSvgText：3602 次 → 2 次（仍顯示兩個結構標題），本版 3.2～3.7ms。
- 先前開發中有初始 camera 中途恢復全文字，已改成等 transform 穩定，以上為修正後結果。
- 數字含量測開銷與當時本機負載，不保證其他 fixture 相同比例。
- 工具與截圖位於本機 algo-vis-backend/test-results/culling-profile：frontend.cjs/frontend.json、lod-full.png、lod-overview.png。未提交、非永久保存；三次數字以上述紀錄留存。

## 剩餘驗證與整合
- 未跑完整 regression。主代理需核實動畫中途進入 Studio、複合結構及大範圍樣式組合。
- 不涵蓋獨立 Fabric table 的 LOD；其腳本僅更新共用工具版本。
- 3103 核對原 PID 72932 絕對 server.js 路徑為 gamma 後重啟，現 PID 38000；HTTP 確認 trace-231 與 LOD 資產。
- 未變更 main/intergration，未部署公開服務。

## 主代理核實與整合（待填）
- 狀態：尚未核實
- 差異審查、合併 commit、整合驗證：待主代理填寫。
