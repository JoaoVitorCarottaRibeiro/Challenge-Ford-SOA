import axios from 'axios'
import { Platform } from 'react-native'
import { HmacSHA256, enc } from 'crypto-js'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333/api'
const HMAC_SECRET = process.env.EXPO_PUBLIC_HMAC_SECRET || ''

// crypto-js é uma implementação pura em JS (sem bindings nativos) — a Web
// Crypto API (`crypto.subtle`) usada antes funciona em navegador/`expo start
// --web`, mas não existe no runtime nativo (Hermes), quebrando o HMAC (e por
// tabela o login) em qualquer build real gerado pelo EAS.
function generateHmac(body: string): string {
  return 'sha256=' + HmacSHA256(body, HMAC_SECRET).toString(enc.Hex)
}

/**
 * Storage universal — SecureStore no nativo, localStorage na web.
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key)
    }
    const SecureStore = await import('expo-secure-store')
    return SecureStore.getItemAsync(key)
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value)
      return
    }
    const SecureStore = await import('expo-secure-store')
    await SecureStore.setItemAsync(key, value)
  },
  async delete(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key)
      return
    }
    const SecureStore = await import('expo-secure-store')
    await SecureStore.deleteItemAsync(key)
  }
}

const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use(async (config) => {
  const token = await storage.get('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (config.data && ['post', 'put', 'patch'].includes(config.method || '')) {
    const body = JSON.stringify(config.data)
    config.headers['X-Signature'] = generateHmac(body)
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url: string = error.config?.url || ''
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh')

    if (error.response?.status === 401 && !isAuthEndpoint) {
      const refreshToken = await storage.get('refresh_token')
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken })
          await storage.set('access_token', data.accessToken)
          error.config.headers.Authorization = `Bearer ${data.accessToken}`
          return api.request(error.config)
        } catch {
          await storage.delete('access_token')
          await storage.delete('refresh_token')
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
