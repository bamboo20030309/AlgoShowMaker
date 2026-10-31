# gamma-studio-lod 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實。
- 分支：codex/2026-09-22-gamma。
- 基準：6c2159909a3d53ba06198736e7a467c0c24aae56。
- 程式修正：40a20c9eb56f38a27fd980f94e0a96217dd7e5d4。
- 驗證版本：此commit的程式內容，測試時未提交；提交後只有任務文件修改。
- 日期：2026-09-28至2026-09-29。

## 根因與修改
closeStudio 原本只傳 animatePositions:false，renderFrame 會把未提供的 animateEvents 視為true，而canLod要求明確false。因此關閉第一次就失去LOD，與首尾事件剔除無關。

closeStudio穩定重繪改為同時animateEvents:false，保留LOD且不重播事件。真正播放路徑未修改。algorithm.html 的Studio資產升至trace-131，entrypoints同步。另擴充兩個現有局部browser測試。

不新增持久化欄位／操作介面，README不需更新；本文件記錄相容性與重跑方式。與task.md無範圍差異。

## 驗收與證據
| 條件 | 實際結果 | 判定 |
|---|---|---|
| 重現原問題 | 未修正時第一次close後LOD群組0，預期2，測試exit1 | 已重現 |
| 三次開關Studio | 每次關閉後LOD群組保持2 | 通過 |
| 縮放文字門檻 | 放大至24px補齊可見文字，縮小省略文字並恢復overview背景合併 | 通過 |
| 使用者棋盤 | 1000＋100×100、兩條明確grid[0:100][0:100]規則，11,000格與紅綠樣式保留 | 通過 |
| 舊檔及設定 | 舊trace首幀事件、明確關閉、自訂顏色、初始keep經載入與JSON存檔重開正常 | 通過 |
| 頁面錯誤 | 相關場景無pageerror／console error | 通過 |

## 重跑方式
在本worktree的algo-vis-backend，使用既有Node、g++、Playwright Edge。browser測試自行啟動隨機埠及独立頁面，不操作使用者分頁。

- `node --test tests/scene-load-performance.browser.test.js tests/trace-chunks.browser.test.js tests/entrypoints.test.js`：3/3，exit0；含marker preflight子測試1/1。
- 將棋盤style改為使用者明確範圍後，`node --test tests/trace-chunks.browser.test.js`：1/1，exit0；preflight 1/1。
- public/trace-studio.js及上述3個test JS的node --check、git diff --check：exit0。
- 本機證據：test-results/culling-profile/studio-lod-before.log、studio-lod-after.log、studio-lod-range-after.log。未提交，僅本機保留，不保證永久保存。
- 未跑完整regression及大規模動畫驗證。

## 交付與限制
- 無已知剩餘本次問題；不擴張原本LOD對其他renderer／自訂顯示格式的適用條件。
- 3103已核對完整gamma路徑後由PID13320重啟為79260，HTTP200及Studio trace-131已核實。
- 程式與文件將push origin/codex/2026-09-22-gamma，結果以交付訊息為準；未merge main/intergration或公開部署。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實。
- 核實commit及diff／必要重跑：待填。
- 合併commit、完整regression、投影片實際驗證：待填。
- 未完成或環境阻塞：待填。
- 整合服務重啟、Push及部署：待填。
