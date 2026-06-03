import { newOrderId, signOrder } from '@beampay/signer'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { z } from 'zod'

/**
 * Reference self-hosted merchant signer for the BeamPay checkout demo.
 *
 * Holds the DEMO merchant's own BSC-testnet burner key (a CF secret). This is
 * NOT a BeamPay protocol key — the protocol stays zero-key/non-custodial. Same
 * shape a real merchant copies to self-host. Serves both push (Mode A/B: call
 * /sign once, share the result) and pull (Mode C: call /sign per checkout).
 */
type Bindings = { MERCHANT_KEY: string }

const CHAIN = 'bsc-testnet' as const
// tUSDT on BSC testnet — server-locked token (mirrors the demo store).
const TOKEN = '0x0c6DfFCbb941d2fDec9c8107e8128dcb6651951c' as const
const DECIMALS = 6
const TTL_SECONDS = 3600 // short TTL bounds a leaked hot-key blast radius

// Server-side price catalog — NEVER trust client-supplied prices.
const CATALOG: Record<string, string> = { mug: '4.5', tee: '12', hoodie: '29' }

const CartSchema = z
  .object({ items: z.record(z.string(), z.number().int().min(0).max(999)) })
  .strict()

const app = new Hono<{ Bindings: Bindings }>()
app.use('*', cors())

app.get('/health', (c) => c.json({ ok: true }))

app.post('/sign', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = CartSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'invalid cart' }, 400)

  let total = 0n
  for (const [id, qty] of Object.entries(parsed.data.items)) {
    const price = CATALOG[id]
    if (!price) return c.json({ error: `unknown item: ${id}` }, 400)
    total += parseUnits(price, DECIMALS) * BigInt(qty)
  }
  if (total <= 0n) return c.json({ error: 'empty cart' }, 400)

  const key = c.env.MERCHANT_KEY as `0x${string}` | undefined
  if (!key) return c.json({ error: 'signer not configured' }, 500)

  // Self-sign: signer == merchant == receiver, all server-locked.
  const merchant = privateKeyToAccount(key).address
  const now = Math.floor(Date.now() / 1000)

  const envelope = await signOrder({
    privateKey: key,
    chain: CHAIN,
    merchant,
    receiver: merchant,
    token: TOKEN,
    amount: total.toString(),
    orderId: newOrderId(),
    createdAt: now,
    expiresAt: now + TTL_SECONDS,
  })

  return c.json(envelope)
})

export default app
