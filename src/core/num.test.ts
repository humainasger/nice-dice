// Property and example tests for the Num wrapper: exact save round trip, algebra, comparisons,
// the format table and the zod schema.
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { N, type Num } from './num'

const finiteDouble = fc.double({ noNaN: true, noDefaultInfinity: true })

// Values across the whole break_infinity range, built from a mantissa in [1, 10] and an exponent.
const wideNum: fc.Arbitrary<Num> = fc
  .tuple(fc.boolean(), fc.double({ min: 1, max: 10, noNaN: true }), fc.integer({ min: -1000, max: 1000 }))
  .map(([negative, m, e]) => N.parse(`${negative ? '-' : ''}${m}e${e}`))

const anyNum: fc.Arbitrary<Num> = fc.oneof(
  finiteDouble.map((x) => N.from(x)),
  wideNum,
  fc.constant(N.zero),
)

/** break_infinity's canonical form: zero, or a mantissa with 1 <= |m| < 10. */
const isNormalised = (x: Num): boolean => x.m === 0 || (Math.abs(x.m) >= 1 && Math.abs(x.m) < 10)

describe('N.serialize and N.parse', () => {
  it('round trip exactly', () => {
    fc.assert(fc.property(anyNum, (x) => N.eq(N.parse(N.serialize(x)), x)), { numRuns: 5000 })
  })

  it('round trip arithmetic results exactly', () => {
    fc.assert(
      fc.property(anyNum, anyNum, (a, b) => {
        const sum = N.add(a, b)
        const product = N.mul(a, b)
        return N.eq(N.parse(N.serialize(sum)), sum) && N.eq(N.parse(N.serialize(product)), product)
      }),
      { numRuns: 5000 },
    )
  })

  // Regression for break_infinity.js 2.2.0: add() handed back m = 0.999999999999998, e = -512 for
  // this pair, because its normalize() trusts Math.floor(Math.log10(m)) and log10 rounds up to 15
  // for 999999999999998. serialize wrote "0.999999999999998e-512", parse normalised it back to
  // m = 9.99999999999998, e = -513, and eq (exact on m and e) failed.
  it('normalises a sum whose mantissa break_infinity leaves below 1', () => {
    const a = N.parse('1e-527')
    const b = N.parse('9.999999999999964e-513')
    const sum = N.add(a, b)
    expect(Math.abs(sum.m)).toBeGreaterThanOrEqual(1)
    expect(Math.abs(sum.m)).toBeLessThan(10)
    expect(N.eq(N.parse(N.serialize(sum)), sum)).toBe(true)
  })

  it('every result leaves the wrapper in canonical form', () => {
    fc.assert(
      fc.property(anyNum, anyNum, (a, b) =>
        [N.add(a, b), N.sub(a, b), N.mul(a, b), N.div(a, b), N.floor(a), N.max(a, b), N.min(a, b)].every(
          isNormalised,
        ),
      ),
      { numRuns: 5000 },
    )
  })

  it('parse accepts ordinary literals', () => {
    expect(N.eq(N.parse('1000'), N.from(1000))).toBe(true)
    expect(N.eq(N.parse('12.5'), N.from(12.5))).toBe(true)
    expect(N.eq(N.parse('1e+36'), N.pow(N.from(10), 36))).toBe(true)
    expect(N.eq(N.parse('-1.5e9'), N.from(-1.5e9))).toBe(true)
  })

  it('parse rejects garbage and non-finite text', () => {
    const bad = ['abc', 'NaN', 'Infinity', '-Infinity', '', ' 1', '1 ', '1e3x', '0x10', '1_000', '1.2.3', '1e', 'e5']
    for (const text of bad) expect(() => N.parse(text), text).toThrow()
  })

  it('from accepts numbers and strings', () => {
    expect(N.toNumber(N.from(42))).toBe(42)
    expect(N.toNumber(N.from('42'))).toBe(42)
    expect(() => N.from('forty-two')).toThrow()
  })
})

describe('N arithmetic', () => {
  it('add is commutative', () => {
    fc.assert(fc.property(anyNum, anyNum, (a, b) => N.eq(N.add(a, b), N.add(b, a))))
  })

  it('mul by one is the identity', () => {
    fc.assert(fc.property(anyNum, (a) => N.eq(N.mul(a, N.one), a) && N.eq(N.mul(a, 1), a)))
  })

  it('never mutates its inputs', () => {
    const a = N.from(5)
    const before = N.serialize(a)
    N.add(a, 1)
    N.sub(a, 7)
    N.mul(a, 3)
    N.div(a, 2)
    N.pow(a, 3)
    N.floor(a)
    N.max(a, 9)
    N.min(a, 1)
    expect(N.serialize(a)).toBe(before)
    expect(N.toNumber(N.zero)).toBe(0)
    expect(N.toNumber(N.one)).toBe(1)
  })

  it('pow, floor, sub and div', () => {
    expect(N.toNumber(N.pow(N.from(2), 10))).toBe(1024)
    expect(N.toNumber(N.floor(N.from(12.7)))).toBe(12)
    expect(N.toNumber(N.floor(N.from(-12.3)))).toBe(-13)
    expect(N.toNumber(N.sub(N.from(10), 4))).toBe(6)
    expect(N.toNumber(N.div(N.from(10), 4))).toBe(2.5)
  })

  it('division by zero yields zero, as break_infinity does', () => {
    expect(N.isZero(N.div(N.one, N.zero))).toBe(true)
  })
})

describe('N comparisons', () => {
  it('gte agrees with cmp', () => {
    fc.assert(fc.property(anyNum, anyNum, (a, b) => N.gte(a, b) === (N.cmp(a, b) >= 0)))
  })

  it('gt, lt, lte and eq agree with cmp', () => {
    fc.assert(
      fc.property(anyNum, anyNum, (a, b) => {
        const c = N.cmp(a, b)
        return (
          N.gt(a, b) === (c > 0) &&
          N.lt(a, b) === (c < 0) &&
          N.lte(a, b) === (c <= 0) &&
          N.eq(a, b) === (c === 0)
        )
      }),
    )
  })

  it('max and min follow cmp', () => {
    fc.assert(
      fc.property(anyNum, anyNum, (a, b) => {
        const bigger = N.cmp(a, b) >= 0 ? a : b
        const smaller = N.cmp(a, b) >= 0 ? b : a
        return N.eq(N.max(a, b), bigger) && N.eq(N.min(a, b), smaller)
      }),
    )
  })

  it('isZero and isFinite', () => {
    expect(N.isZero(N.zero)).toBe(true)
    expect(N.isZero(N.from(0))).toBe(true)
    expect(N.isZero(N.from(-0))).toBe(true)
    expect(N.isZero(N.one)).toBe(false)
    expect(N.isFinite(N.one)).toBe(true)
    expect(N.isFinite(N.pow(N.from(10), 1000))).toBe(true)
    expect(N.isFinite(N.from(Infinity))).toBe(false)
    expect(N.isFinite(N.from(-Infinity))).toBe(false)
    expect(N.isFinite(N.from(NaN))).toBe(false)
  })
})

describe('N.format', () => {
  // 1000 is shown as 1.00K (three significant digits, trailing zeros kept in the suffix range).
  const cases: ReadonlyArray<readonly [number | string, string]> = [
    [0, '0'],
    [-0, '0'],
    [7, '7'],
    [12.5, '12.5'],
    [999.99, '999.99'],
    [0.001, '0'],
    [-0.001, '0'],
    [999.999, '1.00K'],
    [1000, '1.00K'],
    [1234, '1.23K'],
    [1e6, '1.00M'],
    [45.6e6, '45.6M'],
    [789e9, '789B'],
    [1.5e9, '1.50B'],
    [999.6e9, '1.00T'],
    [1e15, '1.00Qa'],
    [1e18, '1.00Qi'],
    [1e21, '1.00Sx'],
    [1e24, '1.00Sp'],
    [1e27, '1.00Oc'],
    [1e30, '1.00No'],
    [1e33, '1.00Dc'],
    ['9.99e35', '999Dc'],
    ['9.999e35', '1.00e36'],
    ['1e36', '1.00e36'],
    ['1.23e45', '1.23e45'],
    ['1e400', '1.00e400'],
    [-12.5, '-12.5'],
    [-1234.5, '-1.23K'],
    [-1.5e9, '-1.50B'],
    ['-1.23e45', '-1.23e45'],
  ]

  it.each(cases)('formats %s as %s', (input, expected) => {
    expect(N.format(N.from(input))).toBe(expected)
  })

  it('honours decimals and sigDigits options', () => {
    expect(N.format(N.from(12.345), { decimals: 1 })).toBe('12.3')
    expect(N.format(N.from(12.345), { decimals: 0 })).toBe('12')
    expect(N.format(N.from(1234), { sigDigits: 4 })).toBe('1.234K')
    expect(N.format(N.from(1234), { sigDigits: 2 })).toBe('1.2K')
    expect(N.format(N.from('1.2346e45'), { sigDigits: 4 })).toBe('1.235e45')
  })

  it('is ASCII only with no locale separators', () => {
    const shape = /^-?\d+(\.\d+)?(K|M|B|T|Qa|Qi|Sx|Sp|Oc|No|Dc|e\d+)?$/
    fc.assert(fc.property(anyNum, (x) => shape.test(N.format(x))))
  })

  it('names non-finite values', () => {
    expect(N.format(N.from(NaN))).toBe('NaN')
    expect(N.format(N.from(Infinity))).toBe('Infinity')
    expect(N.format(N.from(-Infinity))).toBe('-Infinity')
  })
})

describe('N.schema', () => {
  it('accepts a serialized Num and yields the same value', () => {
    fc.assert(
      fc.property(anyNum, (x) => {
        const result = N.schema.safeParse(N.serialize(x))
        return result.success && N.eq(result.data, x)
      }),
    )
  })

  it('accepts ordinary literals', () => {
    const result = N.schema.safeParse('1.5e9')
    expect(result.success).toBe(true)
    if (result.success) expect(N.eq(result.data, N.from(1.5e9))).toBe(true)
  })

  it('rejects garbage, NaN, Infinity and non-strings', () => {
    for (const bad of ['abc', 'NaN', 'Infinity', '-Infinity', '', '1e3x']) {
      expect(N.schema.safeParse(bad).success, bad).toBe(false)
    }
    expect(N.schema.safeParse(12).success).toBe(false)
    expect(N.schema.safeParse(null).success).toBe(false)
  })
})
