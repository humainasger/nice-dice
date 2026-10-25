// The look-and-feel toolkit for the game screens: particles, floating numbers, the combo callout,
// the points count-up and a screen shake, plus the reduce-motion hooks they share. README.md in
// this folder documents each one; the keyframes and palette live in src/index.css.
export { Particles, PARTICLE_MS, type ParticleKind } from './Particles'
export { FloatingNumber } from './FloatingNumber'
export { useFloatingNumbers, FLOAT_MS, type FloatTone, type FloatingNumbers } from './useFloatingNumbers'
export { ComboCallout, CALLOUT_HOLD_MS, CALLOUT_FADE_MS } from './ComboCallout'
export { useCountUp, parseFormatted, formatTween, COUNT_UP_MS, type ParsedNumber } from './useCountUp'
export { ScreenShake, SHAKE_MS } from './ScreenShake'
export { useReduceMotion, reduceMotionNow, osPrefersReducedMotion } from './useReduceMotion'
