'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const fsp = fs.promises;
const CACHE_VERSION = 1;
const ARTIFACT_TYPES = new Set(['executable', 'trace']);
const CONTENT_KEY_PATTERN = /^[a-f0-9]{64}$/;

class ArtifactCacheCapacityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ArtifactCacheCapacityError';
    this.code = 'ARTIFACT_CACHE_CAPACITY';
  }
}

/**
 * JSON encoding with deterministic object key ordering.
 *
 * Arrays deliberately retain their order because compiler flags can change
 * meaning when reordered. Undefined object fields are omitted just like JSON,
 * while undefined array entries are encoded as null.
 */
function canonicalStringify(value) {
  const seen = new Set();

  function normalize(current, inArray = false) {
    if (current === null || typeof current === 'string' || typeof current === 'boolean') {
      return current;
    }
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new TypeError('Canonical values must contain finite numbers');
      return Object.is(current, -0) ? 0 : current;
    }
    if (current === undefined) return inArray ? null : undefined;
    if (typeof current === 'bigint' || typeof current === 'function' || typeof current === 'symbol') {
      throw new TypeError(`Unsupported canonical value: ${typeof current}`);
    }
    if (Buffer.isBuffer(current)) {
      return { $buffer: current.toString('base64') };
    }
    if (current instanceof Date) return { $date: current.toISOString() };
    if (seen.has(current)) throw new TypeError('Canonical values cannot be circular');

    seen.add(current);
    let normalized;
    if (Array.isArray(current)) {
      normalized = current.map((entry) => normalize(entry, true));
    } else {
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        seen.delete(current);
        throw new TypeError('Canonical values must use plain objects');
      }
      normalized = {};
      for (const key of Object.keys(current).sort()) {
        const entry = normalize(current[key], false);
        if (entry !== undefined) normalized[key] = entry;
      }
    }
    seen.delete(current);
    return normalized;
  }

  return JSON.stringify(normalize(value));
}

function sha256Canonical(value) {
  return createHash('sha256').update(canonicalStringify(value)).digest('hex');
}

/**
 * Key for a reusable native executable. Input is intentionally absent: the
 * same binary can execute many test cases as long as its compiled source and
 * toolchain contract remain identical.
 */
function createExecutableKey({ source, compiler, flags = [], engine } = {}) {
  requireValue(source, 'source');
  requireValue(compiler, 'compiler');
  requireValue(engine, 'engine');
  return sha256Canonical({
    namespace: 'algoshowmaker-executable-v1',
    source,
    compiler,
    flags,
    engine,
  });
}

/**
 * Key for a rendered trace. It includes the executable identity, input and all
 * trace-affecting settings. Callers should include instrumentation/runtime
 * versions in traceConfig or engine when those contracts change.
 */
function createTraceKey({ executableKey, input = '', traceConfig = {}, engine } = {}) {
  assertContentKey(executableKey);
  requireValue(engine, 'engine');
  return sha256Canonical({
    namespace: 'algoshowmaker-trace-v1',
    executableKey,
    input,
    traceConfig,
    engine,
  });
}

/**
 * Persistent content-addressed storage for executable and trace artifacts.
 *
 * `maxBytes` bounds disposable artifacts. Pinned official assets are included
 * in reported total bytes but never removed by normal TTL/LRU pruning, so they
 * may make physical usage exceed this disposable-cache budget.
 */
class ArtifactCache {
  constructor(options = {}) {
    if (!options.rootDir) throw new TypeError('rootDir is required');
    this.rootDir = path.resolve(options.rootDir);
    this.maxBytes = nonNegativeNumber(options.maxBytes, 512 * 1024 * 1024, 'maxBytes');
    this.defaultTtlMs = nonNegativeNumber(
      options.defaultTtlMs,
      7 * 24 * 60 * 60 * 1000,
      'defaultTtlMs',
    );
    this.now = typeof options.now === 'function' ? options.now : Date.now;
    this.entries = new Map();
    this.initialized = false;
    this.initializePromise = null;
    this.mutationTail = Promise.resolve();
    this.counters = { hits: 0, misses: 0, puts: 0, evictions: 0, expired: 0 };
  }

  async init() {
    if (this.initialized) return this;
    if (this.initializePromise) return this.initializePromise;
    this.initializePromise = this._enqueueMutation(async () => {
      await fsp.mkdir(this.rootDir, { recursive: true });
      for (const type of ARTIFACT_TYPES) await fsp.mkdir(path.join(this.rootDir, type), { recursive: true });
      await this._loadIndex();
      this.initialized = true;
      return this;
    });
    try {
      return await this.initializePromise;
    } finally {
      this.initializePromise = null;
    }
  }

  async put(type, key, content, options = {}) {
    await this.init();
    assertType(type);
    assertContentKey(key);
    const buffer = toBuffer(content);
    const contentSha256 = sha256Bytes(buffer);
    return this._enqueueMutation(() => this._putBuffer(type, key, buffer, contentSha256, options));
  }

  async putFile(type, key, sourcePath, options = {}) {
    await this.init();
    assertType(type);
    assertContentKey(key);
    const resolvedSource = path.resolve(sourcePath);
    const contentSha256 = await sha256File(resolvedSource);
    return this._enqueueMutation(async () => {
      const stat = await fsp.stat(resolvedSource);
      if (!stat.isFile()) throw new TypeError('sourcePath must point to a regular file');
      return this._putFromWriter(type, key, stat.size, options, (temporaryPath) => (
        fsp.copyFile(resolvedSource, temporaryPath, fs.constants.COPYFILE_EXCL)
      ), contentSha256);
    });
  }

  async lookup(type, key, options = {}) {
    await this.init();
    assertType(type);
    assertContentKey(key);
    const mapKey = entryMapKey(type, key);
    const entry = this.entries.get(mapKey);
    if (!entry) {
      this.counters.misses += 1;
      return null;
    }

    if (!entry.pinned && isExpired(entry, this.now())) {
      this.counters.misses += 1;
      await this._enqueueMutation(async () => {
        const current = this.entries.get(mapKey);
        if (current && !current.pinned && isExpired(current, this.now())) {
          await this._removeEntry(current, 'expired');
        }
      });
      return null;
    }

    try {
      const stat = await fsp.lstat(entry.path);
      if (!stat.isFile() || stat.size !== entry.size) throw new Error('artifact size mismatch');
    } catch {
      this.counters.misses += 1;
      await this._enqueueMutation(() => this._removeEntry(entry, 'missing'));
      return null;
    }

    this.counters.hits += 1;
    if (options.touch !== false) {
      await this._enqueueMutation(async () => {
        const current = this.entries.get(mapKey);
        if (!current) return;
        current.lastAccessedAt = this.now();
        await atomicWriteJson(current.metadataPath, serializeEntry(current));
      });
    }
    return publicEntry(this.entries.get(mapKey) || entry);
  }

  async read(type, key, options = {}) {
    const lease = await this.acquire(type, key, options);
    if (!lease) return null;
    try {
      return { ...lease.entry, data: await fsp.readFile(lease.entry.path) };
    } finally {
      await lease.release();
    }
  }

  /**
   * Protect an artifact from TTL/LRU deletion while a child process or stream
   * uses its path. Every successful acquire must be paired with release.
   */
  async acquire(type, key, options = {}) {
    await this.init();
    assertType(type);
    assertContentKey(key);
    return this._enqueueMutation(async () => {
      const mapKey = entryMapKey(type, key);
      const entry = this.entries.get(mapKey);
      if (!entry || (!entry.pinned && isExpired(entry, this.now()))) {
        this.counters.misses += 1;
        if (entry && entry.leases === 0) await this._removeEntry(entry, 'expired');
        return null;
      }
      try {
        const stat = await fsp.lstat(entry.path);
        if (!stat.isFile() || stat.size !== entry.size) throw new Error('artifact size mismatch');
      } catch {
        this.counters.misses += 1;
        if (entry.leases === 0) await this._removeEntry(entry, 'missing');
        return null;
      }
      this.counters.hits += 1;
      entry.leases += 1;
      if (options.touch !== false) {
        entry.lastAccessedAt = this.now();
        await atomicWriteJson(entry.metadataPath, serializeEntry(entry));
      }
      let released = false;
      return {
        entry: publicEntry(entry),
        release: async () => {
          if (released) return false;
          released = true;
          return this._enqueueMutation(async () => {
            const current = this.entries.get(mapKey);
            if (!current || current.leases === 0) return false;
            current.leases -= 1;
            await this._pruneInternal();
            return true;
          });
        },
      };
    });
  }

  async setPinned(type, key, pinned = true) {
    await this.init();
    assertType(type);
    assertContentKey(key);
    return this._enqueueMutation(async () => {
      const entry = this.entries.get(entryMapKey(type, key));
      if (!entry) return null;
      entry.pinned = Boolean(pinned);
      entry.updatedAt = this.now();
      await atomicWriteJson(entry.metadataPath, serializeEntry(entry));
      if (!entry.pinned) await this._pruneInternal();
      return publicEntry(entry);
    });
  }

  async remove(type, key, options = {}) {
    await this.init();
    assertType(type);
    assertContentKey(key);
    return this._enqueueMutation(async () => {
      const entry = this.entries.get(entryMapKey(type, key));
      if (!entry) return false;
      if (entry.leases > 0) return false;
      if (entry.pinned && options.forcePinned !== true) return false;
      return this._removeEntry(entry, 'manual');
    });
  }

  async prune() {
    await this.init();
    return this._enqueueMutation(() => this._pruneInternal());
  }

  stats() {
    let bytes = 0;
    let pinnedBytes = 0;
    let artifacts = 0;
    let pinnedArtifacts = 0;
    let leasedArtifacts = 0;
    const byType = {};
    for (const type of ARTIFACT_TYPES) byType[type] = { artifacts: 0, bytes: 0, pinned: 0 };
    for (const entry of this.entries.values()) {
      artifacts += 1;
      bytes += entry.size;
      byType[entry.type].artifacts += 1;
      byType[entry.type].bytes += entry.size;
      if (entry.pinned) {
        pinnedArtifacts += 1;
        pinnedBytes += entry.size;
        byType[entry.type].pinned += 1;
      }
      if (entry.leases > 0) leasedArtifacts += 1;
    }
    return {
      ...this.counters,
      artifacts,
      bytes,
      pinnedArtifacts,
      pinnedBytes,
      leasedArtifacts,
      disposableBytes: bytes - pinnedBytes,
      maxBytes: this.maxBytes,
      byType,
    };
  }

  async _putBuffer(type, key, buffer, contentSha256, options) {
    return this._putFromWriter(type, key, buffer.length, options, (temporaryPath) => (
      fsp.writeFile(temporaryPath, buffer, { flag: 'wx', mode: options.mode ?? 0o600 })
    ), contentSha256);
  }

  async _putFromWriter(type, key, size, options, writer, contentSha256) {
    const mapKey = entryMapKey(type, key);
    const existing = this.entries.get(mapKey);
    if (existing) {
      if (existing.size !== size || existing.contentSha256 !== contentSha256) {
        throw new Error(`Content-addressed artifact ${key} already exists with different bytes`);
      }
      const now = this.now();
      if (options.pinned && !existing.pinned) {
        existing.pinned = true;
      }
      if (!existing.pinned && options.ttlMs !== undefined) {
        const ttlMs = nonNegativeNumber(options.ttlMs, this.defaultTtlMs, 'ttlMs');
        existing.expiresAt = ttlMs === 0 ? null : now + ttlMs;
      }
      existing.updatedAt = now;
      existing.lastAccessedAt = now;
      await atomicWriteJson(existing.metadataPath, serializeEntry(existing));
      this.counters.puts += 1;
      return publicEntry(existing);
    }

    const pinned = Boolean(options.pinned);
    if (!pinned && size > this.maxBytes) {
      throw new ArtifactCacheCapacityError(
        `Artifact size ${size} exceeds disposable cache budget ${this.maxBytes}`,
      );
    }
    const ttlMs = options.ttlMs === undefined
      ? this.defaultTtlMs
      : nonNegativeNumber(options.ttlMs, this.defaultTtlMs, 'ttlMs');
    const locations = artifactLocations(this.rootDir, type, key);
    await fsp.mkdir(locations.directory, { recursive: true });
    const temporaryPath = path.join(locations.directory, `.${key}.${randomUUID()}.tmp`);
    try {
      await writer(temporaryPath);
      if (options.mode !== undefined) await fsp.chmod(temporaryPath, options.mode);
      await fsp.rename(temporaryPath, locations.path);
    } catch (error) {
      await fsp.rm(temporaryPath, { force: true }).catch(() => {});
      throw error;
    }

    const now = this.now();
    const entry = {
      version: CACHE_VERSION,
      type,
      key,
      path: locations.path,
      metadataPath: locations.metadataPath,
      size,
      contentSha256,
      pinned,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      expiresAt: pinned || ttlMs === 0 ? null : now + ttlMs,
      custom: sanitizeCustomMetadata(options.metadata),
      leases: 0,
    };
    try {
      await atomicWriteJson(entry.metadataPath, serializeEntry(entry));
    } catch (error) {
      await fsp.rm(entry.path, { force: true }).catch(() => {});
      throw error;
    }
    this.entries.set(mapKey, entry);
    this.counters.puts += 1;
    await this._pruneInternal();

    if (!entry.pinned && !this.entries.has(mapKey)) {
      throw new ArtifactCacheCapacityError('Artifact was immediately evicted by the cache budget');
    }
    return publicEntry(entry);
  }

  async _pruneInternal() {
    const now = this.now();
    let removedExpired = 0;
    let removedLru = 0;
    for (const entry of [...this.entries.values()]) {
      if (!entry.pinned && entry.leases === 0 && isExpired(entry, now)) {
        await this._removeEntry(entry, 'expired');
        removedExpired += 1;
      }
    }

    let disposableBytes = [...this.entries.values()]
      .filter((entry) => !entry.pinned)
      .reduce((sum, entry) => sum + entry.size, 0);
    const candidates = [...this.entries.values()]
      .filter((entry) => !entry.pinned && entry.leases === 0)
      .sort((left, right) => (
        left.lastAccessedAt - right.lastAccessedAt
        || left.createdAt - right.createdAt
        || left.key.localeCompare(right.key)
      ));
    for (const entry of candidates) {
      if (disposableBytes <= this.maxBytes) break;
      await this._removeEntry(entry, 'lru');
      disposableBytes -= entry.size;
      removedLru += 1;
    }
    return { removedExpired, removedLru, ...this.stats() };
  }

  async _removeEntry(entry, reason) {
    const current = this.entries.get(entryMapKey(entry.type, entry.key));
    if (current !== entry) return false;
    if (entry.leases > 0) return false;
    this.entries.delete(entryMapKey(entry.type, entry.key));
    await Promise.all([
      fsp.rm(entry.path, { force: true }),
      fsp.rm(entry.metadataPath, { force: true }),
    ]);
    if (reason === 'expired') this.counters.expired += 1;
    if (reason === 'expired' || reason === 'lru') this.counters.evictions += 1;
    return true;
  }

  async _loadIndex() {
    this.entries.clear();
    // Staging files are never addressable cache entries. They can only remain
    // after a process crash, so startup may safely discard them.
    await fsp.rm(path.join(this.rootDir, '.staging'), { recursive: true, force: true });
    for (const type of ARTIFACT_TYPES) {
      const typeDirectory = path.join(this.rootDir, type);
      const shards = await safeReadDir(typeDirectory);
      for (const shard of shards) {
        if (!shard.isDirectory() || !/^[a-f0-9]{2}$/.test(shard.name)) continue;
        const directory = path.join(typeDirectory, shard.name);
        const files = await safeReadDir(directory);
        for (const file of files) {
          if (file.isFile() && file.name.endsWith('.tmp')) {
            await fsp.rm(path.join(directory, file.name), { force: true });
          }
        }
        for (const file of files) {
          if (!file.isFile() || !file.name.endsWith('.json')) continue;
          const key = file.name.slice(0, -5);
          if (!CONTENT_KEY_PATTERN.test(key) || key.slice(0, 2) !== shard.name) continue;
          const locations = artifactLocations(this.rootDir, type, key);
          try {
            const metadata = JSON.parse(await fsp.readFile(locations.metadataPath, 'utf8'));
            const stat = await fsp.lstat(locations.path);
            const entry = hydrateEntry(metadata, locations, type, key, stat.size);
            this.entries.set(entryMapKey(type, key), entry);
          } catch {
            // A partial/crashed write is not a usable cache hit. Leave unrelated
            // files alone and remove only this content-addressed pair.
            await Promise.all([
              fsp.rm(locations.path, { force: true }),
              fsp.rm(locations.metadataPath, { force: true }),
            ]);
          }
        }
        for (const file of files) {
          if (!file.isFile() || !file.name.endsWith('.artifact')) continue;
          const key = file.name.slice(0, -9);
          if (!CONTENT_KEY_PATTERN.test(key) || key.slice(0, 2) !== shard.name) continue;
          if (!this.entries.has(entryMapKey(type, key))) {
            await fsp.rm(path.join(directory, file.name), { force: true });
          }
        }
      }
    }
    await this._pruneInternal();
  }

  _enqueueMutation(operation) {
    const result = this.mutationTail.then(operation, operation);
    this.mutationTail = result.catch(() => {});
    return result;
  }
}

function artifactLocations(rootDir, type, key) {
  assertType(type);
  assertContentKey(key);
  const directory = path.resolve(rootDir, type, key.slice(0, 2));
  const artifactPath = path.resolve(directory, `${key}.artifact`);
  const metadataPath = path.resolve(directory, `${key}.json`);
  const expectedPrefix = `${path.resolve(rootDir)}${path.sep}`;
  if (!artifactPath.startsWith(expectedPrefix) || !metadataPath.startsWith(expectedPrefix)) {
    throw new Error('Artifact path escaped cache root');
  }
  return { directory, path: artifactPath, metadataPath };
}

async function atomicWriteJson(destination, value) {
  const directory = path.dirname(destination);
  await fsp.mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `.${path.basename(destination)}.${randomUUID()}.tmp`);
  try {
    await fsp.writeFile(temporary, `${JSON.stringify(value)}\n`, { flag: 'wx', mode: 0o600 });
    await fsp.rename(temporary, destination);
  } catch (error) {
    await fsp.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

function serializeEntry(entry) {
  return {
    version: CACHE_VERSION,
    type: entry.type,
    key: entry.key,
    size: entry.size,
    contentSha256: entry.contentSha256,
    pinned: entry.pinned,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    lastAccessedAt: entry.lastAccessedAt,
    expiresAt: entry.expiresAt,
    custom: entry.custom,
  };
}

function hydrateEntry(metadata, locations, expectedType, expectedKey, actualSize) {
  if (!metadata || metadata.version !== CACHE_VERSION) throw new Error('Unsupported cache metadata');
  if (metadata.type !== expectedType || metadata.key !== expectedKey) throw new Error('Cache metadata identity mismatch');
  if (!Number.isSafeInteger(metadata.size) || metadata.size < 0 || metadata.size !== actualSize) {
    throw new Error('Cache metadata size mismatch');
  }
  if (typeof metadata.contentSha256 !== 'string' || !CONTENT_KEY_PATTERN.test(metadata.contentSha256)) {
    throw new Error('Invalid cache metadata contentSha256');
  }
  for (const field of ['createdAt', 'updatedAt', 'lastAccessedAt']) {
    if (!Number.isFinite(metadata[field])) throw new Error(`Invalid cache metadata ${field}`);
  }
  if (metadata.expiresAt !== null && !Number.isFinite(metadata.expiresAt)) {
    throw new Error('Invalid cache metadata expiresAt');
  }
  return {
    ...metadata,
    pinned: Boolean(metadata.pinned),
    custom: sanitizeCustomMetadata(metadata.custom),
    leases: 0,
    path: locations.path,
    metadataPath: locations.metadataPath,
  };
}

function publicEntry(entry) {
  return Object.freeze({
    version: entry.version,
    type: entry.type,
    key: entry.key,
    path: entry.path,
    size: entry.size,
    contentSha256: entry.contentSha256,
    pinned: entry.pinned,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    lastAccessedAt: entry.lastAccessedAt,
    expiresAt: entry.expiresAt,
    metadata: entry.custom,
  });
}

function sanitizeCustomMetadata(value) {
  if (value === undefined || value === null) return {};
  const encoded = canonicalStringify(value);
  const decoded = JSON.parse(encoded);
  if (!decoded || Array.isArray(decoded) || typeof decoded !== 'object') {
    throw new TypeError('metadata must be a plain object');
  }
  return decoded;
}

function isExpired(entry, now) {
  return entry.expiresAt !== null && entry.expiresAt <= now;
}

function toBuffer(content) {
  if (Buffer.isBuffer(content)) return content;
  if (typeof content === 'string') return Buffer.from(content);
  if (ArrayBuffer.isView(content)) {
    return Buffer.from(content.buffer, content.byteOffset, content.byteLength);
  }
  throw new TypeError('content must be a Buffer, string, or typed array');
}

function assertType(type) {
  if (!ARTIFACT_TYPES.has(type)) throw new TypeError(`Unsupported artifact type: ${type}`);
}

function assertContentKey(key) {
  if (typeof key !== 'string' || !CONTENT_KEY_PATTERN.test(key)) {
    throw new TypeError('Artifact key must be a lowercase SHA-256 hex digest');
  }
}

function requireValue(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new TypeError(`${name} is required`);
  }
}

function nonNegativeNumber(value, fallback, name) {
  const selected = value === undefined ? fallback : value;
  if (!Number.isFinite(selected) || selected < 0) throw new TypeError(`${name} must be non-negative`);
  return selected;
}

function entryMapKey(type, key) {
  return `${type}:${key}`;
}

function sha256Bytes(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.once('error', reject);
    stream.once('end', resolve);
  });
  return hash.digest('hex');
}

async function safeReadDir(directory) {
  try {
    return await fsp.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

module.exports = {
  ArtifactCache,
  ArtifactCacheCapacityError,
  ARTIFACT_TYPES,
  CACHE_VERSION,
  canonicalStringify,
  createExecutableKey,
  createTraceKey,
  sha256Canonical,
};
