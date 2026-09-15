import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'

vi.mock('@ford-intel/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ford-intel/database')>()
  const { fakeAppDataSource } = await import('./helpers/fakeDb')
  return { ...actual, AppDataSource: fakeAppDataSource }
})

import { buildApp } from '../src/app'
import { resetFakeDb, seed } from './helpers/fakeDb'

let app: FastifyInstance

beforeEach(async () => {
  resetFakeDb()
  app = await buildApp()
  const passwordHash = await bcrypt.hash('Senha123!', 4) // custo baixo só pra testar mais rápido
  seed('User', {
    email: 'analista@ford.com',
    passwordHash,
    role: 'analyst',
    isActive: true,
    failedAttempts: 0,
    lockedUntil: null,
  })
})

afterEach(async () => {
  await app.close()
})

describe('POST /api/auth/register', () => {
  it('cria um usuário quando a adminKey está correta (sucesso)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'novo@ford.com', password: 'SenhaForte123', adminKey: 'test-admin-key' }
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().email).toBe('novo@ford.com')
  })

  it('rejeita adminKey incorreta (erro / não autorizado)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'novo@ford.com', password: 'SenhaForte123', adminKey: 'chave-errada' }
    })
    expect(res.statusCode).toBe(403)
  })

  it('rejeita corpo sem senha (erro de validação)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'novo@ford.com', adminKey: 'test-admin-key' }
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejeita email já cadastrado (erro de negócio)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'analista@ford.com', password: 'SenhaForte123', adminKey: 'test-admin-key' }
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/auth/login', () => {
  it('autentica com credenciais corretas e devolve tokens (sucesso)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'analista@ford.com', password: 'Senha123!' }
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.accessToken).toBeTruthy()
    expect(body.refreshToken).toBeTruthy()
    expect(body.role).toBe('analyst')
  })

  it('rejeita senha incorreta (não autorizado)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'analista@ford.com', password: 'senha-errada' }
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejeita usuário inexistente (não autorizado)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nao-existe@ford.com', password: 'Senha123!' }
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejeita corpo com email malformado (erro de validação)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nao-e-email', password: 'Senha123!' }
    })
    expect(res.statusCode).toBe(400)
  })

  it('bloqueia a conta após 5 tentativas de senha incorreta seguidas', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'analista@ford.com', password: 'senha-errada' }
      })
      expect(res.statusCode).toBe(401)
    }

    // 6ª tentativa, agora já com a conta bloqueada — mesmo com a senha certa, deve falhar
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'analista@ford.com', password: 'Senha123!' }
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().message).toMatch(/bloqueada/i)
  })
})

describe('POST /api/auth/refresh', () => {
  it('emite um novo access token a partir de um refresh token válido (sucesso)', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'analista@ford.com', password: 'Senha123!' }
    })
    const { refreshToken } = login.json()

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken }
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().accessToken).toBeTruthy()
  })

  it('rejeita um token inválido (não autorizado)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: 'token-invalido' }
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejeita um access token usado como refresh token (não autorizado)', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'analista@ford.com', password: 'Senha123!' }
    })
    const { accessToken } = login.json()

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: accessToken }
    })
    expect(res.statusCode).toBe(401)
  })
})
