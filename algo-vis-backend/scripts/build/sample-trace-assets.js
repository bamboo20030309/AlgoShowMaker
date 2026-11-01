const fs = require('node:fs');
const path = require('node:path');
const { validId, validFile } = require('../../public/sample-trace-assets');

// Register one rebuilt deck without changing the ID contract or losing earlier
// results still referenced by user decks. Payloads remain separate from asmdeck.
function registerDeckTraces(publicRoot, entry, deck, seeds) {
  const directory = path.resolve(publicRoot, 'deck-traces');
  const indexFile = path.join(directory, 'index.json');
  const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : { schema: 1, traces: {} };
  const stem = path.basename(entry.archive.split('?')[0], '.asmdeck');
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(stem)) throw new Error('Invalid public deck filename');
  const resolve = file => {
    if (!validFile(file)) throw new Error('Invalid sample trace filename');
    const result = path.resolve(directory, file);
    if (!result.startsWith(directory + path.sep)) throw new Error('Trace path escaped asset directory');
    return result;
  };
  const write = (file, data) => {
    const target = resolve(file), temporary = target + '.' + process.pid + '.tmp';
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(temporary, data); fs.renameSync(temporary, target);
  };
  const inputs = new Map(seeds.map(seed => [seed.key, seed.trace]));
  let count = 0;
  for (const slide of deck.groups.flatMap(group => group.slides || []).filter(slide => slide.animation?.traceRef)) {
    const id = slide.animation.traceRef;
    if (!validId(id)) throw new Error('Invalid trace ID');
    const file = `${stem}-${String(++count).padStart(2, '0')}.json`;
    for (const [oldId, old] of Object.entries(index.traces)) {
      if (oldId === id || old.file !== file) continue;
      const previous = `legacy/${stem}-previous-${oldId.slice(0, 12)}.json`;
      write(previous, fs.readFileSync(resolve(old.file)));
      old.file = previous; old.legacy = true;
    }
    const trace = inputs.get(id);
    if (trace) write(file, JSON.stringify(trace));
    else {
      const existing = index.traces[id]?.file;
      if (!existing) throw new Error(`Missing generated Trace: ${id}`);
      if (existing !== file) write(file, fs.readFileSync(resolve(existing)));
    }
    index.traces[id] = { file, deck: path.basename(entry.archive.split('?')[0]), slideId: slide.id };
  }
  fs.mkdirSync(directory, { recursive: true });
  const temporary = indexFile + '.' + process.pid + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(index, null, 2) + '\n'); fs.renameSync(temporary, indexFile);
  return count;
}
module.exports = { registerDeckTraces };
