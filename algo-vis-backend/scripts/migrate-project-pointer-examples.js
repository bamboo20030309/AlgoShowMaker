#!/usr/bin/env node
// Repository-only migration. User downloads and cloud decks are never touched.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { migrateSource, migrateJSON, migrateJavaScript } = require('./migrate-indexed-pointers');
// This tool cannot infer whether an indexed expression was authored under the
// old grammar or intentionally selects a value under the new grammar.
if (!process.argv.includes('--confirm-legacy')) {
  console.error('One-time legacy migration only. Back up your work, then pass --confirm-legacy. Do not rerun on migrated examples.');
  process.exit(1);
}
const root = path.resolve(__dirname, '../..');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString('utf8').split('\0').filter(Boolean);
let changed = 0;
for (const relative of files) {
  if (/vendor\/|public\/deck-traces\/|public\/default-animation\//.test(relative)) continue;
  if (/trace-instrumenter\.js$/.test(relative)) continue;
  const file = path.join(root, relative);
  if (relative.endsWith('.asmdeck')) {
    const bytes = fs.readFileSync(file); let offset = 9; let cover;
    if (bytes.subarray(0,9).toString() === 'ASMDECK2\n') {
      const length = bytes.readUInt32LE(9); cover = JSON.parse(bytes.subarray(13,13+length)); offset = 13+length;
    } else if (bytes.subarray(0,9).toString() !== 'ASMDECK1\n') continue;
    const pkg = JSON.parse(zlib.gunzipSync(bytes.subarray(offset)));
    const before = JSON.stringify(pkg.body.deck);
    pkg.body.deck = migrateJSON(pkg.body.deck);
    if (before === JSON.stringify(pkg.body.deck)) continue;
    function invalidate(value) {
      if (!value || typeof value !== 'object') return;
      if (value.animation?.code) {
        delete value.animation.prebuilt; delete value.animation.traceRef; delete value.animation.traceDocument;
      }
      Object.values(value).forEach(invalidate);
    }
    invalidate(pkg.body.deck);
    delete pkg.body.prebuiltTraces; delete pkg.manifest.prebuiltTraceHashes;
    pkg.manifest.contentHash = hash(JSON.stringify(pkg.body));
    let prefix = Buffer.from('ASMDECK1\n');
    if (cover) {
      cover.contentHash = pkg.manifest.contentHash;
      const data = Buffer.from(JSON.stringify(cover)); const length = Buffer.alloc(4); length.writeUInt32LE(data.length);
      pkg.manifest.coverHash = hash(data); prefix = Buffer.concat([Buffer.from('ASMDECK2\n'),length,data]);
    }
    fs.writeFileSync(file, Buffer.concat([prefix,zlib.gzipSync(JSON.stringify(pkg))]));
  } else if (/\.(?:cpp|md|js|json)$/.test(relative)) {
    const source = fs.readFileSync(file,'utf8'); if (!/\/\/[^\n]*@(frame|object)\b/.test(source)) continue;
    let next;
    if (relative.endsWith('.js')) next = migrateJavaScript(source);
    else if (relative.endsWith('.json')) {
      const value = JSON.parse(source), migrated = migrateJSON(value);
      next = JSON.stringify(value) === JSON.stringify(migrated) ? source : JSON.stringify(migrated,null,2)+'\n';
    } else next = migrateSource(source);
    if (next === source) continue;
    fs.writeFileSync(file,next);
  } else continue;
  console.log(relative); changed++;
}
console.log(`Migrated ${changed} tracked files. Rebuild public deck traces before publishing.`);
