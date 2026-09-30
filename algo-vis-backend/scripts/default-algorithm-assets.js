const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gzipSync } = require('node:zlib');

const FORMAT = 'AlgoShowMaker.default-animation';
const PACKAGE_VERSION = 1;
const MAGIC = Buffer.from('ASMTRACE1\n');
const DEFAULT_SLIDE_ID = 'linear-sieve-teaching-22';

const clone = value => JSON.parse(JSON.stringify(value));
const sha256 = value => createHash('sha256').update(value).digest('hex');

function animationPayload(animation, traceDocument, kind, totalFrames, engineVersion) {
  return {
    format: FORMAT,
    packageVersion: PACKAGE_VERSION,
    engineVersion,
    kind,
    totalFrames,
    animation: {
      mode: 'trace',
      code: animation.code,
      input: animation.input || '',
      sliceMode: animation.sliceMode || traceDocument.sliceMode || 'auto',
      watches: clone(animation.watches || []),
      skins: clone(traceDocument.skins || animation.skins || {}),
      rules: clone(traceDocument.rules || animation.rules || []),
      traceDocument
    }
  };
}

function encodePayload(payload) {
  const text = JSON.stringify(payload);
  const compressed = gzipSync(Buffer.from(text), { level: 9 });
  return {
    bytes: Buffer.concat([MAGIC, compressed]),
    contentHash: sha256(text),
    jsonBytes: Buffer.byteLength(text)
  };
}

async function atomicWrite(target, content) {
  const temporary = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temporary, content);
  await fs.rename(temporary, target);
}

async function buildDefaultAlgorithmAssets(deck, options = {}) {
  const publicRoot = options.publicRoot || path.resolve(__dirname, '../public');
  const slideId = options.slideId || DEFAULT_SLIDE_ID;
  const slide = (deck.groups || []).flatMap(group => group.slides || [])
    .find(item => item.id === slideId);
  const animation = slide?.animation;
  const fullTrace = animation?.traceDocument;
  if (!animation?.code?.trim() || !fullTrace?.frames?.length) {
    throw new Error(`預設演算法投影片 ${slideId} 缺少程式碼或完整 Trace。`);
  }
  const engineVersion = options.engineVersion
    || `${fullTrace.provenance?.engineVersion}/${fullTrace.provenance?.formatVersion}`;
  if (!/^\d+\/\d+$/.test(engineVersion)) throw new Error('預設動畫缺少有效的引擎版本。');

  const totalFrames = fullTrace.frames.length;
  const firstFrame = fullTrace.frames[0];
  const snapshotIds = new Set(firstFrame.snapshotIds || []);
  const previewTrace = clone({
    ...fullTrace,
    frames: [firstFrame],
    snapshots: (fullTrace.snapshots || []).filter(snapshot => snapshotIds.has(snapshot.id))
  });
  const preview = encodePayload(animationPayload(animation, previewTrace, 'preview', totalFrames, engineVersion));
  const full = encodePayload(animationPayload(animation, clone(fullTrace), 'full', totalFrames, engineVersion));

  const directory = path.join(publicRoot, 'default-animation');
  await fs.mkdir(directory, { recursive: true });
  await atomicWrite(path.join(directory, 'linear-sieve-preview.asmtrace'), preview.bytes);
  await atomicWrite(path.join(directory, 'linear-sieve-full.asmtrace'), full.bytes);
  const provenance = fullTrace.provenance || {};
  const manifest = {
    format: FORMAT,
    packageVersion: PACKAGE_VERSION,
    engineVersion,
    id: 'linear-sieve',
    sourceSlideId: slideId,
    totalFrames,
    sourceFingerprint: provenance.sourceFingerprint,
    inputFingerprint: provenance.inputFingerprint,
    preview: {
      url: '/default-animation/linear-sieve-preview.asmtrace',
      contentHash: preview.contentHash,
      bytes: preview.bytes.length,
      jsonBytes: preview.jsonBytes
    },
    full: {
      url: '/default-animation/linear-sieve-full.asmtrace',
      contentHash: full.contentHash,
      bytes: full.bytes.length,
      jsonBytes: full.jsonBytes
    }
  };
  await atomicWrite(path.join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const sampleCode = animation.code.replace(/\r\n?/g, '\n').split('\n')
    .map(line => line.trimEnd()).join('\n').trimEnd();
  await atomicWrite(path.join(publicRoot, 'sample_code.cpp'), `${sampleCode}\n`);
  return manifest;
}

module.exports = { buildDefaultAlgorithmAssets, FORMAT, PACKAGE_VERSION, MAGIC, DEFAULT_SLIDE_ID };
