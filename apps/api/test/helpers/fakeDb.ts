import { randomUUID } from 'crypto'
import { FindOperator } from 'typeorm'

/**
 * Banco em memória usado só nos testes, no lugar do Oracle real.
 *
 * Depois de um teste ter apagado ~190 logs de auditoria reais durante uma
 * verificação manual (ver histórico do projeto), testes automatizados NUNCA
 * devem tocar no Oracle compartilhado — tudo aqui roda isolado por arquivo de
 * teste, sem rede e sem qualquer chance de afetar dado real.
 */

type Store = Record<string, any[]>

const stores: Store = {
  Vehicle: [],
  VehicleSpec: [],
  User: [],
  AuditLog: [],
  Segment: [],
}

export function resetFakeDb() {
  Object.keys(stores).forEach(key => { stores[key] = [] })
}

function matches(entity: any, criteria: any): boolean {
  if (!criteria) return true
  return Object.entries(criteria).every(([key, value]) => {
    if (value instanceof FindOperator) {
      // suporta os operadores do TypeORM usados no projeto (ex.: LessThan em
      // DELETE /admin/audit-logs/retention)
      const target = value.value
      switch (value.type) {
        case 'lessThan':        return entity[key] < target
        case 'lessThanOrEqual': return entity[key] <= target
        case 'moreThan':        return entity[key] > target
        case 'moreThanOrEqual': return entity[key] >= target
        default:                return entity[key] === target
      }
    }
    if (value && typeof value === 'object' && 'id' in value) {
      // suporta { vehicle: { id } } usado em specRepo.delete({ vehicle: { id } })
      return entity[key]?.id === value.id
    }
    return entity[key] === value
  })
}

function createFakeRepo(entityName: string) {
  const store = () => stores[entityName]

  return {
    create: (partial: any) => ({ ...partial }),
    save: async (entityOrList: any) => {
      const list = Array.isArray(entityOrList) ? entityOrList : [entityOrList]
      list.forEach(e => {
        if (!e.id) e.id = randomUUID()
        if (!e.createdAt) e.createdAt = new Date()
        const idx = store().findIndex(x => x.id === e.id)
        if (idx >= 0) store()[idx] = e
        else store().push(e)
      })
      return entityOrList
    },
    find: async (opts?: any) => {
      const results = store().filter(e => matches(e, opts?.where))
      return opts?.order ? sortByOrder(results, opts.order) : results
    },
    findOne: async (opts?: any) => store().find(e => matches(e, opts?.where)) ?? null,
    delete: async (criteria: any) => {
      const before = store().length
      stores[entityName] = store().filter(e => !matches(e, criteria))
      return { affected: before - stores[entityName].length }
    },
    createQueryBuilder: (_alias?: string) => {
      let predicate = (_e: any) => true
      const builder = {
        where(_expr: string, params: Record<string, any>) {
          const actions: string[] = params.actions
          predicate = (e: any) => actions.includes(e.action)
          return builder
        },
        andWhere(_expr: string, params: Record<string, any>) {
          const since: Date = params.since
          const prev = predicate
          predicate = (e: any) => prev(e) && new Date(e.createdAt) >= since
          return builder
        },
        orderBy() {
          return builder
        },
        getMany: async () => store().filter(predicate),
      }
      return builder
    },
  }
}

function sortByOrder(list: any[], order: Record<string, 'ASC' | 'DESC'>) {
  const [field, dir] = Object.entries(order)[0]
  return [...list].sort((a, b) => {
    const av = a[field], bv = b[field]
    const cmp = av > bv ? 1 : av < bv ? -1 : 0
    return dir === 'DESC' ? -cmp : cmp
  })
}

const repos = new Map<string, ReturnType<typeof createFakeRepo>>()

export const fakeAppDataSource = {
  initialize: async () => {},
  destroy: async () => {},
  getRepository: (entity: { name: string }) => {
    const name = entity.name
    if (!repos.has(name)) repos.set(name, createFakeRepo(name))
    return repos.get(name)
  },
}

export function seed(entityName: keyof typeof stores, row: any) {
  const withId = { id: row.id ?? randomUUID(), createdAt: row.createdAt ?? new Date(), ...row }
  stores[entityName].push(withId)
  return withId
}
