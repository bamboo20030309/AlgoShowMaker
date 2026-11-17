const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
function readPackage(bytes) {
  const magic = bytes.subarray(0,9).toString();
  if (!['ASMDECK1\n','ASMDECK2\n'].includes(magic)) throw new Error('Unknown deck header');
  const offset = magic === 'ASMDECK2\n' ? 13 + bytes.readUInt32LE(9) : 9;
  return JSON.parse(gunzipSync(bytes.subarray(offset)));
}
// Existing visual contracts keep this synchronous fixture API. Its input now
// comes from real isolated execution, never from a saved public result file.
const runtimeResults = new Map();
function savedTrace(body, animation, { presentation = true } = {}) {
  const recipe = require('../../public/animation-recipe').strip(animation);
  if (!presentation) { delete recipe.traceView; delete recipe.rebuild; }
  const key = JSON.stringify(recipe);
  if (!runtimeResults.has(key)) {
    const child = require('node:child_process').spawnSync(process.execPath,
      [path.join(__dirname, 'execute-deck-animation.js')], {
        cwd: path.join(__dirname, '../..'), input: key, encoding: 'utf8',
        timeout: 120000, maxBuffer: 256 * 1024 * 1024, windowsHide: true,
      });
    if (child.status !== 0) throw new Error(`Isolated animation fixture execution failed: ${child.stderr || child.error || child.stdout}`);
    runtimeResults.set(key, JSON.parse(child.stdout));
  }
  return JSON.parse(JSON.stringify(runtimeResults.get(key)));
}

module.exports = { readPackage, savedTrace };
