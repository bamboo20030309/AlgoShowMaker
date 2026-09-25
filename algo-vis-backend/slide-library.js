/**
 * 使用者投影片資料夾與排序 API。
 *
 * 版面資料存在使用者 preferences，但每次讀寫都會和實際擁有的 deck 清單
 * reconcile。PUT 會先驗證結構與所有權，避免前端送入不存在或屬於他人的 ID。
 */

const Layout = require('./public/library-layout');

// -----------------------------------------------------------------------------
// 掛載讀取與更新端點；兩者都必須先通過 JWT 身分驗證。
// -----------------------------------------------------------------------------
module.exports = function mountSlideLibrary(app, { authenticateToken, User, SlideDeck }) {
  app.get('/api/slide-library', authenticateToken, async (req, res) => {
    try {
      const [user, decks] = await Promise.all([
        User.findById(req.user.id).select('preferences').lean(),
        SlideDeck.find({ user_uid: req.user.id }).select('deck_uid').sort({ updated_at: -1 }).lean()
      ]);
      if (!user) return res.status(404).json({ error: '找不到使用者' });
      res.json({ layout: Layout.reconcile(user.preferences?.slideLibrary, decks.map(deck => deck.deck_uid)) });
    } catch (error) { res.status(500).json({ error: '無法讀取資料夾與排序' }); }
  });
  app.put('/api/slide-library', authenticateToken, async (req, res) => {
    let layout;
    try { layout = Layout.validate(req.body?.layout); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    try {
      const decks = await SlideDeck.find({ user_uid: req.user.id }).select('deck_uid').sort({ updated_at: -1 }).lean();
      const owned = new Set(decks.map(deck => deck.deck_uid));
      if ([...layout.unfiled, ...layout.folders.flatMap(folder => folder.deckIds)].some(id => !owned.has(id))) return res.status(400).json({ error: '包含不存在或不屬於你的投影片，請重新整理' });
      layout = Layout.reconcile(layout, decks.map(deck => deck.deck_uid));
      const user = await User.findOneAndUpdate({ _id: req.user.id }, { $set: { 'preferences.slideLibrary': layout } }, { new: true }).select('_id');
      if (!user) return res.status(404).json({ error: '找不到使用者' });
      res.json({ layout });
    } catch (error) { res.status(500).json({ error: '無法儲存資料夾與排序，請再試一次' }); }
  });
};
