import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('@ford-intel/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ford-intel/database')>()
  const { fakeAppDataSource } = await import('./helpers/fakeDb')
  return { ...actual, AppDataSource: fakeAppDataSource }
})

import { buildApp } from '../src/app'
import { resetFakeDb, seed } from './helpers/fakeDb'
import { issueAccessToken, signBody } from './helpers/tokens'

let app: FastifyInstance
let adminToken: string
let analystToken: string

beforeEach(async () => {
  resetFakeDb()
  app = await buildApp()
  adminToken = issueAccessToken({ id: '1', email: 'admin@ford.com', role: 'admin' } as any)
  analystToken = issueAccessToken({ id: '2', email: 'analista@ford.com', role: 'analyst' } as any)
})

afterEach(async () => {
  await app.close()
})

describe('GET /api/vehicles', () => {
  it('lista só veículos com spec e potenciaCv preenchidos (sucesso)', async () => {
    seed('Vehicle', { brand: 'Ford', model: 'Ranger', version: 'Raptor', yearModel: 2026, spec: { potenciaCv: 288 } })
    seed('Vehicle', { brand: 'Fiat', model: 'Titano', version: 'Ranch', yearModel: 2026, spec: null })
    seed('Vehicle', { brand: 'Toyota', model: 'Hilux', version: 'SRX', yearModel: 2025, spec: { potenciaCv: null } })

    const res = await app.inject({
      method: 'GET',
      url: '/api/vehicles',
      headers: { authorization: `Bearer ${analystToken}` }
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(1)
    expect(body[0].brand).toBe('Ford')
  })
})

describe('GET /api/vehicles/:id', () => {
  it('retorna o veículo quando existe (sucesso)', async () => {
    const vehicle = seed('Vehicle', { brand: 'Ford', model: 'Ranger', version: 'Raptor', yearModel: 2026 })
    const res = await app.inject({
      method: 'GET',
      url: `/api/vehicles/${vehicle.id}`,
      headers: { authorization: `Bearer ${analystToken}` }
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(vehicle.id)
  })

  it('retorna 404 quando o id não existe (erro)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/vehicles/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${analystToken}` }
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/vehicles/:id', () => {
  it('retorna 404 ao tentar deletar um id inexistente (erro)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/vehicles/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` }
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/vehicles', () => {
  const payload = { brand: 'Ford', model: 'Ranger', version: 'Raptor', yearModel: 2026 }

  it('cria um veículo com assinatura HMAC válida (sucesso)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vehicles',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-signature': signBody(payload)
      },
      payload
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().brand).toBe('Ford')
  })

  it('rejeita sem o header X-Signature (não autorizado)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vehicles',
      headers: { authorization: `Bearer ${adminToken}` },
      payload
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejeita uma assinatura HMAC incorreta (não autorizado)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vehicles',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-signature': 'sha256=assinatura-forjada'
      },
      payload
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejeita quando quem chama é analyst, mesmo com assinatura correta (proibido)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vehicles',
      headers: {
        authorization: `Bearer ${analystToken}`,
        'x-signature': signBody(payload)
      },
      payload
    })
    expect(res.statusCode).toBe(403)
  })

  it('rejeita corpo sem o campo obrigatório "brand" (erro de validação)', async () => {
    const invalidPayload = { model: 'Ranger', version: 'Raptor', yearModel: 2026 }
    const res = await app.inject({
      method: 'POST',
      url: '/api/vehicles',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-signature': signBody(invalidPayload)
      },
      payload: invalidPayload
    })
    expect(res.statusCode).toBe(400)
  })
})
