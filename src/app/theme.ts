// Theme and motion classes on <html>. shadcn's dark variant is the .dark class; the die roll
// animation is skipped under the reduce-motion class as well as prefers-reduced-motion.
// applyTheme is the pure-ish core (given the OS preference); startTheme wires it to the store's
// settings and to the OS preference while theme is 'auto'. boot() calls startTheme once.
import { store, type Settings } from './store'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** Whether the page is dark for these settings, given the OS preference. */
export function resolveDark(settings: Settings, prefersDark: boolean): boolean {
  return settings.theme === 'auto' ? prefersDark : settings.theme === 'dark'
}

function osPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
}

/** Set the dark and reduce-motion classes (and color-scheme) on <html> for these settings. */
export function applyTheme(settings: Settings, prefersDark: boolean = osPrefersDark()): void {
  if (typeof document === 'undefined') return
  const dark = resolveDark(settings, prefersDark)
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.classList.toggle('reduce-motion', settings.reduceMotion)
  root.style.colorScheme = dark ? 'dark' : 'light'
}

/**
 * Apply the stored settings now, then follow them: re-apply when settings change in the store
 * and when the OS preference flips while theme is 'auto'. Returns a stop function.
 */
export function startTheme(): () => void {
  const query = window.matchMedia(DARK_QUERY)
  const apply = (): void => applyTheme(store.getState().ui.settings, query.matches)
  const onOsChange = (): void => {
    if (store.getState().ui.settings.theme === 'auto') apply()
  }
  apply()
  query.addEventListener('change', onOsChange)
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.ui.settings !== previous.ui.settings) apply()
  })
  return () => {
    query.removeEventListener('change', onOsChange)
    unsubscribe()
  }
}
