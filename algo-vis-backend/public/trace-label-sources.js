// Shared projection provenance for custom matrix labels. Text equality never
// establishes a binding; only the authored variable and index do.
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  root.ASMTraceLabelSources=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function materialize(data){return Array.isArray(data?.items)?data.items.map(materialize):data?.value;}
  function resolve(spec,state={}){
    if(!spec)return null;
    if(spec.mode!=='custom')return {mode:spec.mode,values:[]};
    const values=[],sources=[];
    const append=(value,source=null)=>{values.push(value);sources.push(source);};
    for(const part of spec.parts||[]){
      if(part.type==='blank')for(let i=0;i<Math.max(0,Number(part.count)||0);i++)append('');
      else if(part.type==='literal')append(part.value);
      else if(part.type==='variable'){
        const matches=Object.keys(state).filter(id=>state[id]?.name===part.name);
        const variableId=state[part.variableId]?part.variableId:matches.length===1?matches[0]:null;
        const value=materialize(state[variableId]?.data);
        if(Array.isArray(value)||typeof value==='string')[...value].forEach((item,index)=>append(item,{variableId,index}));
        else if(value!==undefined)append(value,{variableId,index:0});
      }
    }
    return {mode:'custom',values,sources};
  }
  return {version:1,resolve};
});
