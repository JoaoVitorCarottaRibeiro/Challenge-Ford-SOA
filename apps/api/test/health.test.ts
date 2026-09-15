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

describe('GET /health', () => {
  it('responde 200 sem exigir autenticação', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok', project: 'Fordiq' })
  })
})
