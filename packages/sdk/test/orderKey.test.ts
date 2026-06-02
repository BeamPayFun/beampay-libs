import { describe, expect, it } from 'vitest'
import { deriveOrderId, deriveOrderKey } from '../src/orderKey.js'
import orderIdFixtures from './fixtures/orderid.json'
import orderKeyFixtures from './fixtures/orderkey.json'

describe('deriveOrderId', () => {
  it.each(orderIdFixtures)(
    'derives expected orderId for $merchant',
    ({ merchant, token, amount, salt, expectedOrderId }) => {
      const result = deriveOrderId({
        merchant: merchant as `0x${string}`,
        token: token as `0x${string}`,
        amount,
        salt: salt as `0x${string}`,
      })
      expect(result).toBe(expectedOrderId)
    },
  )
})

// Parity vector — beampay-cron's deriveOrderKey MUST produce identical hashes
// for the same inputs (see beampay-cron/test/order-key fixtures).
describe('deriveOrderKey', () => {
  it.each(orderKeyFixtures)(
    'derives expected global orderKey for chain $chainId / $merchant',
    ({ chainId, merchant, orderId, expectedOrderKey }) => {
      const result = deriveOrderKey({
        chainId,
        merchant: merchant as `0x${string}`,
        orderId: orderId as `0x${string}`,
      })
      expect(result).toBe(expectedOrderKey)
    },
  )
})
