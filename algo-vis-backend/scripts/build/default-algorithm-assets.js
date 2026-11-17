'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const Recipe = require('../../public/animation-recipe');
const FORMAT = 'AlgoShowMaker.default-animation', PACKAGE_VERSION = 2;
async function buildDefaultAlgorithmAssets(deck, options = {}) {
  const slide = deck.groups.flatMap(group => group.slides || []).find(slide => slide.animation);
  if (!slide?.animation?.code?.trim()) throw new Error('Default animation source is missing');
  const manifest = { format: FORMAT, packageVersion: PACKAGE_VERSION, id: 'linear-sieve', animation: Recipe.strip(slide.animation) };
  const directory = path.join(options.publicRoot || path.join(__dirname, '../../public'), 'default-animation');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
module.exports = { buildDefaultAlgorithmAssets, FORMAT, PACKAGE_VERSION };
