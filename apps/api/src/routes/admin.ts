import { FastifyInstance } from 'fastify'
import { AppDataSource, AuditLog } from '@ford-intel/database'
import { authenticate, requireRole, AuthenticatedRequest } from '../middlewares/rbac'
import { LessThan } from 'typeorm'

export async function adminRoutes(app: FastifyInstance) {

  app.delete('/admin/audit-logs/retention', {
    preHandler: [authenticate, requireRole('admin')],
    schema: {
      tags: ['Admin'],
      summary: 'Aplicar política de retenção nos logs de auditoria',
      description: 'Restrito ao papel admin. Remove permanentemente logs mais antigos que retentionDays.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['retentionDays'],
        properties: {
          retentionDays: { type: 'integer', minimum: 30, maximum: 365 }
        },
        additionalProperties: false
      }
    }
  }, async (req: AuthenticatedRequest, reply) => {
    const { retentionDays } = req.query as { retentionDays: number }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const repo = AppDataSource.getRepository(AuditLog)
    const result = await repo.delete({ createdAt: LessThan(cutoffDate) })

    return reply.send({
      message: `Logs anteriores a ${cutoffDate.toISOString()} removidos`,
      deletedCount: result.affected ?? 0,
      retentionDays,
      policy: 'Dados removidos de forma segura conforme política de retenção'
    })
  })

  app.get('/admin/audit-logs', {
    preHandler: [authenticate, requireRole('admin')],
    schema: {
      tags: ['Admin'],
      summary: 'Listar os 100 logs de auditoria mais recentes',
      description: 'Restrito ao papel admin.',
      security: [{ bearerAuth: [] }]
    }
  }, async (req: AuthenticatedRequest, reply) => {
    const repo = AppDataSource.getRepository(AuditLog)
    const logs = await repo.find({
      order: { createdAt: 'DESC' },
      take: 100
    })

    return reply.send({
      total: logs.length,
      logs: logs.map(log => ({
        id: log.id,
        action: log.action,
        ip: log.ip,
        status: log.status,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt
      }))
    })
  })

  app.get('/admin/suspicious', {
    preHandler: [authenticate, requireRole('admin')],
    schema: {
      tags: ['Admin'],
      summary: 'Resumo de eventos suspeitos na última hora',
      description: 'Restrito ao papel admin. Agrupa tentativas de login falhas e acessos negados por IP.',
      security: [{ bearerAuth: [] }]
    }
  }, async (req: AuthenticatedRequest, reply) => {
    const repo = AppDataSource.getRepository(AuditLog)

    const since = new Date()
    since.setHours(since.getHours() - 1)

    const suspicious = await repo
      .createQueryBuilder('log')
      .where('log.action IN (:...actions)', {
        actions: ['login_failed', 'unauthorized_access', 'suspicious_access']
      })
      .andWhere('log.created_at >= :since', { since })
      .orderBy('log.created_at', 'DESC')
      .getMany()

    const byIp: Record<string, number> = {}
    suspicious.forEach(log => {
      byIp[log.ip] = (byIp[log.ip] || 0) + 1
    })

    const highRiskIps = Object.entries(byIp)
      .filter(([, count]) => count >= 5)
      .map(([ip, count]) => ({ ip, attempts: count, risk: 'HIGH' }))

    return reply.send({
      period: 'Última 1 hora',
      totalSuspiciousEvents: suspicious.length,
      highRiskIps,
      events: suspicious.map(log => ({
        action: log.action,
        ip: log.ip,
        status: log.status,
        createdAt: log.createdAt
      }))
    })
  })
}