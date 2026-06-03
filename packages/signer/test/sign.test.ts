import { BEAMPAY_ROUTER_ADDRESSES } from '@beampay/contracts-abi'
import { CHAIN_IDS, OrderEnvelopeSchema, envelopeToTypedData } from '@beampay/schemas'
import { recoverTypedDataAddress } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { newOrderId, signOrder } from '../src/index.js'

const NATIVE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as const
const now = 1_717_000_000

describe('signOrder', () => {
  const pk = generatePrivateKey()
  const account = privateKeyToAccount(pk)

  it('produces a schema-valid envelope that recovers to the signer (self-sign)', async () => {
    const env = await signOrder({
      privateKey: pk,
      chain: 'bsc-testnet',
      merchant: account.address,
      receiver: account.address,
      token: NATIVE,
      amount: '1500000',
      orderId: newOrderId(),
      createdAt: now,
      expiresAt: now + 3600,
    })

    expect(() => OrderEnvelopeSchema.parse(env)).not.toThrow()
    expect(env.signer.toLowerCase()).toBe(account.address.toLowerCase())
    expect(env.isDelegate).toBe(false)
    expect(env.feeBps).toBe(0)

    const typedData = envelopeToTypedData(
      env,
      CHAIN_IDS['bsc-testnet'],
      BEAMPAY_ROUTER_ADDRESSES['bsc-testnet'] as `0x${string}`,
    )
    const recovered = await recoverTypedDataAddress({
      ...typedData,
      signature: env.signature as `0x${string}`,
    })
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase())
  })

  it('marks isDelegate true when the signing key is not the merchant', async () => {
    const merchant = privateKeyToAccount(generatePrivateKey()).address
    const env = await signOrder({
      privateKey: pk,
      chain: 'bsc-testnet',
      merchant,
      receiver: merchant,
      token: NATIVE,
      amount: '1',
      orderId: newOrderId(),
      createdAt: now,
      expiresAt: now + 3600,
    })
    expect(env.isDelegate).toBe(true)
    expect(env.signer.toLowerCase()).toBe(account.address.toLowerCase())
  })

  it('newOrderId returns a 32-byte hex', () => {
    expect(newOrderId()).toMatch(/^0x[0-9a-f]{64}$/)
  })
})
