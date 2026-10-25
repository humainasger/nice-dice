// The one wrapper around break_infinity.js. Every game value is a Num (a Decimal) and nothing
// outside this file touches Decimal directly. Every operation returns a value and never mutates
// its inputs (break_infinity may hand back one of the inputs when the result equals it, for
// example when adding zero; that is harmless because nothing in this codebase mutates a Num).
// Every Decimal that leaves this file is in canonical form (zero, or 1 <= |m| < 10); see normalize.
// serialize/parse are the exact save format; format is the human-facing, locale independent text.
import Decimal from 'break_infinity.js'
import { z } from 'zod'

export type Num = Decimal
/** Operands may be plain numbers so formulas stay readable. Results are always Num. */
export type NumInput = Num | number

export interface FormatOptions {
  /** Decimals shown below 1000, trailing zeros trimmed. Default 2. */
  readonly decimals?: number
  /** Significant digits shown with a suffix or in scientific notation. Default 3. */
  readonly sigDigits?: number
}

// break_infinity stores +/-Infinity as exponent 9e15 (its EXP_LIMIT) and NaN as a NaN mantissa.
const EXP_LIMIT = 9e15

// Formatting thresholds. Suffixes step every three decades from 1e3; scientific from 1e36.
const GROUP = 3
const SUFFIX_START = 1000
const SCI_EXPONENT = 36
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'] as const
const DEFAULT_DECIMALS = 2
const DEFAULT_SIG_DIGITS = 3

// A plain decimal or scientific literal: optional sign, digits with optional fraction, optional
// exponent. No whitespace, hex, underscores, NaN or Infinity.
const NUM_LITERAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

/**
 * Canonical form: zero is (0, 0), anything else has 1 <= |m| < 10. break_infinity's own
 * normalize() computes the exponent shift once as Math.floor(Math.log10(|m|)) and trusts it, but
 * log10 rounds up to the next integer for mantissas just below a power of ten (999999999999998
 * gives exactly 15), so add, mul, div and pow (all via fromMantissaExponent) can hand back a value
 * with |m| just under 1, for example 0.999999999999998e-512. eq compares m and e exactly and
 * serialize prints them as they are, so such a value breaks the exact save round trip. Every
 * Decimal produced in this file passes through here. Values already canonical, NaN and Infinity
 * (m = +/-1, e = EXP_LIMIT) are returned as is; a fresh Decimal is built otherwise, never a
 * mutated one.
 */
function normalize(d: Decimal): Decimal {
  const m = d.m
  if (!Number.isFinite(m)) return d
  if (m === 0) return d.e === 0 && !Object.is(m, -0) ? d : Decimal.fromMantissaExponent_noNormalize(0, 0)
  const abs = Math.abs(m)
  if (abs >= 1 && abs < 10) return d
  let mantissa = m
  let exponent = d.e
  while (Math.abs(mantissa) < 1) {
    mantissa *= 10
    exponent -= 1
  }
  while (Math.abs(mantissa) >= 10) {
    mantissa /= 10
    exponent += 1
  }
  return Decimal.fromMantissaExponent_noNormalize(mantissa, exponent)
}

const ZERO = normalize(Decimal.fromNumber(0))
const ONE = normalize(Decimal.fromNumber(1))

const toDecimal = (value: NumInput): Decimal =>
  typeof value === 'number' ? normalize(Decimal.fromNumber(value)) : value

function isFiniteNum(n: Num): boolean {
  return Number.isFinite(n.m) && Number.isFinite(n.e) && n.e < EXP_LIMIT
}

/**
 * Exact text form for saves: `<mantissa>e<exponent>`, for example "1.5e9" or "7e0". Both parts
 * are doubles printed by JavaScript, so parse recovers the identical Decimal. Decimal.toString
 * is not used because it goes through toNumber for exponents between -7 and 21 and drifts in
 * the last digit for about two percent of values. Non-finite values serialize as "NaN",
 * "Infinity" or "-Infinity", which parse rejects: a non-finite game value is a bug upstream.
 */
function serialize(n: Num): string {
  if (!isFiniteNum(n)) return n.toString()
  return `${n.m}e${n.e}`
}

/** Inverse of serialize. Also accepts ordinary literals like "1000", "12.5" or "1e+36". Throws on garbage. */
function parse(text: string): Num {
  if (!NUM_LITERAL.test(text)) throw new Error(`Not a number literal: ${JSON.stringify(text)}`)
  const n = normalize(Decimal.fromString(text))
  if (!isFiniteNum(n)) throw new Error(`Not a finite number: ${JSON.stringify(text)}`)
  return n
}

/** zod schema for a serialized Num: a string that parse accepts, transformed to the Num. */
const schema = z.string().transform((text, ctx): Num => {
  try {
    return parse(text)
  } catch (error) {
    ctx.addIssue({ code: 'custom', message: error instanceof Error ? error.message : String(error) })
    return z.NEVER
  }
})

function trimZeros(fixed: string): string {
  if (!fixed.includes('.')) return fixed
  return fixed.replace(/0+$/, '').replace(/\.$/, '')
}

/** value in [1, 1000) rounded to at least `sig` significant digits, as fixed-point text. */
function toSignificant(value: number, sig: number): string {
  let digitsBefore = value >= 100 ? 3 : value >= 10 ? 2 : 1
  let text = value.toFixed(Math.max(0, sig - digitsBefore))
  // Rounding can add a digit (9.996 -> "10.00"); reformat with one more digit before the point.
  if (digitsBefore < 3 && Number(text) >= 10 ** digitsBefore) {
    digitsBefore += 1
    text = Number(text).toFixed(Math.max(0, sig - digitsBefore))
  }
  return text
}

function formatScientific(mantissa: number, exponent: number, sig: number): string {
  let text = mantissa.toFixed(Math.max(0, sig - 1))
  let e = exponent
  if (Number(text) >= 10) {
    text = (1).toFixed(Math.max(0, sig - 1))
    e += 1
  }
  return `${text}e${e}`
}

/** mantissa in [1, 10), exponent >= 3. */
function formatSuffixed(mantissa: number, exponent: number, sig: number): string {
  let group = Math.floor(exponent / GROUP)
  let text = toSignificant(mantissa * 10 ** (exponent - group * GROUP), sig)
  // 999.6K rounds to 1000K, which is 1.00M.
  if (Number(text) >= SUFFIX_START) {
    group += 1
    text = toSignificant(1, sig)
  }
  if (group * GROUP >= SCI_EXPONENT) return formatScientific(1, group * GROUP, sig)
  return text + (SUFFIXES[group] ?? '')
}

/**
 * Human-facing text, hand rolled and locale independent (never Intl). Below 1000: up to
 * `decimals` decimals, trimmed (0, 7, 12.5, 999.99). From 1e3: K M B T Qa Qi Sx Sp Oc No Dc with
 * `sigDigits` significant digits (1.00K, 1.23K, 45.6M, 789B). At or above 1e36: scientific like
 * 1.23e45. Negatives keep their sign unless they round to zero (-0.001 is "0", never "-0").
 */
function format(n: Num, options: FormatOptions = {}): string {
  const decimals = options.decimals ?? DEFAULT_DECIMALS
  const sig = options.sigDigits ?? DEFAULT_SIG_DIGITS
  if (Number.isNaN(n.m)) return 'NaN'
  if (!isFiniteNum(n)) return n.m < 0 ? '-Infinity' : 'Infinity'
  const sign = n.m < 0 ? '-' : ''
  const abs = n.abs()
  if (abs.e >= SCI_EXPONENT) return sign + formatScientific(abs.m, abs.e, sig)
  if (abs.lt(SUFFIX_START)) {
    const text = abs.toNumber().toFixed(decimals)
    // 999.999 rounds up to 1000.00 and belongs with the suffixes as 1.00K.
    if (Number(text) >= SUFFIX_START) return sign + formatSuffixed(1, GROUP, sig)
    const trimmed = trimZeros(text)
    // A tiny negative rounds to zero and reads as "0", not "-0".
    return trimmed === '0' ? trimmed : sign + trimmed
  }
  return sign + formatSuffixed(abs.m, abs.e, sig)
}

export const N = {
  zero: ZERO,
  one: ONE,
  /** A number as is (including NaN or Infinity, mirroring Decimal), or a string via parse. */
  from: (value: number | string): Num =>
    typeof value === 'number' ? normalize(Decimal.fromNumber(value)) : parse(value),
  add: (a: NumInput, b: NumInput): Num => normalize(toDecimal(a).add(b)),
  sub: (a: NumInput, b: NumInput): Num => normalize(toDecimal(a).sub(b)),
  mul: (a: NumInput, b: NumInput): Num => normalize(toDecimal(a).mul(b)),
  /** Division by zero yields zero, as break_infinity does. */
  div: (a: NumInput, b: NumInput): Num => normalize(toDecimal(a).div(b)),
  pow: (base: NumInput, exponent: number): Num => normalize(toDecimal(base).pow(exponent)),
  cmp: (a: NumInput, b: NumInput): -1 | 0 | 1 => toDecimal(a).cmp(b),
  eq: (a: NumInput, b: NumInput): boolean => toDecimal(a).eq(b),
  gt: (a: NumInput, b: NumInput): boolean => toDecimal(a).gt(b),
  gte: (a: NumInput, b: NumInput): boolean => toDecimal(a).gte(b),
  lt: (a: NumInput, b: NumInput): boolean => toDecimal(a).lt(b),
  lte: (a: NumInput, b: NumInput): boolean => toDecimal(a).lte(b),
  max: (a: NumInput, b: NumInput): Num => normalize(toDecimal(a).max(b)),
  min: (a: NumInput, b: NumInput): Num => normalize(toDecimal(a).min(b)),
  floor: (n: NumInput): Num => normalize(toDecimal(n).floor()),
  isZero: (n: NumInput): boolean => toDecimal(n).eq(ZERO),
  isFinite: (n: Num): boolean => isFiniteNum(n),
  /** Lossy above 2^53 and Infinity past 1e308. For display use format, for saves serialize. */
  toNumber: (n: Num): number => n.toNumber(),
  serialize,
  parse,
  schema,
  format,
} as const
