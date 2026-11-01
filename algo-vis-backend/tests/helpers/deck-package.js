const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
function readPackage(bytes) {
  const magic = bytes.subarray(0,9).toString();
  if (!['ASMDECK1\n','ASMDECK2\n'].includes(magic)) throw new Error('Unknown deck header');
  const offset = magic === 'ASMDECK2\n' ? 13 + bytes.readUInt32LE(9) : 9;
  return JSON.parse(gunzipSync(bytes.subarray(offset)));
}
function savedTrace(body, animation, { presentation = true } = {}) {
  const directory = path.join(__dirname, '../../public/deck-traces');
  const index = JSON.parse(fs.readFileSync(path.join(directory, 'index.json'), 'utf8'));
  const result = animation.traceRef
    ? JSON.parse(fs.readFileSync(path.join(directory, require('../../public/sample-trace-assets').filenameFor(index, animation.traceRef))))
    : body.prebuiltTraces[animation.prebuilt.traceId];
  // The content-addressed result excludes per-slide presentation settings.
  // Rehydrate those settings just as the slide loader does before playback.
  return presentation ? { ...result, ...(animation.traceView || {}) } : result;
}
module.exports = { readPackage, savedTrace };
