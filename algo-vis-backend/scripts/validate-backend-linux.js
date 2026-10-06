'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// No deployment mutation: an ephemeral container has no ports, database or
// persistent volumes. Only test source is mounted, read-only.
const source = path.resolve(__dirname, '..');
const result = spawnSync('docker', ['run', '--rm', '--name', `asm-validation-${process.pid}`,
  '--cpus', '2', '--memory', '2g', '--pids-limit', '128', '--cap-drop', 'ALL',
  '--cap-add', 'SETUID', '--cap-add', 'SETGID', '--security-opt', 'no-new-privileges',
  '--mount', `type=bind,source=${source},target=/workspace,readonly`, '--workdir', '/workspace',
  '--env', 'NODE_PATH=/usr/src/app/node_modules',
  process.env.ASM_TEST_DOCKER_IMAGE || 'algo-vis-backend-backend',
  'node', '--test', 'tests/compile-recovery.integration.test.js'],
{ stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
