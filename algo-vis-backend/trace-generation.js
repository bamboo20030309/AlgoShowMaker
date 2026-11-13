'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
// 與 OS／編譯器無關的 Trace 生成規格；播放器與介面修改不使公開結果失效。
const dependencies=['trace-instrumenter.js','public/trace-label-sources.js','public/trace-selection.js','lib/ASMTrace.hpp','lib/AV.hpp','public/trace-view-source.js','public/trace-provenance.js'];
function generationFingerprint(root=__dirname) {
  const hash=createHash('sha256');
  for(const file of dependencies){hash.update(file+'\0');hash.update(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n?/g,'\n'));hash.update('\0');}
  return hash.digest('hex');
}
module.exports={generationFingerprint,dependencies};
