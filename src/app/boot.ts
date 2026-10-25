// Boot sequence for the dev shell: load the save (crediting time away), start the loop and autosave.
import { loadSave, startAutosave } from './devSave'
import { startLoop } from './loop'

let started = false

export function boot(): void {
  if (started) return
  started = true
  loadSave()
  startLoop()
  startAutosave()
}
