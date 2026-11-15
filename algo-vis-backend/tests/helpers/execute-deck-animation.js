'use strict';
// Isolated test-only worker. Stdout contains exactly one transient JSON result.
const {startIsolatedServer}=require('./isolated-server');
(async()=>{
 const cleanup=[];let server;
 try{
  server=await startIsolatedServer({after:action=>cleanup.push(action)});
  const fetchOriginal=global.fetch;global.fetch=(url,init)=>fetchOriginal(new URL(String(url),server.base),init);
  global.ASMTraceProvenance=require('../../public/trace-provenance');
  global.ASMTraceProvenance.configure(await(await fetch('/api/trace/version')).json());
  global.ASMTraceViewSource=require('../../public/trace-view-source');
  global.ASMTraceModel={normalizeTraceDocument:value=>JSON.parse(JSON.stringify(value))};
  const A=require('../../public/asmdeck'),source=JSON.parse(require('node:fs').readFileSync(0,'utf8'));
  const result=await A.rebuildMissingAnimation(source);
  for(const action of cleanup.reverse())await action();cleanup.length=0;
  process.stdout.write(JSON.stringify(result.traceDocument));
 }finally{for(const action of cleanup.reverse())await action();}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
