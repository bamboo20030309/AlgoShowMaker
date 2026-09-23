const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '../public', name), 'utf8');
test('all algorithm surfaces load the same shared modules in dependency order', () => {
  const html = read('algorithm.html');
  const sources = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1].split('?')[0]);
  for (const name of ['trace-code-model.js', 'trace-event-code-tree.js', 'trace-code-presenter.js', 'trace-camera.js', 'trace-renderer.js', 'trace-player.js', 'trace-debug-recorder.js', 'trace-provenance.js',
    'algorithm-animation.js', 'trace-editor.js', 'trace-freshness.js', 'trace-studio.js', 'slides-embed.js']) {
    assert.equal(sources.filter(s => s === name).length, 1, name);
  }
  assert.ok(sources.indexOf('trace-camera.js') < sources.indexOf('trace-renderer.js'));
  assert.ok(sources.indexOf('algorithm-animation.js') < sources.indexOf('trace-editor.js'));
  for (const mode of ['runtime', 'editor']) {
    assert.ok(read('slides.js').includes('algorithm.html?asmEmbed=' + mode + '&v=trace-runtime-40'));
  }
  assert.ok(read('front.js').includes("if (!new URLSearchParams(window.location.search).has('asmEmbed'))"),
    'embedded animation surfaces wait for the parent payload instead of painting the bundled sample');
  const controlsStart = html.indexOf('<div class="controls">');
  const freshnessDot = html.indexOf('id="traceFreshnessNotice"');
  const timeline = html.indexOf('id="frameTimeline"');
  assert.ok(controlsStart >= 0 && freshnessDot > controlsStart && timeline > freshnessDot,
    'the shared freshness dot stays in the playback controls before the frame timeline');
  assert.ok(html.includes('trace-freshness.js?v=trace-2'));
  assert.ok(html.includes('canva.js?v=trace-12'));
  assert.ok(html.includes('<script src="vendor/ace/ace.js"></script>'));
  assert.ok(!html.includes('cdnjs.cloudflare.com/ajax/libs/ace'));
  assert.ok(html.includes('trace-model.js?v=trace-35'));
  assert.ok(html.includes('trace-directive-assist.js?v=directive-21'));
  assert.ok(html.includes('<script src="vendor/ace/mode-c_cpp.js"></script>'));
  assert.ok(html.includes('<script src="vendor/ace/theme-monokai.js"></script>'));
  assert.ok(html.includes('trace-code-model.js?v=code-25'));
  assert.ok(html.includes('trace-event-code-tree.js?v=trace-5'));
  assert.ok(sources.indexOf('trace-code-model.js') < sources.indexOf('trace-event-code-tree.js'));
  assert.ok(sources.indexOf('trace-event-code-tree.js') < sources.indexOf('trace-studio.js'));
  assert.ok(html.includes('trace-code-presenter.js?v=code-29'));
  assert.ok(html.includes('trace-view-source.js?v=trace-15'));
  assert.ok(html.includes('trace-editor.js?v=trace-25'));
  assert.ok(html.includes('compile.js?v=syntax-7'));
  assert.match(read('compile.js'), /sourceCode:\s*typeof data\.traceDocument\.sourceCode[\s\S]*?: sourceCode/,
    'RUN must retain editor source when an older backend omits trace source metadata');
  assert.ok(html.includes('style.css?v=brand-shared-6'));
  assert.ok(html.includes('brand.css?v=hover-pill-1'));
  assert.match(html, /<a class="brand menu-brand" href="\/" aria-label="AlgoShowMaker 首頁">[\s\S]*?<img class="brand-mark" src="favicon\.svg"[\s\S]*?<span>AlgoShowMaker<\/span>[\s\S]*?<\/a>/);
  const slides = read('slides.html');
  const legacy = read('index.html');
  assert.ok(slides.includes('slides-storage.js?v=5'));
  assert.ok(slides.includes('slides-cloud.js?v=1'));
  assert.ok(slides.includes('slides.js?v=inline-script-default-222'));
  assert.ok(slides.includes('slide-inline-scripts.js?v=2'));
  assert.ok(slides.includes('id="slideOrderToggleBtn"'));
  assert.ok(!slides.includes('id="deckCacheBtn"'));
  assert.ok(!slides.includes('id="deckCacheDialog"'));
  for (const surface of [html, slides, legacy]) {
    assert.ok(surface.includes('href="https://github.com/bamboo20030309/AlgoShowMaker"'));
    assert.ok(surface.includes('target="_blank"'));
    assert.ok(surface.includes('rel="noopener noreferrer"'));
    assert.ok(surface.includes('viewBox="0 0 16 16"'));
  }
  assert.ok(slides.includes('slides.css?v=inline-scripts-111'));
  assert.ok(slides.indexOf('trace-arrow-model.js?v=arrow-8') < slides.indexOf('slides.js?v='));
  for (const name of ['trace-view-source.js', 'trace-model.js', 'trace-provenance.js', 'asmdeck.js']) {
    assert.ok(slides.includes(`<script src="${name}?`), `${name} must load in the slide editor`);
  }
  assert.ok(slides.indexOf('trace-provenance.js?') < slides.indexOf('asmdeck.js?'));
  assert.ok(slides.indexOf('asmdeck.js?') < slides.indexOf('slides.js?'));
  assert.ok(legacy.includes('home.css?v=brand-favicon-17'));
  assert.ok(legacy.includes('brand.css?v=hover-pill-1'));
  assert.ok(legacy.includes('guest-gallery.js?v=5'));
  assert.ok(!read('guest-gallery.js').includes('免登入觀賞'));
  assert.ok(legacy.indexOf('library-layout.js?v=2') < legacy.indexOf('library-organizer.js?v=7'));
  assert.ok(legacy.indexOf('library-organizer.js?v=7') < legacy.indexOf('home.js?v=header-examples-9'));
  assert.match(legacy, /id="headerSlidesLink"[^>]+href="\/"[^>]*>投影片<\/a>/);
  assert.match(legacy, /id="headerExamplesLink"[^>]+href="\/\?examples=1"[^>]*>範例投影片<\/a>/);
  assert.match(legacy, /id="workspaceExamplesNav"[^>]+href="\/\?examples=1"/);
  assert.ok(slides.indexOf('algorithm-animation.js?') < slides.indexOf('slides.js?'));
  assert.ok(slides.includes('slide-structures.js?v=20'));
  assert.ok(legacy.includes('slide-structures.js?v=7'));
  assert.ok(html.includes('trace-arrow-model.js?v=arrow-8'));
  assert.ok(sources.indexOf('trace-arrow-model.js') < sources.indexOf('trace-renderer.js'));
  assert.ok(html.includes('draw/draw_arrow.js?v=arrow-2'));
  assert.ok(read('draw/draw_arrow.js').includes('window.ASMArrowModel?.geometry'));
  const rendererBuild = html.match(/trace-renderer\.js\?v=(trace-\d+)/)?.[1];
  assert.ok(rendererBuild);
  assert.ok(read('trace-renderer.js').includes(`build: '${rendererBuild}'`));
  assert.ok(read('trace-renderer.js').includes(`asmTraceRendererBuild = '${rendererBuild}'`));
  assert.ok(html.includes('trace-rules.js?v=trace-22'));
  for (const name of ['normal', 'heap', 'segment_tree', 'BIT', 'disk', 'stack', 'queue']) {
    const version = name === 'segment_tree' ? 'segment-label-3' : 'gap-1';
    assert.ok(html.includes(`draw/draw_array_${name}.js?v=${version}`));
    assert.ok(slides.includes(`draw/draw_array_${name}.js?v=${version}`));
    assert.ok(legacy.includes(`draw/draw_array_${name}.js?v=${version}`));
  }
  assert.ok(html.includes('draw/draw_2Darray.js?v=focus-2'));
  assert.ok(html.includes('trace-events.js?v=trace-48'));
  const tweenBuild = html.match(/trace-frame-tween\.js\?v=(trace-\d+)/)?.[1];
  assert.ok(tweenBuild);
  assert.ok(read('trace-frame-tween.js').includes(`build: '${tweenBuild}'`));
  assert.ok(read('trace-frame-tween.js').includes(`asmTraceFrameTweenBuild = '${tweenBuild}'`));
  assert.ok(html.includes('trace-camera.js?v=trace-5'));
  assert.ok(html.includes('trace-player.js?v=trace-25'));
  assert.ok(html.includes('trace-debug-recorder.js?v=debug-6'));
  assert.ok(sources.indexOf('trace-player.js') < sources.indexOf('trace-debug-recorder.js'));
  assert.ok(html.includes('trace-studio.js?v=trace-122'));
  assert.ok(html.includes('syntax-tree.js?v=syntax-3'));
  assert.ok(html.includes('front.js?v=random-id-36'));
  assert.ok(html.includes('slides-embed.js?v=trace-10'));
  assert.ok(html.includes('trace-provenance.js?v=trace-9'));
  assert.ok(html.includes('trace.css?v=trace-36'));
  const codeHighlight = read('trace.css').match(/\.ace-tm \.asm-trace-code-event-span\.is-active,[^{]*\{([^}]*)\}/)?.[1] || '';
  assert.match(codeHighlight, /background-color:\s*rgba\(255,\s*214,\s*10,\s*0\.48\)/);
  assert.doesNotMatch(codeHighlight, /(?:^|[;\s])color\s*:/,
    'event emphasis must preserve ACE token foreground colors and use only a background highlight');
  assert.match(read('trace.css'), /\.asm-trace-code-page\s*\{[^}]*transform 460ms/s);
  assert.match(read('trace-code-presenter.js'), /codePanelPosition/);
  assert.match(read('trace-code-presenter.js'), /codePanelFontSize/);
  assert.match(read('trace-code-presenter.js'), /CODE_PANEL_REFERENCE_HEIGHT\s*=\s*900/);
  assert.match(read('trace-code-presenter.js'), /CODE_PANEL_REFERENCE_WIDTH\s*=\s*1600/);
  assert.match(read('trace.css'), /\.asm-trace-code-line code\s*\{[^}]*user-select:\s*text/s);
  assert.match(read('trace-studio.js'), /asm:trace-code-panel-selected/);
  assert.match(read('trace-code-presenter.js'), /addEventListener\('pointerdown'/);
  assert.doesNotMatch(read('trace-code-presenter.js'), /asm-trace-studio-open'\)\) return/,
    'the code panel must remain draggable in ordinary playback');
  assert.match(read('trace-code-presenter.js'), /selectExternal\?\.\(panel\)/,
    'the code panel must share the canvas object selection lifecycle');
  assert.match(read('trace-code-presenter.js'), /clearExternalSelection\?\.\(panel\)/,
    'the code panel selection must be explicitly clearable');
  assert.match(read('interaction.js'), /selectExternal\(element\)/);
  assert.match(read('interaction.js'), /clearExternalSelection\(element = null\)/);
  assert.match(read('trace.css'), /\.asm-trace-code-panel\.selected \.asm-trace-code-body/);
  assert.ok(html.includes('interaction.js?v=trace-40'));
  assert.match(read('trace-code-presenter.js'), /currentPlan\.layoutKey === nextPlan\.layoutKey/);
  assert.match(read('trace-code-presenter.js'), /is-transition-preparing/);
  assert.match(read('trace-code-presenter.js'), /playbackEventIds/);
  assert.match(read('trace-code-presenter.js'), /scheduledEventIds\.has\(id\)/,
    'disabled non-condition events must not receive a completed background highlight');
  assert.match(read('trace-code-presenter.js'), /is-condition-true/);
  assert.match(read('trace-code-presenter.js'), /is-condition-false/);
  assert.match(read('trace-code-presenter.js'), /eventNodes\.values\(\)/,
    'condition colors must also update the detached final code page used by smooth transitions');
  assert.match(read('trace-player.js'), /plan:\s*playbackPlan/,
    'all surfaces must provide the shared playback plan to the code presenter');
  assert.match(read('trace.css'), /is-condition-true[^}]*rgba\(165,\s*214,\s*167,\s*0\.6\)/s);
  assert.match(read('trace.css'), /is-condition-false[^}]*rgba\(239,\s*154,\s*154,\s*0\.6\)/s);
  assert.match(read('trace.css'), /is-complete:not\(\.is-active\)[^}]*border-radius:\s*0/s,
    'completed nested event spans must form one continuous background band');
  assert.ok(!read('trace-code-presenter.js').includes('<header>'));
  assert.ok(html.includes('draw/draw_array.js?v=trace-3'));
  for (const surface of [html, slides, legacy]) {
    assert.ok(surface.includes('draw/draw_array_utils.js?v=gap-1'));
  }
  assert.ok(html.includes('trace-studio.css?v=trace-52'));
  assert.doesNotMatch(read('trace-studio.js'), /section\('註標形狀'\)/,
    'the retired marker-shape controls must not return to the object inspector');
  assert.doesNotMatch(read('trace-studio.css'), /trace-studio-marker-shape/,
    'retired marker-shape controls must not keep unused styles');
  assert.doesNotMatch(read('trace-studio.js'), /inspector\.append\(field\('作用時間線'/,
    'the obsolete event timeline scope selector is absent from the right sidebar');
  assert.match(read('trace-studio.css'), /\.trace-studio-event-code-button\.is-current\s*\{[^}]*inset 4px 0 #60a5fa/s,
    'every instruction occurring in the current frame receives a left emphasis band');
  assert.match(read('trace-renderer.js'), /autoCameraView\(bounds, zoom, offsetX, offsetY, false\)/,
    'auto camera capture must not reserve space for the independent code layer');
  assert.match(read('trace-studio.js'), /codePanelSelectionActive\s*=\s*true;[\s\S]*?inspectorMode\s*=\s*'object'/,
    'selecting the code panel must open the object inspector');
  assert.match(read('trace-studio.css'), /is-code-panel-selection[^}]*data-trace-code-controls/,
    'the code-panel object inspector must hide unrelated object controls');
  assert.ok(read('trace-studio.js').includes("section('自動固定')"));
  assert.ok(read('trace-studio.js').includes("classList.add('trace-studio-fixed-section')"));
  assert.match(read('trace-studio.css'),
    /\.trace-studio-events-panel\s*\{[^}]*flex-direction:\s*column;/s);
  assert.ok(read('trace-editor.js').includes("className = 'trace-auto-fixed-settings'"));
  assert.ok(read('trace-editor.js').includes("className = 'trace-auto-loop-boundary-settings'"));
  assert.ok(read('trace-editor.js').includes('autoLoopBoundaryEnabled = autoLoopBoundary.checked'));
  assert.ok(!read('trace-studio.js').includes('input.disabled = autoDisabled'));
  assert.ok(!read('trace-studio.js').includes('目前缺少可見動畫目標'));
  assert.ok(read('trace-studio.css').includes('.trace-studio-frame-event.is-missing-target'));
  assert.ok(read('trace-studio.css').includes('.trace-studio-frame-event.is-unrenderable'));
  assert.ok(read('trace-studio.css').includes('.trace-studio-event-outline'));
  assert.ok(read('trace-studio.css').includes('.trace-studio-event-code-button.is-enabled.is-available'));
  assert.ok(read('trace-studio.js').includes("section('事件程式碼')"));
  const saveHandler = read('slides.js').match(/function handleAlgorithmEmbedMessage[\s\S]*?function openAlgorithmEditor/)?.[0] || '';
  assert.ok(saveHandler.includes('refreshAlgorithmSlideInPlace(slide)'));
  assert.ok(!saveHandler.includes('renderDeck()'), 'saving one animation slide must not rebuild the whole deck');
  assert.ok(saveHandler.includes("event.data.type === 'asm-animation-applied'"));
  assert.ok(read('slides.css').includes('.algorithm-editor-modal.is-loading #algorithmEditorFrame'));
  assert.match(read('slides.js'), /class="algorithm-slide-frame\$\{hasScript \? ' is-loading' : ''\}"/);
  assert.match(saveHandler, /asm-animation-geometry-ready[\s\S]*?classList\.remove\('is-loading'\)/,
    'runtime animation slides must stay hidden until visible geometry has been rebased');
  assert.ok(read('slides.css').includes('.algorithm-slide-frame.is-loading'));
  assert.match(read('trace-renderer.js'), /classList\.contains\('asm-trace-text-object'\)/,
    'frame-authored text must be captured once for its shared fade-out lifecycle');
  assert.match(read('trace-frame-tween.js'), /entry\.appearanceStart\s*=\s*entry\.keepTransition[\s\S]*?frameTransitionStart[\s\S]*?declarationSlot[\s\S]*?enteringMarkerKeys/,
    'new frame objects must remain hidden until code and pre-keep exits have finished');
  assert.match(read('trace-frame-tween.js'), /if \(options\.keepSnapshotMember \|\| options\.retainedSnapshot\) return false/,
    'every retained keep object remains visible without an entrance animation');
  assert.match(read('trace-frame-tween.js'), /keepHandoffSources[\s\S]*?entry\.keepSnapshotMember\s*&&\s*!entry\.keepHandoff/,
    'a retained keep snapshot takes ownership of the prior live geometry without re-entering');
  assert.match(read('trace-frame-tween.js'), /entry\.declarationEntrance\s*&&\s*entry\.lifecycleKind\s*!==\s*'marker'/,
    'declaration-owned marker entrances must still descend from above');
  for (const surface of [html, slides, legacy]) {
    assert.ok(surface.includes('draw/draw_array_hintWidget.js?v=trace-4'));
  }
});
