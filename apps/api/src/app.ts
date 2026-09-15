import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { vehicleRoutes } from './routes/vehicles'
import { authRoutes } from './routes/auth'
import { adminRoutes } from './routes/admin'
import { verifyToken } from './services/auth'
import { logAudit } from './services/audit'

/**
 * Monta e registra a aplicação Fastify inteira, sem conectar ao banco nem
 * abrir porta — separado de `start()` (index.ts) para poder ser testado via
 * `app.inject()` sem depender de rede ou do Oracle real.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)

  // bodyLimit elevado (padrão é 1MB) para acomodar fichas técnicas em PDF enviadas em base64 no /extract
  const app = Fastify({ logger: false, bodyLimit: 25 * 1024 * 1024 })

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (
        ALLOWED_ORIGINS.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)
      ) {
        return cb(null, true)
      }
      cb(new Error('Origem não permitida pelo CORS'), false)
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Signature'],
    credentials: true
  })

  await app.register(helmet, { contentSecurityPolicy: false })

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Fordiq API',
        description: 'Inteligência Competitiva Automotiva — extração, padronização e comparação de fichas técnicas de picapes 4x4.',
        version: '1.0.0'
      },
      servers: [{ url: '/api', description: 'Prefixo usado por todas as rotas, exceto /health' }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Access token JWT obtido em POST /auth/login. Exigido em toda rota exceto /health, /auth/login, /auth/refresh e /auth/register.'
          },
          hmacSignature: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Signature',
            description: 'HMAC-SHA256 do corpo da requisição (JSON.stringify) usando um segredo compartilhado, no formato "sha256=<hash>". Não é um valor estático — precisa ser calculado a cada requisição.'
          }
        }
      }
    }
  })

  await app.register(swaggerUi, {
    routePrefix: '/docs'
  })

  // Sem errorResponseBuilder customizado: o builder padrão do plugin cria um
  // Error de verdade com `.statusCode` preenchido, que o setErrorHandler abaixo
  // sabe reconhecer. Um builder customizado que retorna um objeto plano (sem
  // `.statusCode`) faz o setErrorHandler cair no branch genérico de 500 em vez
  // do 429 — é o que estava acontecendo aqui antes desse ajuste.
  await app.register(rateLimit, {
    max: 30,
    timeWindow: '1 minute'
  })

  app.addHook('onRequest', async (req: any, reply) => {
    const publicRoutes = ['/health', '/docs', '/api/auth/login', '/api/auth/refresh', '/api/auth/register']
    if (publicRoutes.some(r => req.url.startsWith(r))) return
    if (req.method === 'OPTIONS') return

    const authHeader = req.headers['authorization']

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await logAudit('unauthorized_access', req, 'error', { url: req.url }, 'Token ausente')
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Token de autorização ausente ou malformado'
      })
    }

    const token = authHeader.split(' ')[1]

    try {
      const payload = verifyToken(token)
      if (payload.type !== 'access') throw new Error('Tipo de token inválido')
      req.user = { id: payload.sub, email: payload.email, role: payload.role }
    } catch {
      await logAudit('unauthorized_access', req, 'error', { url: req.url }, 'Token inválido')
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Token inválido ou expirado'
      })
    }
  })

  app.addHook('onResponse', async (req: any, reply) => {
    if (reply.statusCode === 401 || reply.statusCode === 403) {
      await logAudit('suspicious_access', req, 'error',
        { url: req.url, method: req.method, statusCode: reply.statusCode },
        `Acesso negado com status ${reply.statusCode}`
      )
    }
  })

  app.setErrorHandler((error: any, req, reply) => {
    app.log.error(error)

    if (error.validation) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Dados de entrada inválidos',
        details: error.validation.map((v: any) => v.message)
      })
    }

    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: 'Limite de 30 requisições por minuto atingido'
      })
    }

    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Ocorreu um erro interno. Tente novamente.'
    })
  })

  app.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Verifica se a API está no ar',
      description: 'Rota pública, sem autenticação. Único endpoint fora do prefixo /api — por isso sobrescreve o "servers" global do OpenAPI, senão o "Try it out" do Swagger testaria /api/health por engano.',
      servers: [{ url: '' }]
    }
  }, async () => {
    return { status: 'ok', project: 'Fordiq' }
  })

  await app.register(authRoutes, { prefix: '/api' })
  await app.register(vehicleRoutes, { prefix: '/api' })
  await app.register(adminRoutes, { prefix: '/api' })

  return app
}
