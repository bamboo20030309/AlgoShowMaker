const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { chromium } = require('playwright');

test('array queens explains only rows with no legal column before returning', { timeout: 90000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'algorithm_sample/Backtracking/8queen-array-teaching.cpp'), 'utf8');
  const port = await new Promise(resolve => {
    const socket = net.createServer();
    socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolve(port)); });
  });
  const server = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true, stdio: 'ignore',
    env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') } });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(base)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/algorithm.html`);
    await page.waitForFunction(() => window.ASMTracePlayer && window.ace);
    await page.waitForTimeout(800);
    await page.evaluate(code => { ace.edit('editor').setValue(code, -1); document.getElementById('inputArea').value = '4'; }, source);
    await page.locator('#runBtn').click();
    await page.waitForFunction(() => !document.getElementById('runBtn').classList.contains('loading')
      && ASMTracePlayer.getDocument()?.frames.length > 10, null, { timeout: 45000 });
    const result = await page.evaluate(async () => {
      const trace = ASMTracePlayer.getDocument();
      const id = name => Object.keys(trace.variables).find(id => trace.variables[id].name === name);
      const indices = trace.frames.map((frame, i) => JSON.stringify(frame.texts).includes('返回上一列') ? i : -1).filter(i => i >= 0);
      const masks = frame => ['L', 'M', 'R'].map(name => frame.state[id(name)].data.items.map(item => Number(ASMTraceModel.scalarValue(item))));
      const deadActivations = new Set(trace.frames.filter(frame => {
        const row = Number(ASMTraceModel.scalarValue(frame.state[id('row')]?.data));
        if (!Number.isInteger(row) || row >= 4 || !frame.state[id('L')]) return false;
        const [L, M, R] = masks(frame);
        return L.every((_, col) => L[col] || M[col] || R[col]);
      }).map(frame => frame.source.recursionActivationId));
      const notices = indices.map(i => ({ row: Number(ASMTraceModel.scalarValue(trace.frames[i].state[id('row')].data)),
        masks: masks(trace.frames[i]), activation: trace.frames[i].source.recursionActivationId }));
      const helperEvents = trace.frames.flatMap(frame => frame.events).filter(event => /has_move/.test(event.source?.text || ''));
      const visible = [];
      const rowPaints = [];
      for (let i = 0; i < trace.frames.length; i++) {
        const frame = trace.frames[i];
        const text = JSON.stringify(frame.texts);
        const entry = text.includes('只嘗試尚未受到攻擊的欄位') || text.includes('每一列都已放置皇后');
        const next = text.includes('逐格計算下一列的攻擊狀態');
        if (!entry && !next) continue;
        const targetRow = Number(ASMTraceModel.scalarValue(frame.state[id('row')].data)) + (next ? 1 : 0);
        const names = next ? ['nextL', 'nextM', 'nextR'] : ['L', 'M', 'R'];
        const states = names.map(name => frame.state[id(name)].data.items.map(item => Number(ASMTraceModel.scalarValue(item))));
        const styles = ASMTraceRules.evaluate(trace, frame)[id('board')] || {};
        await ASMTracePlayer.renderStable(i);
        const cells = [...document.getElementById('asm-trace-root').querySelectorAll('[data-trace-object-key][data-trace-index]')];
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
          const expected = r === targetRow ? (states.some(mask => mask[c])
            ? 'rgba(239, 154, 154, 0.6)' : 'rgba(165, 214, 167, 0.6)') : null;
          const color = styles[`${r},${c}`]?.styleTypes?.background;
          if (expected ? color !== expected : /rgba\((239|165),/.test(color || '')) {
            throw new Error(`frame ${i + 1} cell ${r},${c}: expected ${expected}, got ${color}`);
          }
          if (expected) {
            const source = frame.source || {};
            const boardKey = source.objectIds?.[id('board')]
              || (source.primaryVariableId === id('board') && source.objectId)
              || trace.snapshots.find(snapshot => snapshot.sourceVariableId === id('board')
                && snapshot.recursionActivationId === source.recursionActivationId)?.objectId || id('board');
            const cell = cells.find(cell => cell.getAttribute('data-trace-object-key') === `${boardKey}#${r},${c}`);
            const fill = cell?.querySelector(':scope > rect')?.getAttribute('fill');
            if (fill !== expected) throw new Error(`frame ${i + 1} SVG ${r},${c}: got ${fill}`);
          }
        }
        rowPaints.push({ frame: i + 1, targetRow, next });
      }
      window.asmGetAnimationPlaybackRate = () => 4;
      for (const i of indices) {
        await ASMTracePlayer.renderStable(i - 1);
        await CodeScript.next();
        const text = document.getElementById('asm-trace-root').textContent;
        visible.push(text.includes('沒有可放皇后的位置') && text.includes('返回上一列，嘗試其他欄位。'));
      }
      return { notices, deadActivations: [...deadActivations], helperEvents: helperEvents.length, visible, rowPaints,
        snapshots: trace.snapshots.length, output: document.getElementById('outputArea').textContent };
    });
    assert.equal(result.notices.length, 4);
    assert.deepEqual(result.notices.map(notice => notice.row), [2, 3, 3, 2]);
    assert.equal(new Set(result.notices.map(notice => notice.activation)).size, result.notices.length);
    assert.deepEqual([...new Set(result.notices.map(notice => notice.activation))].sort(), result.deadActivations.sort());
    for (const notice of result.notices) {
      const [L, M, R] = notice.masks;
      assert.ok(L.every((_, col) => L[col] || M[col] || R[col]));
    }
    assert.deepEqual(result.visible, [true, true, true, true]);
    assert.equal(result.helperEvents, 0);
    assert.equal(result.snapshots, 17);
    assert.equal(result.rowPaints.filter(item => !item.next).length, 17);
    assert.equal(result.rowPaints.filter(item => item.next).length, 16);
    assert.match(result.output, /Total Solutions: 2/);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(result));
  } finally { if (browser) await browser.close(); server.kill(); }
});
