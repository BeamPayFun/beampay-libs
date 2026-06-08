import { buildWebhookHeaders, signWebhook } from '@beampay/common'
import { describe, expect, it } from 'vitest'
import { verifyWebhook } from '../src/webhook.js'

const SECRET = 'merchant-secret'
const RAW_BODY = '{"chain":"bsc","orderKey":"0xabc","eventType":"Payment"}'

async function makeHeaders(
  opts: {
    secret?: string | string[]
    timestamp?: number
    webhookId?: string
    body?: string
  } = {},
) {
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000)
  const webhookId = opts.webhookId ?? 'bsc:0xtx:0'
  const secrets = Array.isArray(opts.secret) ? opts.secret : [opts.secret ?? SECRET]
  const signatures = await Promise.all(
    secrets.map((secret) =>
      signWebhook({ webhookId, timestamp, payload: opts.body ?? RAW_BODY, secret }),
    ),
  )
  return buildWebhookHeaders({ webhookId, timestamp, signatures })
}

describe('verifyWebhook', () => {
  it('accepts a valid signed webhook', async () => {
    const headers = await makeHeaders()
    expect(await verifyWebhook(RAW_BODY, headers, { secret: SECRET })).toBe(true)
  })

  it('accepts identical string and Uint8Array bodies', async () => {
    const headers = await makeHeaders()
    const bytes = new TextEncoder().encode(RAW_BODY)
    expect(await verifyWebhook(bytes, headers, { secret: SECRET })).toBe(true)
  })

  it('rejects a wrong secret', async () => {
    const headers = await makeHeaders()
    expect(await verifyWebhook(RAW_BODY, headers, { secret: 'nope' })).toBe(false)
  })

  it('rejects a tampered body', async () => {
    const headers = await makeHeaders()
    expect(await verifyWebhook('{"tampered":true}', headers, { secret: SECRET })).toBe(false)
  })

  it('rejects a timestamp beyond tolerance', async () => {
    const old = Math.floor(Date.now() / 1000) - 1000
    const headers = await makeHeaders({ timestamp: old })
    expect(await verifyWebhook(RAW_BODY, headers, { secret: SECRET })).toBe(false)
    // ...but passes with a wide enough tolerance
    expect(await verifyWebhook(RAW_BODY, headers, { secret: SECRET, toleranceSec: 5000 })).toBe(
      true,
    )
  })

  it('rotation: header signed by both, merchant holding only the OLD secret passes', async () => {
    const headers = await makeHeaders({ secret: ['new-secret', 'old-secret'] })
    expect(await verifyWebhook(RAW_BODY, headers, { secret: 'old-secret' })).toBe(true)
  })

  it('rejects a non-finite tolerance instead of disabling the replay window', async () => {
    const headers = await makeHeaders()
    expect(
      await verifyWebhook(RAW_BODY, headers, { secret: SECRET, toleranceSec: Number.NaN }),
    ).toBe(false)
    expect(
      await verifyWebhook(RAW_BODY, headers, {
        secret: SECRET,
        toleranceSec: Number.POSITIVE_INFINITY,
      }),
    ).toBe(false)
  })

  it('returns false on missing/malformed headers', async () => {
    expect(
      await verifyWebhook(
        RAW_BODY,
        { 'webhook-id': '', 'webhook-timestamp': '', 'webhook-signature': '' },
        { secret: SECRET },
      ),
    ).toBe(false)
    expect(
      await verifyWebhook(
        RAW_BODY,
        {
          'webhook-id': 'x',
          'webhook-timestamp': 'not-a-number',
          'webhook-signature': 'v1,abc',
        },
        { secret: SECRET },
      ),
    ).toBe(false)
  })
})
