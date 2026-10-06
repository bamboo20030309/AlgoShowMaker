'use strict';
// Loaded only by the disposable server in pipeline-read-failure.integration.test.
const fs=require('node:fs');const path=require('node:path');
const originalExists=fs.existsSync,originalRead=fs.readFileSync;
fs.existsSync=function(filename){if(/^script_[a-f0-9-]+\.js$/.test(path.basename(String(filename))))return true;return originalExists.apply(this,arguments);};
fs.readFileSync=function(filename){if(/^script_[a-f0-9-]+\.js$/.test(path.basename(String(filename))))throw new Error('fixture script read failure');return originalRead.apply(this,arguments);};
require('../../trace-chunk-store').read=async()=>{throw new Error('fixture trace read failure');};