// Lookups into the content tables for the rest of core: die definitions by id and the rules
// object. Content is validated at startup (validateContent), so an unknown id here is a bug.
import { content, type DieDef, type Id, type RulesDef } from '@/content'

const diceById: ReadonlyMap<Id, DieDef> = new Map(content.dice.map((def) => [def.id, def]))

/** The content row for a die id. Throws on an id that is not in the dice table. */
export function dieDef(id: Id): DieDef {
  const def = diceById.get(id)
  if (def === undefined) throw new Error(`Unknown die id ${JSON.stringify(id)}`)
  return def
}

/** The global rules table: auto-roll baseline and unlock, offline policy. */
export const rules: RulesDef = content.rules
