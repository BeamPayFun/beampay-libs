import { z } from 'zod'
import { ChainSchema } from './chain.js'

export const CreateOrderBodySchema = z.object({
  chain: ChainSchema,
  merchant: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  receiver: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  token: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  amount: z.string().regex(/^\d+$/),
})

export type CreateOrderBody = z.infer<typeof CreateOrderBodySchema>
