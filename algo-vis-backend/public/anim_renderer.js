// anim_renderer.js
;(function() {
  // 記錄上一幀的狀態：key = ID, value = { x, y, fill, text, opacity, rect }
  let frameSnapshot = {}; 
  // 記錄這一幀「有被用到」的 IDs (用來判斷哪些要刪除)
  let currentFrameActiveIds = new Set();

  window.Anim = {
    /**
     * 1. 在 CodeScript 執行前呼叫：快照目前 DOM 狀態
     */
    startStep: function() {
      frameSnapshot = {};
      const vp = window.getViewport();
      if (!vp) return;

      // 掃描目前畫面上所有有 ID 的元素
      vp.querySelectorAll('[id]').forEach(el => {
        const id = el.id;
        // 抓取關鍵屬性
        const rect = el.getBoundingClientRect(); // 螢幕絕對座標(用於處理跨容器移動)
        
        // 嘗試抓取文字內容 (優先抓 data-val，其次抓 textContent)
        let text = el.getAttribute('data-val') || el.textContent || "";
        
        // 抓取視覺屬性
        const fill = el.getAttribute('fill') || '';
        const opacity = el.getAttribute('opacity') || el.getAttribute('fill-opacity') || '1';
        
        // 抓取幾何屬性 (若是 SVG 元素)
        const x = parseFloat(el.getAttribute('x') || 0);
        const y = parseFloat(el.getAttribute('y') || 0);

        frameSnapshot[id] = {
            el: el, 
            x, y, fill, opacity, text,
            rawRect: rect
        };
      });

      // 重置當前幀活躍 ID 集合
      currentFrameActiveIds = new Set();
    },

    /**
     * 2. 提供給 draw_block 等函式呼叫：註冊這個 ID 在這一幀還活著
     */
    register: function(id) {
      if (id) currentFrameActiveIds.add(id);
    },

    /**
     * 3. CodeScript 執行完後呼叫：計算差異並執行動畫
     * @param {number} duration - 動畫時間 (ms)
     */
    endStep: function(duration = 300) {
      const vp = window.getViewport();
      if (!vp) return;

      // 取得執行完畢後的新 DOM 狀態
      const postState = {};
      const allNewElements = [];

      vp.querySelectorAll('[id]').forEach(el => {
          const id = el.id;
          postState[id] = el;
          if (!frameSnapshot[id]) {
              allNewElements.push(el); // 這是全新增的
          }
      });

      // === A. 處理移除 (Exit) ===
      // 在 snapshot 中有，但現在沒有被 register 的，代表這幀不需要了
      Object.keys(frameSnapshot).forEach(id => {
          // 如果新狀態沒有這個元素，或者有這個元素但這一輪沒被 register (可能是殘留的 DOM)
          if (!postState[id] || !currentFrameActiveIds.has(id)) {
              
              const oldData = frameSnapshot[id];
              // 只有 block 或 arrow 這類視覺元素才做消失動畫
              if(id.includes('block') || id.includes('arrow') || id.includes('cell')) {
                 // 如果 DOM 還在 (只是沒被 register)，就用原本的；如果不在了，就克隆一個
                 let ghost = postState[id] || oldData.el.cloneNode(true);
                 
                 // 如果是剛被 remove 的，需要加回去讓它做動畫
                 if (!ghost.parentNode) {
                    const parent = document.getElementById(id.split('-')[0]) || vp; // 嘗試掛回原本的 parent 或 vp
                    try { parent.appendChild(ghost); } catch(e) {}
                 }

                 // 設定為舊狀態，準備 fade out
                 ghost.style.transition = `all ${duration}ms ease-out`;
                 ghost.setAttribute('opacity', '1'); 
                 
                 // 強制重繪
                 ghost.getBoundingClientRect();

                 // 動畫目標：變透明、稍微縮小
                 ghost.setAttribute('opacity', '0');
                 ghost.style.transformOrigin = "center";
                 ghost.style.transform = "scale(0.5)"; // CSS transform 對 SVG 有效

                 // 動畫結束後移除
                 setTimeout(() => {
                     if(ghost.parentNode) ghost.parentNode.removeChild(ghost);
                 }, duration);
              } else {
                  // 其他雜項直接移除
                  if(postState[id] && postState[id].parentNode) {
                      postState[id].parentNode.removeChild(postState[id]);
                  }
              }
          }
      });

      // === B. 處理新增 (Enter) ===
      allNewElements.forEach(el => {
          // 初始狀態：透明、放大
          el.style.transition = 'none';
          const finalOpacity = el.getAttribute('opacity') || '1';
          
          el.setAttribute('opacity', '0');
          // el.setAttribute('transform', 'scale(1.2)'); // Optional: 進場特效
          
          el.getBoundingClientRect(); // Force reflow

          el.style.transition = `opacity ${duration}ms ease-out`;
          el.setAttribute('opacity', finalOpacity);
          // el.setAttribute('transform', 'scale(1)');
      });

      // === C. 處理更新 (Update / Move / Text Morph) ===
      Object.keys(postState).forEach(id => {
          if (frameSnapshot[id]) {
              const oldData = frameSnapshot[id];
              const el = postState[id]; 

              // 1. 文字改變動畫
              let newText = el.getAttribute('data-val') || el.textContent || "";
              if (oldData.text !== newText) {
                  const textEl = el.querySelector('text') || (el.tagName === 'text' ? el : null);
                  if (textEl) {
                      // 簡單的縮放效果：先縮小舊字 -> 換新字 -> 放大
                      // 但因為 DOM 已經是新字了，我們直接做 "彈一下" 的效果
                      textEl.style.transition = 'none';
                      textEl.style.transformOrigin = "center";
                      textEl.style.transform = "scale(1.5)"; // 瞬間變大強調
                      
                      textEl.getBoundingClientRect();

                      textEl.style.transition = `transform ${duration}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`; // BackOut
                      textEl.style.transform = "scale(1)";
                  }
              }

              // 2. 位置移動 (FLIP)
              const targetX = parseFloat(el.getAttribute('x') || 0);
              const targetY = parseFloat(el.getAttribute('y') || 0);

              if (oldData.x !== targetX || oldData.y !== targetY) {
                   // Invert: 算出位移差
                   // 注意：如果是在同一個 group 內，可以直接用 x, y 差值
                   // 這裡假設結構沒變，直接操作屬性
                   el.style.transition = 'none';
                   // 把視覺位置強制拉回舊的地方 (利用 CSS transform translate)
                   // 因為 SVG 的 x, y 屬性已經是新的了
                   // 這裡比較複雜，最簡單的方法是動畫 x 和 y 屬性本身
                   
                   // 方法一：利用 CSS transition SVG 屬性 (現代瀏覽器支援)
                   // 先設回舊值
                   el.setAttribute('x', oldData.x);
                   el.setAttribute('y', oldData.y);
                   
                   el.getBoundingClientRect(); // Reflow

                   // Play
                   el.style.transition = `x ${duration}ms ease-in-out, y ${duration}ms ease-in-out`;
                   el.setAttribute('x', targetX);
                   el.setAttribute('y', targetY);
              }

              // 3. 顏色改變
              const targetFill = el.getAttribute('fill');
              if (oldData.fill !== targetFill) {
                  // SVG 屬性漸變需要瀏覽器支援，或者用 CSS fill
                  // 如果我們用 attribute fill，需要確保 CSS transition 有吃到
                  // 這裡用一個通用的 style transition
                  el.style.transition = `fill ${duration}ms linear`;
                  // (屬性已經是新的了，CSS transition 會自動補間)
              }
          }
      });
    }
  };
})();