(function () {
  const definitions = [
    { type: 'declare', label: '宣告', color: '#25824d', showTag: false },
    { type: 'read', label: '讀取', color: '#3976b8', showTag: false },
    { type: 'write', label: '寫入', color: '#c8483f', showTag: true },
    { type: 'assign', label: '賦值', color: '#c8483f', showTag: true },
    { type: 'compare', label: '比較', color: '#c38a16', showTag: false },
    { type: 'condition', label: '條件', color: '#7b61a8', showTag: true },
    { type: 'swap', label: '交換', color: '#1d8f83', showTag: true },
    { type: 'fixed', label: '固定', color: '#4caf50', showTag: true },
    { type: 'call', label: '呼叫', color: '#65737a', showTag: false },
    { type: 'function-enter', label: '進入函式', color: '#59656b', showTag: false },
    { type: 'function-exit', label: '離開函式', color: '#59656b', showTag: false }
  ];
  const byType = Object.fromEntries(definitions.map(definition => [definition.type, definition]));
  const animations = Object.freeze({
    declare: 'none',
    read: 'none',
    write: 'lift',
    assign: 'assign',
    compare: 'compare',
    condition: 'pulse',
    swap: 'swap',
    fixed: 'none',
    call: 'none',
    'function-enter': 'none',
    'function-exit': 'none'
  });

  window.ASMTraceEvents = {
    definitions,
    labels: Object.fromEntries(definitions.map(definition => [definition.type, definition.label])),
    colors: Object.fromEntries(definitions.map(definition => [definition.type, definition.color])),
    animations,
    definition(type) {
      return byType[type] || { type, label: type, color: '#65737a', showTag: true };
    },
    color(type) {
      return byType[type]?.color || '#65737a';
    },
    animation(type) {
      return animations[type] || 'none';
    },
    showTag(type) {
      return byType[type]?.showTag !== false;
    }
  };
})();
