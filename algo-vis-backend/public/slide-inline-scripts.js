(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ASMInlineScripts = api;
})(typeof window !== 'undefined' ? window : null, function () {
  function copyStyles(styles) {
    const result = {};
    Object.entries(styles || {}).forEach(([line, characters]) => {
      result[line] = {};
      Object.entries(characters || {}).forEach(([index, style]) => {
        result[line][index] = { ...style };
      });
    });
    return result;
  }

  const graphemeSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

  function segmentGraphemes(text) {
    const value = String(text || '');
    if (!graphemeSegmenter) return Array.from(value);
    return Array.from(graphemeSegmenter.segment(value), entry => entry.segment);
  }

  function format(text, baseStyles = {}, defaultFontSize = 18) {
    const styles = copyStyles(baseStyles);
    String(text || '').split('\n').forEach((sourceLine, lineIndex) => {
      const line = segmentGraphemes(sourceLine);
      const lineStyles = styles[lineIndex] || (styles[lineIndex] = {});
      const hide = index => {
        lineStyles[index] = {
          ...(lineStyles[index] || {}),
          fontSize: 0.1,
          fill: 'rgba(0, 0, 0, 0)',
          stroke: 'rgba(0, 0, 0, 0)',
          underline: false,
          linethrough: false,
          textBackgroundColor: ''
        };
      };
      for (let index = 0; index < line.length; index += 1) {
        if (line[index] === '\\' && /[_^{}]/.test(line[index + 1] || '')) {
          hide(index);
          index += 1;
          continue;
        }
        const symbol = line[index];
        if (symbol !== '_' && symbol !== '^') continue;
        if (!index || !/[\p{L}\p{N})\]}]/u.test(line[index - 1])) continue;
        const start = index + 1;
        let first = start;
        let end = start + 1;
        let closingBrace = -1;
        if (line[start] === '{') {
          closingBrace = line.indexOf('}', start + 1);
          if (closingBrace <= start + 1) continue;
          first = start + 1;
          end = closingBrace;
        } else if (!/[\p{L}\p{N}]/u.test(line[start] || '')) {
          continue;
        }
        hide(index);
        if (closingBrace !== -1) {
          hide(start);
          hide(closingBrace);
        }
        for (let charIndex = first; charIndex < end; charIndex += 1) {
          const base = lineStyles[charIndex] || {};
          const size = Number(base.fontSize) || Number(defaultFontSize) || 18;
          lineStyles[charIndex] = {
            ...base,
            fontSize: size * 0.6,
            deltaY: (Number(base.deltaY) || 0) + size * (symbol === '^' ? -0.35 : 0.11)
          };
        }
        index = closingBrace !== -1 ? closingBrace : end - 1;
      }
      if (!Object.keys(lineStyles).length) delete styles[lineIndex];
    });
    return styles;
  }

  return { copyStyles, format, segmentGraphemes };
});
