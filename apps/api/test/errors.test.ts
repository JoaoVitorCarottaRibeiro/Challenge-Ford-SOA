import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('@ford-intel/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ford-intel/database')>()
  const { fakeAppDataSource } = await import('./helpers/fakeDb')
  return { ...actual, AppDataSource: fakeAppDataSource }
})

import { buildApp } from '../src/app'
import { resetFakeDb } from './helpers/fakeDb'

let app: FastifyInstance

beforeEach(async () => {
  resetFakeDb()
  app = await buildApp()
})

afterEach(async () => {
  await app.close()
})

describe('tratamento de erros padronizado', () => {
  it('erros de validação sempre respondem no formato {error, message, details}', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nao-e-email' } // falta password, email inválido
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error).toBe('Validation Error')
    expect(body.message).toBeTruthy()
    expect(Array.isArray(body.details)).toBe(true)
  })

  it('limita a 30 requisições por minuto e responde 429 padronizado a partir daí', async () => {
    let lastRes
    for (let i = 0; i < 31; i++) {
      lastRes = await app.inject({ method: 'GET', url: '/health' })
    }
    expect(lastRes!.statusCode).toBe(429)
    expect(lastRes!.json()).toEqual({
      error: 'Too Many Requests',
      message: 'Limite de 30 requisições por minuto atingido'
    })
  })
})
