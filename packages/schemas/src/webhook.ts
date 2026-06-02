import { z } from 'zod'
import { ChainSchema } from './chain.js'
import { OrderKeySchema } from './orderKey.js'

// Order lifecycle webhook. `orderKey` = global unique key (backend has it when
// emitting); payload carries the contract `orderId` the merchant recognizes.
export const OrderWebhookBodySchema = z
  .object({
    chain: ChainSchema,
    /** global unique order key */
    orderKey: OrderKeySchema,
    /** contract event orderId (merchant-facing) */
    orderId: OrderKeySchema,
    eventType: z.enum(['Payment', 'Refund']),
    txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    payload: z.record(z.unknown()),
    timestamp: z.number(),
    recvWindow: z.number().min(1).max(60000),
    salt: z.string().min(1).max(128),
    // proxyAuth HMAC-SHA256 = bare 64-char hex (no 0x prefix), byte-identical to
    // the signer in @beampay/common + beampay-api. Must match, or every webhook 401s.
    signature: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()

export const FeeRedirectWebhookBodySchema = z
  .object({
    chain: ChainSchema,
    orderKey: OrderKeySchema,
    orderId: OrderKeySchema,
    txHash: z.string(),
    timestamp: z.number(),
    recvWindow: z.number(),
    salt: z.string(),
    signature: z.string(),
  })
  .strict()

export type OrderWebhookBody = z.infer<typeof OrderWebhookBodySchema>
export type FeeRedirectWebhookBody = z.infer<typeof FeeRedirectWebhookBodySchema>
