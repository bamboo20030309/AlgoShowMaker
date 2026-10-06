// Loaded only by the isolated regression process. Exercise the route's
// Promise error boundary without changing production cache behavior.
const cache = require('../../artifact-cache');
const createExecutableKey = cache.createExecutableKey;
cache.createExecutableKey = options => {
  if (options.source.includes('ASM_TEST_PREPARATION_FAILURE')) {
    throw new TypeError('injected cache-key preparation failure');
  }
  return createExecutableKey(options);
};
