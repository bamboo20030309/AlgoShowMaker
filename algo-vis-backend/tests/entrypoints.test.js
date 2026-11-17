'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {TWEEN_BUILD,RENDERER_BUILD,POINTER_BUILD,RUNTIME_BUILD}=require('./helpers/builds');
const read=name=>fs.readFileSync(path.join(__dirname,'../public',name),'utf8');

test('all algorithm surfaces share modules, current builds and dependency order',()=>{
 const html=read('algorithm.html');const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);const sources=scripts.map(s=>s.split('?')[0]);
 const required=['trace-model.js','trace-rules.js','trace-events.js','trace-code-model.js','trace-event-code-tree.js','trace-code-presenter.js','trace-camera.js','trace-pointer-model.js','trace-renderer.js','trace-frame-tween.js','trace-player.js','trace-debug-recorder.js','trace-provenance.js','algorithm-animation.js','trace-editor.js','trace-freshness.js','trace-studio.js','slides-embed.js','compile.js'];
 for(const file of required)assert.equal(sources.filter(s=>s===file).length,1,file);
 for(const [before,after]of [['trace-camera.js','trace-renderer.js'],['trace-pointer-model.js','trace-frame-tween.js'],['trace-code-model.js','trace-event-code-tree.js'],['trace-event-code-tree.js','trace-studio.js'],['algorithm-animation.js','trace-editor.js']])assert.ok(sources.indexOf(before)<sources.indexOf(after),before+' before '+after);
 for(const [file,build]of [['trace-frame-tween.js',TWEEN_BUILD],['trace-renderer.js',RENDERER_BUILD],['trace-pointer-model.js',POINTER_BUILD]])assert.ok(scripts.includes(file+'?v='+build),file+' cache build');
 assert.ok(sources.includes('vendor/ace/ace.js'));assert.ok(!html.includes('cdnjs.cloudflare.com/ajax/libs/ace'));
 const slides=read('slides.js'),page=read('slides.html');assert.ok(slides.includes('algorithm.html?asmEmbed=runtime&v='+RUNTIME_BUILD));assert.ok(page.includes('id="algorithmEditorStage"'));assert.ok(!page.includes('id="algorithmEditorFrame"'),'editor reuses the existing iframe');
 assert.ok(page.includes('slides-storage.js?'));assert.ok(page.indexOf('slides-storage.js?')<page.indexOf('slides.js?'));
 assert.ok(page.includes('animation-recipe.js?'));assert.ok(page.indexOf('animation-recipe.js?')<page.indexOf('slides.js?'));
});
