const { parentPort } = require('node:worker_threads');
const { analyzeTraceSource } = require('./trace-analysis');

parentPort.on('message', ({ id, code }) => {
  try {
    parentPort.postMessage({ id, result: analyzeTraceSource(code) });
  } catch (error) {
    parentPort.postMessage({ id, error: { message: error.message, name: error.name } });
  }
});
