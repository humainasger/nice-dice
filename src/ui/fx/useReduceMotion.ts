// Whether motion should be skipped right now: the settings switch (store) or the OS preference.
// useReduceMotion for components, reduceMotionNow for imperative spawners (floating numbers).
// The CSS in index.css already collapses every animation under either flag; these let the fx
// components skip spawning DOM at all.
import { useEffect, useState } from 'react'
import { selectReduceMotion } from '@/app/selectors'
import { store, useGameStore } from '@/app/store'

const QUERY = '(prefers-reduced-motion: reduce)'

function mediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(QUERY)
}

/** The OS preference alone. */
export function osPrefersReducedMotion(): boolean {
  return mediaQuery()?.matches ?? false
}

/** Settings switch or OS preference, read once, outside React. */
export function reduceMotionNow(): boolean {
  return store.getState().ui.settings.reduceMotion || osPrefersReducedMotion()
}

/** Settings switch or OS preference, live. */
export function useReduceMotion(): boolean {
  const setting = useGameStore(selectReduceMotion)
  const [os, setOs] = useState(osPrefersReducedMotion)
  useEffect(() => {
    const query = mediaQuery()
    if (query === null) return
    const onChange = (): void => setOs(query.matches)
    onChange()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return setting || os
}
