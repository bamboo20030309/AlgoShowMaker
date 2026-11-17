# Gamma 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準：74bbda71e1168e0d9054719d4f2d3f93b3096c82
- 程式修正 commit：7344de1001e5e74d7a9b39387f0f62a5ec63635f
- 驗證日期：2026-09-28
- 測試內容與上述程式提交一致，文件另行提交。

## 根因與修改
- 原 RUN 載入一幀後自動 Studio.open，依序產生主畫布、Studio 畫布、事件檢查、縮圖四次完整場景。
- 成功 RUN 改為畫布分頁，openStudio:false 只傳入 RUN 路徑，其餘載入入口維持原預設。
- 當 RUN 已在 Studio，先完成原有保存並關閉編輯布局，避免先渲染舊場景。
- fitSvgText 使用最多 4096 筆結果快取：文字、範圍、字型家族／字重／字距等繼承樣式入 key；字型載入／失敗清空，不快取脫離 DOM 或估算寬度結果。
- event availability 重用目前 placements/elements；最近兩個場景保留前幀定位。不適用時沿用隱藏場景計算。
- Studio 只重用同 document/frame、仍連接且已完成的場景；存在 hidden 狀態時重新繪製。
- 目前穩定幀縮圖 clone SVG、重映射 ID 與內部 url/href、移除 viewport culled 標记。其他幀仍用 renderer，未宣稱所有縮圖都不用建立。
- 未對任意 SVG getBBox 直接快取，避免動畫、尺寸變化導致失效資料。
- HTML 三入口同步字型工具版本；renderer build 與測試預期同步。

## 小驗證與重跑
執行目錄為本 worktree/algo-vis-backend。
- node --check public/compile.js
- node --check public/trace-editor.js
- node --check public/trace-studio.js
- node --check public/trace-renderer.js
- node --check public/draw/draw_array_utils.js
- git diff --check
以上通過。
- node --test tests/scene-load-performance.browser.test.js tests/entrypoints.test.js：2 pass、0 fail、0 skip。
- node -e "process.env.ASM_VERIFY_PREFLIGHT='1'; require('./tests/studio-virtual-rail.browser.test.js')"：內層事件可用性與外層 500 幀縮圖各 1 pass，0 fail、0 skip。
- 隔離隨機埠服務、Edge headless 1440×900；測試 finally 關閉自建服務及瀏覽器。
- 功能斷言：RUN 畫布／Studio 關閉；3000 格；手動 open 不增加 renderFrame；縮圖 3000 格、0 重複 ID、0 裁切標記；字型／字距改變重新計算；hidden 場景重建並保留原編輯灰化。
- 測試修正歷程：共用工具的首頁／slides 資產版本起初遺漏，補齊；Studio 隱藏 RUN，重跑路徑改呼叫同 handler；新測試原先誤以為 hidden thumbnail 移除節點，依既有實作改驗證 editing ghost 與 fallback。未修改原事件可用性斷言。

## 效能測量（使用者原始 fixture）
- 500 格 vector + 50×50 vector，一幀，autoFixedEnabled=false、autoLoopBoundaryEnabled=false。
- 原三次 RUN：6770.8 / 6592.5 / 7937.3 ms。
- 修改後三次 RUN：2307.9 / 2263.3 / 2213.6 ms。
- 測量端點：RUN handler 至 loading 結束再經兩個 rAF，包含編譯與前端，不含首頁下載。
- 場景建立四次降為一次；新單次 renderScene：366.0 / 345.7 / 338.3 ms。
- 另次細部量測：getComputedTextLength 55632 次／2811.7 ms → 1694 次／69.4 ms；getBBox 14417 次／230.9 ms → 3604 次／30.3 ms。
- 文字／邊界時間包含於場景時間，不得疊加。不同輪有負载差異，含工具開銷，非普遍效能保證。
- 手動 Studio.open 同步處理測得 115.4 ms（不含之後非同步縮圖完成）。
- 證據：提交的直接相關 browser test；細部量測工具／JSON 只留本機 algo-vis-backend/test-results/culling-profile，不提交且非永久保存。原始第一輪 JSON 已被後續量測覆寫，前後數字依本輪工具紀錄保留在此。

## 相容性與限制
- 無新持久化欄位；原 fixture 即無新增欄位的既有資料，RUN、使用、JSON 保存與重開完成，兩個明確 false 保留。
- 自訂字型與字距快取結果與清空後量測相等。
- 未執行完整 regression；未驗證公開 Docker／遠端資料庫。
- 主代理補核實複合結構、動畫中途進入 Studio、跨幀自訂樣式。

## 本機服務
- 一般沙箱 Windows 登入錯誤 1909，使用核准環境執行。
- 3103 經唯一臨時檔 HTTP 回讀確認 gamma worktree，監聽 PID 81256；核對不變後只停止該 PID。
- 沿用 .env、PORT=3103，背景新程序 PID 72932；HTTP 與 trace-230／syntax-8 已核實。
- 未動 main／intergration／其他代理服務，未公開部署。

## 主代理核實與整合
- 狀態：尚未核實
- 合併 commit、整合驗收：待主代理填写
