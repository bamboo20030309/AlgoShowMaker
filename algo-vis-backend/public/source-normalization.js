// Parse, instrument and display the same LF source so offsets stay consistent.
(function (root) {
  function normalize(source) {
    return source.replace(/\r\n?/g, '\n');
  }
  const api = Object.freeze({ normalize });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ASMSource = api;
})(typeof window !== 'undefined' ? window : globalThis);
