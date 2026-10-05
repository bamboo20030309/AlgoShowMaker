'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { inventory, animationCases, prerequisites } = require('./validation-manifest');
const digest = value => createHash('sha256').update(value).digest('hex');

// Hash contents, not Git HEAD: uncommitted fixes must invalidate prior evidence too.
// Browser/service dependencies deliberately overapproximate dynamic script loading.
function captureEvidence(root, files, { environment, animation = true } = {}) {
  const cache = new Map();
  const hashFile = file => {
    if (!cache.has(file)) cache.set(file, fs.existsSync(path.join(root, file)) ? digest(fs.readFileSync(path.join(root, file))) : 'missing');
    return cache.get(file);
  };
  const walk = dir => !fs.existsSync(path.join(root, dir)) ? [] : fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', 'test-results', 'tmp', 'drafts', '.git'].includes(entry.name)) return [];
    const file = `${dir}/${entry.name}`.replace(/^\//, '');
    return entry.isDirectory() ? walk(file) : [file];
  });
  const backend = walk('').filter(file => !file.includes('/') && /\.(js|hpp|h|cpp)$/.test(file));
  const frontend = walk('public').filter(file => /\.(js|html|css)$/.test(file));
  const traceFrontend = frontend.filter(file => /trace-|asmdeck|draw\/|compile|canva|algorithm|animation/.test(file));
  const inputs = [...walk('tests/fixtures'), ...walk('algorithm_sample'), ...walk('public/guest-decks'), ...walk('public/default-animation'), 'public/guest-decks.json'];
  const known = [...backend, ...frontend, ...inputs, ...walk('tests/helpers'), ...walk('scripts')];
  const direct = new Map();
  function closure(initial) {
    const seen = new Set();
    function visit(file) {
      if (seen.has(file)) return;
      seen.add(file);
      const absolute = path.join(root, file);
      if (!fs.existsSync(absolute) || !/\.(js|cjs)$/.test(file)) return;
      if (direct.has(file)) { direct.get(file).forEach(visit); return; }
      const source = fs.readFileSync(absolute, 'utf8');
      const dependencies = [];
      for (const match of source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
        let dependency = path.relative(root, path.resolve(path.dirname(absolute), match[1])).replaceAll('\\', '/');
        if (!path.extname(dependency)) dependency += '.js';
        if (!dependency.startsWith('../')) dependencies.push(dependency);
      }
      // fs.readFileSync(path.join(root, '...')) and basename-based browser loaders.
      for (const candidate of known) if (source.includes(candidate) || source.includes(path.basename(candidate))) dependencies.push(candidate);
      if (/fixtures[^\n]*\+|fixture\(/.test(source)) for (const input of inputs.filter(f => f.startsWith('tests/fixtures/'))) dependencies.push(input);
      direct.set(file, dependencies);
      dependencies.forEach(visit);
    }
    initial.forEach(visit);
    return [...seen].sort();
  }
  const compiler = environment ? null : spawnSync('g++', ['--version'], { encoding: 'utf8', timeout: 3000, windowsHide: true });
  const localSettings = {};
  const envFile = path.join(root, '.env');
  if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_0-9]+)\s*=\s*(.*)$/);
    if (match && /^(COMPILE_|ASYNC_COMPILE_|TRACE_|ASM_)/.test(match[1]) && !/SECRET|TOKEN|PASSWORD/.test(match[1])) localSettings[match[1]] = match[2];
  }
  const settings = Object.fromEntries(Object.entries({ ...localSettings, ...process.env }).filter(([key]) => /^(COMPILE_|ASYNC_COMPILE_|TRACE_|ASM_)/.test(key)
    && !/SECRET|TOKEN|PASSWORD|BASE_URL|ANIMATION_CASES|ANIMATION_PREREQUISITES|ANIMATION_WORKERS|TEMP_DIR|CACHE_DIR|REGRESSION/.test(key)).sort());
  const browserPath = process.platform === 'win32' ? ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(file => fs.existsSync(file)) : null;
  const browserBuild = browserPath ? { size: fs.statSync(browserPath).size, modified: fs.statSync(browserPath).mtimeMs } : null;
  const env = environment || { node: process.version, platform: process.platform, arch: process.arch, browserBuild,
    compiler: compiler.stdout || `unavailable:${compiler.error?.code || compiler.status}`, browser: process.env.ASM_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium'), settings };
  const common = ['package.json', 'package-lock.json', 'scripts/validation-evidence.js', 'scripts/validation-manifest.js'];
  const entries = new Map(fs.existsSync(path.join(root, 'tests')) ? inventory(root).map(item => [item.file, item]) : []);
  const fingerprint = dependencies => digest(JSON.stringify({ environment: env, files: [...new Set([...common, ...dependencies])].sort().map(file => [file, hashFile(file)]) }));
  const tests = Object.fromEntries(files.map(file => {
    const item = entries.get(file);
    const broad = item?.browser ? [...backend, ...frontend] : item?.service ? [...backend, ...traceFrontend] : [];
    return [file, fingerprint(closure([file, ...broad]))];
  }));
  const animations = animation ? Object.fromEntries([
    ...animationCases.map(item => [item.name, fingerprint(closure([...backend, ...frontend, item.fixture, 'scripts/animation-browser.js', 'scripts/animation-assertions.js']))]),
    ...prerequisites.map(item => [item.label, fingerprint(closure([...backend, ...frontend, `scripts/${item.module.slice(2)}.js`]))])
  ]) : {};
  return { schema: 1, environment: env, tests, animations };
}

function reconcileEvidence(state, current) {
  const previous = state.evidence;
  const invalidatedFiles = (state.passedFiles || []).filter(file => previous?.tests?.[file] !== current.tests[file]);
  const invalidatedItems = (state.animation?.passedItems || []).filter(item => previous?.animations?.[item] !== current.animations[item]);
  state.passedFiles = (state.passedFiles || []).filter(file => !invalidatedFiles.includes(file));
  if (invalidatedFiles.length) {
    state.remainingFiles = [...new Set([...(state.remainingFiles || []), ...invalidatedFiles])].sort();
    state.status = 'running'; state.completedAt = null;
  }
  if (state.animation && invalidatedItems.length) {
    state.animation.passedItems = state.animation.passedItems.filter(item => !invalidatedItems.includes(item));
    const prerequisiteNames = new Set(prerequisites.map(item => item.label));
    state.animation.failedCases = [...new Set([...state.animation.failedCases, ...invalidatedItems.filter(item => !prerequisiteNames.has(item))])].sort();
    state.animation.failedPrerequisites = [...new Set([...state.animation.failedPrerequisites, ...invalidatedItems.filter(item => prerequisiteNames.has(item))])].sort();
    state.animation.status = 'failed'; state.animation.retryAll = false;
  }
  if (invalidatedFiles.length || invalidatedItems.length) {
    state.invalidations ||= [];
    state.invalidations.push({ at: new Date().toISOString(), reason: previous ? 'dependency-or-environment-changed' : 'legacy-evidence-without-fingerprint', files: invalidatedFiles, animationItems: invalidatedItems });
  }
  state.evidence = current;
  return state;
}
module.exports = { captureEvidence, reconcileEvidence };
