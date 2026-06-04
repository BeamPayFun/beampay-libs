import { newOrderId, signOrder } from '@beampay/signer'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { isAddress } from 'viem'
import { z } from 'zod'

/**
 * Reference self-hosted merchant signer for the BeamPay checkout demo.
 *
 * Holds the DEMO merchant's own BSC-testnet burner key (a CF secret). This is
 * NOT a BeamPay protocol key — the protocol stays zero-key/non-custodial. Same
 * shape a real merchant copies to self-host. Serves both push (Mode A/B: call
 * /sign once, share the result) and pull (Mode C: call /sign per checkout).
 */
type Bindings = { MERCHANT_SIGNER_PRIVATE_KEY: string }

const CHAIN = 'bsc-testnet' as const
// tUSDT on BSC testnet — the demo store's default token; client may override.
const DEFAULT_TOKEN = '0x0c6DfFCbb941d2fDec9c8107e8128dcb6651951c' as `0x${string}`
const TTL_SECONDS = 3600 // short TTL bounds a leaked hot-key blast radius

const addr = z.string().refine((s): s is `0x${string}` => isAddress(s), 'invalid address')

// The merchant's own frontend supplies the order fields. amount + merchant +
// receiver are required; the rest fall back to a server default (token = the
// demo store token, fresh orderId, now + TTL). NOTE: this signs whatever
// amount/receiver the caller sends — acceptable for a testnet demo with a
// burner key, but a PRODUCTION signer MUST authenticate the caller and validate
// the price/receiver before signing.
const SignSchema = z
  .object({
    amount: z.string().regex(/^\d+$/, 'amount must be a wei string'),
    merchant: addr,
    receiver: addr,
    token: addr.optional(),
    orderId: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, 'orderId must be bytes32 hex')
      .optional(),
    createdAt: z.number().int().positive().optional(),
    expiresAt: z.number().int().positive().optional(),
    feeBps: z.number().int().min(0).optional(),
    memo: z.string().max(256).optional(),
  })
  .strict()

// Unified response shape — mirrors beampay-api BaseResponse
// ({ code, msg, data, timestamp }) so every BeamPay surface returns the same
// envelope. SUCCESS sentinel matches beampay-api ErrorCode.SUCCESS.
const SUCCESS = '000000000'
const body = (code: string, msg: string, data: unknown = null) => ({
  code,
  msg,
  data,
  timestamp: Date.now(),
})

const app = new Hono<{ Bindings: Bindings }>()
app.use('*', cors())

app.get('/health', (c) => c.json(body(SUCCESS, 'ok', { ok: true })))

app.post('/sign', async (c) => {
  const raw = await c.req.json().catch(() => null)
  const parsed = SignSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json(body('400', parsed.error.issues[0]?.message ?? 'invalid order'), 400)
  }
  const p = parsed.data
  if (BigInt(p.amount) <= 0n) return c.json(body('400', 'amount must be > 0'), 400)

  const key = c.env.MERCHANT_SIGNER_PRIVATE_KEY as `0x${string}` | undefined
  if (!key) return c.json(body('500', 'signer not configured'), 500)

  const now = Math.floor(Date.now() / 1000)
  const createdAt = p.createdAt ?? now
  const expiresAt = p.expiresAt ?? createdAt + TTL_SECONDS

  const envelope = await signOrder({
    privateKey: key,
    chain: CHAIN,
    merchant: p.merchant,
    receiver: p.receiver,
    token: p.token ?? DEFAULT_TOKEN,
    amount: p.amount,
    orderId: (p.orderId as `0x${string}` | undefined) ?? newOrderId(),
    createdAt,
    expiresAt,
    ...(p.feeBps !== undefined ? { feeBps: p.feeBps } : {}),
    ...(p.memo !== undefined ? { memo: p.memo } : {}),
  })

  return c.json(body(SUCCESS, 'ok', envelope))
})

export default app
