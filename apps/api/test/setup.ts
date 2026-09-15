// Executado antes de cada arquivo de teste carregar seus imports — precisa
// setar as env vars ANTES de qualquer módulo do app ser importado, já que
// services/auth.ts e services/crypto.ts leem process.env no top-level.
process.env.JWT_SECRET = 'test-jwt-secret-nao-usar-em-producao'
process.env.JWT_EXPIRES_IN = '8h'
process.env.JWT_REFRESH_EXPIRES_IN = '7d'
process.env.HMAC_SECRET = 'test-hmac-secret-nao-usar-em-producao'
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-ok!'
process.env.API_KEY = 'test-admin-key'
process.env.ALLOWED_ORIGINS = ''
