/**
 * AlgoShowMaker 後端服務
 *
 * 模組職責與請求生命週期：
 * 1. 提供帳號、偏好設定、投影片、分享連結與程式草稿的 REST API。
 * 2. `/trace/analyze` 與 `/syntax-tree` 只解析來源碼，不執行使用者程式。
 * 3. `/compile` 先驗證輸入與危險語彙，再插入追蹤碼、呼叫 C++ 編譯器，
 *    於受時間／輸出／記憶體限制的子程序中執行，最後整理成前端使用的 trace。
 * 4. 投影片中的大型 trace 會由 CloudContent 抽離與還原；資料庫文件只保存引用，
 *    因此任何寫入流程都必須同步維護 resource_keys，避免孤兒資源或斷裂引用。
 *
 * 主要不變條件：所有私人資源查詢都必須以 JWT 的 user_uid 限定擁有者；分享寫入
 * 必須持有 edit token；子程序完成、逾時或失敗時都要回收計時器與暫存檔；回傳給
 * 瀏覽器的錯誤不可洩漏密碼、JWT secret 或伺服器內部檔案內容。
 */

// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const { EventEmitter } = require('node:events');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { performance } = require('perf_hooks');
//引入 crypto uuid
const { createHash, randomUUID: uuidv4 } = require('crypto');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');            //資料庫溝通套件
const bcrypt = require('bcryptjs');            //密碼加密套件
const jwt = require('jsonwebtoken');        //webtoken套件
const nodemailer = require('nodemailer');          //重置密碼email套件
const {
  JWT_SIGN_OPTIONS,
  JWT_VERIFY_OPTIONS,
  loadJwtSecret
} = require('./jwt-config');
const {
  normalizeSource,
  buildSyntaxTree,
  instrumentSource
} = require('./trace-instrumenter');
const TraceViewSource = require('./public/trace-view-source');
const TraceProvenance = require('./public/trace-provenance');
const TraceChunkStore = require('./trace-chunk-store');
const SlideStorage = require('./public/slides-storage');
const CloudContent = require('./cloud-content');
const { resolveCompileOwner } = require('./compile-owner');
const {
  CompileJobQueue,
  CompileQueueCancelledError,
  CompileQueueError,
} = require('./compile-job-queue');
const {
  getCompileDebugMessages,
  logCompileDebug,
  runWithCompileContext,
} = require('./compile-context');
const { TraceAnalysisPool, TraceAnalysisQueueError } = require('./trace-analysis-pool');
const {
  ArtifactCache,
  createExecutableKey,
  createTraceKey,
  canonicalStringify,
  sha256Canonical,
} = require('./artifact-cache');
const {
  CompileJobRegistry,
  CompileJobRegistryError,
} = require('./compile-job-registry');

// JWT 密鑰必須由部署環境提供；缺少或使用公開預設值時直接停止啟動。
const JWT_SECRET = loadJwtSecret();

// 設定連線字串
// Docker 會自動幫你把 'mongo' 解析成該容器的 IP 位址。
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/algo_vis_db';

// 開始連線
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB 連線成功！'))
  .catch(err => console.error('MongoDB 連線失敗:', err));

// User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, // 帳號 (唯一)
  password: { type: String, required: true },               // 密碼 (加密後)
  // 密碼重置用的 Token 與 過期時間
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  preferences: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// ─────────────────────────────────────────────────────────────────────────────
// 持久化資料模型：投影片本體、外部 trace 引用與分享權限
// ─────────────────────────────────────────────────────────────────────────────

const SlideDeckSchema = new mongoose.Schema({
  user_uid: { type: String, required: true, index: true },
  deck_uid: { type: String, required: true, unique: true },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
    default: '未命名投影片'
  },
  deck: { type: mongoose.Schema.Types.Mixed, required: true },
  trace_references: { type: mongoose.Schema.Types.Mixed, default: () => [] },
  trace_results: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  cloud_snapshot: { type: String, default: '' },
  resource_keys: { type: [String], default: () => [] },
  cover_thumbnail: { type: String, default: '' },
  slide_count: { type: Number, default: 0 },
  share_mode: {
    type: String,
    enum: ['private', 'view', 'edit'],
    default: 'private'
  },
  share_view_token: {
    type: String,
    unique: true,
    sparse: true,
    select: false
  },
  share_edit_token: {
    type: String,
    unique: true,
    sparse: true,
    select: false
  },
  format: { type: String, default: 'AlgoShowMaker.slides' },
  version: { type: String, default: 'AV_V4.3' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

SlideDeckSchema.index({ user_uid: 1, updated_at: -1 });

const SlideDeck = mongoose.model('SlideDeck', SlideDeckSchema);

// 設定 Email 寄送器 (Transporter)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER || 'your-email@gmail.com',
    pass: process.env.SMTP_PASS || 'your-app-password'
  }
});

const BLACKLIST_KEYWORDS = [
  // 1. 執行與程序控制
  'system', 'popen', 'exec', 'fork', 'clone', 'wait', 'kill', 'raise',

  // 2. 檔案讀寫 (Stream & C-style)
  'fstream', 'ifstream', 'ofstream', 'fstream',
  'fopen', 'freopen', 'fdopen', 'fflush',

  // 3. 檔案操作 (刪除、移動、權限)
  'remove', 'rename', 'unlink', 'mkdir', 'rmdir', 'chmod', 'chown', 'stat',

  // 4. 系統與網路
  'getenv', 'setenv', 'putenv', 'ptrace', 'socket',

  // 5. 危險標頭檔 (include)
  '<unistd.h>', '<fcntl.h>', '<sys/', '<windows.h>', '<signal.h>'
];


// 1. 先初始化 app (非常重要，必須在 app.use 之前！)
const app = express();
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
  // Docker 部署只有一層 Nginx；讓限流器使用代理提供的真實客戶端 IP。
  app.set('trust proxy', trustProxyHops);
}
const PORT = process.env.PORT || 3000;
const INTERNAL_COMPILE_TOKEN = uuidv4();

function positiveIntegerEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function attachCompileOwner(req, res, next) {
  if (req.headers['x-asm-internal-token'] === INTERNAL_COMPILE_TOKEN) {
    req.isInternalCompileRequest = true;
    req.compileOwnerId = String(req.headers['x-asm-internal-owner'] || 'internal:async');
    return next();
  }
  req.compileOwnerId = resolveCompileOwner(req, res, {
    secret: JWT_SECRET,
    verifyBearer: token => jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTIONS),
  });
  next();
}

// 共用網路只做寬鬆的濫用保護；公平性與每人上限使用帳號或簽章瀏覽器 session。
const ipAbuseLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 分鐘內
  max: positiveIntegerEnv('COMPILE_IP_RATE_LIMIT_PER_MINUTE', 600),
  message: { error: '請求過於頻繁，請稍後再試' },
  standardHeaders: false,
  legacyHeaders: false,
  skip: req => process.env.ASM_REGRESSION === '1' || req.isInternalCompileRequest
});

const ownerRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: positiveIntegerEnv('COMPILE_OWNER_RATE_LIMIT_PER_MINUTE', 120),
  keyGenerator: req => req.compileOwnerId,
  message: { error: '你的編譯請求過於頻繁，請稍後再試' },
  skip: req => process.env.ASM_REGRESSION === '1' || req.isInternalCompileRequest
});

const compileJobPollLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: positiveIntegerEnv('ASYNC_COMPILE_POLL_RATE_LIMIT_PER_MINUTE', 600),
  keyGenerator: req => req.compileOwnerId,
  message: { error: '工作狀態查詢過於頻繁，請稍後再試' },
  standardHeaders: false,
  legacyHeaders: false,
  skip: () => process.env.ASM_REGRESSION === '1',
});

const compileResultLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: positiveIntegerEnv('ASYNC_COMPILE_RESULT_RATE_LIMIT_PER_MINUTE', 30),
  keyGenerator: req => req.compileOwnerId,
  message: { error: '編譯結果下載過於頻繁，請稍後再試' },
  standardHeaders: false,
  legacyHeaders: false,
  skip: () => process.env.ASM_REGRESSION === '1',
});

const resultStreamState = { active: 0, byOwner: new Map() };
function acquireResultStream(ownerId) {
  const globalLimit = positiveIntegerEnv('ASYNC_COMPILE_RESULT_STREAMS', 8);
  const ownerLimit = positiveIntegerEnv('ASYNC_COMPILE_RESULT_STREAMS_PER_OWNER', 2);
  const ownerActive = resultStreamState.byOwner.get(ownerId) || 0;
  if (resultStreamState.active >= globalLimit || ownerActive >= ownerLimit) return null;
  resultStreamState.active += 1;
  resultStreamState.byOwner.set(ownerId, ownerActive + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    resultStreamState.active -= 1;
    const remaining = (resultStreamState.byOwner.get(ownerId) || 1) - 1;
    if (remaining > 0) resultStreamState.byOwner.set(ownerId, remaining);
    else resultStreamState.byOwner.delete(ownerId);
  };
}

// 先建立公平排程身分，再套用個人與全站濫用限制。
app.use('/compile', attachCompileOwner, ipAbuseLimiter, ownerRateLimiter);

const compileQueue = new CompileJobQueue({
  concurrency: positiveIntegerEnv('COMPILE_CONCURRENCY', 1),
  maxPending: positiveIntegerEnv('COMPILE_MAX_QUEUED', 150),
  maxPendingPerOwner: positiveIntegerEnv('COMPILE_MAX_QUEUED_PER_OWNER', 3),
  maxActivePerOwner: positiveIntegerEnv('COMPILE_MAX_ACTIVE_PER_OWNER', 1),
});

// Async callers release their browser connection immediately and poll a small
// owner-scoped record. A few loopback submissions may wait on the authoritative
// compileQueue, while the remaining burst stays as lightweight registry data.
const compileJobRegistry = new CompileJobRegistry({
  queueOptions: {
    concurrency: positiveIntegerEnv('ASYNC_COMPILE_DISPATCH_CONCURRENCY', 2),
    maxPending: positiveIntegerEnv('COMPILE_MAX_QUEUED', 150),
    maxPendingPerOwner: positiveIntegerEnv('COMPILE_MAX_QUEUED_PER_OWNER', 3),
    maxActivePerOwner: 1,
  },
  ttlMs: positiveIntegerEnv('ASYNC_COMPILE_RESULT_TTL_MINUTES', 10) * 60 * 1000,
  maxResults: positiveIntegerEnv('ASYNC_COMPILE_MAX_RESULTS', 100),
});

function compilePriority(req) {
  const purpose = String(req.headers['x-compile-purpose'] || '').toLowerCase();
  if (purpose === 'manual' || purpose === 'current-slide') return 'interactive';
  if (purpose === 'nearby-slide') return 'normal';
  if (purpose === 'background') return 'background';
  return 'normal';
}

/**
 * Keep the existing synchronous HTTP contract while serializing the expensive
 * compiler/runtime section. The queue slot is released only after the response
 * finishes, so the next request cannot overlap g++, the sandbox, or trace load.
 */
function queueCompileRequest(req, res, next) {
  if (req.method !== 'POST') return next();
  const queuedAt = performance.now();
  let started = false;
  let ticket;

  try {
    ticket = compileQueue.enqueue({
      ownerId: req.compileOwnerId,
      priority: compilePriority(req),
      // HTTP response streaming is still request-bound. Cross-request result
      // deduplication is enabled in the scheduler API after compile execution is
      // extracted into a reusable result object; do not share a response here.
      run: ({ jobId }) => new Promise((resolve) => {
        started = true;
        req.compileWorkSpawned = false;
        req.compileJobId = jobId;
        const waitMs = Math.max(0, Math.round(performance.now() - queuedAt));
        if (!res.headersSent) {
          res.setHeader('X-Compile-Job-Id', jobId);
          res.setHeader('X-Compile-Queue-Wait-Ms', String(waitMs));
        }

        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          resolve();
        };
        req.once('asm:compile-work-complete', release);
        res.once('finish', () => {
          if (!req.compileWorkSpawned) release();
        });
        res.once('close', () => {
          if (!req.compileWorkSpawned) release();
        });
        next();
      }),
    });
  } catch (error) {
    if (error instanceof CompileQueueError) {
      const status = error.code === 'COMPILE_QUEUE_FULL' ? 503 : error.statusCode;
      res.setHeader('Retry-After', '5');
      return res.status(status).json({
        error: error.code === 'COMPILE_QUEUE_FULL'
          ? '編譯佇列已滿，請稍後再試'
          : '你已有太多等待中的編譯工作',
        code: error.code,
      });
    }
    return next(error);
  }

  const cancelIfWaiting = () => {
    if (!started) ticket.cancel();
  };
  req.once('aborted', cancelIfWaiting);
  res.once('close', () => {
    if (!res.writableEnded) cancelIfWaiting();
  });

  ticket.promise.catch((error) => {
    if (error instanceof CompileQueueCancelledError) return;
    if (!res.headersSent) next(error);
    else res.destroy(error);
  });
}

// Queue before JSON parsing so waiting requests do not each retain an up-to-8MB
// parsed body inside the 1 GB backend container.
app.use('/compile', queueCompileRequest);

app.get('/api/compile/queue', async (req, res) => {
  const state = compileQueue.snapshot();
  const asyncState = compileJobRegistry.metrics();
  const asyncQueue = asyncState.queue;
  await artifactCacheReady;
  res.json({
    active: state.active,
    pending: state.pending,
    concurrency: state.concurrency,
    maxPending: state.maxPending,
    asyncJobs: {
      queued: asyncState.queued,
      running: asyncState.running,
      completed: asyncState.completed,
      failed: asyncState.failed,
      cancelled: asyncState.cancelled,
      retained: asyncState.retained,
      counters: asyncState.counters,
      queue: {
        concurrency: asyncQueue.concurrency,
        maxActivePerOwner: asyncQueue.maxActivePerOwner,
        maxPendingPerOwner: asyncQueue.maxPendingPerOwner,
        maxPending: asyncQueue.maxPending,
        active: asyncQueue.active,
        pending: asyncQueue.pending,
        inFlightKeys: asyncQueue.inFlightKeys,
      },
    },
    traceAnalysis: traceAnalysisPool.snapshot(),
    traceAnalysisCacheEntries: traceAnalysisCache.size,
    resultStreams: {
      active: resultStreamState.active,
      max: positiveIntegerEnv('ASYNC_COMPILE_RESULT_STREAMS', 8),
    },
    artifacts: artifactCache.stats(),
  });
});

// 設定目錄路徑
const SAMPLE_DIR = path.join(__dirname, 'tmp', 'algorithm_sample');
// 確保暫存目錄存在
const TEMP_DIR = process.env.ASM_TEMP_DIR
  ? path.resolve(process.env.ASM_TEMP_DIR)
  : path.join(__dirname, 'tmp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function computeCompilerFingerprint() {
  const hash = createHash('sha256');
  hash.update(process.env.ASM_COMPILER_FINGERPRINT || `${process.platform}-${process.arch}-g++`);
  for (const args of [['--version'], ['-dumpmachine'], ['-dumpfullversion', '-dumpversion']]) {
    const result = spawnSync('g++', args, { encoding: 'utf8', timeout: 3000, windowsHide: true });
    hash.update(result.stdout || '');
    hash.update(result.stderr || '');
    hash.update(String(result.status));
  }
  for (const relativePath of ['trace-instrumenter.js', 'lib/ASMTrace.hpp', 'lib/AV.hpp']) {
    hash.update(relativePath);
    hash.update(fs.readFileSync(path.join(__dirname, relativePath)));
  }
  return `asm-compiler-v2-${hash.digest('hex')}`;
}

const COMPILER_FINGERPRINT = computeCompilerFingerprint();

const artifactCache = new ArtifactCache({
  rootDir: process.env.ARTIFACT_CACHE_DIR || path.join(__dirname, 'artifact-cache-data'),
  maxBytes: positiveIntegerEnv('ARTIFACT_CACHE_MAX_MB', 512) * 1024 * 1024,
  defaultTtlMs: positiveIntegerEnv('ARTIFACT_CACHE_TTL_HOURS', 168) * 60 * 60 * 1000,
});
const artifactCacheReady = artifactCache.init().catch((error) => {
  console.error('Artifact cache initialization failed:', error.message);
  return null;
});

const artifactMaintenanceTimer = setInterval(() => {
  compileJobRegistry.metrics();
  artifactCache.prune().catch(error => console.error('Artifact cache prune failed:', error.message));
}, 60_000);
artifactMaintenanceTimer.unref();

// === 限制設定 ===
const LIMITS = {
  TIME_MS: 5000,
  MEMORY_MB: 256,
  OUTPUT_SIZE: 64 * 1024,
  COMPILE_TIME_MS: 20 * 1000,
  COMPILE_STDERR_SIZE: 256 * 1024,
  HTTP_JSON_SIZE: '8mb',
};

// Static trace analysis is deterministic for a source string. Keeping a small
// process-local LRU avoids repeating the same parser/instrumenter CPU work when
// many browsers open the same public example deck.
const TRACE_ANALYSIS_CACHE_MAX = positiveIntegerEnv('TRACE_ANALYSIS_CACHE_MAX', 100);
const traceAnalysisCache = new Map();
const traceAnalysisPool = new TraceAnalysisPool({
  size: positiveIntegerEnv('TRACE_ANALYSIS_WORKERS', 1),
  maxPending: positiveIntegerEnv('TRACE_ANALYSIS_MAX_QUEUED', 150),
});

function getCachedTraceAnalysis(key) {
  const value = traceAnalysisCache.get(key);
  if (!value) return null;
  traceAnalysisCache.delete(key);
  traceAnalysisCache.set(key, value);
  return value;
}

function setCachedTraceAnalysis(key, value) {
  traceAnalysisCache.set(key, value);
  while (traceAnalysisCache.size > TRACE_ANALYSIS_CACHE_MAX) {
    traceAnalysisCache.delete(traceAnalysisCache.keys().next().value);
  }
}

// 記錄 debug 訊息
function logDebug(msg, extra = {}) {
  logCompileDebug(msg, extra);
}

function usesLegacyAnimationCompiler(source) {
  if (typeof source !== 'string') return false;
  return /^\s*#\s*include\s*[<"]AV\.hpp[>"]/m.test(source)
    || /\/\/\s*draw\s*\{/.test(source);
}

// 設定中間件
app.use('/vendor/reveal', express.static(path.join(__dirname, 'node_modules', 'reveal.js', 'dist')));
app.use('/vendor/fabric', express.static(path.join(__dirname, 'node_modules', 'fabric', 'dist')));
app.use('/vendor/iro', express.static(path.join(__dirname, 'node_modules', '@jaames', 'iro', 'dist')));
app.use('/vendor/ace', express.static(path.join(__dirname, 'node_modules', 'ace-builds', 'src-min-noconflict')));
app.use(express.static(path.join(__dirname, 'public')));
// Async jobs are spooled to disk, but bounding each request also limits the
// short interval between JSON parsing and the spool write during a burst.
app.use('/api/compile/jobs', express.json({ limit: '512kb' }));
app.use(express.json({ limit: LIMITS.HTTP_JSON_SIZE }));
app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    if (req.path?.startsWith('/api/compile/jobs')) {
      return res.status(413).json({ error: '非同步編譯請求超過 512 KB 上限' });
    }
    return res.status(413).json({ error: '請求內容超過 8 MB 上限' });
  }
  return next(err);
});

function sendCompileJobError(res, error) {
  if (error instanceof CompileJobRegistryError || error instanceof CompileQueueError) {
    if (error.code === 'COMPILE_QUEUE_FULL') res.setHeader('Retry-After', '5');
    return res.status(error.statusCode || 500).json({ error: error.message, code: error.code });
  }
  console.error('Async compile job failed:', error);
  return res.status(500).json({ error: '非同步編譯工作暫時無法使用', code: 'ASYNC_COMPILE_ERROR' });
}

function forwardedCompileHeaders(req) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Compile-Cache': 'shared',
    'X-Compile-Purpose': String(req.headers['x-compile-purpose'] || 'background'),
    'X-ASM-Internal-Token': INTERNAL_COMPILE_TOKEN,
    'X-ASM-Internal-Owner': req.compileOwnerId,
  };
  return headers;
}

async function spoolFetchResponse(response, ttlMs) {
  const maximumBytes = positiveIntegerEnv('ASYNC_COMPILE_RESULT_MAX_MB', 128) * 1024 * 1024;
  const declaredBytes = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredBytes) && declaredBytes > maximumBytes) {
    throw new Error(`非同步編譯結果超過 ${maximumBytes / 1024 / 1024} MB 上限`);
  }
  const stagingDirectory = path.join(artifactCache.rootDir, '.staging');
  await fs.promises.mkdir(stagingDirectory, { recursive: true });
  const temporaryPath = path.join(stagingDirectory, `async_result_${uuidv4()}.json`);
  const hash = createHash('sha256').update('async-compile-result-v1\0');
  let bytes = 0;
  const limiter = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      if (bytes > maximumBytes) return callback(new Error(`非同步編譯結果超過 ${maximumBytes / 1024 / 1024} MB 上限`));
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    const source = response.body ? Readable.fromWeb(response.body) : Readable.from([]);
    await pipeline(source, limiter, fs.createWriteStream(temporaryPath, { flags: 'wx' }));
    const sharedTraceId = String(response.headers.get('x-compile-trace-id') || '');
    if (/^[a-f0-9]{64}$/.test(sharedTraceId)) {
      const sharedTrace = await artifactCache.lookup('trace', sharedTraceId);
      if (sharedTrace) {
        return {
          statusCode: response.status,
          resultArtifactId: sharedTraceId,
          contentType: response.headers.get('content-type') || 'application/json',
        };
      }
    }
    const resultArtifactId = hash.digest('hex');
    await artifactCache.putFile('trace', resultArtifactId, temporaryPath, {
      ttlMs,
      metadata: {
        asyncCompileResult: true,
        statusCode: response.status,
        contentType: response.headers.get('content-type') || 'application/json',
      },
    });
    return {
      statusCode: response.status,
      resultArtifactId,
      contentType: response.headers.get('content-type') || 'application/json',
    };
  } finally {
    await fs.promises.rm(temporaryPath, { force: true }).catch(() => {});
  }
}

async function storeJsonArtifact(key, body, options = {}) {
  const stagingDirectory = path.join(artifactCache.rootDir, '.staging');
  await fs.promises.mkdir(stagingDirectory, { recursive: true });
  const temporaryPath = path.join(stagingDirectory, `cached_response_${uuidv4()}.json`);
  try {
    await pipeline(
      Readable.from(TraceChunkStore.jsonParts(body)),
      fs.createWriteStream(temporaryPath, { flags: 'wx' }),
    );
    return await artifactCache.putFile('trace', key, temporaryPath, options);
  } finally {
    await fs.promises.rm(temporaryPath, { force: true }).catch(() => {});
  }
}

// Optional non-blocking API for bursty classrooms. Existing clients may keep
// using POST /compile; new clients can submit once, poll status, then download
// the owner-scoped result without holding a long HTTP connection open.
app.post('/api/compile/jobs', attachCompileOwner, ipAbuseLimiter, ownerRateLimiter, async (req, res) => {
  if (typeof req.body?.code !== 'string') return res.status(400).json({ error: 'code 必須是字串' });
  if (!req.body.code.trim()) return res.status(400).json({ error: '程式碼不能為空白', code: 'EMPTY_SOURCE' });
  if (!await artifactCacheReady) return res.status(503).json({ error: '編譯結果儲存區尚未就緒' });
  const requestBody = { ...req.body, cachePolicy: 'shared' };
  const asyncResultTtlMs = positiveIntegerEnv('ASYNC_COMPILE_RESULT_TTL_MINUTES', 10) * 60 * 1000;
  const asyncRequestTtlMs = positiveIntegerEnv('ASYNC_COMPILE_REQUEST_TTL_MINUTES', 120) * 60 * 1000;
  const requestArtifactId = sha256Canonical({
    namespace: 'async-compile-request-v1',
    requestBody,
    engine: `${TraceProvenance.ENGINE_VERSION}/${TraceProvenance.FORMAT_VERSION}`,
    compiler: COMPILER_FINGERPRINT,
  });
  const compileHeaders = forwardedCompileHeaders(req);
  const priority = compilePriority(req);
  try {
    await artifactCache.put('trace', requestArtifactId, canonicalStringify(requestBody), {
      ttlMs: asyncRequestTtlMs,
      metadata: { asyncCompileRequest: true },
    });
    const handle = compileJobRegistry.submit({
      ownerId: req.compileOwnerId,
      key: requestArtifactId,
      priority,
      metadata: { requestArtifactId },
      run: async () => {
        const requestArtifact = await artifactCache.read('trace', requestArtifactId);
        if (!requestArtifact) {
          const error = new Error('排隊中的編譯內容已過期，請重新送出工作');
          error.code = 'ASYNC_COMPILE_REQUEST_EXPIRED';
          error.statusCode = 410;
          throw error;
        }
        try {
          const response = await fetch(`http://127.0.0.1:${PORT}/compile`, {
            method: 'POST',
            headers: compileHeaders,
            body: requestArtifact.data,
            signal: AbortSignal.timeout(positiveIntegerEnv('ASYNC_COMPILE_TIMEOUT_MS', 420_000)),
          });
          if (response.status === 429 || response.status >= 500) {
            await response.body?.cancel().catch(() => {});
            const error = new Error(`內部編譯服務回應 ${response.status}`);
            error.code = 'ASYNC_COMPILE_UPSTREAM_ERROR';
            error.statusCode = response.status;
            throw error;
          }
          return await spoolFetchResponse(response, asyncResultTtlMs);
        } finally {
          await artifactCache.remove('trace', requestArtifactId).catch(() => {});
        }
      },
    });
    const snapshot = compileJobRegistry.getSnapshot(handle.jobId, req.compileOwnerId);
    res.status(202).json({
      jobId: handle.jobId,
      state: snapshot.state,
      queuePosition: snapshot.queuePosition,
      deduplicated: handle.deduplicated,
      statusUrl: `/api/compile/jobs/${handle.jobId}`,
      resultUrl: `/api/compile/jobs/${handle.jobId}/result`,
    });
  } catch (error) {
    if (res.headersSent || res.destroyed) {
      console.error('Async compile result stream failed:', error.message);
      if (!res.destroyed) res.destroy(error);
      return undefined;
    }
    return sendCompileJobError(res, error);
  }
});

app.get('/api/compile/jobs/:jobId', attachCompileOwner, compileJobPollLimiter, (req, res) => {
  try {
    const snapshot = compileJobRegistry.getSnapshot(req.params.jobId, req.compileOwnerId);
    res.json({
      ...snapshot,
      resultUrl: snapshot.state === 'completed'
        ? `/api/compile/jobs/${snapshot.jobId}/result`
        : null,
    });
  } catch (error) {
    if (res.headersSent || res.destroyed) {
      console.error('Async compile result stream failed:', error.message);
      if (!res.destroyed) res.destroy(error);
      return undefined;
    }
    return sendCompileJobError(res, error);
  }
});

app.get('/api/compile/jobs/:jobId/result', attachCompileOwner, compileResultLimiter, async (req, res) => {
  const releaseStream = acquireResultStream(req.compileOwnerId);
  if (!releaseStream) {
    res.setHeader('Retry-After', '2');
    return res.status(429).json({ error: '目前下載中的大型結果過多，請稍後再試' });
  }
  try {
    const snapshot = compileJobRegistry.getSnapshot(req.params.jobId, req.compileOwnerId);
    if (snapshot.state !== 'completed') {
      return res.status(409).json({ error: '編譯工作尚未完成', state: snapshot.state });
    }
    const lease = await artifactCache.acquire('trace', snapshot.result.resultArtifactId);
    if (!lease) return res.status(410).json({ error: '編譯結果已過期，請重新送出工作' });
    res.status(snapshot.result.statusCode);
    res.type(snapshot.result.contentType || 'application/json');
    res.setHeader('Content-Length', String(lease.entry.size));
    try {
      await pipeline(fs.createReadStream(lease.entry.path), res);
    } finally {
      await lease.release();
    }
    return undefined;
  } catch (error) {
    if (res.headersSent || res.destroyed) {
      console.error('Async compile result stream failed:', error.message);
      if (!res.destroyed) res.destroy(error);
      return undefined;
    }
    return sendCompileJobError(res, error);
  } finally {
    releaseStream();
  }
});

app.delete('/api/compile/jobs/:jobId', attachCompileOwner, (req, res) => {
  try {
    res.json(compileJobRegistry.cancel(req.params.jobId, req.compileOwnerId));
  } catch (error) {
    return sendCompileJobError(res, error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 靜態分析 API：只解析來源碼，不會編譯或執行使用者輸入
// ─────────────────────────────────────────────────────────────────────────────

app.post('/trace/analyze', attachCompileOwner, ipAbuseLimiter, ownerRateLimiter, async (req, res) => {
  let code = req.body?.code;
  if (typeof code !== 'string') return res.status(400).json({ error: '程式碼必須是字串' });
  if (code.length > 64 * 1024) return res.status(400).json({ error: '程式碼不可超過 64KB' });
  code = normalizeSource(code);
  const cacheKey = createHash('sha256').update(code).digest('base64url');
  const cached = getCachedTraceAnalysis(cacheKey);
  if (cached) {
    res.setHeader('X-Trace-Analysis-Cache', 'HIT');
    return res.json(cached);
  }
  try {
    const responseBody = await traceAnalysisPool.analyze(code);
    setCachedTraceAnalysis(cacheKey, responseBody);
    res.setHeader('X-Trace-Analysis-Cache', 'MISS');
    res.json(responseBody);
  } catch (err) {
    if (err instanceof TraceAnalysisQueueError) {
      res.setHeader('Retry-After', '2');
      return res.status(503).json({ error: '追蹤分析佇列已滿，請稍後再試', code: err.code });
    }
    console.error('Failed to analyze trace source:', err);
    res.status(400).json({ error: `無法分析 C++ 程式碼：${err.message}` });
  }
});

app.post('/syntax-tree', attachCompileOwner, ipAbuseLimiter, ownerRateLimiter, (req, res) => {
  let code = req.body?.code;
  if (typeof code !== 'string') return res.status(400).json({ error: '程式碼必須是字串' });
  if (code.length > 64 * 1024) return res.status(400).json({ error: '程式碼不可超過 64KB' });
  code = normalizeSource(code);
  try {
    res.json({ success: true, ...buildSyntaxTree(code) });
  } catch (error) {
    res.status(400).json({ error: error.message || '無法建立語法樹' });
  }
});

// ==========================================
// 會員系統 API
// ==========================================

// 1. 註冊 (Register)
// ─────────────────────────────────────────────────────────────────────────────
// 帳號 API：註冊、登入、重設密碼與 JWT 身分驗證
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;

  // 簡單驗證
  if (!username || !password) {
    return res.status(400).json({ error: '請輸入帳號和密碼' });
  }

  // 檢查長度 (例如：帳號至少 5 碼，密碼至少 8 碼)
  if (username.length < 5) {
    return res.status(400).json({ error: '帳號長度過短 (至少需 5 個字元)' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: '密碼長度過短 (至少需 8 個字元)' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(username)) {
    return res.status(400).json({ error: '帳號格式錯誤，請使用有效的 Email (例如: user@gmail.com)' });
  }

  try {
    // 檢查帳號是否已存在
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: '此帳號已被註冊' });
    }

    // 密碼加密！ (Salt Rounds = 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 建立新用戶
    const newUser = await User.create({
      username,
      password: hashedPassword
    });

    res.json({ success: true, message: '註冊成功！', user_uid: newUser._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// 2. 登入 (Login)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // 找用戶
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: '帳號或密碼錯誤' });
    }

    // 比對密碼 (將輸入的密碼加密後跟資料庫的比對)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: '帳號或密碼錯誤' });
    }

    // 發放 JWT 通行證
    // 裡面藏了 user_id，有效期限 1 天
    const token = jwt.sign(
      { id: user._id, username: user.username },
      JWT_SECRET,
      JWT_SIGN_OPTIONS
    );

    res.json({ success: true, token, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// 忘記密碼 (寄送重置信)
app.post('/api/auth/forgot-password', async (req, res) => {
  const { username } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: '找不到此帳號 (Email)' });
    }

    // 1. 產生 Token (有效期限 1 小時)
    const token = uuidv4();
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // 2. 建立重置連結 (假設前端跑在 localhost:3000)
    // 使用者點這個連結會帶上 ?reset_token=xxxxx
    // 優先讀取環境變數，如果沒設定就預設用 localhost
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/?reset_token=${token}`;

    // 3. 寄信
    const mailOptions = {
      from: 'AlgoShowMaker <no-reply@algoshowmaker.com>',
      to: user.username, // 假設 username 就是 email
      subject: 'AlgoShowMaker 密碼重置請求',
      text: `您好，請點擊以下連結重置您的密碼：\n\n${resetLink}\n\n(連結 1 小時內有效，若非本人操作請忽略)`
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: '重置信已寄出，請檢查您的信箱！' });

  } catch (err) {
    console.error('寄信失敗:', err);
    res.status(500).json({ error: '寄信失敗，請稍後再試' });
  }
});

// 重置密碼 (設定新密碼)
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    // 1. 驗證 Token 是否存在且沒過期 ($gt = greater than)
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: '連結無效或已過期，請重新申請' });
    }

    // 2. 更新密碼
    if (newPassword.length < 8) {
      return res.status(400).json({ error: '新密碼長度過短 (需 8 碼以上)' });
    }

    user.password = await bcrypt.hash(newPassword, 10);

    // 3. 清除 Token，避免重複使用
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ success: true, message: '密碼重置成功！請使用新密碼登入' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// 3. 驗證身分的中間件 (Middleware)
// 用來保護需要登入才能使用的路由
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // 格式通常是: "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: '請先登入' });

  jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTIONS, (err, user) => {
    if (err) return res.status(403).json({ error: '憑證無效或過期' });

    // 驗證成功，把用戶資料掛在 req 上，後面的路由就可以用了
    req.user = user;
    next();
  });
};

// 範例：取得目前登入使用者的資訊 (受保護路由)
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({
    message: '驗證成功',
    user: req.user
  });
});

const EVENT_SETTING_TYPES = [
  'declare', 'scope-exit', 'visual-exit', 'read', 'write', 'assign', 'compare', 'swap',
  'call', 'function-enter', 'function-exit'
];
const DEFAULT_EVENT_GAP_MS = 500;

// ─────────────────────────────────────────────────────────────────────────────
// 使用者偏好：僅接受已知事件旗標，避免任意欄位寫入 preferences
// ─────────────────────────────────────────────────────────────────────────────

function cleanEventSettings(value = {}) {
  const cleanFlags = source => Object.fromEntries(EVENT_SETTING_TYPES.flatMap(type => (
    typeof source?.[type] === 'boolean' ? [[type, source[type]]] : []
  )));
  return {
    gapMs: Number.isFinite(Number(value.gapMs))
      ? Math.max(0, Math.min(2000, Number(value.gapMs)))
      : DEFAULT_EVENT_GAP_MS,
    autoFixedEnabled: typeof value.autoFixedEnabled === 'boolean'
      ? value.autoFixedEnabled
      : (typeof value.defaultEnabled?.fixed === 'boolean' ? value.defaultEnabled.fixed : true),
    autoLoopBoundaryEnabled: value.autoLoopBoundaryEnabled === true,
    defaultEnabled: cleanFlags(value.defaultEnabled),
    timelineTypes: cleanFlags(value.timelineTypes)
  };
}

app.get('/api/user/preferences/event-settings', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.user.id }).select('preferences').lean();
    if (!user) return res.status(404).json({ error: '找不到使用者' });
    res.json({ success: true, eventSettings: cleanEventSettings(user.preferences?.eventSettings || { gapMs: DEFAULT_EVENT_GAP_MS }) });
  } catch (err) {
    console.error('Failed to load event settings:', err);
    res.status(500).json({ error: '無法讀取事件設定' });
  }
});

app.put('/api/user/preferences/event-settings', authenticateToken, async (req, res) => {
  const eventSettings = cleanEventSettings(req.body?.eventSettings || {});
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.user.id },
      { $set: { 'preferences.eventSettings': eventSettings } },
      { new: true }
    ).select('_id');
    if (!user) return res.status(404).json({ error: '找不到使用者' });
    res.json({ success: true, eventSettings });
  } catch (err) {
    console.error('Failed to save event settings:', err);
    res.status(500).json({ error: '無法儲存事件設定' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 投影片 API：擁有者 CRUD、分享權限，以及外部 trace 資源的存取協調
// ─────────────────────────────────────────────────────────────────────────────

function countDeckSlides(deck) {
  if (!deck || !Array.isArray(deck.groups)) return 0;
  return deck.groups.reduce((total, group) => {
    return total + (Array.isArray(group?.slides) ? group.slides.length : 0);
  }, 0);
}

function cleanDeckTitle(title) {
  const value = String(title || '').trim();
  return value.slice(0, 120) || '未命名投影片';
}

function cleanCoverThumbnail(value) {
  if (typeof value !== 'string') return '';
  const thumbnail = value.trim();
  if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(thumbnail)) return '';
  return thumbnail.length <= 500000 ? thumbnail : '';
}

// List metadata only. The large Fabric canvas payload is fetched when a deck is opened.
require('./slide-library')(app, { authenticateToken, User, SlideDeck });

app.get('/api/slides', authenticateToken, async (req, res) => {
  try {
    const slides = await SlideDeck.find({ user_uid: req.user.id })
      .select('deck_uid title cover_thumbnail slide_count format version created_at updated_at')
      .sort({ updated_at: -1 })
      .lean();
    res.json({ success: true, slides });
  } catch (err) {
    console.error('Failed to list slide decks:', err);
    res.status(500).json({ error: '無法讀取投影片，請稍後再試' });
  }
});

app.post('/api/slides', authenticateToken, async (req, res) => {
  const body = req.body || {};
  const deck = body.deck && typeof body.deck === 'object'
    ? body.deck
    : { groups: [] };

  try {
    const slideDeck = await SlideDeck.create({
      user_uid: req.user.id,
      deck_uid: uuidv4(),
      title: cleanDeckTitle(body.title),
      deck,
      cover_thumbnail: cleanCoverThumbnail(body.cover_thumbnail),
      slide_count: countDeckSlides(deck)
    });

    res.status(201).json({
      success: true,
      slide: {
        deck_uid: slideDeck.deck_uid,
        title: slideDeck.title,
        slide_count: slideDeck.slide_count,
        created_at: slideDeck.created_at,
        updated_at: slideDeck.updated_at
      }
    });
  } catch (err) {
    console.error('Failed to create slide deck:', err);
    res.status(500).json({ error: '無法建立投影片，請稍後再試' });
  }
});

function shareResponse(slide) {
  return {
    mode: slide.share_mode || 'private',
    view_token: slide.share_view_token || null,
    edit_token: slide.share_edit_token || null
  };
}

app.get('/api/slides/:deck_uid/share', authenticateToken, async (req, res) => {
  try {
    const slide = await SlideDeck.findOne({
      deck_uid: req.params.deck_uid,
      user_uid: req.user.id
    }).select('share_mode +share_view_token +share_edit_token');

    if (!slide) {
      return res.status(404).json({ error: '找不到這份投影片' });
    }

    res.json({ success: true, share: shareResponse(slide) });
  } catch (err) {
    console.error('Failed to get slide sharing settings:', err);
    res.status(500).json({ error: '無法讀取分享設定，請稍後再試' });
  }
});

app.put('/api/slides/:deck_uid/share', authenticateToken, async (req, res) => {
  const mode = String(req.body?.mode || '');
  if (!['private', 'view', 'edit'].includes(mode)) {
    return res.status(400).json({ error: '分享權限設定無效' });
  }

  try {
    const slide = await SlideDeck.findOne({
      deck_uid: req.params.deck_uid,
      user_uid: req.user.id
    }).select('share_mode +share_view_token +share_edit_token');

    if (!slide) {
      return res.status(404).json({ error: '找不到這份投影片' });
    }

    slide.share_mode = mode;
    if (mode === 'private') {
      slide.share_view_token = undefined;
      slide.share_edit_token = undefined;
    } else if (mode === 'view') {
      slide.share_view_token = slide.share_view_token || uuidv4();
      slide.share_edit_token = undefined;
    } else {
      slide.share_view_token = slide.share_view_token || uuidv4();
      slide.share_edit_token = slide.share_edit_token || uuidv4();
    }
    await slide.save();

    res.json({ success: true, share: shareResponse(slide) });
  } catch (err) {
    console.error('Failed to update slide sharing settings:', err);
    res.status(500).json({ error: '無法更新分享設定，請稍後再試' });
  }
});

async function restoreSlideDeck(slide, { lazyTraces = false } = {}) {
  if (slide.cloud_snapshot) {
    const restored = await cloudContent.restore(slide, { lazyTraces });
    slide.trace_keys = restored.record.references.map(ref => ref.key);
    return restored.deck;
  }
  if (lazyTraces) {
    const record = slide.trace_references?.length
      ? { deck: slide.deck, references: slide.trace_references }
      : await SlideStorage.project(slide.deck);
    const deck = JSON.parse(JSON.stringify(record.deck));
    for (const ref of record.references) deck.groups[ref.groupIndex].slides[ref.slideIndex].animation.traceView = ref.view || {};
    slide.trace_keys = record.references.map(ref => ref.key);
    return deck;
  }
  return SlideStorage.hydrate({ deck: slide.deck, references: slide.trace_references || [],
    traces: slide.trace_results || {} });
}

async function prepareTraceSave(body, query, updates) {
  if (!body.deck || typeof body.deck !== 'object') return {};
  const previous = await SlideDeck.findOne(query).lean();
  if (!previous) return null;
  if (previous.cloud_snapshot) throw Object.assign(new Error('請重新整理頁面以使用分批儲存'), { status: 409 });
  // A simultaneous editor cannot delete a result referenced by this snapshot.
  query.updated_at = previous.updated_at;
  const owned = previous.trace_references?.length
    ? { traces: previous.trace_results || {} }
    : await SlideStorage.project(previous.deck);
  const incoming = body.trace_storage
    ? { deck: body.deck, references: body.trace_storage.references, traces: body.trace_storage.traces }
    : await SlideStorage.project(body.deck);
  let complete;
  try { complete = await SlideStorage.merge(incoming, owned); }
  catch (error) { error.status = 400; throw error; }
  updates.deck = complete.deck;
  updates.trace_references = complete.references;
  for (const [key, trace] of Object.entries(complete.traces)) {
    if (!Object.hasOwn(previous.trace_results || {}, key)) updates[`trace_results.${key}`] = trace;
  }
  const unset = {};
  for (const key of Object.keys(previous.trace_results || {})) {
    if (!Object.hasOwn(complete.traces, key)) unset[`trace_results.${key}`] = '';
  }
  return unset;
}

async function readSlideTrace(slide, key, history = false) {
  if (!/^[a-f0-9]{64}$/.test(key)) throw Object.assign(new Error('動畫 ID 無效'), { status: 400 });
  if (slide.cloud_snapshot) return cloudContent.trace(slide, key, { history });
  const owned = slide.trace_references?.length
    ? { references: slide.trace_references, traces: slide.trace_results || {} }
    : await SlideStorage.project(slide.deck);
  if (!owned.references.some(ref => ref.key === key) || !Object.hasOwn(owned.traces, key))
    throw Object.assign(new Error('找不到這份投影片的動畫結果'), { status: 404 });
  return owned.traces[key];
}

app.get('/api/slides/:deck_uid/traces/:key', authenticateToken, async (req, res) => {
  try {
    const slide = await SlideDeck.findOne({ deck_uid: req.params.deck_uid, user_uid: req.user.id }).lean();
    if (!slide) return res.status(404).json({ error: '找不到投影片' });
    res.json({ trace: await readSlideTrace(slide, req.params.key, true) });
  } catch (error) { res.status(error.status || 500).json({ error: error.message }); }
});

app.get('/api/shared-slides/:share_token/traces/:key', async (req, res) => {
  try {
    const token = req.params.share_token;
    const slide = await SlideDeck.findOne({ $or: [{ share_view_token: token }, { share_edit_token: token }] })
      .select('deck_uid deck cloud_snapshot trace_references trace_results share_mode +share_view_token +share_edit_token');
    const editor = slide && slide.share_edit_token === token && slide.share_mode === 'edit';
    const viewer = slide && slide.share_view_token === token && ['view', 'edit'].includes(slide.share_mode);
    if (!editor && !viewer) return res.status(404).json({ error: '分享連結無效或已停止分享' });
    res.json({ trace: await readSlideTrace(slide, req.params.key, editor) });
  } catch (error) { res.status(error.status || 500).json({ error: error.message }); }
});

app.get('/api/slides/:deck_uid', authenticateToken, async (req, res) => {
  try {
    const slide = await SlideDeck.findOne({
      deck_uid: req.params.deck_uid,
      user_uid: req.user.id
    }).lean();

    if (!slide) {
      return res.status(404).json({ error: '找不到這份投影片' });
    }

    slide.trace_keys = Object.keys(slide.trace_results || {});
    slide.deck = await restoreSlideDeck(slide, { lazyTraces: req.query?.traceMode === 'lazy' });
    delete slide.trace_results;
    delete slide.trace_references;
    delete slide.cloud_snapshot;
    delete slide.resource_keys;
    res.json({ success: true, slide });
  } catch (err) {
    console.error('Failed to get slide deck:', err);
    res.status(500).json({ error: '無法讀取投影片，請稍後再試' });
  }
});

app.put('/api/slides/:deck_uid', authenticateToken, async (req, res) => {
  const body = req.body || {};
  const updates = {};
  let contentChanged = false;

  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    updates.title = cleanDeckTitle(body.title);
    contentChanged = true;
  }
  if (body.deck && typeof body.deck === 'object') {
    updates.deck = body.deck;
    updates.slide_count = countDeckSlides(body.deck);
    contentChanged = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'cover_thumbnail')) {
    updates.cover_thumbnail = cleanCoverThumbnail(body.cover_thumbnail);
  }
  if (contentChanged) updates.updated_at = new Date();

  try {
    const query = { deck_uid: req.params.deck_uid, user_uid: req.user.id };
    const unset = await prepareTraceSave(body, query, updates);
    if (unset === null) return res.status(404).json({ error: '找不到這份投影片' });
    const slide = await SlideDeck.findOneAndUpdate(
      query,
      { $set: updates, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true, runValidators: true }
    ).select('deck_uid title cover_thumbnail slide_count format version created_at updated_at');

    if (!slide) {
      return res.status(409).json({ error: '投影片已由另一個編輯頁面更新，請重新儲存' });
    }

    res.json({ success: true, slide });
  } catch (err) {
    console.error('Failed to update slide deck:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : '無法儲存投影片，請稍後再試' });
  }
});

app.get('/api/shared-slides/:share_token', async (req, res) => {
  try {
    const token = req.params.share_token;
    const slide = await SlideDeck.findOne({
      $or: [
        { share_view_token: token },
        { share_edit_token: token }
      ]
    }).select('deck_uid title deck cloud_snapshot resource_keys trace_references trace_results cover_thumbnail slide_count updated_at share_mode +share_view_token +share_edit_token');

    const canView = slide
      && slide.share_view_token === token
      && ['view', 'edit'].includes(slide.share_mode);
    const canEdit = slide
      && slide.share_edit_token === token
      && slide.share_mode === 'edit';

    if (!canView && !canEdit) {
      return res.status(404).json({ error: '分享連結無效或已停止分享' });
    }

    res.json({
      success: true,
      slide: {
        title: slide.title,
        deck: await restoreSlideDeck(slide, { lazyTraces: req.query?.traceMode === 'lazy' }),
        trace_keys: slide.trace_keys || Object.keys(slide.trace_results || {}),
        cover_thumbnail: slide.cover_thumbnail,
        slide_count: slide.slide_count,
        updated_at: slide.updated_at
      },
      access: canEdit ? 'edit' : 'view'
    });
  } catch (err) {
    console.error('Failed to get shared slide deck:', err);
    res.status(500).json({ error: '無法讀取分享的投影片，請稍後再試' });
  }
});

app.put('/api/shared-slides/:share_token', async (req, res) => {
  const body = req.body || {};
  const updates = {};

  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    updates.title = cleanDeckTitle(body.title);
  }
  if (body.deck && typeof body.deck === 'object') {
    updates.deck = body.deck;
    updates.slide_count = countDeckSlides(body.deck);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'cover_thumbnail')) {
    updates.cover_thumbnail = cleanCoverThumbnail(body.cover_thumbnail);
  }
  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: '沒有可儲存的內容' });
  }
  updates.updated_at = new Date();

  try {
    const query = { share_edit_token: req.params.share_token, share_mode: 'edit' };
    const unset = await prepareTraceSave(body, query, updates);
    if (unset === null) return res.status(403).json({ error: '這個分享連結沒有編輯權限' });
    const slide = await SlideDeck.findOneAndUpdate(
      query,
      { $set: updates, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true, runValidators: true }
    ).select('title slide_count updated_at');

    if (!slide) {
      return res.status(409).json({ error: '投影片已更新或編輯權限已變更，請重新載入' });
    }

    res.json({ success: true, slide });
  } catch (err) {
    console.error('Failed to update shared slide deck:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : '無法儲存分享的投影片，請稍後再試' });
  }
});

app.delete('/api/slides/:deck_uid', authenticateToken, async (req, res) => {
  try {
    const slide = await SlideDeck.findOneAndDelete({
      deck_uid: req.params.deck_uid,
      user_uid: req.user.id
    });

    if (!slide) {
      return res.status(404).json({ error: '找不到這份投影片' });
    }

    await cloudContent.remove(slide.deck_uid).catch(error => console.error('Deferred deck resource cleanup:', error.message));
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete slide deck:', err);
    res.status(500).json({ error: '無法刪除投影片，請稍後再試' });
  }
});

const cloudContent = CloudContent.register(app, mongoose, SlideDeck, authenticateToken, cleanDeckTitle, cleanCoverThumbnail);

// ─────────────────────────────────────────────────────────────────────────────
// 子程序資源監控：Linux 讀取 /proc；其他平台保留可安全降級的空結果
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 讀取 Linux /proc/<pid>/status
 */
function readProcStatus(pid) {
  try {
    const statusPath = `/proc/${pid}/status`;
    const text = fs.readFileSync(statusPath, 'utf8');

    const getKB = (key) => {
      const m = text.match(new RegExp(`^${key}:\\s+(\\d+)\\s+kB$`, 'm'));
      return m ? Number(m[1]) : null;
    };

    return {
      rssKB: getKB('VmRSS'),
      hwmKB: getKB('VmHWM'),
      vmsKB: getKB('VmSize'),
    };
  } catch (e) {
    return null;
  }
}

/**
 * 記憶體輪詢取樣
 */
function startMemorySampler(childPid, intervalMs = 80) {
  let peakRssKB = 0;
  let peakHwmKB = 0;
  let peakVmsKB = 0;

  const first = readProcStatus(childPid);
  if (first) {
    if (typeof first.rssKB === 'number') peakRssKB = Math.max(peakRssKB, first.rssKB);
    if (typeof first.hwmKB === 'number') peakHwmKB = Math.max(peakHwmKB, first.hwmKB);
    if (typeof first.vmsKB === 'number') peakVmsKB = Math.max(peakVmsKB, first.vmsKB);
  } else {
    logDebug('MEM: /proc 讀取失敗或非 Linux，無法取用 child 記憶體資訊', { pid: childPid });
  }

  const timer = setInterval(() => {
    const info = readProcStatus(childPid);
    if (!info) return;

    if (typeof info.rssKB === 'number') peakRssKB = Math.max(peakRssKB, info.rssKB);
    if (typeof info.hwmKB === 'number') peakHwmKB = Math.max(peakHwmKB, info.hwmKB);
    if (typeof info.vmsKB === 'number') peakVmsKB = Math.max(peakVmsKB, info.vmsKB);
  }, intervalMs);

  return {
    stop: () => clearInterval(timer),
    getPeak: () => ({ peakRssKB, peakHwmKB, peakVmsKB }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Trace 後處理：補齊 renderer、keep 物件生命週期與跨幀快照
//
// keep materialization 必須依原始 frame 順序執行；每一幀以複本承接前態，
// 再套用當幀 mutation／exit，避免修改早先已交付給前端的快照。
// ─────────────────────────────────────────────────────────────────────────────

function defaultTraceRenderer(kind) {
  if (kind === 'matrix') return 'original-matrix';
  if (kind === 'stack') return 'original-stack';
  if (kind === 'queue') return 'original-queue';
  if (['sequence', 'set', 'map'].includes(kind)) return 'original-array';
  if (kind === 'scalar' || kind === 'string') return 'original-cell';
  if (kind === 'node-graph') return 'graph';
  if (kind === 'coordinate-system') return 'coordinate-system';
  return 'object';
}

function autoSliceTraceFrames(frames) {
  if (frames.length <= 2) return frames;
  return frames.filter((frame, index) => {
    if (index === 0 || index === frames.length - 1) return true;
    const hasWatchedEvent = (frame.events || []).some(event =>
      (event.targets || []).some(target => !!target.variableId));
    if (hasWatchedEvent) return true;
    return JSON.stringify(frames[index - 1]?.state || {}) !== JSON.stringify(frame.state || {});
  });
}

function assignKeepBoundaryEvents(frames) {
  if (!Array.isArray(frames) || frames.length < 2) return frames;
  // Preserve the last runtime event that had already happened when each
  // visible frame was captured. Events moved onto the outgoing frame below
  // happened after that capture and before @keep, so @keep last must fold
  // their completed state into the retained copy without replaying older
  // events that the captured state already contains.
  frames.forEach(frame => {
    const orders = (frame.events || [])
      .filter(event => event.afterCapture !== true)
      .map(event => Number(event?.order))
      .filter(Number.isFinite);
    frame.captureOrder = orders.reduce((order, value) => Math.max(order, value), -1);
  });
  for (let frameIndex = 1; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    const ordered = [...(frame.events || [])].sort((left, right) => (
      (Number(left?.order) || 0) - (Number(right?.order) || 0)
    ));
    const keepOrders = ordered
      .filter(event => event?.type === 'keep')
      .map(event => Number(event.order))
      .filter(Number.isFinite);
    if (!keepOrders.length) continue;

    // A manual @exit immediately before @keep is explicitly a pre-keep
    // visual action. A natural scope-exit immediately after @keep can be
    // folded across the boundary only while no observable event intervenes.
    // Keep the original numeric order for diagnostics and tag the visual
    // phase instead of falsifying runtime execution order.
    ordered.forEach((event, eventIndex) => {
      if (event?.type !== 'keep') return;
      const keepOrder = Number(event.order);
      for (let cursor = eventIndex - 1; cursor >= 0; cursor -= 1) {
        const candidate = ordered[cursor];
        if (candidate?.type !== 'visual-exit') break;
        candidate.preKeepExit = true;
        candidate.preKeepOrder = keepOrder;
      }
      for (let cursor = eventIndex + 1; cursor < ordered.length; cursor += 1) {
        const candidate = ordered[cursor];
        if (candidate?.type !== 'scope-exit') break;
        candidate.preKeepExit = true;
        candidate.preKeepOrder = keepOrder;
        candidate.absorbedAfterKeep = true;
      }
    });

    const boundaryOrder = Math.max(...keepOrders);
    const outgoingEvents = ordered.filter(event => (
      event?.type !== 'keep'
      && event?.preKeepExit !== true
      && Number.isFinite(Number(event?.order))
      && Number(event.order) < boundaryOrder
    ));
    if (!outgoingEvents.length) continue;
    const outgoingSet = new Set(outgoingEvents);
    const previousFrame = frames[frameIndex - 1];
    previousFrame.events = [...(previousFrame.events || []), ...outgoingEvents]
      .sort((left, right) => (
        (Number(left?.order) || 0) - (Number(right?.order) || 0)
      ));
    frame.events = ordered.filter(event => !outgoingSet.has(event));
  }
  return frames;
}

function cloneTraceValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function mutationTargets(event = {}) {
  const targets = (event.targets || []).filter(target => target?.variableId);
  const explicit = targets.filter(target => target.role === 'target');
  return explicit.length ? explicit : targets.slice(0, 1);
}

function applyKeepMutation(frame, target, value) {
  const entry = frame?.state?.[target?.variableId];
  if (!entry || value == null) return;
  const captured = Array.isArray(target.resolvedIndices)
    ? target.resolvedIndices.map(Number) : [];
  const resolvedIndex = Number(target.resolvedIndex);
  const indices = captured.length && captured.every(Number.isInteger)
    ? captured : (Number.isInteger(resolvedIndex) ? [resolvedIndex] : []);
  if (indices.length) {
    let data = entry.data;
    for (let depth = 0; depth < indices.length - 1; depth += 1) {
      data = data?.items?.[indices[depth]];
    }
    const items = data?.items;
    const index = indices.at(-1);
    if (Array.isArray(items) && index >= 0 && index < items.length) items[index] = cloneTraceValue(value);
    return;
  }
  entry.data = cloneTraceValue(value);
}

function removeExitedKeepObject(frame, event = {}) {
  (event.targets || []).forEach(target => {
    const variableId = String(target?.variableId || '');
    if (!variableId) return;
    const lifetime = String(target?.lifetimeIdentity || event.lifetimeIdentity || '');
    const entry = frame.state?.[variableId];
    if (!entry || (lifetime && String(entry.lifetime || '') !== lifetime)) return;
    delete frame.state[variableId];
    delete frame.renderers?.[variableId];
    delete frame.rendererOptions?.[variableId];
    frame.captureOnlyVariableIds = (frame.captureOnlyVariableIds || [])
      .filter(id => id !== variableId);
    frame.bindings = (frame.bindings || []).filter(binding => (
      binding?.targetVariableId !== variableId
      && binding?.sourceVariableId !== variableId
      && !(binding?.sourceVariableIds || []).includes(variableId)
    ));
    frame.objectBindings = (frame.objectBindings || []).filter(binding => (
      binding?.targetVariableId !== variableId
      && binding?.sourceVariableId !== variableId
      && !(binding?.sourceVariableIds || []).includes(variableId)
    ));
    frame.styles = (frame.styles || []).filter(style => style?.targetVariableId !== variableId);
    frame.segments = (frame.segments || []).filter(segment => segment?.targetVariableId !== variableId);
  });
}

function materializeKeepFrameState(sourceFrame, keepOrder, pendingEvents = []) {
  const frame = cloneTraceValue(sourceFrame);
  const captureOrder = Number(sourceFrame?.captureOrder);
  const upperOrder = Number(keepOrder);
  const ordinaryBoundaryEvents = [...(sourceFrame?.events || [])]
    .filter(event => {
      const order = Number(event?.order);
      return Number.isFinite(order)
        && (!Number.isFinite(captureOrder) || order > captureOrder)
        && (!Number.isFinite(upperOrder) || order < upperOrder);
    });
  const preKeepExits = (pendingEvents || []).filter(event => (
    event?.preKeepExit === true
    && Number(event?.preKeepOrder) === upperOrder
    && (event?.type === 'scope-exit' || event?.type === 'visual-exit')
  ));
  const boundaryEvents = [...new Set([...ordinaryBoundaryEvents, ...preKeepExits])]
    .sort((left, right) => Number(left.order) - Number(right.order));
  boundaryEvents.forEach(event => {
    // Loop-boundary events are a user-selectable synthetic view. Their value
    // is applied later by trace-events.js only when that setting is enabled.
    if (event?.loopBoundary === true) return;
    if (event?.type === 'scope-exit' || event?.type === 'visual-exit') {
      removeExitedKeepObject(frame, event);
      return;
    }
    if (event?.type === 'declare') {
      const target = (event.targets || []).find(item => item?.variableId);
      if (!target) return;
      const declaredValue = event.payload?.value == null
        ? { kind: event.kind || 'scalar', value: '' }
        : cloneTraceValue(event.payload.value);
      frame.state[target.variableId] = {
        name: event.name || target.expression || target.variableId,
        identity: '',
        lifetime: event.lifetimeIdentity || target.lifetimeIdentity || '',
        data: declaredValue
      };
      return;
    }
    if (event?.type === 'swap') {
      const left = (event.targets || []).find(target => target.role === 'left');
      const right = (event.targets || []).find(target => target.role === 'right');
      applyKeepMutation(frame, left, event.payload?.leftAfter);
      applyKeepMutation(frame, right, event.payload?.rightAfter);
      return;
    }
    if (event?.type === 'assign' || event?.type === 'write') {
      mutationTargets(event).forEach(target => (
        applyKeepMutation(frame, target, event.payload?.after)
      ));
    }
  });
  return frame;
}

function materializeKeepSnapshots(frames, layouts = []) {
  const layoutsById = new Map((layouts || []).map(layout => [layout.id, layout]));
  const snapshots = [];
  const activeSnapshotIds = [];
  const activeRecursionSnapshots = new Map();
  const counts = new Map();
  let sceneGeneration = 0;
  const usedObjectIds = new Set(frames.flatMap(frame => [
    ...Object.keys(frame.state || {}),
    String(frame.source?.objectId || '').trim()
  ]).filter(Boolean));
  function allocateObjectId(requested) {
    const base = String(requested || 'Snapshot').trim() || 'Snapshot';
    let id = base;
    let suffix = 1;
    while (usedObjectIds.has(id)) {
      id = `${base}_${suffix}`;
      suffix += 1;
    }
    usedObjectIds.add(id);
    return id;
  }
  function recursionSnapshotKey(event) {
    const layoutId = String(event?.layoutId || '');
    const activationId = String(event?.recursionActivationId || '');
    return layoutsById.get(layoutId)?.type === 'recursion' && activationId
      ? `${layoutId}\u0000${activationId}` : '';
  }
  function replacedRecursionSnapshot(event) {
    const key = recursionSnapshotKey(event);
    const snapshotId = key ? activeRecursionSnapshots.get(key) : '';
    return snapshotId ? snapshots.find(snapshot => snapshot.id === snapshotId) || null : null;
  }
  function activateSnapshot(snapshot, replacedSnapshot = null) {
    if (replacedSnapshot) {
      const activeIndex = activeSnapshotIds.indexOf(replacedSnapshot.id);
      if (activeIndex >= 0) activeSnapshotIds.splice(activeIndex, 1);
      snapshot.replacesSnapshotId = replacedSnapshot.id;
    }
    activeSnapshotIds.push(snapshot.id);
    const key = layoutsById.get(snapshot.layoutId)?.type === 'recursion'
      && snapshot.recursionActivationId
      ? `${snapshot.layoutId}\u0000${snapshot.recursionActivationId}`
      : '';
    if (key) activeRecursionSnapshots.set(key, snapshot.id);
  }
  function variableRenderState(frame, variableId, identity = '') {
    if (!frame) return null;
    const directEntry = frame.state?.[variableId];
    let sourceVariableId = directEntry
      && (!identity || String(directEntry.identity || '') === String(identity))
      ? variableId
      : '';
    if (!sourceVariableId && identity) {
      sourceVariableId = Object.entries(frame.state || {})
        .find(([, entry]) => String(entry?.identity || '') === String(identity))?.[0] || '';
    }
    if (!sourceVariableId) return null;
    const binding = (frame.objectBindings || []).find(item => (
      item?.sourceVariableId === sourceVariableId
    ));
    return {
      frameId: frame.id,
      sourceVariableId,
      renderer: String(frame.renderers?.[sourceVariableId] || ''),
      rendererOptions: JSON.parse(JSON.stringify(frame.rendererOptions?.[sourceVariableId] || {})),
      binding: binding ? JSON.parse(JSON.stringify(binding)) : null,
      styles: (frame.styles || [])
        .filter(style => style.targetVariableId === sourceVariableId)
        .map(style => JSON.parse(JSON.stringify(style))),
      arrows: (frame.arrows || [])
        .filter(arrow => arrow?.from?.targetVariableId === sourceVariableId)
        .map(arrow => JSON.parse(JSON.stringify(arrow)))
    };
  }
  function retainedSnapshotArrows(renderState, frame, snapshot) {
    const layoutArrows = (frame?.arrows || []).filter(arrow => (
      arrow?.ownerLayoutId
      || [arrow?.from, arrow?.to].some(endpoint => (
        endpoint?.type === 'layout'
        && endpoint.layoutSelector === 'current'
        && endpoint.layoutId === snapshot.layoutId
      ))
    ));
    const sourceArrows = [...(renderState?.arrows || []), ...layoutArrows]
      .filter((arrow, index, all) => all.findIndex(candidate => candidate.id === arrow.id) === index);
    return sourceArrows.map(arrow => {
      const retained = cloneTraceValue(arrow);
      retained.id = `${arrow.id}@${snapshot.id}`;
      retained.explicitId = true;
      retained.retainedFromArrowId = arrow.id;
      retained.source = 'directive';
      if (retained.from?.type !== 'layout') {
        retained.from = {
          ...retained.from,
          targetVariableId: '',
          targetName: '',
          targetObjectKey: snapshot.objectId,
          objectKey: snapshot.objectId
        };
      }
      for (const endpointName of ['from', 'to']) {
        const endpoint = retained[endpointName];
        if (endpoint?.type === 'layout' && endpoint.layoutSelector === 'current') {
          endpoint.layoutActivationId = String(snapshot.recursionActivationId || '');
        }
        if (!endpoint || !Array.isArray(endpoint.indexExpressions)) continue;
        const resolved = endpoint.indexExpressions.map(expression => (
          resolveTraceIndexExpression(frame, expression)
        ));
        if (resolved.every(Number.isInteger)) {
          endpoint.indexExpressions = resolved.map(String);
          endpoint.indexExpression = resolved.join(',');
        }
      }
      return retained;
    });
  }
  function eventsForGeneration(events, generation, preKeepGeneration = generation) {
    return (events || []).filter(event => event?.type !== 'keep').map(event => ({
      ...event,
      sceneGeneration: event?.preKeepExit === true ? preKeepGeneration : generation,
      targets: (event.targets || []).map(target => ({
        ...target,
        sceneGeneration: event?.preKeepExit === true ? preKeepGeneration : generation
      }))
    }));
  }
  let materializedFrames = frames.map((frame, frameIndex) => {
    const branchVariableId = String(frame.source?.primaryVariableId || '');
    const branchEntry = branchVariableId ? frame.state?.[branchVariableId] : null;
    const branchKeep = frame.source?.branchId && frame.source?.layoutId && branchEntry
      ? {
        type: 'keep',
        order: Number((frame.events || [])[0]?.order ?? -1) - 0.25,
        signature: `automatic-branch:${frame.source.branchId}`,
        label: String(frame.source.branchLabel || branchEntry.name || 'Branch'),
        layoutId: String(frame.source.layoutId),
        recursionFunction: String(frame.source.recursionFunction || ''),
        recursionActivationId: String(frame.source.recursionActivationId || frame.source.branchId),
        recursionParentActivationId: String(frame.source.recursionParentActivationId || frame.source.branchOwnerActivationId || ''),
        recursionAncestorActivationIds: cloneTraceValue(frame.source.recursionAncestorActivationIds || []),
        recursionDepth: Number(frame.source.recursionDepth) || 0,
        recursionSiblingIndex: Number(frame.source.recursionSiblingIndex) || 0,
        recursionRootIndex: Number(frame.source.recursionRootIndex) || 0,
        preserveStyle: true,
        payload: { data: cloneTraceValue(branchEntry.data) },
        targets: [{ variableId: branchVariableId }]
      }
      : null;
    const keepEvents = [
      ...(branchKeep ? [branchKeep] : []),
      ...(frame.initialKeeps || []),
      ...(frame.events || []).filter(event => event.type === 'keep')
    ];
    const snapshotGeneration = sceneGeneration;
    const liveGeneration = keepEvents.length ? sceneGeneration + 1 : sceneGeneration;
    let keepLastFocus = false;
    keepEvents.forEach(event => {
      if (event.mode === 'last') {
        const previousFrame = frames[frameIndex - 1];
        if (!previousFrame) return;
        const retainedFrame = materializeKeepFrameState(previousFrame, event.order, frame.events);
        const preserveStyle = event.preserveStyle !== false;
        const count = (counts.get('$frame') || 0) + 1;
        counts.set('$frame', count);
        const id = `snapshot:frame:${count}`;
        const replacedSnapshot = replacedRecursionSnapshot(event);
        const objectId = replacedSnapshot?.objectId || allocateObjectId(event.label || 'Frame');
        const snapshot = {
          id,
          objectId,
          kind: 'frame',
          createdFrameId: frame.id,
          sourceFrameId: previousFrame.id,
          label: event.layoutId && event.recursionActivationId
            ? String(event.label || 'Frame').trim() || 'Frame'
            : objectId,
          preserveStyle,
          layoutId: String(event.layoutId || ''),
          recursionFunction: String(event.recursionFunction || ''),
          recursionActivationId: String(event.recursionActivationId || ''),
          recursionParentActivationId: String(event.recursionParentActivationId || ''),
          recursionAncestorActivationIds: cloneTraceValue(event.recursionAncestorActivationIds || []),
          recursionDepth: Number(event.recursionDepth) || 0,
          recursionSiblingIndex: Number(event.recursionSiblingIndex) || 0,
          recursionRootIndex: Number(event.recursionRootIndex) || 0,
          keepOrder: Number(event.order),
          sceneGeneration: snapshotGeneration,
          binding: event.binding ? JSON.parse(JSON.stringify(event.binding)) : null,
          placementOffset: event.placementOffset
            ? JSON.parse(JSON.stringify(event.placementOffset))
            : null,
          frame: {
            ...retainedFrame,
            sceneGeneration: snapshotGeneration,
            renderers: JSON.parse(JSON.stringify(retainedFrame.renderers || {})),
            rendererOptions: JSON.parse(JSON.stringify(retainedFrame.rendererOptions || {})),
            events: eventsForGeneration(retainedFrame.events, snapshotGeneration),
            texts: [],
            styles: preserveStyle ? JSON.parse(JSON.stringify(retainedFrame.styles || [])) : [],
            snapshotIds: []
          }
        };
        if (snapshot.layoutId) {
          snapshot.arrows = retainedSnapshotArrows(
            { arrows: retainedFrame.arrows || [] }, retainedFrame, snapshot
          );
          snapshot.frame.arrows = [];
        }
        snapshots.push(snapshot);
        activateSnapshot(snapshot, replacedSnapshot);
        keepLastFocus = true;
        return;
      }
      const target = (event.targets || []).find(item => item.variableId);
      const variableId = target?.variableId;
      const entry = variableId ? frame.state?.[variableId] : null;
      const capturedData = event.payload?.data;
      if (!variableId || (!entry && capturedData == null)) return;
      const identity = String(entry?.identity || '');
      const currentRenderState = variableRenderState(frame, variableId, identity);
      const previousRenderState = variableRenderState(frames[frameIndex - 1], variableId, identity);
      const renderState = (event.layoutId && event.recursionActivationId
        ? currentRenderState || previousRenderState
        : previousRenderState || currentRenderState)
        || { frameId: '', sourceVariableId: variableId, renderer: '', rendererOptions: {}, binding: null, styles: [], arrows: [] };
      const preserveStyle = event.preserveStyle !== false;
      const count = (counts.get(variableId) || 0) + 1;
      counts.set(variableId, count);
      const id = `snapshot:${variableId}:${count}`;
      const labelBase = String(event.label || event.name || entry.name || 'Snapshot').trim() || 'Snapshot';
      const replacedSnapshot = replacedRecursionSnapshot(event);
      const objectId = replacedSnapshot?.objectId || allocateObjectId(labelBase);
      const styleVariableIds = new Set([
        variableId,
        ...Object.keys(frame.renderers || {}),
        ...(frame.captureOnlyVariableIds || [])
      ]);
      const styleFrameState = Object.fromEntries(Object.entries(frame.state || {})
        .filter(([stateVariableId]) => styleVariableIds.has(stateVariableId))
        .map(([stateVariableId, stateEntry]) => [
          stateVariableId, cloneTraceValue(stateEntry)
        ]));
      const snapshot = {
        id,
        objectId,
        sourceVariableId: variableId,
        sourceFrameId: renderState.frameId,
        createdFrameId: frame.id,
        label: event.layoutId && event.recursionActivationId ? labelBase : objectId,
        preserveStyle,
        layoutId: String(event.layoutId || ''),
        recursionFunction: String(event.recursionFunction || ''),
        recursionActivationId: String(event.recursionActivationId || ''),
        recursionParentActivationId: String(event.recursionParentActivationId || ''),
        recursionAncestorActivationIds: cloneTraceValue(event.recursionAncestorActivationIds || []),
        recursionDepth: Number(event.recursionDepth) || 0,
        recursionSiblingIndex: Number(event.recursionSiblingIndex) || 0,
        recursionRootIndex: Number(event.recursionRootIndex) || 0,
        sceneGeneration: snapshotGeneration,
        binding: event.binding
          ? JSON.parse(JSON.stringify(event.binding))
          : event.layoutId
            ? null
            : renderState.binding,
        placementOffset: event.placementOffset
          ? JSON.parse(JSON.stringify(event.placementOffset))
          : null,
        data: JSON.parse(JSON.stringify(capturedData ?? entry.data)),
        renderer: renderState.renderer,
        rendererOptions: renderState.rendererOptions,
        styles: preserveStyle ? renderState.styles : [],
        styleFrame: frame.source?.silentKeepView === true ? {
          id: frame.id,
          state: styleFrameState,
          lets: cloneTraceValue(frame.lets || []),
          renderers: cloneTraceValue(frame.renderers || {}),
          rendererOptions: cloneTraceValue(frame.rendererOptions || {}),
          captureOnlyVariableIds: cloneTraceValue(frame.captureOnlyVariableIds || [])
        } : null
      };
      snapshot.arrows = snapshot.layoutId
        ? retainedSnapshotArrows(renderState, frame, snapshot)
        : [];
      snapshots.push(snapshot);
      activateSnapshot(snapshot, replacedSnapshot);
    });
    sceneGeneration = liveGeneration;
    return {
      ...frame,
      sceneGeneration: liveGeneration,
      events: eventsForGeneration(frame.events, liveGeneration, snapshotGeneration),
      snapshotIds: [...activeSnapshotIds],
      keepLastFocus
    };
  });
  const latestByActivation = new Map();
  snapshots.forEach(snapshot => {
    if (layoutsById.get(snapshot.layoutId)?.type !== 'recursion'
      || !snapshot.recursionActivationId) return;
    const activationKey = `${snapshot.layoutId}\u0000${snapshot.recursionActivationId}`;
    const ancestors = Array.isArray(snapshot.recursionAncestorActivationIds)
      ? [...snapshot.recursionAncestorActivationIds].reverse()
      : [];
    const parentActivations = [snapshot.recursionParentActivationId, ...ancestors]
      .map(value => String(value || ''))
      .filter(value => value && value !== snapshot.recursionActivationId);
    const parent = parentActivations.map(activationId => (
      latestByActivation.get(`${snapshot.layoutId}\u0000${activationId}`)
    )).find(Boolean);
    const parentSnapshotId = parent?.id || '';
    snapshot.layoutNode = {
      layoutId: snapshot.layoutId,
      nodeId: snapshot.id,
      parentSnapshotId,
      activationId: snapshot.recursionActivationId,
      depth: snapshot.recursionDepth,
      siblingIndex: snapshot.recursionSiblingIndex,
      rootIndex: snapshot.recursionRootIndex
    };
    latestByActivation.set(activationKey, snapshot);
  });
  // `@keep ... use ...` captures a presentation state without creating a
  // user-visible frame. Later authored frames already carry the accumulated
  // snapshotIds, so the internal capture records can be removed here.
  materializedFrames = materializedFrames.filter(frame => (
    frame.source?.silentKeepView !== true
  ));
  const initialByActivation = new Map();
  snapshots.forEach(snapshot => {
    if (!snapshot.layoutId || !snapshot.recursionActivationId) return;
    const key = `${snapshot.layoutId}\u0000${snapshot.recursionActivationId}`;
    if (!initialByActivation.has(key)) initialByActivation.set(key, snapshot);
  });
  const childrenByParent = new Map();
  for (const snapshot of initialByActivation.values()) {
    if (!snapshot.recursionParentActivationId) continue;
    const key = `${snapshot.layoutId}\u0000${snapshot.recursionParentActivationId}`;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(snapshot);
  }
  const previewPlans = [];
  for (const [parentKey, children] of childrenByParent.entries()) {
    const parent = initialByActivation.get(parentKey);
    if (!parent || children.length < 2) continue;
    if (layoutsById.get(parent.layoutId)?.showBranchPreviews === false) continue;
    const ordered = [...children].sort((left, right) => (
      Number(left.recursionSiblingIndex) - Number(right.recursionSiblingIndex)
    ));
    const childIndexes = ordered.map(child => (
      materializedFrames.findIndex(frame => frame.id === child.sourceFrameId)
    )).filter(index => index >= 0);
    if (!childIndexes.length) continue;
    const parentIndex = materializedFrames.findIndex(frame => frame.id === parent.sourceFrameId);
    const firstChildIndex = Math.min(...childIndexes);
    if (parentIndex < 0 || firstChildIndex <= parentIndex) continue;
    const previews = ordered.map(child => {
      const childFrameIndex = materializedFrames.findIndex(frame => frame.id === child.sourceFrameId);
      const subtreeActivations = new Set([...initialByActivation.values()]
        .filter(candidate => candidate.layoutId === child.layoutId
          && (candidate.recursionActivationId === child.recursionActivationId
            || (candidate.recursionAncestorActivationIds || []).includes(child.recursionActivationId)))
        .map(candidate => candidate.recursionActivationId));
      let completionFrame = materializedFrames[childFrameIndex] || null;
      for (let index = childFrameIndex; index < materializedFrames.length; index += 1) {
        const candidate = materializedFrames[index];
        const activationId = String(candidate.source?.recursionActivationId || '');
        if (subtreeActivations.has(activationId)) {
          completionFrame = candidate;
        } else if (index > childFrameIndex) {
          break;
        }
      }
      return {
        child,
        childFrame: materializedFrames[childFrameIndex] || null,
        completionFrame
      };
    });
    previewPlans.push({ insertIndex: parentIndex + 1, parentKey, parentSnapshotId: parent.id, previews });
  }
  previewPlans.sort((left, right) => right.insertIndex - left.insertIndex).forEach(plan => {
    const base = materializedFrames[Math.max(0, plan.insertIndex - 1)];
    if (!base) return;
    const firstActualChildIndex = Math.min(...plan.previews.map(({ child }) => (
      materializedFrames.findIndex(frame => frame.id === child.sourceFrameId)
    )).filter(index => index >= 0));
    plan.previews.forEach(({ child }) => {
      const actualIndex = materializedFrames.findIndex(frame => frame.id === child.sourceFrameId);
      for (let index = plan.insertIndex; index <= actualIndex; index += 1) {
        const frame = materializedFrames[index];
        if (!frame.snapshotIds.includes(child.id)) frame.snapshotIds.push(child.id);
      }
    });
    const finalPreview = plan.previews[plan.previews.length - 1];
    for (let index = plan.insertIndex; index < firstActualChildIndex; index += 1) {
      const frame = materializedFrames[index];
      const heldState = cloneTraceValue(frame.state || {});
      for (const [variableId, renderer] of Object.entries(finalPreview?.childFrame?.renderers || {})) {
        if (!/(?:^|-)disk$/.test(renderer)
          || !finalPreview?.completionFrame?.state?.[variableId]) continue;
        heldState[variableId] = cloneTraceValue(finalPreview.completionFrame.state[variableId]);
      }
      frame.state = heldState;
    }
    const growing = [];
    const previewFrames = plan.previews.map(({ child, childFrame, completionFrame }, ordinal) => {
      growing.push(child.id);
      const authored = childFrame || base;
      const state = cloneTraceValue(base.state || {});
      for (const variableId of authored.captureOnlyVariableIds || []) {
        if (authored.state?.[variableId]) state[variableId] = cloneTraceValue(authored.state[variableId]);
      }
      for (const [variableId, renderer] of Object.entries(authored.renderers || {})) {
        if (!/(?:^|-)disk$/.test(renderer) || !completionFrame?.state?.[variableId]) continue;
        state[variableId] = cloneTraceValue(completionFrame.state[variableId]);
      }
      return {
        ...base,
        objectBindings: cloneTraceValue(authored.objectBindings || {}),
        renderers: cloneTraceValue(authored.renderers || {}),
        rendererOptions: cloneTraceValue(authored.rendererOptions || {}),
        captureOnlyVariableIds: cloneTraceValue(authored.captureOnlyVariableIds || []),
        lets: cloneTraceValue(authored.lets || {}),
        texts: cloneTraceValue(authored.texts || []),
        styles: cloneTraceValue(authored.styles || []),
        segments: cloneTraceValue(authored.segments || []),
        camera: cloneTraceValue(authored.camera || base.camera || null),
        state,
        id: `branch-preview:${plan.parentKey.replace(/\u0000/g, ':')}:${ordinal}`,
        source: {
          ...(authored.source || base.source || {}),
          systemBranchPreview: true,
          previewSnapshotId: child.id
        },
        events: [],
        snapshotIds: [...new Set([...(base.snapshotIds || []), plan.parentSnapshotId, ...growing])],
        keepLastFocus: false
      };
    });
    const transitionStyleFrameId = previewFrames.at(-1)?.id || '';
    // Authored handoff frames deliberately show the real board without disk
    // coloring.  Their outgoing restore motion still belongs to the final
    // branch preview, so retain that preview as the paint source used only by
    // the following transition.
    for (let index = plan.insertIndex; index < firstActualChildIndex; index += 1) {
      const frame = materializedFrames[index];
      frame.source = {
        ...(frame.source || {}),
        systemBranchHandoff: true,
        transitionStyleFrameId
      };
    }
    materializedFrames.splice(plan.insertIndex, 0, ...previewFrames);
  });
  const snapshotsById = new Map(snapshots.map(snapshot => [snapshot.id, snapshot]));
  materializedFrames = materializedFrames.map(frame => {
    const retainedArrows = (frame.snapshotIds || []).flatMap(snapshotId => (
      snapshotsById.get(snapshotId)?.arrows || []
    ));
    const retainedSourceIds = new Set(retainedArrows
      .filter(arrow => [arrow.from, arrow.to].every(endpoint => (
        !endpoint?.layoutActivationId
          || endpoint.layoutActivationId === frame.source?.recursionActivationId

      )))
      .map(arrow => arrow.retainedFromArrowId)
      .filter(Boolean));
    return {
      ...frame,
      arrows: [
        ...(frame.arrows || []).filter(arrow => !retainedSourceIds.has(arrow.id)),
        ...retainedArrows
      ]
    };
  });
  return { frames: materializedFrames, snapshots };
}

const FIXED_EVENT_KINDS = new Set(['sequence', 'stack', 'queue', 'set']);
const FIXED_ACCESS_EVENTS = new Set(['read', 'write', 'assign', 'swap']);

// ─────────────────────────────────────────────────────────────────────────────
// 指令求值與固定標記：將分析器保留的索引表達式解析到當幀資料
// ─────────────────────────────────────────────────────────────────────────────

function traceScalarValue(data) {
  if (!data || typeof data !== 'object') return data;
  return Object.prototype.hasOwnProperty.call(data, 'value') ? data.value : data;
}

function resolveTraceIndexExpression(frame, expression) {
  const source = String(expression ?? '').trim();
  if (!source) return null;
  const directLet = (frame.lets || []).find(binding => binding?.name === source);
  if (directLet?.expression && String(directLet.expression).trim() !== source) {
    return resolveTraceIndexExpression(frame, directLet.expression);
  }
  const tokens = [];
  let cursor = 0;
  while (cursor < source.length) {
    if (/\s/.test(source[cursor])) {
      cursor += 1;
      continue;
    }
    const number = source.slice(cursor).match(/^\d+(?:\.\d+)?/);
    if (number) {
      tokens.push({ type: 'number', value: number[0] });
      cursor += number[0].length;
      continue;
    }
    const identifier = source.slice(cursor).match(/^[A-Za-z_]\w*/);
    if (identifier) {
      tokens.push({ type: 'identifier', value: identifier[0] });
      cursor += identifier[0].length;
      continue;
    }
    if ('+-*/%().'.includes(source[cursor])) {
      tokens.push({ type: 'operator', value: source[cursor] });
      cursor += 1;
      continue;
    }
    return null;
  }

  let position = 0;
  const invalid = Symbol('invalid-trace-index');
  const peek = value => tokens[position]?.value === value;
  const consume = value => {
    if (value && !peek(value)) return null;
    return tokens[position++] || null;
  };

  function parsePrimary() {
    if (peek('(')) {
      consume('(');
      const value = parseAdditive();
      if (value === invalid || !consume(')')) return invalid;
      return value;
    }
    const token = tokens[position];
    if (!token) return invalid;
    if (token.type === 'number') {
      position += 1;
      return Number(token.value);
    }
    if (token.type !== 'identifier') return invalid;
    position += 1;
    const match = Object.entries(frame.state || {}).find(([, entry]) => entry?.name === token.value);
    if (!match) {
      const binding = (frame.lets || []).find(candidate => candidate?.name === token.value);
      return binding?.expression ? resolveTraceIndexExpression(frame, binding.expression) : invalid;
    }
    const data = match[1]?.data;
    if (peek('.')) {
      consume('.');
      const member = consume();
      if (member?.type !== 'identifier' || !['length', 'size'].includes(member.value)) return invalid;
      if (peek('(')) {
        consume('(');
        if (!consume(')')) return invalid;
      }
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : null;
      return items ? items.length : invalid;
    }
    return traceScalarValue(data);
  }

  function parseUnary() {
    if (peek('+')) {
      consume('+');
      const value = parseUnary();
      return value === invalid ? invalid : Number(value);
    }
    if (peek('-')) {
      consume('-');
      const value = parseUnary();
      return value === invalid ? invalid : -Number(value);
    }
    return parsePrimary();
  }

  function parseMultiplicative() {
    let value = parseUnary();
    while (peek('*') || peek('/') || peek('%')) {
      const operator = consume().value;
      const right = parseUnary();
      if (value === invalid || right === invalid) return invalid;
      if (operator === '*') value = Number(value) * Number(right);
      else if (operator === '/') value = Number(value) / Number(right);
      else value = Number(value) % Number(right);
    }
    return value;
  }

  function parseAdditive() {
    let value = parseMultiplicative();
    while (peek('+') || peek('-')) {
      const operator = consume().value;
      const right = parseMultiplicative();
      if (value === invalid || right === invalid) return invalid;
      value = operator === '+' ? Number(value) + Number(right) : Number(value) - Number(right);
    }
    return value;
  }

  const value = parseAdditive();
  if (value === invalid || position !== tokens.length || !Number.isInteger(Number(value))) return null;
  return Number(value);
}

function resolveFrameRendererOptions(frame, directive) {
  const source = directive?.rendererOptions;
  if (!source || typeof source !== 'object') return {};
  const options = {};

  if (source.range) {
    const start = resolveTraceIndexExpression(frame, source.range.startExpression);
    const end = resolveTraceIndexExpression(frame, source.range.endExpression);
    if (start != null && end != null) options.range = [start, end + 1];
  }
  if (source.columns) {
    const columns = resolveTraceIndexExpression(frame, source.columns.expression);
    if (columns != null && columns > 0) options.columns = columns;
  }
  if (source.gap) {
    const horizontal = resolveTraceIndexExpression(frame, source.gap.horizontalExpression);
    const vertical = resolveTraceIndexExpression(frame, source.gap.verticalExpression);
    if (horizontal != null && vertical != null) {
      options.gap = {
        horizontal: Math.max(0, horizontal),
        vertical: Math.max(0, vertical)
      };
    }
  }
  if (source.labels) {
    const format = source.labels.indexFormat || 'none';
    if (source.labels.showValue === false && format === 'decimal') options.indexMode = 2;
    else if (format === 'decimal') options.indexMode = 1;
    else if (format === 'binary') options.indexMode = 3;
    else if (format === 'binary-padded') options.indexMode = 4;
    else options.indexMode = 0;
    if (source.labels.showValue === false && format === 'none') options.showValue = false;
  }
  const materializeTraceValue = data => {
    if (Array.isArray(data?.items)) return data.items.map(materializeTraceValue);
    return traceScalarValue(data);
  };
  const resolveLabelSource = spec => {
    if (!spec) return null;
    if (spec.mode !== 'custom') return { mode: spec.mode, values: [] };
    const values = [];
    (spec.parts || []).forEach(part => {
      if (part.type === 'blank') {
        values.push(...Array.from({ length: Math.max(0, Number(part.count) || 0) }, () => ''));
      } else if (part.type === 'literal') {
        values.push(part.value);
      } else if (part.type === 'variable') {
        const entry = frame.state?.[part.variableId]
          || Object.values(frame.state || {}).find(item => item?.name === part.name);
        const value = materializeTraceValue(entry?.data);
        if (Array.isArray(value)) values.push(...value);
        else if (typeof value === 'string') values.push(...value);
        else if (value !== undefined) values.push(value);
      }
    });
    return { mode: 'custom', values };
  };
  ['indexLabels', 'rowLabels', 'columnLabels', 'innerLabels'].forEach(name => {
    if (source[name]) options[name] = resolveLabelSource(source[name]);
  });
  if (Object.prototype.hasOwnProperty.call(source, 'gridlines')) options.gridlines = source.gridlines;
  if (Object.prototype.hasOwnProperty.call(source, 'outerframe')) options.outerframe = source.outerframe;
  if (source.markerLayout) options.markerLayout = source.markerLayout;
  if (source.fields) {
    options.fields = {
      names: Array.isArray(source.fields.names) ? [...source.fields.names] : [],
      variableIds: Array.isArray(source.fields.variableIds) ? [...source.fields.variableIds] : []
    };
  }
  if (source.hide) {
    options.hide = {
      entries: Array.isArray(source.hide.entries)
        ? source.hide.entries.map(entry => ({ field: entry.field, value: entry.value }))
        : []
    };
  }
  if (source.format) {
    options.format = {
      entries: Array.isArray(source.format.entries)
        ? source.format.entries.map(entry => ({
          field: entry.field,
          type: entry.type,
          ...(Number.isInteger(entry.precision) ? { precision: entry.precision } : {}),
          variableId: entry.variableId || ''
        }))
        : []
    };
  }
  if (source.capacity) {
    const capacity = resolveTraceIndexExpression(frame, source.capacity.expression);
    if (capacity != null && capacity >= 0) options.capacity = capacity;
  }
  if (source.display && typeof source.display.template === 'string') {
    options.display = {
      template: source.display.template,
      expressions: Array.isArray(source.display.expressions) ? [...source.display.expressions] : []
    };
  }
  if (Array.isArray(source.symbols)) options.symbols = [...source.symbols];
  if (directive?.dataTransform?.type === 'char') {
    options.dataTransform = { type: 'char' };
  }
  if (directive?.dataTransform?.type === 'bits') {
    const width = resolveTraceIndexExpression(frame, directive.dataTransform.widthExpression);
    if (width != null && width > 0) {
      options.dataTransform = { type: 'bits', width, order: 'msb-first' };
    }
  }
  if (Object.prototype.hasOwnProperty.call(source, 'separator')) options.separator = source.separator;
  return options;
}

function appendFixedEvents(frames, variables = []) {
  if (!Array.isArray(frames) || !frames.length) return frames;
  const variableKinds = new Map(variables.map(variable => [variable.id, variable.kind]));
  const accesses = new Map();

  frames.forEach(frame => {
    frame.events = (frame.events || []).filter(event => event.type !== 'fixed');
  });

  frames.forEach((frame, frameIndex) => {
    (frame.events || []).filter(event => FIXED_ACCESS_EVENTS.has(event.type)).forEach(event => {
      (event.targets || []).forEach(target => {
        const variableId = target.variableId;
        const entry = frame.state?.[variableId];
        const data = entry?.data;
        const kind = variableKinds.get(variableId) || data?.kind;
        if (!variableId || !FIXED_EVENT_KINDS.has(kind) || !Array.isArray(data?.items)) return;
        const index = target.resolvedIndex != null
          && target.resolvedIndex !== ''
          && Number.isInteger(Number(target.resolvedIndex))
          ? Number(target.resolvedIndex)
          : resolveTraceIndexExpression(frame, target.indexExpression);
        if (index == null || index < 0 || index >= data.items.length) return;
        // References in main, heap_sort and recursive heapify calls have
        // different source IDs but the same runtime identity. Fixed means the
        // last use of the actual object, not the last use of one alias.
        const runtimeIdentity = String(entry?.identity || '');
        const objectIdentity = runtimeIdentity || `variable:${variableId}`;
        const key = `${objectIdentity}#${index}`;
        const access = accesses.get(key) || {
          variableId,
          variableName: entry.name || variableId,
          runtimeIdentity,
          objectIdentity,
          index,
          lastAccessFrameIndex: frameIndex,
          lastEventId: event.id || '',
          lastEventOrder: Number(event.order) || 0
        };
        access.variableId = variableId;
        access.variableName = entry.name || variableId;
        access.lastAccessFrameIndex = frameIndex;
        access.lastEventId = event.id || access.lastEventId;
        access.lastEventOrder = Number.isFinite(Number(event.order))
          ? Number(event.order)
          : access.lastEventOrder;
        accesses.set(key, access);
      });
    });
  });

  const groups = new Map();
  accesses.forEach(access => {
    const key = `${access.lastAccessFrameIndex}#${access.objectIdentity}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(access);
  });

  groups.forEach(group => {
    group.sort((left, right) => left.index - right.index);
    const fixedFrameIndex = group[0].lastAccessFrameIndex;
    const frame = frames[fixedFrameIndex];
    const lastAccess = group.reduce((latest, access) => (
      access.lastEventOrder >= latest.lastEventOrder ? access : latest
    ), group[0]);
    const stableVariableId = String(lastAccess.variableId || '').replace(/@\d+$/, '');
    const signature = `fixed:auto:${stableVariableId}:${group.map(access => access.index).join(',')}`;
    frame.events ||= [];
    frame.events.push({
      id: signature,
      type: 'fixed',
      signature,
      autoFixed: true,
      stateChange: true,
      persistent: true,
      runtimeIdentity: group[0].runtimeIdentity,
      line: Number(frame.source?.line) || 0,
      order: lastAccess.lastEventOrder + 0.001,
      phase: 'after',
      afterEventId: lastAccess.lastEventId,
      targets: group.map(access => ({
        role: 'target',
        variableId: access.variableId,
        runtimeIdentity: access.runtimeIdentity,
        expression: `${access.variableName}[${access.index}]`,
        indexExpression: String(access.index),
        resolvedIndex: access.index
      }))
    });
  });

  frames.forEach(frame => {
    frame.events.sort((left, right) => (
      (Number(left?.order) || 0) - (Number(right?.order) || 0)
      || String(left?.signature || left?.id || '').localeCompare(String(right?.signature || right?.id || ''))
    ));
  });

  return frames;
}

async function readTraceDocument(tracePath, variables, traceRequest = {}) {
  const loaded = await TraceChunkStore.read(tracePath);
  if (!loaded) return null;
  const {records, stats} = loaded;
  const keepDirectives = Array.isArray(traceRequest.keepDirectives)
    ? traceRequest.keepDirectives
    : [];
  const keepDirectiveByStatementId = new Map(keepDirectives.map((directive, index) => {
    const functionName = directive.functionName || 'global';
    const statementId = `manual-keep:${functionName}:${directive.line}:${directive.index ?? index}`;
    return [statementId, directive];
  }));
  const eventSources = traceRequest.eventSources && typeof traceRequest.eventSources === 'object'
    ? traceRequest.eventSources
    : {};
  const codeHideRanges = Array.isArray(traceRequest.codeHideRanges)
    ? traceRequest.codeHideRanges.map(range => ({
      from: Number(range.from) || 0,
      contentFrom: Number(range.contentFrom) || Number(range.from) || 0,
      contentTo: Number(range.contentTo) || Number(range.to) || 0,
      to: Number(range.to) || 0,
      line: Number(range.line) || 0,
      endLine: Number(range.endLine) || 0
    }))
    : [];
  const hiddenRuntimeEvent = event => {
    if (!event || event.type === 'keep') return false;
    const from = Number(event.source?.from);
    const to = Number(event.source?.to);
    const line = Number(event.source?.line || event.line);
    return codeHideRanges.some(range => (
      (Number.isFinite(from) && Number.isFinite(to)
        && from < range.contentTo && to > range.contentFrom)
      || (line > 0 && range.line > 0 && range.endLine > 0
        && line > range.line && line < range.endLine)
    ));
  };
  const enrichRuntimeEvent = event => {
    const source = eventSources[event.signature];
    const enriched = source ? { ...event, source } : event;
    if (event.type !== 'keep') return enriched;
    const directive = keepDirectiveByStatementId.get(enriched.signature);
    if (!directive) return enriched;
    return {
      ...enriched,
      ...(directive.binding
        ? { binding: JSON.parse(JSON.stringify(directive.binding)) }
        : {}),
      ...(directive.placementOffset
        ? { placementOffset: JSON.parse(JSON.stringify(directive.placementOffset)) }
        : {}),
      ...(directive.when
        ? { when: JSON.parse(JSON.stringify(directive.when)) }
        : {}),
      ...(directive.layoutId ? { layoutId: directive.layoutId } : {})
    };
  };
  const allFrames = records.filter(record => record.record === 'frame').map(frame => ({
    ...frame,
    events: (frame.events || []).map(enrichRuntimeEvent).filter(event => !hiddenRuntimeEvent(event)),
    ...(frame.initialKeeps?.length ? {initialKeeps:frame.initialKeeps.map(enrichRuntimeEvent)} : {})
  }));
  const frameDirectives = Array.isArray(traceRequest.frameDirectives)
    ? traceRequest.frameDirectives
    : [];
  const directiveByStatementId = new Map(frameDirectives.map((directive, index) => {
    const functionName = directive.functionName || 'global';
    const statementId = `manual-frame:${functionName}:${directive.line}:${directive.index ?? index}`;
    return [statementId, directive];
  }));
  const tracedFrames = allFrames.map(frame => {
    const directive = directiveByStatementId.get(frame.source?.statementId);
    const objectDirectives = Array.isArray(directive?.objects)
      ? directive.objects
      : (directive?.variableIds?.[0] ? [{
        objectId: directive.objectId || '',
        layoutId: directive.layoutId || '',
        primaryVariableId: directive.variableIds[0],
        renderer: directive.renderer || '',
        rendererOptions: directive.rendererOptions || {},
        dataTransform: directive.dataTransform || null,
        objectBinding: directive.objectBinding || null
      }] : []);
    const primaryObject = objectDirectives[0] || null;
    const primaryVariableId = primaryObject?.primaryVariableId || '';
    const renderers = Object.fromEntries(objectDirectives
      .filter(object => object.primaryVariableId && object.renderer)
      .map(object => [object.primaryVariableId, object.renderer]));
    const rendererOptions = Object.fromEntries(objectDirectives.map(object => [
      object.primaryVariableId,
      resolveFrameRendererOptions(frame, object)
    ]).filter(([variableId, options]) => variableId && Object.keys(options).length));
    const objectBindings = objectDirectives.map(object => object.objectBinding).filter(Boolean);
    const objectIds = Object.fromEntries(objectDirectives
      .filter(object => object.primaryVariableId && object.objectId)
      .map(object => [object.primaryVariableId, object.objectId]));
    const layoutIds = Object.fromEntries(objectDirectives
      .filter(object => object.primaryVariableId && object.layoutId)
      .map(object => [object.primaryVariableId, object.layoutId]));
    const primaryLayoutId = primaryObject?.layoutId || '';
    const branchActive = Boolean(frame.source?.branchId
      && frame.source?.branchLayoutId === primaryLayoutId);
    const branchAncestors = branchActive
      ? [...(frame.source?.recursionAncestorActivationIds || []), frame.source?.branchOwnerActivationId]
      : frame.source?.recursionAncestorActivationIds;
    return {
      ...frame,
      source: {
        ...(frame.source || {}),
        ...(branchActive ? {
          recursionActivationId: frame.source.branchId,
          recursionParentActivationId: frame.source.branchOwnerActivationId,
          recursionAncestorActivationIds: branchAncestors,
          recursionDepth: frame.source.branchDepth,
          recursionSiblingIndex: frame.source.branchSiblingIndex
        } : {}),
        directiveName: directive?.name || '',
        directiveKey: directive?.sourceKey || '',
        logicalDirectiveKey: directive?.logicalSourceKey || '',
        directiveKeyAliases: directive?.sourceKeyAliases || [],
        silentKeepView: directive?.silentKeepView === true,
        objectId: primaryObject?.objectId || '',
        objectIds,
        layoutId: primaryLayoutId,
        layoutIds,
        primaryVariableId,
        when: directive?.when || null
      },
      bindings: Array.isArray(directive?.bindings) ? directive.bindings : [],
      objectBindings: [
        ...objectBindings,
        ...(Array.isArray(directive?.placeBindings) ? directive.placeBindings : [])
      ],
      renderers,
      rendererOptions,
      captureOnlyVariableIds: Array.isArray(directive?.captureOnlyVariableIds)
        ? directive.captureOnlyVariableIds
        : [],
      lets: Array.isArray(directive?.lets) ? directive.lets : [],
      texts: Array.isArray(directive?.texts) ? directive.texts : [],
      styles: Array.isArray(directive?.styles) ? directive.styles : [],
      segments: Array.isArray(directive?.segments) ? directive.segments : [],
      arrows: Array.isArray(directive?.arrows) ? directive.arrows : [],
      eventControls: Array.isArray(directive?.eventControls) ? directive.eventControls : [],
      autoMarkVariableIds: Array.isArray(directive?.autoMarkVariableIds) ? directive.autoMarkVariableIds : null,
      camera: directive?.camera || null
    };
  });
  const sliceMode = traceRequest.sliceMode === 'manual'
    ? 'manual'
    : traceRequest.sliceMode === 'full' ? 'full' : 'auto';
  const slicedFrames = sliceMode === 'auto' ? autoSliceTraceFrames(tracedFrames) : tracedFrames;
  assignKeepBoundaryEvents(slicedFrames);
  // A frame snapshot must be created after derived events are complete. This
  // keeps fixed marks and every event-driven visual state in @keep last.
  const framesWithFixedEvents = appendFixedEvents(slicedFrames, variables);
  const keepSnapshots = materializeKeepSnapshots(
    framesWithFixedEvents,
    traceRequest.layoutDirectives
  );
  const asmView = traceRequest.asmView && typeof traceRequest.asmView === 'object' ? traceRequest.asmView : {};
  const requestedSkins = {
    ...(traceRequest.skins && typeof traceRequest.skins === 'object' ? traceRequest.skins : {}),
    ...(asmView.skins && typeof asmView.skins === 'object' ? asmView.skins : {})
  };
  const variableMap = {};
  const skins = {};
  for (const variable of variables) {
    variableMap[variable.id] = {
      id: variable.id,
      name: variable.name,
      cppType: variable.type,
      kind: variable.kind,
      line: variable.line,
      functionName: variable.functionName
    };
    skins[variable.id] = {
      renderer: requestedSkins[variable.id]?.renderer || defaultTraceRenderer(variable.kind),
      options: requestedSkins[variable.id]?.options || {}
    };
  }
  return {
    schemaVersion: '1.0',
    traceStorage: stats,
    generatedAt: new Date().toISOString(),
    loopRecords: records.filter(record => record.record === 'loop'),
    sourceCode: typeof traceRequest.sourceCode === 'string' ? traceRequest.sourceCode : '',
    sourceDeclarations: Array.isArray(traceRequest.sourceDeclarations)
      ? JSON.parse(JSON.stringify(traceRequest.sourceDeclarations))
      : [],
    sourceStructure: Array.isArray(traceRequest.sourceStructure)
      ? JSON.parse(JSON.stringify(traceRequest.sourceStructure))
      : [],
    codeHideRanges: JSON.parse(JSON.stringify(codeHideRanges)),
    sliceMode,
    variables: variableMap,
    frames: keepSnapshots.frames,
    snapshots: keepSnapshots.snapshots,
    skins,
    rules: Array.isArray(asmView.rules)
      ? asmView.rules
      : Array.isArray(traceRequest.rules) ? traceRequest.rules : [],
    studio: asmView.studio && typeof asmView.studio === 'object' ? asmView.studio : {},
    asmView,
    frameDirectives,
    layouts: Array.isArray(traceRequest.layoutDirectives)
      ? JSON.parse(JSON.stringify(traceRequest.layoutDirectives))
      : []
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 編譯／執行 API
//
// 流程順序是安全邊界的一部分：驗證來源 → 插樁 → 產生暫存檔 → 編譯 →
// 受限執行 → 解析 trace → 回收。任一分支結束時都需只回收本請求建立的資源。
// ─────────────────────────────────────────────────────────────────────────────
app.post('/compile', (req, res) => runWithCompileContext(async () => {
  // Express 4 does not catch rejected async route Promises. Keep preparation
  // failures inside this request instead of allowing Node to terminate.
  try {
  let compileWorkCompleted = false;
  const markCompileWorkComplete = () => {
    if (compileWorkCompleted) return;
    compileWorkCompleted = true;
    req.emit('asm:compile-work-complete');
  };
  let { code, input, trace } = req.body || {};
  let traceEnabled = trace?.enabled === true;

  if (typeof code !== 'string') {
    return res.status(400).json({
      output: '',
      error: 'code 必須是字串',
      compileTime: null,
      runTime: null,
      memoryKB: null,
      debug_log: getCompileDebugMessages(),
    });
  }

  if (!code.trim()) {
    return res.status(400).json({
      output: '', error: '程式碼不能為空白', code: 'EMPTY_SOURCE',
      compileTime: null, runTime: null, memoryKB: null,
      debug_log: getCompileDebugMessages(), traceDocument: null, scriptContent: '',
    });
  }

  // 限制程式碼長度 (例如限制 64KB)
  if (code.length > 64 * 1024) {
    return res.status(400).json({
      output: '',
      error: '程式碼過長 (超過 64KB 限制)，請精簡後再試。',
      compileTime: null,
      runTime: null,
      memoryKB: null,
      debug_log: getCompileDebugMessages(),
    });
  }

  code = normalizeSource(code);
  let sourceCode = code;
  let traceVariables = [];
  let traceFrameDirectives = [];
  let traceKeepDirectives = [];
  let traceLayoutDirectives = [];
  let traceEventSources = {};
  let traceSourceDeclarations = [];
  let traceSourceStructure = [];
  let traceCodeHideRanges = [];
  let traceSliceMode = trace?.sliceMode;
  let traceWarning = '';
  let asmView = null;
  try {
    asmView = TraceViewSource.parse(code);
  } catch (error) {
    traceWarning = error.message;
  }
  if (traceEnabled && usesLegacyAnimationCompiler(code)) {
    traceEnabled = false;
    const legacyWarning = '偵測到舊版 AV.hpp / //draw{} 動畫，已使用舊版動畫編譯器，不套用 trace 改寫。';
    logDebug(legacyWarning);
  }
  if (traceEnabled) {
    try {
      const instrumented = instrumentSource(code, Array.isArray(trace.watches) ? trace.watches : []);
      traceEnabled = instrumented.drawingEnabled !== false;
      sourceCode = instrumented.code;
      traceVariables = instrumented.variables;
      traceFrameDirectives = instrumented.frameDirectives.map((directive, index) => ({
        line: directive.line,
        name: directive.name || '',
        objectId: directive.objectId || '',
        layoutId: directive.layoutId || '',
        sourceKey: directive.sourceKey || '',
        logicalSourceKey: directive.logicalSourceKey || '',
        sourceKeyAliases: directive.sourceKeyAliases || [],
        names: directive.names,
        variableIds: directive.variables.map(variable => variable.id),
        captureOnlyVariableIds: directive.captureOnlyVariableIds || [],
        lets: directive.lets || [],
        functionName: directive.functionName || directive.variables[0]?.functionName || 'global',
        index: directive.index ?? index,
        silentKeepView: directive.silentKeepView === true,
        bindings: directive.bindings || [],
        objectBinding: directive.objectBinding || null,
        placeBindings: directive.placeBindings || [],
        renderer: directive.renderer || '',
        rendererOptions: directive.rendererOptions || {},
        dataTransform: directive.dataTransform || null,
        objects: (directive.objects || []).map(object => ({
          line: object.line,
          frameSpec: object.frameSpec || '',
          objectId: object.objectId || '',
          layoutId: object.layoutId || '',
          primaryVariableId: object.primaryVariableId || '',
          primaryName: object.primaryName || '',
          displayVariableIds: object.displayVariableIds || [],
          renderer: object.renderer || '',
          rendererOptions: object.rendererOptions || {},
          dataTransform: object.dataTransform || null,
          objectBinding: object.objectBinding || null
        })),
        when: directive.when || null,
        texts: directive.texts || [],
        styles: directive.styles || [],
        segments: directive.segments || [],
        arrows: directive.arrows || [],
        eventControls: directive.eventControls || [],
        autoMarkVariableIds: directive.autoMarkVariableIds,
        camera: directive.camera || null,
        presetDirectives: directive.presetDirectives || []
      }));
      traceKeepDirectives = instrumented.keepDirectives.map((directive, index) => ({
        line: directive.line,
        mode: directive.mode,
        label: directive.label || '',
        layoutId: directive.layoutId || '',
        binding: directive.binding || null,
        placementOffset: directive.placementOffset || null,
        when: directive.when || null,
        presetNames: directive.presetNames || [],
        functionName: directive.functionName || directive.variable?.functionName || 'global',
        index: directive.index ?? index
      }));
      traceLayoutDirectives = Array.isArray(instrumented.layoutDirectives)
        ? JSON.parse(JSON.stringify(instrumented.layoutDirectives))
        : [];
      traceEventSources = instrumented.eventSources || {};
      traceSourceDeclarations = Array.isArray(instrumented.sourceDeclarations)
        ? instrumented.sourceDeclarations
        : [];
      traceSourceStructure = Array.isArray(instrumented.sourceStructure)
        ? instrumented.sourceStructure
        : [];
      traceCodeHideRanges = Array.isArray(instrumented.codeHideRanges)
        ? instrumented.codeHideRanges
        : [];
      if (instrumented.frameDirectives.some(directive => !directive.silentKeepView)) {
        traceSliceMode = 'manual';
      }
      logDebug(traceEnabled
        ? `Trace instrumentation enabled for ${traceVariables.length} variables`
        : 'No drawing directives: using normal compilation without animation tracing');
    } catch (err) {
      // Trace analysis must not prevent the original program from running.
      // Fall back to the normal compiler path when the parser cannot rewrite
      // an otherwise valid C++ source file.
      traceEnabled = false;
      sourceCode = code;
      traceVariables = [];
      traceFrameDirectives = [];
      traceKeepDirectives = [];
      traceLayoutDirectives = [];
      traceEventSources = {};
      traceSourceDeclarations = [];
      traceSourceStructure = [];
      traceCodeHideRanges = [];
      traceWarning = `追蹤分析未完成，已使用一般執行：${err.message}`;
      logDebug(traceWarning);
    }
  }

  const engineFingerprint = `${TraceProvenance.ENGINE_VERSION}/${TraceProvenance.FORMAT_VERSION}`;
  const compilerFingerprint = COMPILER_FINGERPRINT;
  const executableKey = createExecutableKey({
    source: sourceCode,
    compiler: compilerFingerprint,
    flags: [traceEnabled ? '-O0' : '-O2', process.platform === 'win32' ? '-std=c++1z' : '-std=c++17'],
    engine: engineFingerprint,
  });
  const traceCacheKey = createTraceKey({
    executableKey,
    input: typeof input === 'string' ? input : '',
    traceConfig: { ...trace, enabled: traceEnabled, sliceMode: traceSliceMode },
    engine: engineFingerprint,
  });
  // Explicit true affects this request only: it still uses the normal queue,
  // limits and sandbox, but neither reads nor writes shared compilation caches.
  const forceRecompile = req.body?.forceRecompile === true;
  const sharedCache = !forceRecompile
    && (req.headers['x-compile-cache'] === 'shared' || req.body?.cachePolicy === 'shared');
  const cacheAvailable = Boolean(await artifactCacheReady);
  if (forceRecompile) {
    res.setHeader('X-Compile-Trace-Cache', 'BYPASS');
    res.setHeader('X-Compile-Executable-Cache', 'BYPASS');
    logDebug('FORCE_RECOMPILE: 略過執行檔與 Trace 快取，重新編譯並執行');
  }
  if (sharedCache) res.setHeader('X-Compile-Trace-Id', traceCacheKey);

  if (sharedCache && cacheAvailable) {
    let cachedLease = null;
    try {
      cachedLease = await artifactCache.acquire('trace', traceCacheKey);
      if (cachedLease) {
        res.setHeader('X-Compile-Trace-Cache', 'HIT');
        res.type('application/json');
        res.setHeader('Content-Length', String(cachedLease.entry.size));
        // Parsing and execution are already complete. Release the single
        // expensive-work slot before streaming to a slow browser.
        markCompileWorkComplete();
        await pipeline(fs.createReadStream(cachedLease.entry.path), res);
        return undefined;
      }
      res.setHeader('X-Compile-Trace-Cache', 'MISS');
    } catch (error) {
      if (res.headersSent) {
        logDebug('傳送追蹤快取失敗：' + error.message);
        res.destroy(error);
        return undefined;
      }
      logDebug('讀取追蹤快取失敗，改用一般編譯：' + error.message);
    } finally {
      if (cachedLease) await cachedLease.release();
    }
  }

  /*
  // 關鍵字過濾
  for (const keyword of BLACKLIST_KEYWORDS) {
      const regex = new RegExp(keyword, 'i');
      if (regex.test(code)) {
          const msg = `不允許 "${keyword}" ，操作已被阻擋。`;
          logDebug(msg);
          return res.status(400).json({
              output: '',
              error: msg,
              compileTime: null,
              runTime: null,
              memoryKB: null,
              debug_log: getCompileDebugMessages(),
          });
      }
  }
  */

  // 使用 uuid 產生唯一 ID
  const uniqueId = uuidv4();
  const isWindows = process.platform === 'win32';
  const sourcePath = path.join(TEMP_DIR, `main_${uniqueId}.cpp`);
  const exePath = path.join(TEMP_DIR, `main_exec_${uniqueId}${isWindows ? '.exe' : ''}`);
  const scriptPath = path.join(TEMP_DIR, `script_${uniqueId}.js`);
  const tracePath = path.join(TEMP_DIR, `trace_${uniqueId}.jsonl`);

  // 定義清理函式
  const cleanup = (attempt = 0) => {
    let retryNeeded = false;
    [sourcePath, exePath, scriptPath, tracePath, tracePath + '.chunks.gz', tracePath + '.chunks.gz.index.json'].forEach(filePath => {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        retryNeeded = true;
        if (attempt >= 3) logDebug('清理暫存檔失敗: ' + e.message);
      }
    });
    if (retryNeeded && attempt < 3) {
      setTimeout(() => cleanup(attempt + 1), 200);
    }
  };

  // 1. 寫入 source
  try {
    fs.writeFileSync(sourcePath, sourceCode, 'utf8');
  } catch (err) {
    cleanup();
    return res.status(500).json({
      output: '',
      error: '無法寫入暫存檔：' + err.message,
      debug_log: getCompileDebugMessages(),
    });
  }
  logDebug(`原始碼寫入完成: ${path.basename(sourcePath)}`);

  // 2. 編譯
  const compileArgs = [
    isWindows ? '-std=c++1z' : '-std=c++17',
    traceEnabled ? '-O0' : '-O2',
    sourcePath,
    '-I', TEMP_DIR,
    '-I', path.join(__dirname, 'lib'), // 去 lib 資料夾找 AV.hpp
    '-o', exePath,
  ];
  if (!isWindows) compileArgs.splice(7, 0, '-I', '/tmp');

  const compileStart = performance.now();
  const compileHardTimeoutMs = LIMITS.COMPILE_TIME_MS + 250;
  const compileHardTimeoutSeconds = `${(compileHardTimeoutMs / 1000).toFixed(3)}s`;
  const compilerMemoryKB = 512 * 1024;
  req.compileWorkSpawned = true;
  let executableCacheHit = false;
  if (cacheAvailable && !forceRecompile) {
    let lease = null;
    try {
      lease = await artifactCache.acquire('executable', executableKey);
      if (lease) {
        fs.copyFileSync(lease.entry.path, exePath);
        executableCacheHit = true;
        res.setHeader('X-Compile-Executable-Cache', 'HIT');
        logDebug('EXECUTABLE_CACHE_HIT: 重用已編譯執行檔');
      } else {
        res.setHeader('X-Compile-Executable-Cache', 'MISS');
      }
    } catch (error) {
      logDebug('讀取執行檔快取失敗，改用一般編譯：' + error.message);
    } finally {
      if (lease) await lease.release();
    }
  }

  let gpp;
  if (executableCacheHit) {
    // Keep the normal post-compile path intact while skipping the compiler.
    // The cached binary is copied into this request's private temp path so the
    // normal sandbox permissions and cleanup rules still apply.
    gpp = new EventEmitter();
    gpp.stderr = new EventEmitter();
    gpp.pid = null;
    gpp.kill = () => false;
    setImmediate(() => gpp.emit('close', 0));
  } else {
    gpp = isWindows
      ? spawn('g++', compileArgs, { cwd: __dirname })
      : spawn('sh', [
          '-c',
          `ulimit -v ${compilerMemoryKB} && exec timeout --signal=TERM --kill-after=1s ${compileHardTimeoutSeconds} g++ "$@"`,
          'g++',
          ...compileArgs,
        ], { cwd: __dirname, detached: true });
  }

  let compileErr = '';
  let compileTimedOut = false;
  let compileOutputExceeded = false;
  let compileSettled = false;
  const terminateCompilerTree = () => {
    try {
      if (isWindows && gpp.pid) {
        spawn('taskkill', ['/F', '/T', '/PID', String(gpp.pid)]);
      } else if (gpp.pid) {
        process.kill(-gpp.pid, 'SIGKILL');
      }
    } catch (error) {
      logDebug(`編譯程序樹終止失敗，等待外部 watchdog 回收: ${error.message}`, {
        code: error.code || '',
      });
    }
  };
  const compileTimer = executableCacheHit ? null : setTimeout(() => {
    compileTimedOut = true;
    logDebug(`編譯超過 ${LIMITS.COMPILE_TIME_MS}ms，強制終止`, { pid: gpp.pid });
    terminateCompilerTree();
  }, LIMITS.COMPILE_TIME_MS);

  gpp.stderr.on('data', (data) => {
    if (compileOutputExceeded) return;
    const chunk = data.toString();
    const remaining = LIMITS.COMPILE_STDERR_SIZE - compileErr.length;
    if (chunk.length > remaining) {
      if (remaining > 0) compileErr += chunk.slice(0, remaining);
      compileErr += '\n... [Compiler Output Limit Exceeded]';
      compileOutputExceeded = true;
      logDebug('編譯器錯誤輸出超過限制，強制終止', { pid: gpp.pid });
      terminateCompilerTree();
      return;
    }
    compileErr += chunk;
  });

  gpp.on('error', (error) => {
    if (compileSettled) return;
    compileSettled = true;
    clearTimeout(compileTimer);
    logDebug('無法啟動編譯器：' + error.message);
    cleanup();
    res.status(500).json({
      output: '',
      error: '編譯服務暫時無法使用',
      verdict: 'INFRA',
      compileTime: +((performance.now() - compileStart).toFixed(1)),
      runTime: null,
      memoryKB: null,
      debug_log: getCompileDebugMessages(),
    });
    markCompileWorkComplete();
  });

  gpp.on('close', async (codeExit) => {
    if (compileSettled) return;
    compileSettled = true;
    clearTimeout(compileTimer);
    const compileTime = +((performance.now() - compileStart).toFixed(1));

    if (codeExit !== 0) {
      logDebug('編譯失敗，退出碼：' + codeExit);
      cleanup();
      res.status(400).json({
        output: '',
        error: compileTimedOut
          ? `編譯逾時 (> ${LIMITS.COMPILE_TIME_MS}ms)`
          : compileErr || ('編譯失敗，退出碼：' + codeExit),
        verdict: compileTimedOut ? 'INFRA' : 'CE',
        compileTime,
        runTime: null,
        memoryKB: null,
        debug_log: getCompileDebugMessages(),
      });
      markCompileWorkComplete();
      return;
    }

    logDebug(executableCacheHit
      ? `執行檔快取載入完成，耗時 ${compileTime} ms`
      : `編譯成功，耗時 ${compileTime} ms`);

    if (!isWindows) {
      // 確保 sandboxuser (UID 1000) 有權限執行這個 root 產生的檔案
      try {
        fs.chmodSync(exePath, 0o755); // 755 = rwxr-xr-x (所有人可讀可執行)
      } catch (err) {
        logDebug('權限設定失敗: ' + err.message);
        cleanup();
        res.status(500).json({ output: '', error: 'Server Error: Unable to set permissions.', verdict: 'INFRA' });
        markCompileWorkComplete();
        return;
      }
    }

    if (!executableCacheHit && cacheAvailable && !forceRecompile) {
      try {
        await artifactCache.putFile('executable', executableKey, exePath, {
          metadata: { compilerFingerprint, engineFingerprint },
        });
        logDebug('EXECUTABLE_CACHE_STORED: 已保存可重用執行檔');
      } catch (error) {
        logDebug('保存執行檔快取失敗，繼續執行本次程式：' + error.message);
      }
    }

    // 3. 執行程式
    // Node 以 root 啟動、執行檔則降級成 sandboxuser。容器沒有 CAP_KILL 時，
    // Node 無法保證能跨 UID 終止逾時程式，因此 Linux 額外使用同 UID 的
    // GNU timeout 當硬性 watchdog。略晚於應用層 TLE，讓前者先記錄原因，
    // watchdog 再確保整個執行程序群組確實被回收。
    const hardTimeoutMs = LIMITS.TIME_MS + 250;
    const hardTimeoutSeconds = `${(hardTimeoutMs / 1000).toFixed(3)}s`;
    const executableCommand = isWindows
      ? `"${exePath}"`
      : `timeout --signal=TERM --kill-after=1s ${hardTimeoutSeconds} "${exePath}"`;
    const ulimitCmd = `ulimit -v ${LIMITS.MEMORY_MB * 1024} && exec ${executableCommand}`;
    const runStart = performance.now();
    const runOptions = {
      cwd: isWindows ? TEMP_DIR : '/sandbox',
      // 幫stdin stdout stderr開通道
      stdio: ['pipe', 'pipe', 'pipe'],

      // 導入環境變數
      env: {
        ...process.env,
        AV_OUTPUT_FILE: scriptPath,
        ASM_TRACE_FILE: tracePath,
        ASM_TRACE_MAX_FRAMES: '5000'
      }
    };
    if (!isWindows) {
      // Linux 正式環境使用唯讀 sandbox 並降級身分。
      runOptions.uid = 1000;
      runOptions.gid = 1000;
    }
    const child = isWindows
      ? spawn(exePath, [], runOptions)
      : spawn('sh', ['-c', ulimitCmd], runOptions);

    if (!isWindows) {
      logDebug(`執行 watchdog 已啟動，硬性上限 ${hardTimeoutMs}ms`, { pid: child.pid });
    }

    let runOut = '';
    let runErr = '';
    let isTLE = false;
    let isOLE = false;

    let memSampler = null;
    let peakMem = { peakRssKB: 0, peakHwmKB: 0, peakVmsKB: 0 };

    if (child.pid && !isWindows) {
      memSampler = startMemorySampler(child.pid, 1);
    } else if (!child.pid) {
      logDebug('MEM: child.pid 不存在，無法取樣記憶體');
    }

    const collectOutput = (data, isStderr) => {
      if (isTLE || isOLE) return;

      const chunk = data.toString();
      const currentLen = runOut.length + runErr.length;

      if (currentLen + chunk.length > LIMITS.OUTPUT_SIZE) {
        isOLE = true;
        const remaining = LIMITS.OUTPUT_SIZE - currentLen;
        if (remaining > 0) {
          if (isStderr) runErr += chunk.substring(0, remaining);
          else runOut += chunk.substring(0, remaining);
        }
        const msg = '\n... [Output Limit Exceeded]';
        if (isStderr) runErr += msg;
        else runOut += msg;

        logDebug('OLE: 輸出超過限制，強制終止');
        try {
          const sent = child.kill('SIGKILL');
          if (!sent) logDebug('OLE: SIGKILL 未成功送出，等待外部 watchdog 回收', { pid: child.pid });
        } catch (error) {
          logDebug(`OLE: SIGKILL 送出失敗，等待外部 watchdog 回收: ${error.message}`, {
            pid: child.pid,
            code: error.code || ''
          });
        }
      } else {
        if (isStderr) runErr += chunk;
        else runOut += chunk;
      }
    };

    child.stdout.on('data', (d) => collectOutput(d, false));
    child.stderr.on('data', (d) => collectOutput(d, true));

    let hasResponded = false; // 防呆：確保不重複回傳

    const sendResponse = async (codeRun, signal, forced = false) => {
      if (hasResponded) return;
      hasResponded = true;

      if (memSampler) {
        memSampler.stop();
        peakMem = memSampler.getPeak();
      }

      const runTime = +((performance.now() - runStart).toFixed(1));
      logDebug(`程式結束，退出碼：${codeRun}，signal：${signal}`, { codeRun, signal, peakRssKB: peakMem.peakRssKB });

      // 解析 stderr 中的 [debug] 訊息與腳本超限提示，加入 debug_log
      if (runErr) {
        runErr.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith('[debug]')) {
            logDebug(trimmed);
          } else if (trimmed.startsWith('Script Size Exceeded')) {
            logDebug(trimmed);
          }
        });
      }

      let scriptContent = '';
      let traceDocument = null;
      let traceError = "";
      try {
        if (fs.existsSync(scriptPath)) scriptContent = fs.readFileSync(scriptPath, 'utf8');
      } catch (err) {
        const warning = '讀取動畫腳本失敗：' + err.message;
        traceWarning = [traceWarning, warning].filter(Boolean).join('\n');
        logDebug(warning);
      }

      if (traceEnabled) {
        try {
          traceDocument = await readTraceDocument(tracePath, traceVariables, {
            ...trace,
            sourceCode: code,
            sliceMode: traceSliceMode,
            frameDirectives: traceFrameDirectives,
            keepDirectives: traceKeepDirectives,
            layoutDirectives: traceLayoutDirectives,
            eventSources: traceEventSources,
            sourceDeclarations: traceSourceDeclarations,
            sourceStructure: traceSourceStructure,
            codeHideRanges: traceCodeHideRanges,
            asmView
          });
        } catch (err) {
          traceError = '追蹤資料載入失敗：' + err.message;
          traceWarning = [traceWarning, traceError].filter(Boolean).join('\n');
          logDebug('Failed to read trace output: ' + err.message);
          runErr += `\nTrace Error: ${err.message}`;
        }
      }

      cleanup();

      const memoryKB = (peakMem.peakRssKB > 0) ? peakMem.peakRssKB : (peakMem.peakHwmKB > 0 ? peakMem.peakHwmKB : null);

      let finalError = '';
      let verdict = 'OK';
      const memoryLimitPattern = /(std::bad_alloc|cannot allocate memory|out of memory|memory limit exceeded)/i;
      if (isTLE) {
        verdict = 'TLE';
        finalError = `Time Limit Exceeded (> ${LIMITS.TIME_MS}ms)`;
      } else if (isOLE) {
        verdict = 'OLE';
        finalError = `Output Limit Exceeded (> ${LIMITS.OUTPUT_SIZE / 1024}KB)`;
      } else if (runErr && runErr.includes('Script Size Exceeded')) {
        verdict = 'OLE';
        finalError = runErr.split('\n').find(l => l.includes('Script Size Exceeded')) || 'Script Size Exceeded';
      } else if (memoryLimitPattern.test(runErr)) {
        verdict = 'MLE';
        finalError = `Memory Limit Exceeded (> ${LIMITS.MEMORY_MB}MB)`;
      } else if (codeRun !== 0 || signal) {
        verdict = 'RE';
        finalError = (runErr && runErr.trim() !== '') ? runErr : `Runtime Error`;
      }

      if (!finalError && traceError) finalError = traceError;

      if (forced) logDebug('強制回收：進程未能及時關閉，已先行回傳結果。');

      if (traceDocument && !finalError) traceDocument.provenance = TraceProvenance.create(code, input);

      const responseBody = {
        output: runOut,
        error: finalError,
        verdict,
        traceWarning,
        compileTime,
        runTime,
        memoryKB,
        debug_log: getCompileDebugMessages(),
        scriptContent: scriptContent,
        traceDocument,
        cache: {
          trace: sharedCache ? 'STORED' : 'BYPASS',
          executable: forceRecompile ? 'BYPASS' : executableCacheHit ? 'HIT' : 'MISS',
          executableId: executableKey,
          traceId: traceCacheKey,
        },
      };
      if (sharedCache && cacheAvailable && traceDocument && !finalError) {
        try {
          await storeJsonArtifact(traceCacheKey, responseBody, {
            metadata: { executableKey, engineFingerprint },
          });
          logDebug('TRACE_CACHE_STORED: 已保存共用追蹤結果');
          responseBody.debug_log = getCompileDebugMessages();
        } catch (error) {
          logDebug('保存追蹤快取失敗，繼續回傳本次結果：' + error.message);
          responseBody.debug_log = getCompileDebugMessages();
        }
      }
      // At this point the child has closed and trace parsing is complete. Free
      // the expensive-work slot before a slow client finishes downloading.
      markCompileWorkComplete();
      try { await TraceChunkStore.sendJson(req, res, responseBody); } catch (error) {
        logDebug('回傳編譯結果失敗：' + error.message);
        if (!res.headersSent) res.status(500).json({error:'無法傳送追蹤資料'});
        else res.destroy();
      }
    };

    const tleTimer = setTimeout(() => {
      isTLE = true;
      logDebug(`TLE: 超過 ${LIMITS.TIME_MS}ms，強制終止`, { pid: child.pid });
      try {
        const sent = child.kill('SIGKILL');
        if (!sent) logDebug('TLE: SIGKILL 未成功送出，等待外部 watchdog 回收', { pid: child.pid });
        // 在 Windows 下 sh 可能不會殺掉 exec 出後的進程，故增加這層保險
        if (process.platform === 'win32' && child.pid) {
          spawn('taskkill', ['/F', '/T', '/PID', child.pid]);
        }
      } catch (error) {
        logDebug(`TLE: SIGKILL 送出失敗，等待外部 watchdog 回收: ${error.message}`, {
          pid: child.pid,
          code: error.code || ''
        });
      }

    }, LIMITS.TIME_MS);

    if (typeof input === 'string' && input.length > 0) {
      child.stdin.write(input);
    }
    child.stdin.end();

    child.on('error', (e) => {
      logDebug('執行程式 spawn 失敗：' + e.message);
      // child.kill() 對不同 UID 的 sandbox 程序可能觸發 EPERM error 事件；
      // 此時同 UID 的外部 watchdog 仍在運作，不能提前 cleanup／回應，
      // 否則 timeout 來不及 wait() 回收子程序而留下 zombie。
      if ((isTLE || isOLE) && e.code === 'EPERM' && !isWindows) {
        logDebug('直接終止權限不足，等待外部 watchdog 完成終止與 wait 回收', {
          pid: child.pid,
          code: e.code
        });
        return;
      }
      if (!hasResponded) sendResponse(null, null);
    });

    child.on('close', (codeRun, signal) => {
      clearTimeout(tleTimer);
      sendResponse(codeRun, signal);
    });
  });
  } catch (error) {
    logDebug('編譯準備失敗：' + error.message);
    req.emit('asm:compile-work-complete');
    if (!res.headersSent && !res.destroyed) {
      res.status(500).json({
        output: '', error: '編譯準備失敗，請重試。', code: 'COMPILE_PREPARATION_ERROR',
        compileTime: null, runTime: null, memoryKB: null,
        debug_log: getCompileDebugMessages(), traceDocument: null, scriptContent: '',
      });
    } else if (!res.destroyed) res.destroy();
  }
}));

// 每小時執行一次：清理殘留檔案
setInterval(() => {
  fs.readdir(TEMP_DIR, (err, files) => {
    if (err) return;
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    files.forEach(file => {
      if (file.startsWith('main_') || file.startsWith('script_')) {
        const filePath = path.join(TEMP_DIR, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return;
          if (now - stats.birthtimeMs > ONE_HOUR) {
            fs.unlink(filePath, () => { });
            console.log(`[Auto-Clean] 刪除過期殘留檔: ${file}`);
          }
        });
      }
    });
  });
}, 60 * 60 * 1000);



const SAMPLES_DIR = path.join(__dirname, '/algorithm_sample');

// 遞迴讀取目錄結構
function getDirectoryTree(dirPath, rootPath = SAMPLES_DIR) {
  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) return [];

  const items = fs.readdirSync(dirPath);
  const visibleItems = items.filter(item => !item.startsWith('.'));

  const tree = visibleItems.map(item => {
    const fullPath = path.join(dirPath, item);
    const itemStats = fs.statSync(fullPath);

    // 計算相對於 SAMPLES_DIR 的路徑 (例如: "Graph/DFS.cpp")
    // 並將 Windows 的反斜線 '\\' 轉為 Web 通用的正斜線 '/'
    const relativePath = path.relative(rootPath, fullPath).split(path.sep).join('/');

    if (itemStats.isDirectory()) {
      return {
        name: item,
        type: 'folder',
        path: relativePath, // 加入路徑
        children: getDirectoryTree(fullPath, rootPath) // 遞迴
      };
    } else {
      return {
        name: item,
        type: 'file',
        path: relativePath  // 加入路徑
      };
    }
  });

  // 排序：資料夾在先
  tree.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'folder' ? -1 : 1;
  });

  return tree;
}

// ─────────────────────────────────────────────────────────────────────────────
// 程式草稿與內建範例 API：草稿受 JWT 擁有者限制，範例目錄只讀
// ─────────────────────────────────────────────────────────────────────────────

// 程式草稿資料結構
const CodeSchema = new mongoose.Schema({
  user_uid: { type: String, required: true },  // User UID
  code_uid: { type: String, unique: true },    // Code UID (唯一)
  title: { type: String, required: true },  // 標題
  desc: { type: String },                  // 簡述
  language: { type: String, default: 'cpp' },  // 程式語言
  inputs: { type: [String], default: [] },   // 儲存一個或多個輸入內容
  content: { type: String, required: true },  // 程式碼內容
  created_at: { type: Date, default: Date.now } // 建檔時間
});

// 4. 建立模型 (Model)
// 以後你就用這個 'CodeModel' 來對資料庫做增刪改查
const CodeModel = mongoose.model('Code', CodeSchema);

// === 程式碼儲存與讀取 API ===

// 1. 儲存程式碼 (需登入)
app.post('/api/codes', authenticateToken, async (req, res) => {
  const { title, desc, language, content, inputs } = req.body;
  const user_uid = req.user.id; // 從 JWT 解析出來的 user id

  if (!title || !content) {
    return res.status(400).json({ error: '標題與程式碼內容為必填' });
  }

  try {
    const code_uid = uuidv4();
    const newCode = await CodeModel.create({
      user_uid,
      code_uid,
      title,
      desc,
      language: language || 'cpp',
      inputs: inputs || [],
      content
    });
    res.json({ success: true, message: '程式碼儲存成功！', code_uid: newCode.code_uid });
  } catch (err) {
    console.error('儲存程式碼失敗:', err);
    res.status(500).json({ error: '伺服器錯誤，儲存失敗' });
  }
});

// 2. 讀取該帳號的所有程式碼 (需登入)
app.get('/api/codes', authenticateToken, async (req, res) => {
  const user_uid = req.user.id;

  try {
    // 找出所有屬於該使用者的程式碼，並依照時間降序排列
    const codes = await CodeModel.find({ user_uid }).sort({ created_at: -1 });
    res.json({ success: true, codes });
  } catch (err) {
    console.error('讀取程式碼列表失敗:', err);
    res.status(500).json({ error: '伺服器錯誤，讀取失敗' });
  }
});

// 3. 讀取特定程式碼內容 (需登入)
app.get('/api/codes/:code_uid', authenticateToken, async (req, res) => {
  const { code_uid } = req.params;
  const user_uid = req.user.id;

  try {
    const code = await CodeModel.findOne({ code_uid, user_uid });
    if (!code) {
      return res.status(404).json({ error: '找不到該程式碼或權限不足' });
    }
    res.json({ success: true, code });
  } catch (err) {
    console.error('讀取特定程式碼失敗:', err);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// 4. 刪除程式碼 (需登入)
app.delete('/api/codes/:code_uid', authenticateToken, async (req, res) => {
  const { code_uid } = req.params;
  const user_uid = req.user.id;

  try {
    // 刪除條件：code_uid 符合 且 user_uid 是本人
    const result = await CodeModel.findOneAndDelete({ code_uid, user_uid });

    if (!result) {
      return res.status(404).json({ error: '找不到該程式碼或無權刪除' });
    }

    res.json({ success: true, message: '刪除成功' });
  } catch (err) {
    console.error('刪除失敗:', err);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// === /api/samples 路由 ===
app.get('/api/samples', (req, res) => {
  const requestedFilename = req.query.filename;
  // === 情況 A: 讀取檔案內容 (有傳 ?filename=Graph/DFS.cpp) ===
  if (requestedFilename) {
    // [安全防護] 防止 Directory Traversal 攻擊 (例如傳 ../../etc/passwd)
    // 1. 組合完整路徑
    const safePath = path.join(SAMPLES_DIR, requestedFilename);

    // 2. 確保解析後的路徑，真的還在 SAMPLES_DIR 裡面
    if (!safePath.startsWith(SAMPLES_DIR)) {
      return res.status(403).send("Access Denied: Invalid file path.");
    }

    // 3. 檢查檔案是否存在
    if (!fs.existsSync(safePath)) {
      return res.status(404).send("File not found.");
    }

    // 4. 讀取並回傳文字內容
    fs.readFile(safePath, 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error reading file.");
      }
      res.send(data);
    });
  }

  // === 情況 B: 獲取目錄結構 (沒傳參數) ===
  else {
    try {
      // 確認根目錄存在
      if (!fs.existsSync(SAMPLES_DIR)) {
        // 如果資料夾不存在，先建立它以免報錯，或是回傳空陣列
        console.warn(`Samples directory not found at: ${SAMPLES_DIR}`);
        return res.json([]);
      }

      const tree = getDirectoryTree(SAMPLES_DIR);
      res.json(tree);
    } catch (err) {
      console.error("Error scanning directory:", err);
      res.status(500).send("Server error scanning samples.");
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
