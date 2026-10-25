// Entry point of the content layer: the tables, and validateContent(), which the app runs at
// startup and the content tests run in CI. Add a table here and in tableSchemas when one lands.
import type { ZodType } from 'zod'
import { dice } from './dice'
import { dieDefSchema, type DieDef, type Id, type UnlockCondition } from './schema'

export * from './schema'
export { dice } from './dice'

export interface ContentTables {
  readonly dice: readonly DieDef[]
}

export const content: ContentTables = { dice }

type TableName = keyof ContentTables

/** Tables before validation, so broken ones can be fed in by tests. */
export type RawTables = { readonly [K in TableName]: readonly unknown[] }

const tableSchemas: { readonly [K in TableName]: ZodType<ContentTables[K][number]> } = {
  dice: dieDefSchema,
}

/** Ids an unlock condition points at. Exhaustive, so a new kind must declare what it references. */
function referencedIds(unlock: UnlockCondition): readonly Id[] {
  switch (unlock.kind) {
    case 'always':
    case 'totalEarned':
    case 'prestiges':
      return []
    case 'owned':
      return [unlock.id]
  }
}

function idOf(raw: unknown): string | undefined {
  if (typeof raw !== 'object' || raw === null || !('id' in raw)) return undefined
  return typeof raw.id === 'string' ? raw.id : undefined
}

/**
 * Checks that every row of every table parses, that ids are unique across all tables and that
 * every id an unlock condition references exists. Throws one Error listing every problem found.
 */
export function validateContent(tables: RawTables = content): void {
  const problems: string[] = []
  const declaredAt = new Map<string, string[]>()
  const unlocks: { where: string; unlock: UnlockCondition }[] = []

  for (const table of Object.keys(tableSchemas) as TableName[]) {
    const schema = tableSchemas[table]
    tables[table].forEach((raw, index) => {
      const id = idOf(raw)
      const where = id === undefined ? `${table}[${index}]` : `${table}[${index}] "${id}"`
      if (id !== undefined) declaredAt.set(id, [...(declaredAt.get(id) ?? []), where])
      const result = schema.safeParse(raw)
      if (!result.success) {
        for (const issue of result.error.issues) {
          const path = issue.path.map(String).join('.') || '(row)'
          problems.push(`${where}: ${path}: ${issue.message}`)
        }
        return
      }
      unlocks.push({ where, unlock: result.data.unlock })
    })
  }

  for (const [id, places] of declaredAt) {
    if (places.length > 1) problems.push(`duplicate id "${id}" declared at ${places.join(', ')}`)
  }
  for (const { where, unlock } of unlocks) {
    for (const id of referencedIds(unlock)) {
      if (!declaredAt.has(id)) problems.push(`${where}: unlock refers to unknown id "${id}"`)
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Content validation failed with ${problems.length} problem(s):\n- ${problems.join('\n- ')}`,
    )
  }
}
