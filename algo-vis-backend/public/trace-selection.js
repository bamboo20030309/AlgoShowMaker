/** 繪圖指令共用的索引／閉區間語法；不改動 C++ 原始陣列。 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ASMTraceSelection=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function split(value, delimiter=',') {
    const source=String(value),parts=[],stack=[];let start=0,quote='',escape=false,ternary=0;
    for(let i=0;i<source.length;i++){
      const c=source[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote='';continue;}
      if(c==='"'||c==="'"){quote=c;continue;}
      if(c==='('||c==='['){stack.push(c==='('?')':']');continue;}
      if(c===')'||c===']'){if(stack.pop()!==c)throw Error('括號不成對');continue;}
      if(stack.length)continue;
      if(delimiter===':'&&c==='?'){ternary++;continue;}
      if(delimiter===':'&&c===':'&&(source[i-1]===':'||source[i+1]===':'))continue;
      if(delimiter===':'&&c===':'&&ternary){ternary--;continue;}
      if(c===delimiter){parts.push(source.slice(start,i).trim());start=i+1;}
    }
    if(quote||stack.length||ternary)throw Error('運算式未結束');parts.push(source.slice(start).trim());return parts;
  }
  function dimension(raw, validate=()=>true) {
    const parts=split(raw,':');if(parts.length>2)throw Error('區間只能有一個冒號');
    if(parts.length===1){if(!parts[0]||!validate(parts[0]))throw Error('索引運算式無效');return{type:'index',indexExpression:parts[0]};}
    const startExpression=parts[0]||'0',endExpression=parts[1]||'';
    if(!validate(startExpression)||(endExpression&&!validate(endExpression)))throw Error('區間運算式無效');
    return{type:'range',startExpression,endExpression,endInclusive:true};
  }
  function expressions(dim){return dim.type==='index'?[dim.indexExpression]:[dim.startExpression,dim.endExpression].filter(Boolean);}
  function stringify(dim){return dim.type==='index'?dim.indexExpression:`${dim.startExpression}:${dim.endExpression}`;}
  function freeze(dim,resolve){const result={...dim};for(const key of ['indexExpression','startExpression','endExpression'])if(result[key]){const value=resolve(result[key]);if(!Number.isSafeInteger(value))throw Error('索引／區間無法解析為安全整數');result[key]=String(value);}return result;}
  function bounds(dim,length,resolve=Number){const start=resolve(dim.type==='index'?dim.indexExpression:dim.startExpression);const end=dim.type==='index'?start:dim.endExpression?resolve(dim.endExpression):length-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end))return null;return{start,end:dim.endInclusive===false?end-1:end};}
  function indices(dim,length,resolve){const b=bounds(dim,length,resolve);if(!b)return[];const start=Math.max(0,b.start),end=Math.min(length-1,b.end);return end<start?[]:Array.from({length:end-start+1},(_,i)=>start+i);}
  function matches(dim,index,length,resolve){const b=bounds(dim,length,resolve);return !!b&&index>=b.start&&index<=b.end;}
  return {split,dimension,expressions,stringify,freeze,bounds,indices,matches};
});
