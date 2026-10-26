// Lookups into the content tables for the rest of core: die, combo, charm, trophy and luck upgrade
// definitions by id, and the rules object. Content is validated at startup (validateContent), so
// an unknown id here is a bug.
import {
  charmRaritySchema,
  content,
  type CharmDef,
  type CharmRarity,
  type ComboDef,
  type ComboId,
  type DieDef,
  type Id,
  type LuckUpgradeDef,
  type LuckUpgradeId,
  type RulesDef,
  type TrophyDef,
} from '@/content'

function byId<T extends { readonly id: string }>(rows: readonly T[]): ReadonlyMap<string, T> {
  return new Map(rows.map((row) => [row.id, row]))
}

const diceById = byId(content.dice)
const combosById = byId(content.combos)
const charmsById = byId(content.charms)
const trophiesById = byId(content.trophies)
const luckUpgradesById = byId(content.luckUpgrades)

function lookup<T>(table: ReadonlyMap<string, T>, what: string, id: string): T {
  const def = table.get(id)
  if (def === undefined) throw new Error(`Unknown ${what} id ${JSON.stringify(id)}`)
  return def
}

/** The content row for a die id. Throws on an id that is not in the dice table. */
export function dieDef(id: Id): DieDef {
  return lookup(diceById, 'die', id)
}

/** The content row for a hand. Throws on an id that is not in the combos table. */
export function comboDef(id: ComboId): ComboDef {
  return lookup(combosById, 'combo', id)
}

/** The content row for a charm id. Throws on an id that is not in the charms table. */
export function charmDef(id: Id): CharmDef {
  return lookup(charmsById, 'charm', id)
}

/** The content row for a trophy id. Throws on an id that is not in the trophies table. */
export function trophyDef(id: Id): TrophyDef {
  return lookup(trophiesById, 'trophy', id)
}

/** The content row for a luck upgrade. Throws on an id that is not in the luckUpgrades table. */
export function luckUpgradeDef(id: LuckUpgradeId): LuckUpgradeDef {
  return lookup(luckUpgradesById, 'luck upgrade', id)
}

/** Whether an id names a content row of the given table; for saves and commands built from untyped data. */
export const isDieId = (id: string): boolean => diceById.has(id)
export const isComboId = (id: string): id is ComboId => combosById.has(id)
export const isCharmId = (id: string): boolean => charmsById.has(id)
export const isTrophyId = (id: string): boolean => trophiesById.has(id)
export const isLuckUpgradeId = (id: string): id is LuckUpgradeId => luckUpgradesById.has(id)

/** The hands ordered strongest first by base multiplier (content order breaks ties), for best-hand detection. */
export const combosByStrength: readonly ComboDef[] = [...content.combos].sort((a, b) => b.base - a.base)

/** Charm rarities weakest first, as the content enum declares them; the index is the rank the memory upgrade keeps by. */
export const rarityOrder: readonly CharmRarity[] = charmRaritySchema.options

/** The global rules table: auto-roll, offline policy, ascension, combos, faces, draft, luck and trophies. */
export const rules: RulesDef = content.rules
