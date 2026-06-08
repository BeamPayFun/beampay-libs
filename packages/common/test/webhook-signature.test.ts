import { describe, expect, it } from 'vitest'
import {
  WEBHOOK_SECRET_PREFIX,
  buildWebhookHeaders,
  parseSignatureHeader,
  signWebhook,
  verifyWebhookSignature,
  webhookId,
} from '../src/webhook-signature'

// Canonical Standard Webhooks test vector (https://www.standardwebhooks.com).
// Secret built by concatenation so no `whsec_…` literal lands in source.
const VECTOR = {
  secret: `${WEBHOOK_SECRET_PREFIX}MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw`,
  webhookId: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
  timestamp: 1614265330,
  payload: '{"test": 2432232314}',
  signature: 'g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
}

describe('signWebhook — fixed vector', () => {
  it('matches the canonical Standard Webhooks signature', async () => {
    const sig = await signWebhook({
      webhookId: VECTOR.webhookId,
      timestamp: VECTOR.timestamp,
      payload: VECTOR.payload,
      secret: VECTOR.secret,
    })
    expect(sig).toBe(VECTOR.signature)
  })

  it('emits base64, never 0x-hex', async () => {
    const sig = await signWebhook({
      webhookId: 'id',
      timestamp: 1,
      payload: 'body',
      secret: 'plain-secret',
    })
    expect(sig.startsWith('0x')).toBe(false)
    expect(sig).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('produces identical sigs for string and Uint8Array bodies', async () => {
    const body = '{"a":1}'
    const a = await signWebhook({ webhookId: 'x', timestamp: 5, payload: body, secret: 's' })
    const b = await signWebhook({
      webhookId: 'x',
      timestamp: 5,
      payload: new TextEncoder().encode(body),
      secret: 's',
    })
    expect(a).toBe(b)
  })
})

describe('verifyWebhookSignature', () => {
  const base = {
    webhookId: 'evt_1',
    timestamp: 1700000000,
    payload: '{"orderKey":"0xabc"}',
  }

  it('round-trips sign → verify', async () => {
    const sig = await signWebhook({ ...base, secret: 'shh' })
    const header = buildWebhookHeaders({
      webhookId: base.webhookId,
      timestamp: base.timestamp,
      signatures: [sig],
    })['webhook-signature']
    expect(
      await verifyWebhookSignature({ ...base, signatureHeader: header, secrets: ['shh'] }),
    ).toBe(true)
  })

  it('rejects a tampered body', async () => {
    const sig = await signWebhook({ ...base, secret: 'shh' })
    expect(
      await verifyWebhookSignature({
        ...base,
        payload: '{"orderKey":"0xDEAD"}',
        signatureHeader: `v1,${sig}`,
        secrets: ['shh'],
      }),
    ).toBe(false)
  })

  it('isolation: secret A cannot verify under secret B', async () => {
    const sig = await signWebhook({ ...base, secret: 'merchant-A' })
    expect(
      await verifyWebhookSignature({
        ...base,
        signatureHeader: `v1,${sig}`,
        secrets: ['merchant-B'],
      }),
    ).toBe(false)
  })

  it('rotation: header carrying both, merchant holding only the old secret still passes', async () => {
    const oldSig = await signWebhook({ ...base, secret: 'old' })
    const newSig = await signWebhook({ ...base, secret: 'new' })
    const header = buildWebhookHeaders({
      webhookId: base.webhookId,
      timestamp: base.timestamp,
      signatures: [newSig, oldSig],
    })['webhook-signature']
    expect(
      await verifyWebhookSignature({ ...base, signatureHeader: header, secrets: ['old'] }),
    ).toBe(true)
  })

  it('returns false on empty header or no secrets', async () => {
    const sig = await signWebhook({ ...base, secret: 's' })
    expect(await verifyWebhookSignature({ ...base, signatureHeader: '', secrets: ['s'] })).toBe(
      false,
    )
    expect(
      await verifyWebhookSignature({ ...base, signatureHeader: `v1,${sig}`, secrets: [] }),
    ).toBe(false)
  })

  it('fails closed (no throw) when a configured secret is empty', async () => {
    const sig = await signWebhook({ ...base, secret: 'good' })
    expect(
      await verifyWebhookSignature({ ...base, signatureHeader: `v1,${sig}`, secrets: [''] }),
    ).toBe(false)
    // a valid secret alongside the empty one still matches
    expect(
      await verifyWebhookSignature({
        ...base,
        signatureHeader: `v1,${sig}`,
        secrets: ['', 'good'],
      }),
    ).toBe(true)
  })
})

describe('secret handling', () => {
  it('rejects an empty secret when signing', async () => {
    await expect(
      signWebhook({ webhookId: 'i', timestamp: 1, payload: 'b', secret: '' }),
    ).rejects.toThrow()
  })

  it('does NOT base64-decode an unprefixed secret (no aliasing)', async () => {
    // 'YWJj' is valid base64 for 'abc'. Treated as raw UTF-8, so it must differ
    // from a whsec_ secret whose bytes are literally 'abc'.
    const asUtf8 = await signWebhook({ webhookId: 'i', timestamp: 1, payload: 'b', secret: 'YWJj' })
    const asBase64 = await signWebhook({
      webhookId: 'i',
      timestamp: 1,
      payload: 'b',
      secret: `${WEBHOOK_SECRET_PREFIX}YWJj`,
    })
    expect(asUtf8).not.toBe(asBase64)
  })
})

describe('headers + parsing', () => {
  it('builds v1, space-separated headers', () => {
    const h = buildWebhookHeaders({ webhookId: 'i', timestamp: 9, signatures: ['aaa', 'bbb'] })
    expect(h['webhook-id']).toBe('i')
    expect(h['webhook-timestamp']).toBe('9')
    expect(h['webhook-signature']).toBe('v1,aaa v1,bbb')
  })

  it('parses only v1 entries', () => {
    expect(parseSignatureHeader('v1,aaa v2,bbb v1,ccc')).toEqual(['aaa', 'ccc'])
  })

  it('webhookId formats chain:txHash:logIndex', () => {
    expect(webhookId('bsc', '0xdead', 3)).toBe('bsc:0xdead:3')
  })
})
