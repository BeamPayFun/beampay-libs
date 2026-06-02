import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Scope — the single source of truth for the mainnet/testnet ↔ chain mapping.
// cron filters its read model by this; api validates/forwards it; web derives it
// from the network selector. No downstream service may hardcode chain lists.
// ─────────────────────────────────────────────────────────────────────────────
export const DashboardScopeSchema = z.enum(['mainnet', 'testnet'])
export type DashboardScope = z.infer<typeof DashboardScopeSchema>

export const SCOPE_CHAINS: Record<DashboardScope, readonly string[]> = {
  mainnet: ['bsc', 'ethereum'],
  testnet: ['bsc-testnet'],
}

// Single source of truth for every dashboard chain id — derived from SCOPE_CHAINS,
// never a second hardcoded list. Downstream services import this instead of
// redefining their own chain enum (realizes the "no hardcoded chain lists" rule).
export const KNOWN_DASH_CHAINS = Object.values(SCOPE_CHAINS).flat() as [string, ...string[]]

export const DashChainSchema = z.enum(KNOWN_DASH_CHAINS)

export function chainsForScope(scope: DashboardScope): readonly string[] {
  return SCOPE_CHAINS[scope]
}

export function scopeForChain(chain: string): DashboardScope {
  return chain === 'bsc-testnet' ? 'testnet' : 'mainnet'
}

export const KpiEntrySchema = z
  .object({
    value: z.string(),
    sym: z.string(),
    delta: z.string(),
  })
  .strict()

export const TokenSplitEntrySchema = z
  .object({
    sym: z.string(),
    pct: z.number().min(0).max(100),
    color: z.string(),
  })
  .strict()

export const ChainSplitEntrySchema = z
  .object({
    key: z.string(),
    name: z.string(),
    pct: z.number().min(0).max(100),
  })
  .strict()

export const SeriesEntrySchema = z
  .object({
    d: z.number().int(),
    v: z.number(),
    o: z.number().int(),
    r: z.number().int(),
  })
  .strict()

export const OrderRowStatusSchema = z.enum(['paid', 'partial', 'refunded', 'expired', 'pending'])

// ─────────────────────────────────────────────────────────────────────────────
// Order list row — canonical machine values only. All money is a canonical
// decimal string (no commas, no rounding, full precision); timestamps are unix
// seconds. The frontend owns every display transform (ellipsize, relative age,
// $/% formatting).
// ─────────────────────────────────────────────────────────────────────────────
export const OrderRowSchema = z
  .object({
    /**
     * Global unique order key (0x + 64 hex) = keccak256(abi.encode(chainId, merchant, orderId)).
     * REST resource key + order↔refund join key. Derived by cron, never on-chain.
     */
    orderKey: z.string(),
    /**
     * Contract event orderId (merchant-chosen bytes32) — the on-chain pay/refund
     * call parameter. Unique per (merchant, chain), not globally.
     */
    orderId: z.string(),
    chain: DashChainSchema,
    tokenAddress: z.string(),
    tokenSymbol: z.string(),
    tokenDecimals: z.number().int().nonnegative(),
    /** requested amount, canonical decimal */
    amount: z.string(),
    /** canonical decimal */
    paidAmount: z.string(),
    /** canonical decimal */
    refundedAmount: z.string(),
    /** max(0, paid - refunded), canonical decimal */
    refundableAmount: z.string(),
    /** full address */
    payer: z.string(),
    status: OrderRowStatusSchema,
    /** paid-time USD snapshot of one token unit, canonical decimal */
    priceUsd: z.string(),
    /** unix seconds */
    createdAt: z.number().int().nonnegative(),
    /** unix seconds, 0 if unpaid */
    paidAt: z.number().int().nonnegative(),
  })
  .strict()

export const RefundEventSchema = z
  .object({
    chain: DashChainSchema,
    /** canonical decimal */
    amount: z.string(),
    tokenAddress: z.string(),
    tokenSymbol: z.string(),
    tokenDecimals: z.number().int().nonnegative(),
    txHash: z.string(),
    logIndex: z.number().int().nonnegative(),
    /** unix seconds */
    blockTime: z.number().int().nonnegative(),
    /** refund-event USD snapshot of one token unit, canonical decimal */
    priceUsd: z.string(),
  })
  .strict()

export const OrderDetailSchema = z
  .object({
    /** Global unique order key — REST resource key. See OrderRowSchema. */
    orderKey: z.string(),
    /** Contract event orderId — on-chain pay/refund parameter. See OrderRowSchema. */
    orderId: z.string(),
    chain: DashChainSchema,
    merchant: z.string(),
    payer: z.string(),
    receiver: z.string(),
    /** BeamPayRouter address for this chain */
    router: z.string(),
    tokenAddress: z.string(),
    tokenSymbol: z.string(),
    tokenDecimals: z.number().int().nonnegative(),
    amount: z.string(),
    paidAmount: z.string(),
    refundedAmount: z.string(),
    refundableAmount: z.string(),
    /** paid-time USD snapshot (refundable USD basis), canonical decimal */
    priceUsd: z.string(),
    status: OrderRowStatusSchema,
    /** unix seconds */
    createdAt: z.number().int().nonnegative(),
    /** unix seconds, 0 if unpaid */
    paidAt: z.number().int().nonnegative(),
    /** unix seconds */
    expiresAt: z.number().int().nonnegative(),
    payTxHash: z.string(),
  })
  .strict()

// Refunds list response for GET /v1/orders/:orderKey/refunds (newest-first).
// Split out of OrderDetail — the detail view + refunds are fetched separately.
export const RefundListResponseSchema = z.array(RefundEventSchema)

export const BalanceSchema = z
  .object({
    sym: z.string(),
    name: z.string(),
    chain: DashChainSchema,
    balance: z.string(),
    usd: z.string(),
  })
  .strict()

export const MerchantStatsTotalsSchema = z
  .object({
    revenue: z.string(),
    refunds: z.string(),
    net: z.string(),
    payCount: z.number().int().nonnegative(),
    refundCount: z.number().int().nonnegative(),
  })
  .strict()

export const MerchantTokenStatSchema = z
  .object({
    tokenSymbol: z.string(),
    tokenAddress: z.string(),
    tokenDecimals: z.number().int().nonnegative(),
    chain: DashChainSchema,
    /** canonical decimal token amount */
    revenueQty: z.string(),
    refundsQty: z.string(),
    /** signed canonical decimal */
    netQty: z.string(),
    /** canonical numeric (no commas) */
    revenueUsd: z.string(),
    refundsUsd: z.string(),
    netUsd: z.string(),
    payCount: z.number().int().nonnegative(),
    refundCount: z.number().int().nonnegative(),
  })
  .strict()

export const MerchantEventSchema = z
  .object({
    type: z.enum(['Payment', 'Refunded']),
    token: z.string(),
    chain: DashChainSchema,
    amount: z.string(),
    order: z.string(),
    tx: z.string(),
    block: z.number().int().nonnegative(),
    age: z.string(),
  })
  .strict()

export const MerchantStatsSchema = z
  .object({
    fromBlock: z.number().int().nonnegative(),
    indexedThrough: z.number().int().nonnegative(),
    syncedAge: z.string(),
    totals: MerchantStatsTotalsSchema,
    tokens: z.array(MerchantTokenStatSchema),
    events: z.array(MerchantEventSchema),
  })
  .strict()

export const DashKpiSetSchema = z
  .object({
    gross: KpiEntrySchema,
    net: KpiEntrySchema,
    orders: KpiEntrySchema,
    refunds: KpiEntrySchema,
    success: KpiEntrySchema,
    aov: KpiEntrySchema,
  })
  .strict()

export const DashboardOverviewSchema = z
  .object({
    kpis: DashKpiSetSchema,
    tokenSplit: z.array(TokenSplitEntrySchema),
    chainSplit: z.array(ChainSplitEntrySchema),
    series: z.array(SeriesEntrySchema),
    peakHours: z.array(z.number()).length(24),
    recent: z.array(OrderRowSchema),
    balances: z.array(BalanceSchema),
    merchantStats: MerchantStatsSchema,
  })
  .strict()

// Per-status totals for the order list, computed server-side over the full
// scope+q+range filter set (independent of the selected status chip). Mandatory —
// pagination means the client sees one page only, so chip badge counts cannot be
// derived client-side. `all` = sum of the five buckets.
export const OrderStatusCountsSchema = z
  .object({
    all: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    paid: z.number().int().nonnegative(),
    partial: z.number().int().nonnegative(),
    refunded: z.number().int().nonnegative(),
    expired: z.number().int().nonnegative(),
  })
  .strict()

export const OrderListResponseSchema = z
  .object({
    items: z.array(OrderRowSchema),
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    statusCounts: OrderStatusCountsSchema,
  })
  .strict()

export type KpiEntry = z.infer<typeof KpiEntrySchema>
export type TokenSplitEntry = z.infer<typeof TokenSplitEntrySchema>
export type ChainSplitEntry = z.infer<typeof ChainSplitEntrySchema>
export type SeriesEntry = z.infer<typeof SeriesEntrySchema>
export type OrderRowStatus = z.infer<typeof OrderRowStatusSchema>
export type OrderRow = z.infer<typeof OrderRowSchema>
export type RefundEvent = z.infer<typeof RefundEventSchema>
export type OrderDetail = z.infer<typeof OrderDetailSchema>
export type RefundListResponse = z.infer<typeof RefundListResponseSchema>
export type Balance = z.infer<typeof BalanceSchema>
export type DashKpiSet = z.infer<typeof DashKpiSetSchema>
export type MerchantStatsTotals = z.infer<typeof MerchantStatsTotalsSchema>
export type MerchantTokenStat = z.infer<typeof MerchantTokenStatSchema>
export type MerchantEvent = z.infer<typeof MerchantEventSchema>
export type MerchantStats = z.infer<typeof MerchantStatsSchema>
export type DashboardOverview = z.infer<typeof DashboardOverviewSchema>
export type OrderStatusCounts = z.infer<typeof OrderStatusCountsSchema>
export type OrderListResponse = z.infer<typeof OrderListResponseSchema>
