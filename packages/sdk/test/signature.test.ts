import { ApiSignatureUtil } from '@beampay/common'
import { describe, expect, it } from 'vitest'

describe('internal proxyAuth signature (@beampay/common)', () => {
  it('produces deterministic 0x-hex HMAC signatures', async () => {
    const msg = 'test-message'
    const key = 'shared-secret'
    const sig1 = await ApiSignatureUtil.sign(msg, key)
    const sig2 = await ApiSignatureUtil.sign(msg, key)
    expect(sig1).toBe(sig2)
    expect(sig1).toMatch(/^0x[0-9a-f]{64}$/)
  })
})
