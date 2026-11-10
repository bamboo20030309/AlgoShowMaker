// -----------------------------------------------------------------------------
// 投影片庫版面純函式
// 負責資料夾與未分類 deck 的正規化、搬移與排序，不直接存取 DOM 或網路。
// -----------------------------------------------------------------------------
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMLibraryLayout = api;
})(typeof window !== 'undefined' ? window : null, function () {
  // -----------------------------------------------------------------------------
  // 版面 schema 驗證
  // 清除重複或非法 id，並保留資料夾名稱與明確排序，產生可安全操作的副本。
  // -----------------------------------------------------------------------------
  function validate(value) {
    if (!value || !Array.isArray(value.folders) || !Array.isArray(value.unfiled) || value.folders.length > 200) throw new Error('資料夾格式不正確');
    const folderIds = new Set(), categorized = new Set();
    let memberships = 0;
    function list(ids) {
      if (!Array.isArray(ids) || ids.length > 10000) throw new Error('投影片排序格式不正確');
      const deckIds = new Set();
      return ids.map(id => {
        if (typeof id !== 'string' || !id || id.length > 100 || deckIds.has(id) || ++memberships > 10000) throw new Error('同一分類內投影片不可重複或超出限制');
        deckIds.add(id); return id;
      });
    }
    const folders = value.folders.map(folder => {
      if (!folder || typeof folder.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(folder.id) || folderIds.has(folder.id) || typeof folder.title !== 'string' || !folder.title.trim() || folder.title.trim().length > 80) throw new Error('資料夾名稱或識別碼不正確');
      folderIds.add(folder.id);
      const deckIds = list(folder.deckIds); deckIds.forEach(id => categorized.add(id));
      return { id: folder.id, title: folder.title.trim(), deckIds };
    });
    const unfiled = list(value.unfiled);
    if (unfiled.some(id => categorized.has(id))) throw new Error('已分類投影片不可同時列入未分類');
    return { folders, unfiled };
  }
  // -----------------------------------------------------------------------------
  // Deck 清單對帳
  // 移除已不存在的 deck，新增的 id 放入未分類區。每份投影片只屬於一個分類：
  // 舊資料若同一 id 出現在多個資料夾，保留第一個資料夾、其餘移除（下次儲存時寫回）。
  // -----------------------------------------------------------------------------
  function reconcile(value, ids) {
    let layout;
    try { layout = validate(value); } catch { layout = { folders: [], unfiled: [] }; }
    const allowed = new Set(ids), used = new Set();
    function keep(list) { return list.filter(id => { if (!allowed.has(id) || used.has(id)) return false; used.add(id); return true; }); }
    layout.folders.forEach(folder => { folder.deckIds = keep(folder.deckIds); });
    layout.unfiled = keep(layout.unfiled);
    layout.unfiled.push(...ids.filter(id => !used.has(id)));
    return layout;
  }
  // -----------------------------------------------------------------------------
  // 搬移與資料夾刪除
  // move 先從所有容器移除該投影片（唯一分類），再依 before 插入目的地；純函式回傳新版供 UI 提交。
  // source 參數保留給舊呼叫端，不再影響結果。
  // -----------------------------------------------------------------------------
  function move(layout, id, destination, before = null, source = null) {
    const next = validate(layout);
    const container = () => destination ? next.folders.find(folder => folder.id === destination)?.deckIds : next.unfiled;
    if (!container() || ![...next.unfiled, ...next.folders.flatMap(folder => folder.deckIds)].includes(id)) throw new Error('找不到投影片或資料夾');
    if (before === id) return next;
    next.folders.forEach(folder => { folder.deckIds = folder.deckIds.filter(item => item !== id); });
    next.unfiled = next.unfiled.filter(item => item !== id);
    const target = container();
    const index = before ? target.indexOf(before) : -1;
    target.splice(index < 0 ? target.length : index, 0, id);
    return validate(next);
  }
  function removeFolder(layout, folderId) {
    const next = validate(layout), removed = next.folders.find(folder => folder.id === folderId);
    next.folders = next.folders.filter(folder => folder.id !== folderId);
    const remaining = new Set(next.folders.flatMap(folder => folder.deckIds));
    next.unfiled.push(...(removed?.deckIds || []).filter(id => !remaining.has(id) && !next.unfiled.includes(id)));
    return validate(next);
  }
  return { validate, reconcile, move, removeFolder };
});
