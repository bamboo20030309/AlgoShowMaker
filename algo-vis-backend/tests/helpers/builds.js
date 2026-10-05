'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Assert that the page serves this checkout, rather than pinning tests to an
// obsolete build number. Behavioral assertions remain in each browser test.
function build(file) {
  const source = fs.readFileSync(path.join(__dirname, '../../public', file), 'utf8');
  const match = source.match(/build:\s*['"](trace-\d+)['"]/);
  if (!match) throw new Error(`Missing build identifier: ${file}`);
  return match[1];
}
const slides = fs.readFileSync(path.join(__dirname, '../../public/slides.js'), 'utf8');
const runtime = slides.match(/asmEmbed=runtime&v=(trace-runtime-\d+)/);
if (!runtime) throw new Error('Missing runtime iframe build');
module.exports = { TWEEN_BUILD: build('trace-frame-tween.js'), RENDERER_BUILD: build('trace-renderer.js'), RUNTIME_BUILD: runtime[1] };
