// Entry point of the content layer: the tables, and validateContent(), which the app runs at
// startup and the content tests run in CI. Add a row table here and in rowSchemas when one lands;
// a single-object table like rules gets its own block in validateContent.
import type { ZodType } from 'zod'
import { charms } from './charms'
import { combos } from './combos'
import { dice } from './dice'
import { luckUpgrades } from './luckUpgrades'
import { rules, rulesSchema, type RulesDef } from './rules'
import {
  charmDefSchema,
  COMBO_IDS,
  comboDefSchema,
  dieDefSchema,
  LUCK_UPGRADE_IDS,
  luckUpgradeDefSchema,
  trophyDefSchema,
  type CharmDef,
  type ComboDef,
  type DieDef,
  type Id,
  type LuckUpgradeDef,
  type TrophyDef,
  type UnlockCondition,
} from './schema'
import { trophies } from './trophies'

export * from './schema'
export { dice } from './dice'
export { combos } from './combos'
export { charms } from './charms'
export { trophies } from './trophies'
export { luckUpgrades } from './luckUpgrades'
export { rules, rulesSchema, type RulesDef } from './rules'

export interface ContentTables {
  readonly dice: readonly DieDef[]
  readonly combos: readonly ComboDef[]
  readonly charms: readonly CharmDef[]
  readonly trophies: readonly TrophyDef[]
  readonly luckUpgrades: readonly LuckUpgradeDef[]
  readonly rules: RulesDef
}

export const content: ContentTables = { dice, combos, charms, trophies, luckUpgrades, rules }

type TableName = keyof ContentTables
/** Tables made of rows with ids. The rest (rules) are single objects. */
type RowTableName = { [K in TableName]: ContentTables[K] extends readonly unknown[] ? K : never }[TableName]

/** Tables before validation, so broken ones can be fed in by tests. A table left out is the shipped one. */
export type RawTables = {
  readonly [K in TableName]?: ContentTables[K] extends readonly unknown[] ? readonly unknown[] : unknown
}

const rowSchemas: { readonly [K in RowTableName]: ZodType<ContentTables[K][number]> } = {
  dice: dieDefSchema,
  combos: comboDefSchema,
  charms: charmDefSchema,
  trophies: trophyDefSchema,
  luckUpgrades: luckUpgradeDefSchema,
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

const DIE_TARGET = 'die:'

/** The die id a charm effect names, if its target is a die. */
export function charmDieTarget(target: string): Id | null {
  return target.startsWith(DIE_TARGET) ? target.slice(DIE_TARGET.length) : null
}

function idOf(raw: unknown): string | undefined {
  if (typeof raw !== 'object' || raw === null || !('id' in raw)) return undefined
  return typeof raw.id === 'string' ? raw.id : undefined
}

/**
 * Checks that every row of every table parses, that the rules object parses, that ids are unique
 * across all tables, that every id a row references (die unlocks, charm die targets, trophy die
 * conditions) exists, and that the combos and luckUpgrades tables have every member of their
 * closed id set exactly once. Throws one Error listing every problem found.
 */
export function validateContent(tables: RawTables = content): void {
  const problems: string[] = []
  const declaredAt = new Map<string, string[]>()
  const references: { where: string; id: Id; what: string }[] = []
  const comboRows: string[] = []
  const luckUpgradeRows: string[] = []

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
      const row = result.data
      if ('unlock' in row) {
        for (const ref of referencedIds(row.unlock)) references.push({ where, id: ref, what: 'unlock' })
      }
      if ('effect' in row && 'target' in row.effect) {
        const die = charmDieTarget(row.effect.target)
        if (die !== null) references.push({ where, id: die, what: 'effect target' })
      }
      if ('condition' in row && row.condition.kind === 'dieOwned') {
        references.push({ where, id: row.condition.id, what: 'condition' })
      }
      if (table === 'combos') comboRows.push(row.id)
      if (table === 'luckUpgrades') luckUpgradeRows.push(row.id)
    })
  }

  const rawRules = tables.rules === undefined ? content.rules : tables.rules
  const rulesResult = rulesSchema.safeParse(rawRules)
  if (rulesResult.success) {
    for (const ref of referencedIds(rulesResult.data.autoRoll.unlock)) {
      references.push({ where: 'rules "autoRoll.unlock"', id: ref, what: 'unlock' })
    }
  } else {
    for (const issue of rulesResult.error.issues) {
      const path = issue.path.map(String).join('.') || '(root)'
      problems.push(`rules: ${path}: ${issue.message}`)
    }
  }

  for (const [id, places] of declaredAt) {
    if (places.length > 1) problems.push(`duplicate id "${id}" declared at ${places.join(', ')}`)
  }
  for (const { where, id, what } of references) {
    if (!declaredAt.has(id)) problems.push(`${where}: ${what} refers to unknown id "${id}"`)
  }
  if (tables.combos !== undefined || comboRows.length > 0) {
    for (const id of COMBO_IDS) {
      if (!comboRows.includes(id)) problems.push(`combos: hand "${id}" has no row`)
    }
  }
  if (tables.luckUpgrades !== undefined || luckUpgradeRows.length > 0) {
    for (const id of LUCK_UPGRADE_IDS) {
      if (!luckUpgradeRows.includes(id)) problems.push(`luckUpgrades: upgrade "${id}" has no row`)
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Content validation failed with ${problems.length} problem(s):\n- ${problems.join('\n- ')}`,
    )
  }
}
