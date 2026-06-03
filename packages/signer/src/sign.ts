import { BEAMPAY_ROUTER_ADDRESSES } from '@beampay/contracts-abi'
import {
  buildOrderTypedData,
  CHAIN_IDS,
  type ChainKey,
  type OrderEnvelope,
  OrderEnvelopeSchema,
} from '@beampay/schemas'
import { privateKeyToAccount } from 'viem/accounts'

export interface SignOrderParams {
  /** Merchant's (or delegate's) EIP-712 signing key, hex. NEVER ships to the client. */
  privateKey: `0x${string}`
  /** Chain key — selects chainId + default router address. */
  chain: ChainKey
  /** Router (verifyingContract). Defaults to BEAMPAY_ROUTER_ADDRESSES[chain]. */
  router?: `0x${string}`
  /** Order owner — order-key namespace, refund caller. */
  merchant: `0x${string}`
  /** Signed payout destination (may equal merchant). */
  receiver: `0x${string}`
  /** ERC-20 address, or NATIVE_TOKEN sentinel. */
  token: `0x${string}`
  /** Amount in token base units (wei), decimal string. */
  amount: string
  /** Merchant-scoped unique 32-byte order id. Use newOrderId(). */
  orderId: `0x${string}`
  /** Unix seconds. */
  createdAt: number
  /** Unix seconds (> createdAt). */
  expiresAt: number
  /** Protocol fee bps — display/forward only, NOT part of the signed struct. Defaults to 0. */
  feeBps?: number
  /** Optional memo (≤256 chars). */
  memo?: string
}

/**
 * Sign a BeamPay v1.4 Order off-chain and return a validated OrderEnvelope.
 *
 * The recovered `signer` is the key's own address. When it equals `merchant`
 * the contract accepts it directly; when it differs the merchant must have
 * authorized it on-chain via `setSigner` (delegate signing). `isDelegate` is
 * derived from that comparison.
 */
export async function signOrder(params: SignOrderParams): Promise<OrderEnvelope> {
  const account = privateKeyToAccount(params.privateKey)
  const router = (params.router ?? BEAMPAY_ROUTER_ADDRESSES[params.chain]) as
    | `0x${string}`
    | undefined
  if (!router) throw new Error(`No router address for chain: ${params.chain}`)

  const typedData = buildOrderTypedData({
    chainId: CHAIN_IDS[params.chain],
    verifyingContract: router,
    merchant: params.merchant,
    receiver: params.receiver,
    signer: account.address,
    token: params.token,
    amount: BigInt(params.amount),
    orderId: params.orderId,
    createdAt: BigInt(params.createdAt),
    expiresAt: BigInt(params.expiresAt),
  })

  const signature = await account.signTypedData(typedData)

  return OrderEnvelopeSchema.parse({
    chain: params.chain,
    merchant: params.merchant,
    receiver: params.receiver,
    token: params.token,
    amount: params.amount,
    orderId: params.orderId,
    feeBps: params.feeBps ?? 0,
    signer: account.address,
    createdAt: params.createdAt,
    expiresAt: params.expiresAt,
    signature,
    isDelegate: account.address.toLowerCase() !== params.merchant.toLowerCase(),
    ...(params.memo !== undefined ? { memo: params.memo } : {}),
  })
}

/** Fresh merchant-scoped 32-byte order id (bytes32 hex) — the contract requires bytes32, not a UUID. */
export function newOrderId(): `0x${string}` {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let hex = '0x'
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex as `0x${string}`
}
