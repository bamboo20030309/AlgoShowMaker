'use strict';

// Shared inventory: both the playback driver and resumable runner read this list.
const animationCases = [
  { name: 'arrow-identity', fixture: 'tests/fixtures/arrow-identity.cpp', input: '' },
  { name: 'quick-style-swap', fixture: 'tests/fixtures/quick-style-swap.cpp', input: '6\n5 7 2 1 9 4\n', frameLimit: 5 },
  { name: 'insertion-style-labels', fixture: 'tests/fixtures/insertion-style-labels.cpp', input: '6\n1 8 7 2 6 5\n', frameLimit: 6 },
  ...['defaults', 'style-frame-completion', 'recursive-roles', 'function-call', 'highlight-swap'].map(name => ({ name, fixture: `tests/fixtures/${name}.cpp`, input: '' })),
  ...['bubble', 'insertion', 'selection', 'heap', 'quick-recursion'].map(name => ({ name, fixture: `tests/fixtures/${name}.cpp`, input: '4\n4 1 3 2\n' })),
  { name: 'merge-recursive', playbackRate: 4, fixture: 'algorithm_sample/Sorting/merge_sort_recursive_layout.cpp', input: '4\n4 1 3 2\n', expectedState: { variable: 'num', items: [1,2,3,4] } },
  { name: 'merge-bottom-up', playbackRate: 4, fixture: 'algorithm_sample/Sorting/merge_sort_bottom_up.cpp', input: '4\n4 1 3 2\n', expectedOutput: '1 2 3 4' },
  { name: 'queens-array', playbackRate: 4, frameLimit: 12, fixture: 'algorithm_sample/Backtracking/8queen-array-teaching.cpp', input: '4', expectedOutput: 'Total Solutions: 2' },
  { name: 'bit-query', playbackRate: 4, fixture: 'algorithm_sample/Tree/Binary_Indexed_Tree_Range_Query.cpp', input: '4\n4 1 3 2\n2 4\n', expectedOutput: 'sum of L to R = 6' },
  { name: 'segment-query', playbackRate: 4, fixture: 'algorithm_sample/Tree/Segment_Tree_easy.cpp', input: '4 1\n4 1 3 2\n2 4\n', expectedOutput: '6' },
  { name: 'lcs-matrix', playbackRate: 4, fixture: 'algorithm_sample/DP/LCS.cpp', input: 'AB\nAC\n', expectedOutput: '1 1 1 1 1 A' },
  { name: 'queens-bits', playbackRate: 4, frameLimit: 16, fixture: 'algorithm_sample/Backtracking/8queen_recursion.cpp', input: '4', expectedOutput: 'Total Solutions: 2' }
];
const prerequisites = [
  { label: 'cloud-storage-browser', module: './cloud-storage-browser', entry: 'runCloudStorageBrowser' },
  { label: 'slide-order-toggle', module: './slide-order-browser', entry: 'runSlideOrderBrowser' },
  { label: 'deck-import-repair', module: './deck-import-browser', entry: 'runDeckImportBrowser' }
];

function domain(file) {
  if (/regression|validation/.test(file)) return 'tooling';
  if (/compile|artifact|auth|payload|protection|watchdog/.test(file)) return 'backend';
  if (/performance|progressive|chunk|lod|default-algorithm/.test(file)) return 'performance';
  if (/guest|sample|teaching/.test(file)) return 'samples';
  if (/slide|widget|clipboard|table|inline|latex|text-deselection/.test(file)) return 'editor';
  return 'trace';
}
function inventory(root) {
  const fs = require('node:fs'), path = require('node:path');
  return fs.readdirSync(path.join(root, 'tests')).filter(name => name.endsWith('.test.js')).sort().map(name => {
    const file = `tests/${name}`, source = fs.readFileSync(path.join(root, file), 'utf8');
    const browser = /playwright|chromium/.test(source);
    const service = /ASM_TEST_BASE_URL|server\.js|helpers\/compile|\/compile|trace\/analyze/.test(source);
    const dependencies = [...source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)].map(match => path.relative(root, path.resolve(root, 'tests', match[1])).replaceAll('\\', '/'));
    const fixtures = (fs.existsSync(path.join(root, 'tests/fixtures')) ? fs.readdirSync(path.join(root, 'tests/fixtures'), { withFileTypes: true }) : []).filter(entry => entry.isFile() && source.includes(entry.name)).map(entry => 'tests/fixtures/' + entry.name);
    return { file, dependencies, fixtures, domain: domain(file), level: domain(file) === 'editor' ? 'V1' : 'V2',
      browser, service, compiler: service && !/guest-gallery-contract/.test(file),
      cost: browser ? 'browser' : service ? 'service' : 'unit',
      dependencyPolicy: browser ? 'all frontend/backend + referenced inputs' : service ? 'backend/trace + referenced inputs' : 'local requires + referenced inputs' };
  });
}
module.exports = { animationCases, prerequisites, inventory };
if (require.main === module) console.log(JSON.stringify({ tests: inventory(require('node:path').resolve(__dirname, '..')), animationCases, prerequisites }, null, 2));
