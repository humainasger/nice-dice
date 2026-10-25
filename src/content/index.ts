// Entry point of the content layer: the tables, and validateContent(), which the app runs at
// startup and the content tests run in CI. Add a row table here and in rowSchemas when one lands;
// a single-object table like rules gets its own block in validateContent.
import type { ZodType } from 'zod'
import { dice } from './dice'
import { rules, rulesSchema, type RulesDef } from './rules'
import { dieDefSchema, type DieDef, type Id, type UnlockCondition } from './schema'

export * from './schema'
export { dice } from './dice'
export { rules, rulesSchema, type RulesDef } from './rules'

export interface ContentTables {
  readonly dice: readonly DieDef[]
  readonly rules: RulesDef
}

export const content: ContentTables = { dice, rules }

type TableName = keyof ContentTables
/** Tables made of rows with ids. The rest (rules) are single objects. */
type RowTableName = { [K in TableName]: ContentTables[K] extends readonly unknown[] ? K : never }[TableName]

/** Tables before validation, so broken ones can be fed in by tests. A table left out is the shipped one. */
export type RawTables = {
  readonly [K in TableName]?: ContentTables[K] extends readonly unknown[] ? readonly unknown[] : unknown
}

const rowSchemas: { readonly [K in RowTableName]: ZodType<ContentTables[K][number]> } = {
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
 * Checks that every row of every table parses, that the rules object parses, that ids are unique
 * across all tables and that every id an unlock condition references exists. Throws one Error
 * listing every problem found.
 */
export function validateContent(tables: RawTables = content): void {
  const problems: string[] = []
  const declaredAt = new Map<string, string[]>()
  const unlocks: { where: string; unlock: UnlockCondition }[] = []

  for (const table of Object.keys(rowSchemas) as RowTableName[]) {
    const schema = rowSchemas[table]
    const rows = tables[table] ?? content[table]
    rows.forEach((raw, index) => {
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

  const rawRules = tables.rules === undefined ? content.rules : tables.rules
  const rulesResult = rulesSchema.safeParse(rawRules)
  if (rulesResult.success) {
    unlocks.push({ where: 'rules "autoRoll.unlock"', unlock: rulesResult.data.autoRoll.unlock })
  } else {
    for (const issue of rulesResult.error.issues) {
      const path = issue.path.map(String).join('.') || '(root)'
      problems.push(`rules: ${path}: ${issue.message}`)
    }
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
