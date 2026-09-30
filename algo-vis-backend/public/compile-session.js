(function (root) {
  const STORAGE_KEY = 'asm_compile_session_v1';
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let memoryId = '';

  function createId() {
    if (root.crypto?.randomUUID) return root.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    root.crypto?.getRandomValues?.(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function id() {
    if (UUID_PATTERN.test(memoryId)) return memoryId;
    try { memoryId = root.localStorage?.getItem(STORAGE_KEY) || ''; } catch (_) { /* private mode */ }
    if (!UUID_PATTERN.test(memoryId)) {
      memoryId = createId();
      try { root.localStorage?.setItem(STORAGE_KEY, memoryId); } catch (_) { /* private mode */ }
    }
    return memoryId;
  }

  function headers(purpose = '') {
    return {
      'X-ASM-Session': id(),
      ...(purpose ? { 'X-Compile-Purpose': purpose } : {}),
    };
  }

  root.ASMCompileSession = { headers, id };
})(typeof window !== 'undefined' ? window : globalThis);
