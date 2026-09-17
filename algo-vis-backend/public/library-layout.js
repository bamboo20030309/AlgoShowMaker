(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMLibraryLayout = api;
})(typeof window !== 'undefined' ? window : null, function () {
  function validate(value) {
    if (!value || !Array.isArray(value.folders) || !Array.isArray(value.unfiled) || value.folders.length > 200) throw new Error('資料夾格式不正確');
    const folderIds = new Set(), deckIds = new Set();
    function list(ids) {
      if (!Array.isArray(ids) || ids.length > 10000) throw new Error('投影片排序格式不正確');
      return ids.map(id => {
        if (typeof id !== 'string' || !id || id.length > 100 || deckIds.has(id) || deckIds.size >= 10000) throw new Error('投影片不可重複或超出限制');
        deckIds.add(id); return id;
      });
    }
    const folders = value.folders.map(folder => {
      if (!folder || typeof folder.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(folder.id) || folderIds.has(folder.id) || typeof folder.title !== 'string' || !folder.title.trim() || folder.title.trim().length > 80) throw new Error('資料夾名稱或識別碼不正確');
      folderIds.add(folder.id);
      return { id: folder.id, title: folder.title.trim(), deckIds: list(folder.deckIds) };
    });
    return { folders, unfiled: list(value.unfiled) };
  }
  function reconcile(value, ids) {
    let layout;
    try { layout = validate(value); } catch { layout = { folders: [], unfiled: [] }; }
    const allowed = new Set(ids), used = new Set();
    function keep(list) { return list.filter(id => { if (!allowed.has(id)) return false; used.add(id); return true; }); }
    layout.folders.forEach(folder => { folder.deckIds = keep(folder.deckIds); });
    layout.unfiled = keep(layout.unfiled);
    layout.unfiled.push(...ids.filter(id => !used.has(id)));
    return layout;
  }
  function move(layout, id, destination, before = null) {
    const next = validate(layout);
    const target = destination ? next.folders.find(folder => folder.id === destination)?.deckIds : next.unfiled;
    if (!target || ![...next.unfiled, ...next.folders.flatMap(folder => folder.deckIds)].includes(id)) throw new Error('找不到投影片或資料夾');
    if (before === id) return next;
    for (const list of [next.unfiled, ...next.folders.map(folder => folder.deckIds)]) {
      const index = list.indexOf(id); if (index !== -1) list.splice(index, 1);
    }
    const index = before ? target.indexOf(before) : -1;
    target.splice(index < 0 ? target.length : index, 0, id);
    return next;
  }
  return { validate, reconcile, move };
});
