'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const { createHash } = require('node:crypto');

const digest = value => createHash('sha256').update(value).digest('hex');
const normalizeIds = values => [...new Set((values || []).map(v => typeof v === 'string' ? v : v?.id).filter(Boolean))].sort();
const sameIds = (left, right) => JSON.stringify(left) === JSON.stringify(right);

// Only server-controlled sources can own permanent executables. Neither a
// client-supplied ID nor a client-supplied "official" flag grants this status.
class OfficialExecutables {
  constructor({ publicRoot, sampleRoot, normalizeSource = s => s.replace(/\r\n?/g, '\n'), compiler, engine, checkIntervalMs = 1000 }) {
    Object.assign(this, { publicRoot, sampleRoot, normalizeSource, compiler, engine, checkIntervalMs });
    this.sources = new Map();
    this.publishedIds = new Map();
    this.signature = null;
    this.lastCheck = 0;
    this.pending = null;
  }

  fingerprint(source) { return digest(this.normalizeSource(source)); }

  async refresh({ force = false } = {}) {
    if (this.pending) return this.pending;
    if (!force && this.signature !== null && Date.now() - this.lastCheck < this.checkIntervalMs) return false;
    this.pending = this._refresh().finally(() => { this.pending = null; });
    return this.pending;
  }

  async _refresh() {
    const catalogPath = path.join(this.publicRoot, 'guest-decks.json');
    let catalog;
    try { catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; catalog = { decks: [] }; }
    const files = new Set([catalogPath]);
    const programs = [];
    async function scan(directory) {
      let entries;
      try { entries = await fs.readdir(directory, { withFileTypes: true }); }
      catch (error) { if (error.code === 'ENOENT') return; throw error; }
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) await scan(target);
        else if (entry.isFile() && entry.name.endsWith('.cpp')) { files.add(target); programs.push(target); }
      }
    }
    await scan(this.sampleRoot);
    const archives = new Set();
    for (const entry of catalog.decks || []) for (const url of [entry.archive, entry.source_archive]) {
      if (!url) continue;
      const target = path.resolve(this.publicRoot, '.' + url.split('?')[0]);
      if (!target.startsWith(path.resolve(this.publicRoot) + path.sep)) throw new Error('Official archive escaped public root');
      archives.add(target); files.add(target);
    }
    const versions = [];
    for (const file of [...files].sort()) {
      try { const stat = await fs.stat(file); versions.push([file, stat.size, stat.mtimeMs]); }
      catch (error) { if (error.code !== 'ENOENT') throw error; versions.push([file, null]); }
    }
    const signature = digest(JSON.stringify(versions));
    this.lastCheck = Date.now();
    if (signature === this.signature) return false;
    const sources = new Map(), publishedIds = new Map();
    const add = (source, watches = []) => {
      if (typeof source !== 'string' || !source.trim()) return;
      const fingerprint = this.fingerprint(source);
      if (!sources.has(fingerprint)) sources.set(fingerprint, []);
      sources.get(fingerprint).push(normalizeIds(watches));
      return fingerprint;
    };
    for (const file of programs) add(await fs.readFile(file, 'utf8'));
    for (const file of archives) {
      const bytes = await fs.readFile(file);
      const magic = bytes.subarray(0, 9).toString();
      const offset = magic === 'ASMDECK2\n' ? 13 + bytes.readUInt32LE(9) : magic === 'ASMDECK1\n' ? 9 : -1;
      if (offset < 0 || offset >= bytes.length) throw new Error('Invalid official archive');
      const body = JSON.parse(gunzipSync(bytes.subarray(offset), { maxOutputLength: 128 * 1024 * 1024 }));
      for (const group of body.body?.deck?.groups || []) for (const slide of group.slides || []) {
        const animation = slide.animation;
        if (!animation) continue;
        const fingerprint = add(animation.code, animation.watches);
        if (fingerprint && /^[a-f0-9]{64}$/.test(animation.executableRef?.id || '')) publishedIds.set(animation.executableRef.id, fingerprint);
      }
    }
    this.sources = sources;
    this.publishedIds = publishedIds;
    this.signature = signature;
    return true;
  }

  classify(source, { traceEnabled = false, watches = [], allVariables = [] } = {}) {
    const sourceFingerprint = this.fingerprint(source);
    const available = new Set(normalizeIds(allVariables.filter(v => typeof v === 'string' || v.supported !== false)));
    const requested = normalizeIds(watches).filter(id => available.has(id));
    const all = [...available].sort();
    const canonicalWatchProfile = !traceEnabled || requested.length === 0 || sameIds(requested, all);
    const allowed = this.sources.get(sourceFingerprint);
    const catalogProfile = allowed?.some(ids => sameIds(ids.filter(id => available.has(id)), requested));
    return { sourceFingerprint, canonicalWatchProfile, official: Boolean(allowed && (canonicalWatchProfile || catalogProfile)) };
  }

  async reconcile(cache) {
    let pinned = 0, unpinned = 0;
    for (const entry of [...cache.entries.values()]) {
      if (entry.type !== 'executable') continue;
      const metadata = entry.custom || {};
      const compatible = metadata.compilerFingerprint === this.compiler && metadata.engineFingerprint === this.engine;
      const source = metadata.sourceFingerprint || this.publishedIds.get(entry.key);
      const eligible = compatible && this.sources.has(source) && (metadata.official || metadata.canonicalWatchProfile || this.publishedIds.has(entry.key));
      if (eligible) {
        if (!entry.pinned || !metadata.official || !metadata.sourceFingerprint) {
          await cache.setPinned('executable', entry.key, true, { metadata: { official: true, sourceFingerprint: source } }); pinned++;
        }
      } else if (entry.pinned && metadata.official) {
        await cache.setPinned('executable', entry.key, false, { metadata: { official: false } }); unpinned++;
      }
    }
    return { sources: this.sources.size, pinned, unpinned };
  }
}
module.exports = { OfficialExecutables };
