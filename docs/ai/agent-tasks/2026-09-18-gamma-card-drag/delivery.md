# gamma-card-drag 交付驗證紀錄

## 交付資訊
- 主代理核實：已合併 intergration，受測程式 68b3cc847c7104c1f33cfeba56e8ee477e2be289；詳見 [整合驗證紀錄](../2026-09-18-library-category-focus-integration.md)。
- 狀態：小驗證通過，待主代理核實
- 分支：codex/2026-09-18-gamma
- 共同基準 commit：d355a25bbcd5d464aafd16064d947c6d65524d61
- 程式修正 commit：5714e80cf80c64cbf4c49503e0767dd380d9b36e
- 驗證版本：此程式 commit 內容，提交前執行；之後只有文件更新。
- 驗證日期：2026-09-18

## 根因與修改
- 原 pointerdown 僅接受把手，整張卡片其餘部分依賴 native HTML drag；內嵌圖片、按鈕與文字行為不同。
- 將 pointer 起點擴至整張 deck-card，移動超過6px才捕捉 pointer 及開始拖動，維持普通點擊功能；input／select 不劫持。
- 拖曳後抑制同一手勢的 click，避免誤開投影片或設定；新的 pointerdown 清除抑制，鍵盤 click 不受影響。
- 取消與 lostpointercapture 清除狀態；圖片不獨立拖曳，已由 pointer 處理時取消 native dragstart。
- library-organizer.js：拖曳；home.css：游標與來源回饋；index.html／entrypoints：快取；library-folders.browser.test.js：全卡片實際滑鼠驗證。
- README／版本紀錄：不適用，原本卡片整理操作範圍擴大，不改 API。
- 與 task.md 差異：無。

## 驗收條件對照
| 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 整張卡片各區可拖曳 | 真實 mouse.down/move/up 從資訊、標題、卡片底部空白、縮圖、設定按鈕及把手 | 每次 a,c,b 與 c,a,b 交替排序符合預期 | 通過 |
| 拖動不誤點／正常點擊仍有效 | 每次拖後檢查 URL 與設定 dialog；既有開啟、命名測試 | 未誤開頁面／設定；普通點擊可命名及導向編輯頁 | 通過 |
| 既有整理維持 | 工作區全案例 | 選單、跨資料夾移動、儲存失敗恢復、重開與窄螢幕均通過 | 通過 |

## 驗證分級與選擇
- V1/B，工作區拖曳與點擊；A 入口版本檢查。
- 不修改演算法或動畫，依使用者要求不執行大型 regression／animation suite。

## 小驗證與重跑方式
- 目錄：此 worktree 的 algo-vis-backend。
- 指令：node --test tests/library-folders.browser.test.js tests/entrypoints.test.js
- 結果：2/2 通過，0 skip，exit 0。
- node --check public/library-organizer.js、git diff --check：exit 0。
- 隔離：隨機埠服務、獨立 Edge context、合成卡片與 mock API；不操作使用者資料庫或私人投影片。
- 必要環境：npm dependencies 與 Edge。
- 證據：提交的既有瀏覽器案例新增六個起點與點擊斷言；無提交 log／test-results。

## 剩餘事項與合併注意
- 未驗證：實機觸控从卡片內文的手勢；原把手 touch-action:none 與手機選單替代操作保留。
- 已知限制：資料夾下拉選單保留選取行為，不作為 pointer 拖曳起點。
- 共用 organizer、home.css、index.html 與入口快取版本需主代理整合核對。
- 主代理需補：實機觸控与整合後完整回歸。

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
