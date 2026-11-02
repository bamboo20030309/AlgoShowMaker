'use strict';
const fs = require('node:fs');
const path = require('node:path');

const directory = path.resolve(__dirname, '../fixtures/event-contracts');

// Expected values are authored in the manifest. This helper never imports a
// product planner/renderer and never rewrites answers from observed results.
function loadManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.cases)) throw Error('Unsupported contract manifest');
  const ids = new Set();
  for (const item of manifest.cases) {
    if (ids.has(item.id)) throw Error('Duplicate contract ID: ' + item.id);
    ids.add(item.id);
    locateCase(manifest, item);
  }
  return manifest;
}

function locateCase(manifest, item) {
  const fixture = manifest.fixtures.find(candidate => candidate.id === item.fixture);
  if (!fixture) throw Error('Missing fixture: ' + item.fixture);
  if (path.basename(fixture.file) !== fixture.file) throw Error('Fixture path must be a filename');
  const filename = path.join(directory, fixture.file);
  const code = fs.readFileSync(filename, 'utf8');
  const lines = code.replace(/\r\n?/g, '\n').split('\n');
  const markerLine = lines.findIndex(line => line.trim() === '// CASE ' + item.marker);
  if (markerLine < 0) throw Error('Missing marker: ' + item.id);
  let sourceLine = markerLine + 1;
  if (item.expression?.startsWith('// @')) {
    while (sourceLine < lines.length && !lines[sourceLine].trim().startsWith('// @')) sourceLine++;
  } else {
    while (sourceLine < lines.length && (!lines[sourceLine].trim() || lines[sourceLine].trim().startsWith('//'))) sourceLine++;
  }
  if (sourceLine >= lines.length) throw Error('Marker has no source: ' + item.id);
  return { fixture, filename, code, markerLine: markerLine + 1, sourceLine: sourceLine + 1,
    source: lines[sourceLine].trim() };
}

// Strict subset comparison: every explicitly specified answer must exist and
// match. Arrays are ordered and retain repeated operands (b+b has two sources).
// Callers pass normalized observed fields; missing observations always fail.
function verifyEvent(actual, expected) {
  const failures = [];
  function compare(observed, answer, at) {
    if (Array.isArray(answer)) {
      if (!Array.isArray(observed)) { failures.push({ path: at, expected: answer, actual: observed, reason: 'missing-array' }); return; }
      if (observed.length !== answer.length) failures.push({ path: at + '.length', expected: answer.length, actual: observed.length });
      answer.forEach((value, index) => compare(observed[index], value, at + '[' + index + ']'));
    } else if (answer !== null && typeof answer === 'object') {
      if (observed === null || typeof observed !== 'object') { failures.push({ path: at, expected: answer, actual: observed, reason: 'missing-object' }); return; }
      for (const [key, value] of Object.entries(answer)) compare(observed[key], value, at ? at + '.' + key : key);
    } else if (!Object.is(observed, answer)) {
      failures.push({ path: at, expected: answer, actual: observed });
    }
  }
  compare(actual, expected, '');
  return { pass: failures.length === 0, failures };
}

module.exports = { directory, loadManifest, locateCase, verifyEvent };
