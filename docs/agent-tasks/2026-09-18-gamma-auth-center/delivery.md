# gamma-auth-center 交付驗證紀錄

## 交付資訊
- 主代理核實：已合併 intergration，受測程式 68b3cc847c7104c1f33cfeba56e8ee477e2be289；詳見 [整合驗證紀錄](../2026-09-18-library-category-focus-integration.md)。
- 狀態：小驗證通過，待主代理核實
- 分支：codex/2026-09-18-gamma
- 共同基準 commit：b3b9d9f51af858adf1ed40d8c0ea284755dc3982
- 程式修正 commit：2c33edf5cf07f04a35c7d577b209c9c089962489
- 驗證版本：此 commit 的內容，提交前執行；後續僅文件更新。
- 驗證日期：2026-09-18

## 根因與修改
- auth-panel 原本 align-self:center，以 guest-view 整個 grid 列高置中，因此左側範例列表拉長會推低登入區塊。
- 桌面改為 sticky、align-self:start，區塊高度使用視窗扣除頂部導覽列；flex safe center 將表單置中，短螢幕內容溢出時從頂部開始並可独立捲動。
- 窄螢幕單欄改將登入放第一列，避免先捲完整個範例列表才能登入；高度不足時採自然內容高度，登入上下留白相等。
- home.css：版面；index.html 與 entrypoints.test.js：快取版本；auth-center.browser.test.js：專屬測試。
- README／版本紀錄：不適用，登入功能不變的版面修正。
- 與 task.md 的差異：無。

## 驗收條件對照
| 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 長列表下桌面螢幕置中與捲動保持可見 | 1440×1000，合成 5000px 列表，scrollY=1200 | 區塊頂52／底1000；表單中心距內容區中心 <2px | 通過 |
| 短螢幕全部欄位可達 | 1440×450，切註冊並捲到表單底部 | 標題未被置中裁切，submit 可見於52至450內 | 通過 |
| 手機登入首先可見且獨立範例無空白欄 | 390×844，登入模式、examples=1 | 登入頂52／底844、中心偏差<2px；範例模式登入隱藏且畫廊頂52 | 通過 |

## 驗證分級與選擇
- V1/A：CSS 排版與入口版本；不涉及認證、動畫或演算法。
- 依使用者要求只執行最小版面檢查，不跑大規模驗證或演算法範例。

## 小驗證與重跑方式
- 執行目錄：此 worktree 的 algo-vis-backend。
- 完整指令：node --test tests/auth-center.browser.test.js tests/entrypoints.test.js
- Fixture：空 mock 範例目錄、左側合成 5000px 高度；不讀使用者資料。
- 隔離：隨機埠服務、獨立 Edge context；必要環境為 npm dependencies 与 Edge。
- 預期與實際結果：2/2 通過、0 skip、exit 0。
- 首次手機中心斷言失敗，原因為舊 CSS 上42／下54留白不對稱；改為48／48後重跑通過，未放寬容許值。
- git diff --check：exit 0。
- CSS-only，無修改 production JavaScript，node --check 不適用。
- 證據：提交專屬測試；本機 test-results/auth-center-desktop.png 與 auth-center-mobile.png 已檢視，不提交且不保證永久保存。

## 剩餘事項與合併注意
- 未驗證：手機實機軟鍵盤彈出、真實認證提交；本次未修改登入邏輯。
- 已知問題：無。
- 相依與衝突：home.css、index.html 與 entrypoints 版號由主代理核對整合。
- 主代理需補：實機登入、註冊、忘記密碼与整合完整回歸。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：待填
- 差異審查與必要重跑結果：待填
- 合併 commit：待填
- 完整 regression：未執行，由主代理負責
- 演算法投影片實際驗證：未執行，由主代理負責
- 未完成或環境阻塞：無開發阻塞
- 本機服務重啟：未執行，由主代理負責
- Push／公開部署狀態：gamma 分支依使用者授權 push；公開部署未執行
