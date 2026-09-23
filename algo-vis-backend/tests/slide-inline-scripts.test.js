const { test } = require('node:test');
const assert = require('node:assert/strict');
const { format } = require('../public/slide-inline-scripts');

test('simple superscripts and subscripts preserve source while styling only target characters', () => {
  const source = 'A_2 A^2 x_i^2';
  const styles = format(source, {}, 20);
  assert.equal(styles[0][1].fill, 'rgba(0, 0, 0, 0)');
  assert.equal(styles[0][2].fontSize, 12);
  assert.equal(styles[0][2].deltaY, 2.2);
  assert.equal(styles[0][5].fill, 'rgba(0, 0, 0, 0)');
  assert.equal(styles[0][6].deltaY, -7);
  assert.equal(styles[0][10].deltaY, 2.2);
  assert.equal(styles[0][12].deltaY, -7);
  assert.equal(source, 'A_2 A^2 x_i^2');
});

test('braces group scripts and escapes keep ordinary symbols', () => {
  const styles = format(String.raw`x_{i+1} A^{n+1} file\_name`, { 0: { 3: { fill: '#123456' } } }, 30);
  assert.equal(styles[0][3].fill, '#123456');
  for (const index of [3, 4, 5]) assert.equal(styles[0][index].deltaY, 3.3);
  for (const index of [11, 12, 13]) assert.equal(styles[0][index].deltaY, -10.5);
  assert.equal(styles[0][20].fill, 'rgba(0, 0, 0, 0)');
  assert.equal(styles[0][21], undefined);
});
