import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('@ford-intel/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ford-intel/database')>()
  const { fakeAppDataSource } = await import('./helpers/fakeDb')
  return { ...actual, AppDataSource: fakeAppDataSource }
})

import { buildApp } from '../src/app'
import { resetFakeDb, seed } from './helpers/fakeDb'
import { issueAccessToken, issueRefreshToken } from './helpers/tokens'

let app: FastifyInstance

beforeEach(async () => {
  resetFakeDb()
  app = await buildApp()
})

afterEach(async () => {
  await app.close()
})

describe('hook global de autenticação — endpoints protegidos', () => {
  it('rejeita requisição sem header Authorization (não autorizado)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/vehicles' })
    expect(res.statusCode).toBe(401)
  })

  it('rejeita header Authorization malformado, sem "Bearer " (não autorizado)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/vehicles',
      headers: { authorization: 'token-sem-prefixo' }
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejeita um token com assinatura inválida (não autorizado)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/vehicles',
      headers: { authorization: 'Bearer token.invalido.aqui' }
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejeita um refresh token usado como access token (não autorizado)', async () => {
    const refreshToken = issueRefreshToken({ id: '1', email: 'a@ford.com', role: 'analyst' } as any)
    const res = await app.inject({
      method: 'GET',
      url: '/api/vehicles',
      headers: { authorization: `Bearer ${refreshToken}` }
    })
    expect(res.statusCode).toBe(401)
  })

  it('aceita um access token válido (sucesso)', async () => {
    const accessToken = issueAccessToken({ id: '1', email: 'a@ford.com', role: 'analyst' } as any)
    const res = await app.inject({
      method: 'GET',
      url: '/api/vehicles',
      headers: { authorization: `Bearer ${accessToken}` }
    })
    expect(res.statusCode).toBe(200)
  })

  it('/health continua público mesmo com o hook global ativo', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
  })
})

describe('controle de acesso por papel (RBAC)', () => {
  it('analyst não pode deletar um veículo (proibido)', async () => {
    const vehicle = seed('Vehicle', { brand: 'Ford', model: 'Ranger', version: 'Raptor', yearModel: 2026 })
    const token = issueAccessToken({ id: '1', email: 'analista@ford.com', role: 'analyst' } as any)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/vehicles/${vehicle.id}`,
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(403)
  })

  it('admin pode deletar um veículo (sucesso)', async () => {
    const vehicle = seed('Vehicle', { brand: 'Ford', model: 'Ranger', version: 'Raptor', yearModel: 2026 })
    const token = issueAccessToken({ id: '2', email: 'admin@ford.com', role: 'admin' } as any)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/vehicles/${vehicle.id}`,
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(200)
  })

  it('analyst não pode acessar rotas administrativas (proibido)', async () => {
    const token = issueAccessToken({ id: '1', email: 'analista@ford.com', role: 'analyst' } as any)
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/audit-logs',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(403)
  })

  it('admin pode acessar rotas administrativas (sucesso)', async () => {
    const token = issueAccessToken({ id: '2', email: 'admin@ford.com', role: 'admin' } as any)
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/audit-logs',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(200)
  })
})
