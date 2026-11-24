const {test}=require('node:test');const assert=require('node:assert/strict');const {chromium}=require('playwright');const fs=require('node:fs/promises');const path=require('node:path');const {startIsolatedServer}=require('./helpers/isolated-server');
test('composition underline follows painted glyph bounds rather than line spacing or trailing character spacing', {timeout:40000},async t=>{
 const {base}=await startIsolatedServer(t),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage();
 const source=await fs.readFile(path.join(__dirname,'../public/slides.js'),'utf8');await page.route('**/slides.js*',r=>r.fulfill({contentType:'application/javascript',body:`const load=fabric.Canvas.prototype.loadFromJSON;fabric.Canvas.prototype.loadFromJSON=function(...args){window.fixtureCanvas=this;return load.apply(this,args)};\n`+source}));
 await page.addInitScript(()=>localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify({groups:[{id:'g',slides:[{id:'s',widgets:[],canvas:{objects:[{type:'textbox',text:'中文輸入',left:100,top:100,width:500,fontSize:40,fill:'#000000'}]}}]}]})));
 await page.goto(base+'/slides.html');await page.waitForFunction(()=>document.body.dataset.fabricBuild?.startsWith('ready')&&window.fixtureCanvas);
 const results=await page.evaluate(()=>{
  const cases=[{text:'中文輸入',lineHeight:2.4,charSpacing:240},{text:'AV gyp中文',lineHeight:1.8,charSpacing:180,textAlign:'center'},{text:'第一行\n中文輸入',lineHeight:2,charSpacing:200,start:4},{text:'不同大小文字',lineHeight:2.3,charSpacing:120,styles:{0:{0:{fontSize:58},3:{fontSize:28,deltaY:5}}}},{text:'AVAVgy',fontFamily:'Georgia',fontStyle:'italic',lineHeight:2,charSpacing:0},{text:'אבגד',direction:'rtl',textAlign:'right',lineHeight:2,charSpacing:140}];
  return cases.map(options=>{
   const o=fixtureCanvas.getObjects()[0];o.set({fontSize:40,fontFamily:'Arial',width:650,textAlign:'left',direction:'ltr',styles:{},asmInlineScripts:false,...options});o.initDimensions();
   const start=options.start||0,end=o.text.length;o.selectionStart=end;o.selectionEnd=end;o.inCompositionMode=true;o.compositionStart=start;o.compositionEnd=end;o.hiddenTextarea={selectionStart:end,selectionEnd:end};
   const make=()=>{const c=document.createElement('canvas');c.width=2000;c.height=1000;const ctx=c.getContext('2d');ctx.translate(1000,500);return{c,ctx};},ink=make(),line=make();o._renderTextFill(ink.ctx);o.renderSelection(o._getCursorBoundaries(end),line.ctx);
   const startLine=o.get2DCursorLocation(o.fromStringToGraphemeSelection(start,start,o.text).selectionStart).lineIndex;let top=500+o._getTopOffset();for(let i=0;i<startLine;i++)top+=o.getHeightOfLine(i);
   function bounds(canvas){const data=canvas.getContext('2d').getImageData(0,0,2000,1000).data;let left=Infinity,right=-Infinity,bottom=-Infinity,y=Infinity;for(let row=Math.max(0,Math.ceil(top));row<1000;row++)for(let x=0;x<2000;x++){const a=data[(row*2000+x)*4+3];if(a>30){left=Math.min(left,x);right=Math.max(right,x);bottom=Math.max(bottom,row);y=Math.min(y,row);}}return{left,right,bottom,top:y};}
   const result={options,ink:bounds(ink.c),line:bounds(line.c)};o.inCompositionMode=false;delete o.hiddenTextarea;return result;
  });
 });
 for(const r of results){assert.ok(r.line.top-r.ink.bottom>=0&&r.line.top-r.ink.bottom<=2,'underline touches the painted glyph bottom without extra gap: '+JSON.stringify(r));assert.ok(Math.abs(r.line.left-r.ink.left)<=3&&Math.abs(r.line.right-r.ink.right)<=3,'underline length matches glyph ink: '+JSON.stringify(r));}
});
