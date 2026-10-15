const express = require('express');
const path = require('node:path');

// Frontend-only checks need the production assets, not Mongo or compile workers.
async function startStaticUiServer(t) {
  const root = path.resolve(__dirname, '../..');
  const app = express();
  for (const [route, folder] of Object.entries({
    '/vendor/reveal': 'reveal.js/dist', '/vendor/fabric': 'fabric/dist',
    '/vendor/iro': '@jaames/iro/dist', '/vendor/ace': 'ace-builds/src-min-noconflict'
  })) app.use(route, express.static(path.join(root, 'node_modules', folder)));
  app.use(express.static(path.join(root, 'public')));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => {
    server.closeAllConnections();
    return new Promise(resolve => server.close(resolve));
  });
  return { base: `http://127.0.0.1:${server.address().port}` };
}
module.exports = { startStaticUiServer };
