'use strict';
// 獨立核對文字位置，不從播放器的計畫推導答案。
function verifySourceCoordinates(trace) {
 const source=trace.sourceCode;
 if(typeof source!=='string'||source.includes('\r'))throw Error('Trace sourceCode 必須保留編譯時的 LF 原始碼');
 const starts=[0];for(let i=0;i<source.length;i++)if(source[i]==='\n')starts.push(i+1);
 let checked=0;
 const check=(position,line,column,label)=>{
  if(!Number.isInteger(position)||!Number.isInteger(line)||!Number.isInteger(column))return;
  if(position<0||position>source.length||starts[line-1]+column-1!==position)throw Error(`${label} 來源座標錯位：${line}:${column} / ${position}`);
  checked++;
 };
 for(const frame of trace.frames||[])for(const event of frame.events||[]){
  const s=event.source;if(!s)continue;
  check(s.from,s.line,s.column,event.id);
  check(s.to,s.endLine,s.endColumn,event.id+' end');
 }
 return checked;
}
module.exports={verifySourceCoordinates};
