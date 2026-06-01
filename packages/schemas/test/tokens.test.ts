import { describe, expect, it } from 'vitest'
import { toTokenDecimalString } from '../src/tokens'

describe('toTokenDecimalString', () => {
  it('formats 18-dp BNB at full precision, no commas', () => {
    expect(toTokenDecimalString('1234500000000000000000', 18)).toBe('1234.5')
    expect(toTokenDecimalString('225000000000000000', 18)).toBe('0.225')
    expect(toTokenDecimalString('1000000000000000000', 18)).toBe('1')
  })

  it('formats 6-dp USDC at full precision', () => {
    expect(toTokenDecimalString('49500000', 6)).toBe('49.5')
    expect(toTokenDecimalString('1', 6)).toBe('0.000001')
    expect(toTokenDecimalString('1000000', 6)).toBe('1')
  })

  it('preserves sub-cent precision (no rounding)', () => {
    // 49.499999999999999999 — would round to 49.5 under a 2-dp formatter
    expect(toTokenDecimalString('49499999999999999999', 18)).toBe('49.499999999999999999')
  })

  it('handles zero and empty as "0"', () => {
    expect(toTokenDecimalString('0', 18)).toBe('0')
    expect(toTokenDecimalString('', 18)).toBe('0')
    expect(toTokenDecimalString('000', 18)).toBe('0')
  })

  it('preserves a leading minus for signed (net) amounts', () => {
    expect(toTokenDecimalString('-225000000000000000', 18)).toBe('-0.225')
    expect(toTokenDecimalString('-1000000', 6)).toBe('-1')
  })

  it('returns "0" for non-numeric input', () => {
    expect(toTokenDecimalString('0x1f', 18)).toBe('0')
    expect(toTokenDecimalString('abc', 6)).toBe('0')
  })

  it('handles 0-decimal tokens', () => {
    expect(toTokenDecimalString('42', 0)).toBe('42')
  })
})
