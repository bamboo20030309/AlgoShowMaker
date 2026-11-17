// Retired public result URLs must never fall through to stale static files.
function registerSampleTraceRoute(app) {
  app.use('/deck-traces', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(410).json({ code: 'TRACE_NOT_FOUND', error: 'Trace 不再保存，請使用投影片中的程式碼與輸入重新執行' });
  });
}
module.exports = { registerSampleTraceRoute };
