'use strict';
// Collect original notices without executing downloaded package code. Missing
// optional packages are read from integrity-checked npm tarballs on explicit refresh.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'public/licenses');
const hash = value => createHash('sha256').update(value).digest('hex');
const lockBytes = fs.readFileSync(path.join(root, 'package-lock.json'));
const lock = JSON.parse(lockBytes);
const noticeName = name => /(?:^|[-_.])(?:licen[sc]e|copying|notice|thirdpartynotices)(?:$|[-_.])/i.test(name);
const escape = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const sourceLinks = {
  'saxes@5.0.1': 'https://github.com/lddubeau/saxes/tree/6ef6a275b20f19cb67808daf0d8f64e06aaf5b0e',
  '@jaames/iro@5.5.2': 'https://github.com/jaames/iro.js/tree/1825363da88e1971befb6c6b827951594f388798',
  '@irojs/iro-core@1.2.1': 'https://github.com/irojs/iro-core/tree/bd46ac36225cc4de5ea2a8453cec4f69b8f40ba6',
};

async function download(url) {
  if (!/^https:\/\/(?:registry\.npmjs\.org|raw\.githubusercontent\.com)\//.test(url)) throw new Error('Untrusted notice URL');
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Notice download failed: ${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function tarFiles(buffer) {
  const tar = gunzipSync(buffer, { maxOutputLength: 128 * 1024 * 1024 });
  const files = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString().replace(/\0.*$/, '');
    if (!name) break;
    const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim(), 8);
    if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw new Error('Invalid npm tarball');
    if (header[156] === 0 || header[156] === 48) files.set(name.replace(/^package\//, ''), tar.subarray(offset + 512, offset + 512 + size).toString('utf8'));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

function notices(files) {
  const result = [...files].filter(([name]) => !name.includes('/') && noticeName(name)).map(([file, text]) => ({ file, text }));
  if (result.length) return result;
  // A few upstream packages place their complete license in their README.
  for (const [file, text] of files) {
    if (!/^readme(?:\.|$)/i.test(file)) continue;
    const start = text.search(/(?:^|\n)(?:#{1,6}\s*)?Licen[sc]e\s*(?:\r?\n|$)/i);
    if (start >= 0 && /permission|redistribution/i.test(text.slice(start))) result.push({ file, text: text.slice(start).trim() });
  }
  return result;
}

async function collect(name, entry, previous, allowNetwork) {
  const installed = path.join(root, entry.packagePath);
  let documents = [];
  let pkg;
  if (fs.existsSync(path.join(installed, 'package.json'))) {
    pkg = JSON.parse(fs.readFileSync(path.join(installed, 'package.json')));
    if (pkg.version === entry.version) {
      const files = new Map(fs.readdirSync(installed, { withFileTypes: true }).filter(f => f.isFile() && (noticeName(f.name) || /^readme/i.test(f.name))).map(f => [f.name, fs.readFileSync(path.join(installed, f.name), 'utf8')]));
      documents = notices(files);
    }
  }
  if (!documents.length && previous?.version === entry.version && previous.documents?.length) documents = previous.documents;
  if (!documents.length && allowNetwork) {
    const bytes = await download(entry.resolved);
    const [algorithm, digest] = entry.integrity.split('-');
    if (createHash(algorithm).update(bytes).digest('base64') !== digest) throw new Error(`Integrity mismatch: ${name}`);
    const files = tarFiles(bytes);
    pkg = JSON.parse(files.get('package.json'));
    documents = notices(files);
    if (!documents.length && name === 'tr46' && entry.version === '0.0.3') {
      const url = 'https://raw.githubusercontent.com/jsdom/tr46/bd303c13dc7ebc716c232f03cb80c79071e7a7f7/LICENSE.md';
      documents = [{ file: 'Upstream MIT license (supplement; 0.0.3 npm package omits license text)', text: (await download(url)).toString(), source: url }];
    }
    if (!documents.length && name === 'saxes' && entry.version === '5.0.1') {
      const url = 'https://raw.githubusercontent.com/lddubeau/saxes/6ef6a275b20f19cb67808daf0d8f64e06aaf5b0e/LICENSE';
      documents = [{ file: 'LICENSE', text: (await download(url)).toString(), source: url }];
    }
    if (!documents.length) {
      const meta = JSON.parse(await download(`https://registry.npmjs.org/${encodeURIComponent(name)}/${entry.version}`));
      const repo = (meta.repository?.url || '').match(/github\.com[/:]([^/]+\/[^/#]+?)(?:\.git)?$/)?.[1];
      if (repo && /^[a-f0-9]{40}$/.test(meta.gitHead || '')) {
        for (const filename of ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'COPYING', 'MIT-LICENSE.txt']) {
          const url = `https://raw.githubusercontent.com/${repo}/${meta.gitHead}/${filename}`;
          try { documents = [{ file: filename, text: (await download(url)).toString(), source: url }]; break; } catch (error) { if (!error.message.includes('404')) throw error; }
        }
      }
    }
  }
  if (!documents.length) throw new Error(`Missing full notice for ${name}@${entry.version}; refresh with --fetch-missing or add verified upstream notice`);
  if (entry.license === 'MPL-2.0' && !sourceLinks[`${name}@${entry.version}`]) throw new Error('Verify MPL source URL for new version: ' + name);
  return { name, version: entry.version, license: entry.license, dev: Boolean(entry.dev), optional: Boolean(entry.optional),
    source: sourceLinks[`${name}@${entry.version}`] || previous?.source || `https://www.npmjs.com/package/${name}/v/${entry.version}`, documents };
}

async function main() {
  let previous = { components: [] };
  const manifest = path.join(output, 'components.json');
  if (fs.existsSync(manifest)) previous = JSON.parse(fs.readFileSync(manifest));
  if (process.argv.includes('--check')) {
    if (previous.lockSha256 !== hash(lockBytes)) throw new Error('Dependency lock changed: regenerate third-party notices');
    if (!previous.components.length || previous.components.some(p => !p.documents?.length)) throw new Error('Incomplete third-party notices');
    for (const name of ['index.html', 'third-party-notices.txt', 'project-license.txt']) if (!fs.existsSync(path.join(output, name))) throw new Error(`Missing ${name}`);
    console.log(`Notices match lockfile: ${previous.components.length} components`); return;
  }
  const entries = new Map();
  for (const [packagePath, entry] of Object.entries(lock.packages)) {
    if (!packagePath) continue;
    const name = packagePath.split('node_modules/').pop();
    const id = `${name}@${entry.version}`;
    const existing = entries.get(id);
    entries.set(id, { name, ...entry, packagePath,
      dev: Boolean(entry.dev && (!existing || existing.dev)),
      optional: Boolean(entry.optional && (!existing || existing.optional)),
    });
  }
  const pending = [...entries].sort(([a], [b]) => a.localeCompare(b, 'en'));
  const components = [];
  // Bound downloads; no package install hooks or third-party code are run.
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < pending.length) {
      const [id, entry] = pending[cursor++];
      components.push(await collect(entry.name, entry, previous.components.find(p => `${p.name}@${p.version}` === id), process.argv.includes('--fetch-missing')));
    }
  }));
  components.push({ name: 'KaTeX', version: '0.16.22', license: 'MIT', source: 'https://github.com/KaTeX/KaTeX/tree/v0.16.22', documents: [{ file: 'LICENSE', text: fs.readFileSync(path.join(root, 'public/vendor/katex/LICENSE'), 'utf8') }] });
  let highlight = previous.components.find(p => p.name === 'highlight.js' && p.version === '11.11.1');
  if (!highlight) highlight = { name: 'highlight.js', version: '11.11.1', license: 'BSD-3-Clause', source: 'https://github.com/highlightjs/highlight.js/tree/11.11.1', documents: [{ file: 'LICENSE', text: (await download('https://raw.githubusercontent.com/highlightjs/highlight.js/11.11.1/LICENSE')).toString() }] };
  components.push(highlight);
  components.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`, 'en'));
  const metadata = { lockSha256: hash(lockBytes), scope: 'npm lockfile including optional/development dependencies; vendored KaTeX and bundled highlight.js', components };
  const fullText = components.map(p => `\n${'='.repeat(72)}\n${p.name} ${p.version} — ${p.license}\nSource: ${p.source}\n${p.documents.map(d => `\n--- ${d.file} ---\n${d.text.trim()}\n`).join('')}`).join('');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(manifest, JSON.stringify(metadata, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'third-party-notices.txt'), fullText);
  fs.copyFileSync(path.resolve(root, '..', 'LICENSE'), path.join(output, 'project-license.txt'));
  const template = fs.readFileSync(path.join(__dirname, 'third-party-notices.template.html'), 'utf8');
  const sections = components.map((p, i) => `<details id="component-${i}"><summary>${escape(p.name)} <small>${escape(p.version)} · ${escape(p.license)}</small></summary><p><a href="${escape(p.source)}" rel="noopener noreferrer" target="_blank">${p.license === 'MPL-2.0' ? '取得此版本原始碼' : '原始專案／版本'}</a>${p.dev ? ' · 開發工具' : ''}${p.optional ? ' · 可選依賴（依環境安裝）' : ''}</p>${p.documents.map(d => `<h3>${escape(d.file)}</h3><pre>${escape(d.text)}</pre>`).join('')}</details>`).join('\n');
  fs.writeFileSync(path.join(output, 'index.html'), template.replace('<!-- COMPONENTS -->', sections));
  console.log(`Generated full third-party notices: ${components.length} components`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
