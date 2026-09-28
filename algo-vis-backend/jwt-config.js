'use strict';

/**
 * JWT 簽發與驗證的單一設定來源。
 *
 * 簽發和驗證必須使用同一個演算法白名單；密鑰由環境注入，禁止回退到公開
 * 範例值。長度不足目前保留開發相容性並提出警告，缺值或已知預設值則直接
 * 阻止服務啟動。
 */

// -----------------------------------------------------------------------------
// 固定演算法與 token 壽命
// -----------------------------------------------------------------------------
const JWT_ALGORITHM = 'HS256';
const JWT_SIGN_OPTIONS = Object.freeze({
  algorithm: JWT_ALGORITHM,
  expiresIn: '1d'
});
const JWT_VERIFY_OPTIONS = Object.freeze({
  algorithms: [JWT_ALGORITHM]
});

const INSECURE_DEFAULT_SECRETS = new Set([
  'dev-secret-key',
  'change-me',
  'your-secret-key'
]);

// -----------------------------------------------------------------------------
// 啟動階段的密鑰載入與安全檢查
// -----------------------------------------------------------------------------
function loadJwtSecret(env = process.env) {
  const secret = env.JWT_SECRET;

  if (typeof secret !== 'string' || secret.trim() === '') {
    throw new Error(
      '缺少 JWT_SECRET：請在環境變數或 algo-vis-backend/.env 設定不可公開的隨機密鑰。'
    );
  }

  if (INSECURE_DEFAULT_SECRETS.has(secret.trim().toLowerCase())) {
    throw new Error('JWT_SECRET 不可使用公開的範例或預設值，請改用隨機密鑰。');
  }

  if (Buffer.byteLength(secret, 'utf8') < 32) {
    console.warn('[security] 建議將 JWT_SECRET 更新為至少 32 bytes 的隨機密鑰。');
  }

  return secret;
}

module.exports = {
  JWT_SIGN_OPTIONS,
  JWT_VERIFY_OPTIONS,
  loadJwtSecret
};
