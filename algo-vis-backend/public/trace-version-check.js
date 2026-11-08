/** 同一個頁面的載入、播放與匯出共用版本檢查；成功結果短暫快取，失敗可立即重試。 */
(function () {
  let pending, checkedAt = 0;
  function check({ force = false } = {}) {
    if (pending) return pending;
    if (!force && checkedAt && Date.now() - checkedAt < 5000) return Promise.resolve();
    pending = fetch('/api/trace/version', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw Error('無法確認追蹤引擎版本，請稍後重試');
      window.ASMTraceProvenance.configure(await response.json());
      checkedAt = Date.now();
    }).catch(error => { checkedAt = 0; throw error; }).finally(() => { pending = null; });
    return pending;
  }
  window.ASMTraceVersionCheck = { check };
})();
