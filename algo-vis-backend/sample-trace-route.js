const fs = require('node:fs');
const path = require('node:path');
const { validId, filenameFor } = require('./public/sample-trace-assets');

// Keep old /deck-traces/<id>.json links usable after files acquire readable names.
function registerSampleTraceRoute(app, publicRoot) {
  app.get('/deck-traces/:filename', (req, res, next) => {
    const id = req.params.filename.replace(/\.json$/, '');
    if (!validId(id) || req.params.filename !== id + '.json') return next();
    try {
      const indexFile = path.join(publicRoot, 'deck-traces/index.json');
      if (!fs.existsSync(indexFile)) return next();
      const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
      if (!Object.hasOwn(index.traces || {}, id)) return next();
      return res.redirect(302, '/deck-traces/' + filenameFor(index, id));
    } catch (error) { next(error); }
  });
}
module.exports = { registerSampleTraceRoute };
