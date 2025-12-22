// server.js
const express         = require('express');
const path            = require('path');
const fs              = require('fs');
const { spawn }       = require('child_process');
const { performance } = require('perf_hooks');

const SAMPLE_DIR = path.join(__dirname, 'tmp', 'algorithm_sample');
const app = express();
let debugMessages = [];

// 記錄這次請求的 debug 訊息
function logDebug(msg) {
  debugMessages.push({ time: new Date().toISOString(), msg });
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '5mb' }));

// 編譯＋執行 C++ 程式
app.post('/compile', (req, res) => {
  debugMessages = []; // 每次請求重置

  const { code, input } = req.body || {};

  if (typeof code !== 'string') {
    logDebug('收到的 code 不是字串');
    return res.status(400).json({
      output: '',
      error: 'code 必須是字串',
      compileTime: null,
      runTime: null,
      memoryKB: null,
      debug_log: debugMessages,
    });
  }

  // main.cpp / main_exec 放在「專案根目錄」
  const sourcePath = path.join(__dirname, 'main.cpp');
  const exePath    = path.join(__dirname, 'main_exec');

  // 1. 寫入 main.cpp
  logDebug('開始寫入 main.cpp');
  try {
    fs.writeFileSync(sourcePath, code, 'utf8');
  } catch (err) {
    logDebug('寫入 main.cpp 失敗：' + err.message);
    return res.status(500).json({
      output: '',
      error: '無法寫入 main.cpp：' + err.message,
      compileTime: null,
      runTime: null,
      memoryKB: null,
      debug_log: debugMessages,
    });
  }
  logDebug('main.cpp 寫入完成，開始編譯');

  // 檢查 AV.hpp 有沒有在你說的 /tmp 位置
  const avInProjectTmp = fs.existsSync(path.join(__dirname, 'tmp', 'AV.hpp'));
  const avInSystemTmp  = fs.existsSync('/tmp/AV.hpp');
  logDebug('fs.existsSync(__dirname + "/tmp/AV.hpp") = ' + avInProjectTmp);
  logDebug('fs.existsSync("/tmp/AV.hpp") = ' + avInSystemTmp);

  // 編譯參數：
  //   -I 專案底下的 tmp
  //   -I 系統的 /tmp
  const compileArgs = [
    '-std=c++17',
    '-O2',
    sourcePath,
    '-I', path.join(__dirname, 'tmp'),
    '-I', '/tmp',
    '-o', exePath,
  ];
  logDebug('編譯指令: g++ ' + compileArgs.join(' '));

  const compileStart = performance.now();
  const gpp = spawn('g++', compileArgs, {
    cwd: __dirname, // 在專案根目錄編譯
  });

  let compileErr = '';

  gpp.stderr.on('data', (data) => {
    compileErr += data.toString();
  });

  gpp.on('error', (e) => {
    logDebug('啟動 g++ 失敗：' + e.message);
  });

  gpp.on('close', (codeExit) => {
    const compileEnd  = performance.now();
    const compileTime = +(compileEnd - compileStart).toFixed(1);

    if (codeExit !== 0) {
      logDebug('編譯失敗，退出碼：' + codeExit);
      if (compileErr) {
        logDebug('g++ stderr:\n' + compileErr);
      }
      return res.status(400).json({
        output: '',
        error: compileErr || ('編譯失敗，退出碼：' + codeExit),
        compileTime,
        runTime: null,
        memoryKB: null,
        debug_log: debugMessages,
      });
    }

    logDebug('編譯成功，耗時 ' + compileTime + ' ms');
    logDebug('開始執行程式');

    // 2. 執行程式：cwd 一樣放在專案根目錄
    //   這樣 AV.hpp 裡的 "public/code_script.js" 會寫到 /usr/src/app/public/code_script.js
    const runStart = performance.now();
    const child = spawn(exePath, [], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let runOut = '';
    let runErr = '';

    child.stdout.on('data', (data) => {
      runOut += data.toString();
    });

    child.stderr.on('data', (data) => {
      runErr += data.toString();
    });

    child.on('error', (e) => {
      logDebug('執行程式 spawn 失敗：' + e.message);
    });

    // 把前端「輸入」tab 的文字寫進 stdin，給 C++ 用 cin / getline 讀
    if (typeof input === 'string' && input.length > 0) {
      logDebug('寫入程式 stdin：\n' + input);
      child.stdin.write(input);
    }
    child.stdin.end();

    const maxMem = null; // 簡化：暫時不抓記憶體

    // 執行超過 5 秒自動切斷（TLE）
    const TLE_MS = 5000;
    let killedByTLE = false;

    const tleTimer = setTimeout(() => {
      killedByTLE = true;
      logDebug(`TLE：執行超過 ${TLE_MS} ms，強制中止程式 (SIGKILL)`);
      try {
        child.kill('SIGKILL');
      } catch (e) {
        logDebug('TLE kill 失敗：' + e.message);
      }
    }, TLE_MS);

    child.on('close', (codeRun, signal) => {
      clearTimeout(tleTimer);

      const runEnd  = performance.now();
      const runTime = +(runEnd - runStart).toFixed(1);

      logDebug('程式結束，退出碼：' + codeRun + (signal ? `，signal：${signal}` : ''));

      if (runErr) {
        logDebug('程式 stderr:\n' + runErr);
      }

      // ★ 新增：TLE 回傳（維持你原本回傳格式，只用 error 告知）
      if (killedByTLE) {
        return res.status(400).json({
          output: runOut || '',
          error: `Time Limit Exceeded（超過 ${TLE_MS} ms）`,
          compileTime,
          runTime,
          memoryKB: maxMem,
          debug_log: debugMessages,
        });
      }

      if (codeRun !== 0) {
        return res.status(400).json({
          output: runOut || runErr,
          error: runErr || ('程式非正常結束，退出碼：' + codeRun),
          compileTime,
          runTime,
          memoryKB: maxMem,
          debug_log: debugMessages,
        });
      }

      return res.json({
        output: runOut,
        error: '',
        compileTime,
        runTime,
        memoryKB: maxMem,
        debug_log: debugMessages,
      });
    });
  });
});

app.get('/api/samples', (req, res) => {
    // === 除錯點 1：確認請求進入路由 ===

    if (req.query.filename) {
        // --- 邏輯 A：如果有 filename，就讀取檔案內容 ---
        console.log('[API] 進入讀取檔案模式');

        const filePath = path.join(SAMPLE_DIR, req.query.filename);

        // 安全檢查
        // 注意：path.join 有時會處理掉 ..，建議用 path.resolve 檢查絕對路徑會更嚴謹
        // 但這裡先沿用你的邏輯
        if (!filePath.startsWith(SAMPLE_DIR)) {
             console.log('[API] ⛔ 路徑非法攔截:', filePath);
             return res.status(403).send("Forbidden");
        }

        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.log('[API] ❌ 讀取失敗:', err.message);
                return res.status(404).send("File not found");
            }
            console.log('[API] ✅ 檔案讀取成功');
            res.send(data);
        });

    } else {
        // --- 邏輯 B：沒有 filename，就列出檔案列表 ---
        console.log('[API] 進入列表模式');

        fs.readdir(SAMPLE_DIR, (err, files) => {
            if (err) {
                console.log('[API] ❌ 無法讀取資料夾:', err.message);
                return res.json([]);
            }

            // 過濾 .cpp 或 .c
            const cppFiles = files.filter(f => f.endsWith('.cpp') || f.endsWith('.c'));

            console.log('[API] ✅ 列表回傳:', cppFiles);
            res.json(cppFiles);
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
