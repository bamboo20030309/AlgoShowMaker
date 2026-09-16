const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '../public', name), 'utf8');

test('the editor header leaves clipboard actions to the editor and operating system', () => {
  const html = read('algorithm.html');
  assert.doesNotMatch(html, /id="(?:copyCodeBtn|pasteCodeBtn)"/);
  assert.match(html, /id="runBtn"/);
});

test('mobile mode delegates Ace long-press clipboard actions to the operating system', () => {
  const mobileSource = read('mobile-ui.js');
  const mobileCss = read('mobile-ui.css');
  assert.match(mobileSource, /setOption\('enableMobileMenu', !query\.matches\)/);
  assert.match(mobileSource, /createElement\('textarea'\)/);
  assert.match(mobileSource, /editor\.session\.setValue\(input\.value\)/);
  assert.match(mobileCss, /#editor \.asm-mobile-code-input[\s\S]*-webkit-user-select: text/);
  assert.match(mobileCss, /-webkit-touch-callout: default/);
});
