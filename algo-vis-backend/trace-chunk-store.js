/** Bounded JSONL -> independently gzipped chunks, with offsets for direct reads.
 * Runtime v2 shares instruction/activation metadata inside each event chunk.
 * Public trace documents remain v1 so saved decks and existing clients still load.
 */
const fs = require('node:fs');
const {gzip, gunzip, createGzip} = require('node:zlib');
const {promisify} = require('node:util');
const {Readable} = require('node:stream');
const {pipeline} = require('node:stream/promises');
const zip = promisify(gzip), unzip = promisify(gunzip);
const LIMITS = Object.freeze({file:128*1024*1024, record:64*1024*1024,
  compressed:32*1024*1024, expanded:512*1024*1024, events:1000000, records:100000});

async function* lines(file, limits = LIMITS) {
  let parts = [], length = 0, total = 0;
  for await (const buffer of fs.createReadStream(file, {highWaterMark:64*1024})) {
    total += buffer.length;
    if (total > limits.file) throw new Error('追蹤資料超過檔案大小上限');
    let start = 0;
    while (start < buffer.length) {
      const newline = buffer.indexOf(10, start);
      const end = newline < 0 ? buffer.length : newline;
      const part = buffer.subarray(start, end);
      length += part.length;
      if (length > limits.record) throw new Error('單筆追蹤資料超過大小上限');
      parts.push(part);
      if (newline < 0) break;
      if (length) yield Buffer.concat(parts, length);
      parts = []; length = 0; start = end + 1;
    }
  }
  // A missing newline is accepted for old JSONL files; invalid JSON still fails.
  if (length) yield Buffer.concat(parts, length);
}

async function pack(file, limits = LIMITS) {
  const archive = file + '.chunks.gz', indexPath = archive + '.index.json';
  const entries = [];
  let deduplicatedBytes = 0, compressedBytes = 0;
  const output = await fs.promises.open(archive, 'w');
  try {
    for await (const line of lines(file, limits)) {
      if (entries.length >= limits.records) throw new Error('追蹤分塊數量超過上限');
      const body = Buffer.concat([line, Buffer.from('\n')]);
      const compressed = await zip(body, {level:6});
      if (compressedBytes + compressed.length > limits.compressed) throw new Error('壓縮追蹤資料超過大小上限');
      // writeFile on a FileHandle appends at the current position and handles short writes.
      await output.writeFile(compressed);
      entries.push({offset:compressedBytes, bytes:compressed.length, expandedBytes:body.length});
      deduplicatedBytes += body.length;
      compressedBytes += compressed.length;
    }
    await fs.promises.writeFile(indexPath, JSON.stringify({version:1, entries}));
    return {archive, indexPath, entries, stats:{format:'asm-trace-chunks-v2',
      deduplicatedBytes, compressedBytes, indexBytes:(await fs.promises.stat(indexPath)).size,
      chunks:entries.length}};
  } finally { await output.close(); }
}

async function* readChunks(archive, entries, limits = LIMITS) {
  const input = await fs.promises.open(archive, 'r');
  let total = 0;
  try {
    for (const entry of entries) {
      if (!Number.isSafeInteger(entry.offset) || entry.offset < 0 || !Number.isSafeInteger(entry.bytes)
          || entry.bytes < 1 || entry.bytes > limits.compressed || !Number.isSafeInteger(entry.expandedBytes)
          || entry.expandedBytes < 1 || entry.expandedBytes > limits.record + 1)
        throw new Error('無效的追蹤分塊索引');
      const compressed = Buffer.allocUnsafe(entry.bytes);
      let read = 0;
      while (read < compressed.length) {
        const result = await input.read(compressed, read, compressed.length-read, entry.offset+read);
        if (!result.bytesRead) throw new Error('追蹤分塊不完整');
        read += result.bytesRead;
      }
      const body = await unzip(compressed, {maxOutputLength:limits.record+1});
      if (body.length !== entry.expandedBytes) throw new Error('追蹤分塊大小不符');
      total += body.length;
      if (total > limits.file) throw new Error('追蹤解壓縮資料超過大小上限');
      yield JSON.parse(body.toString('utf8'));
    }
  } finally { await input.close(); }
}

async function read(file, limits = LIMITS) {
  if (!fs.existsSync(file)) return null;
  const packed = await pack(file, limits);
  const records = [];
  let pending = [], events = 0, expanded = 0, version = null, lastOrder = -1;
  for await (const record of readChunks(packed.archive, packed.entries, limits)) {
    if (record.record === 'meta') {
      if (version !== null || !['1.0','2.0'].includes(record.schemaVersion)) throw new Error('不支援的追蹤格式');
      version = record.schemaVersion;
      records.push({...record, schemaVersion:'1.0'});
    } else if (record.record === 'error') {
      throw new Error('追蹤產生失敗：' + String(record.message || '超過限制'));
    } else if (version === null) {
      throw new Error('追蹤格式標頭遺失');
    } else if (record.record === 'events') {
      if (version !== '2.0' || !Array.isArray(record.templates) || !Array.isArray(record.events))
        throw new Error('無效的追蹤事件分塊');
      const lengths = record.templates.map(item => Buffer.byteLength(JSON.stringify(item)));
      for (const row of record.events) {
        if (!Array.isArray(row) || row.length !== 3 || !Number.isSafeInteger(row[0]) || row[0] <= lastOrder
            || !Number.isSafeInteger(row[1]) || row[1] < 0 || row[1] >= record.templates.length
            || !row[2] || typeof row[2] !== 'object' || Array.isArray(row[2])) throw new Error('無效的追蹤事件參照');
        lastOrder = row[0];
        if (++events > limits.events) throw new Error('追蹤事件數量超過上限');
        expanded += lengths[row[1]] + Buffer.byteLength(JSON.stringify(row[2])) + 64;
        if (expanded > limits.expanded) throw new Error('追蹤事件展開大小超過上限');
        pending.push({id:`event-${row[0]}`, order:row[0], ...record.templates[row[1]], ...row[2]});
      }
    } else if (record.record === 'frame') {
      if (version === '2.0') {
        if (!Array.isArray(record.events) || record.events.length || record.eventCount !== pending.length) throw new Error('追蹤幀的事件數量不符');
        const {eventCount, ...frame} = record;
        records.push({...frame, events:pending}); pending = [];
      } else {
        events += record.events?.length || 0;
        if (events > limits.events) throw new Error('追蹤事件數量超過上限');
        records.push(record);
      }
    } else records.push(record);
  }
  if (version === null) throw new Error('追蹤檔案沒有格式標頭');
  if (pending.length) {
    const lastFrame = records.findLast(record => record.record === 'frame');
    if (lastFrame) {
      // Keep the captured state and frame count unchanged. These events occur
      // after that state's capture, unlike the interval consumed by a frame.
      lastFrame.captureOrder = (lastFrame.events || []).reduce((order, event) =>
        Math.max(order, Number(event.order)), -1);
      lastFrame.events = [...lastFrame.events, ...pending.map(event => ({...event, afterCapture:true}))];
    }
  }
  return {records, stats:{...packed.stats, events}};
}

// Stream the large arrays instead of building another full JSON string in memory.
function* jsonParts(value, key = '') {
  if (Array.isArray(value)) {
    yield '[';
    for (let i=0;i<value.length;i++) { if (i) yield ','; yield* jsonParts(value[i], key === 'frames' ? 'frame' : 'event'); }
    yield ']';
  } else if (value && typeof value === 'object' && ['','traceDocument','frame'].includes(key)) {
    yield '{'; let first = true;
    for (const [name, item] of Object.entries(value)) {
      if (item === undefined) continue;
      if (!first) yield ','; first = false;
      yield JSON.stringify(name) + ':'; yield* jsonParts(item, name);
    }
    yield '}';
  } else yield JSON.stringify(value) ?? 'null';
}
async function sendJson(req, res, body) {
  res.type('application/json');
  res.vary('Accept-Encoding');
  // Batch small tokens to keep stream overhead bounded as well as memory.
  function* buffers() {
    let pieces = [], size = 0;
    for (const part of jsonParts(body)) {
      pieces.push(part); size += part.length;
      if (size >= 64*1024) { yield Buffer.from(pieces.join('')); pieces=[]; size=0; }
    }
    if (pieces.length) yield Buffer.from(pieces.join(''));
  }
  if (req.acceptsEncodings('gzip')) {
    res.set('Content-Encoding','gzip');
    await pipeline(Readable.from(buffers()), createGzip({level:6}), res);
  } else await pipeline(Readable.from(buffers()), res);
}
module.exports = {LIMITS, lines, pack, readChunks, read, sendJson, jsonParts};
