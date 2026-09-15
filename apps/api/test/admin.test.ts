import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('@ford-intel/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ford-intel/database')>()
  const { fakeAppDataSource } = await import('./helpers/fakeDb')
  return { ...actual, AppDataSource: fakeAppDataSource }
})

import { buildApp } from '../src/app'
import { resetFakeDb, seed } from './helpers/fakeDb'
import { issueAccessToken } from './helpers/tokens'

let app: FastifyInstance
let adminToken: string
let analystToken: string

beforeEach(async () => {
  resetFakeDb()
  app = await buildApp()
  adminToken = issueAccessToken({ id: '1', email: 'admin@ford.com', role: 'admin' } as any)
  analystToken = issueAccessToken({ id: '2', email: 'analista@ford.com', role: 'analyst' } as any)

  const old = new Date()
  old.setDate(old.getDate() - 100)
  seed('AuditLog', { action: 'login_success', ip: '127.0.0.1', status: 'success', createdAt: old })
  seed('AuditLog', { action: 'login_success', ip: '127.0.0.1', status: 'success', createdAt: new Date() })
})

afterEach(async () => {
  await app.close()
})

describe('DELETE /api/admin/audit-logs/retention', () => {
  it('remove só logs mais antigos que retentionDays, passado via query string (sucesso)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/audit-logs/retention?retentionDays=90',
      headers: { authorization: `Bearer ${adminToken}` }
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().deletedCount).toBe(1)
    expect(res.json().retentionDays).toBe(90)
  })

  it('rejeita sem retentionDays na query (erro de validação)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/audit-logs/retention',
      headers: { authorization: `Bearer ${adminToken}` }
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejeita retentionDays fora do intervalo permitido (erro de validação)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/audit-logs/retention?retentionDays=5',
      headers: { authorization: `Bearer ${adminToken}` }
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejeita quando quem chama não é admin (proibido)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/audit-logs/retention?retentionDays=90',
      headers: { authorization: `Bearer ${analystToken}` }
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('GET /api/admin/suspicious', () => {
  it('retorna o resumo de eventos suspeitos pra admin (sucesso)', async () => {
    seed('AuditLog', { action: 'login_failed', ip: '10.0.0.1', status: 'error', createdAt: new Date() })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/suspicious',
      headers: { authorization: `Bearer ${adminToken}` }
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().totalSuspiciousEvents).toBeGreaterThanOrEqual(1)
  })
})
