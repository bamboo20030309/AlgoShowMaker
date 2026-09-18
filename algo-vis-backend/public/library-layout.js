(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMLibraryLayout = api;
})(typeof window !== 'undefined' ? window : null, function () {
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
  function assign(layout, id, folderIds) {
    const next = validate(layout), selected = new Set(folderIds);
    if (folderIds.some(folderId => !next.folders.some(folder => folder.id === folderId))) throw new Error('找不到分類');
    next.folders.forEach(folder => {
      if (selected.has(folder.id)) { if (!folder.deckIds.includes(id)) folder.deckIds.push(id); }
      else folder.deckIds = folder.deckIds.filter(item => item !== id);
    });
    next.unfiled = next.unfiled.filter(item => item !== id);
    if (!selected.size) next.unfiled.push(id);
    return validate(next);
  }
  function move(layout, id, destination, before = null, source = null) {
    const next = validate(layout);
    const target = destination ? next.folders.find(folder => folder.id === destination)?.deckIds : next.unfiled;
    if (!target || ![...next.unfiled, ...next.folders.flatMap(folder => folder.deckIds)].includes(id)) throw new Error('找不到投影片或資料夾');
    if (before === id && source === destination) return next;
    if (!destination) {
      next.folders.forEach(folder => { folder.deckIds = folder.deckIds.filter(item => item !== id); });
    } else if (source && source !== destination) {
      const origin = next.folders.find(folder => folder.id === source);
      if (origin) origin.deckIds = origin.deckIds.filter(item => item !== id);
    }
    if (destination) next.unfiled = next.unfiled.filter(item => item !== id);
    if (before === id && target.includes(id)) return validate(next);
    const existing = target.indexOf(id); if (existing >= 0) target.splice(existing, 1);
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
  return { validate, reconcile, assign, move, removeFolder };
});
