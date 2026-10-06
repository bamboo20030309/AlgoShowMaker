(function (root) {
  function headers(purpose = '') {
    return purpose ? { 'X-Compile-Purpose': purpose } : {};
  }

  // Anonymous fairness identity lives in a server-signed HttpOnly cookie.
  // Browsers send it automatically; a caller cannot mint unlimited identities
  // by changing a client-generated UUID header.
  root.ASMCompileSession = { headers };
})(typeof window !== 'undefined' ? window : globalThis);
