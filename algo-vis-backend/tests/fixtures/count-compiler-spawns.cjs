// Observe actual compiler launches only in the isolated test process.
const processes = require('node:child_process');
const spawn = processes.spawn;
processes.spawn = function (file, args, options) {
  if (file === 'g++' || (file === 'sh' && args?.some(value => String(value).includes('g++ "$@"')))) {
    process.stdout.write('ASM_TEST_COMPILER_SPAWN\n');
  }
  return spawn.apply(this, arguments);
};
