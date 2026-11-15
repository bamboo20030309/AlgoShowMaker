#!/usr/bin/env node
'use strict';
const fs = require('node:fs/promises'), path = require('node:path');
global.ASMTraceProvenance = require('../../public/trace-provenance');
const A = require('../../public/asmdeck');
const { buildDefaultAlgorithmAssets } = require('./default-algorithm-assets');
(async () => {
  const deck = await A.decode(new Blob([await fs.readFile(path.join(__dirname, '../../public/guest-decks/linear-sieve.asmdeck'))]));
  await buildDefaultAlgorithmAssets(deck.deck);
  console.log('Default linear sieve recipe published without Trace payloads');
})().catch(error => { console.error(error); process.exitCode = 1; });
