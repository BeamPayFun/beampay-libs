import { describe, expect, it } from 'vitest'
import {
  DashChainSchema,
  DashboardScopeSchema,
  KNOWN_DASH_CHAINS,
  OrderDetailSchema,
  OrderListResponseSchema,
  OrderRowSchema,
  chainsForScope,
  scopeForChain,
} from '../src/dashboard'

describe('scope mapping', () => {
  it('maps mainnet to bsc + ethereum', () => {
    expect(chainsForScope('mainnet')).toEqual(['bsc', 'ethereum'])
  })

  it('maps testnet to bsc-testnet only', () => {
    expect(chainsForScope('testnet')).toEqual(['bsc-testnet'])
  })

  it('derives scope from chain', () => {
    expect(scopeForChain('bsc')).toBe('mainnet')
    expect(scopeForChain('ethereum')).toBe('mainnet')
    expect(scopeForChain('bsc-testnet')).toBe('testnet')
  })

  it('rejects unknown scope', () => {
    expect(DashboardScopeSchema.safeParse('devnet').success).toBe(false)
    expect(DashboardScopeSchema.safeParse('mainnet').success).toBe(true)
  })
})

describe('OrderRowSchema (canonical contract)', () => {
  const row = {
    orderId: `0x${'ab'.repeat(32)}`,
    chain: 'bsc',
    tokenAddress: '0x55d398326f99059ff775485246999027b3197955',
    tokenSymbol: 'USDT',
    tokenDecimals: 18,
    amount: '49.5',
    paidAmount: '49.5',
    refundedAmount: '0',
    refundableAmount: '49.5',
    payer: '0x1111111111111111111111111111111111111111',
    status: 'paid' as const,
    priceUsd: '1',
    createdAt: 1_717_000_000,
    paidAt: 1_717_000_100,
  }

  it('accepts a well-formed canonical row', () => {
    expect(OrderRowSchema.safeParse(row).success).toBe(true)
  })

  it('rejects legacy display fields (strict)', () => {
    expect(OrderRowSchema.safeParse({ ...row, short: '0xab…cd' }).success).toBe(false)
  })

  it('rejects a non-integer timestamp', () => {
    expect(OrderRowSchema.safeParse({ ...row, paidAt: 1.5 }).success).toBe(false)
  })
})

describe('OrderListResponseSchema (offset pagination)', () => {
  const statusCounts = { all: 0, pending: 0, paid: 0, partial: 0, refunded: 0, expired: 0 }

  it('accepts offset/total/limit + statusCounts and no cursor', () => {
    const res = { items: [], total: 0, offset: 0, limit: 20, statusCounts }
    expect(OrderListResponseSchema.safeParse(res).success).toBe(true)
  })

  it('rejects a missing statusCounts (mandatory)', () => {
    const res = { items: [], total: 0, offset: 0, limit: 20 }
    expect(OrderListResponseSchema.safeParse(res).success).toBe(false)
  })

  it('rejects a legacy nextCursor field', () => {
    const res = { items: [], total: 0, offset: 0, limit: 20, statusCounts, nextCursor: null }
    expect(OrderListResponseSchema.safeParse(res).success).toBe(false)
  })
})

describe('DashChainSchema (tightened to KNOWN_DASH_CHAINS)', () => {
  it('derives the chain set from SCOPE_CHAINS', () => {
    expect(KNOWN_DASH_CHAINS).toEqual(['bsc', 'ethereum', 'bsc-testnet'])
  })

  it('accepts known chains, rejects unknown', () => {
    expect(DashChainSchema.safeParse('bsc').success).toBe(true)
    expect(DashChainSchema.safeParse('ethereum').success).toBe(true)
    expect(DashChainSchema.safeParse('bsc-testnet').success).toBe(true)
    expect(DashChainSchema.safeParse('polygon').success).toBe(false)
    expect(DashChainSchema.safeParse('').success).toBe(false)
  })
})

describe('OrderDetailSchema', () => {
  it('requires refundEvents array + detail-only fields', () => {
    const detail = {
      orderId: `0x${'ab'.repeat(32)}`,
      chain: 'bsc',
      merchant: '0x2222222222222222222222222222222222222222',
      payer: '0x1111111111111111111111111111111111111111',
      receiver: '0x2222222222222222222222222222222222222222',
      router: '0x3333333333333333333333333333333333333333',
      tokenAddress: '0x55d398326f99059ff775485246999027b3197955',
      tokenSymbol: 'USDT',
      tokenDecimals: 18,
      amount: '49.5',
      paidAmount: '49.5',
      refundedAmount: '0.225',
      refundableAmount: '49.275',
      priceUsd: '1',
      status: 'partial' as const,
      createdAt: 1_717_000_000,
      paidAt: 1_717_000_100,
      expiresAt: 1_717_003_600,
      payTxHash: `0x${'cd'.repeat(32)}`,
      refundEvents: [
        {
          chain: 'bsc',
          amount: '0.225',
          tokenAddress: '0x55d398326f99059ff775485246999027b3197955',
          tokenSymbol: 'USDT',
          tokenDecimals: 18,
          txHash: `0x${'ef'.repeat(32)}`,
          logIndex: 3,
          blockTime: 1_717_000_200,
          priceUsd: '1',
        },
      ],
    }
    expect(OrderDetailSchema.safeParse(detail).success).toBe(true)
  })
})
