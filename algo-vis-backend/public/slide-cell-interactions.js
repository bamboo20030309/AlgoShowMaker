// Shared cell interaction template. Widgets supply read/write/edit adapters;
// selection, replacement input and plain-text paste do not depend on widget type.
(function () {
  function selectKeys(details, previous, items, modifiers = {}) {
    let keys = [details.key], anchor = details.key;
    if (modifiers.shiftKey && previous) {
      anchor = previous.anchor || previous.key;
      const start = items.find(item => item.key === anchor);
      if (start && Number.isFinite(details.context.row) && Number.isFinite(start.context.row)) {
        keys = items.filter(item => item.context.row >= Math.min(start.context.row, details.context.row)
          && item.context.row <= Math.max(start.context.row, details.context.row)
          && item.context.column >= Math.min(start.context.column, details.context.column)
          && item.context.column <= Math.max(start.context.column, details.context.column)).map(item => item.key);
      } else {
        const ordered = items.map(item => item.key), from = ordered.indexOf(anchor), to = ordered.indexOf(details.key);
        if (from >= 0 && to >= 0) keys = ordered.slice(Math.min(from, to), Math.max(from, to) + 1);
      }
      if (modifiers.ctrlKey || modifiers.metaKey) keys = [...new Set([...(previous.keys || [previous.key]), ...keys])];
    } else if ((modifiers.ctrlKey || modifiers.metaKey) && previous) {
      const selected = new Set(previous.keys || [previous.key]);
      if (selected.has(details.key)) selected.delete(details.key); else selected.add(details.key);
      keys = [...selected];
    }
    return { keys, anchor, key: keys.includes(details.key) ? details.key : keys.at(-1) };
  }
  function create(adapter) {
    function commit(details, value) {
      if (!details) return false;
      if (String(details.context.value ?? '') !== value) adapter.write(details, value);
      return true;
    }
    return {
      commit,
      paste(text) { return commit(adapter.selected(), text.replace(/\r\n?/g, '\n')); },
      type(event) {
        const printable = [...event.key].length === 1 || event.key === 'Process' || event.keyCode === 229
          || event.key === 'Backspace' || event.key === 'Delete';
        if (!printable || event.ctrlKey || event.metaKey || event.altKey || !adapter.enabled()) return false;
        const details = adapter.selected();
        if (!details || !adapter.edit(details)) return false;
        // Keep the browser's default input action and native IME composition.
        event.stopPropagation(); event.stopImmediatePropagation();
        return true;
      }
    };
  }
  window.ASMSlideCellInteractions = { create, selectKeys };
})();
