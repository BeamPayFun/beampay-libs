# @beampay/schemas

## 0.9.0

### Minor Changes

- Split the conflated order identifier into two distinct, consistently-named fields:

  - `orderKey` — global unique key = `keccak256(abi.encode(chainId, merchant, orderId))`. REST resource key + order↔refund join key.
  - `orderId` — contract event orderId (merchant-chosen bytes32); the on-chain pay/refund parameter; unique per (merchant, chain).

  **Breaking changes**

  - `@beampay/schemas`
    - `OrderRowSchema` / `OrderDetailSchema`: add `orderKey`; `OrderDetailSchema` drops `refundEvents` (now a separate refunds list).
    - New `RefundListResponseSchema` (`RefundEvent[]`) for `GET /v1/orders/:orderKey/refunds`.
    - `payment.ts`: removed `GetOrderQuerySchema` / `OrderResponseSchema` (the old `/v1/payment/order` route is gone); `CreateOrderBodySchema` retained.
    - `webhook.ts`: `PaymentWebhookBodySchema` → `OrderWebhookBodySchema` with top-level `orderKey` + `orderId`; `eventType` stays `['Payment','Refund']`.
  - `@beampay/sdk`
    - The old misnamed `deriveOrderKey({merchant, token, amount, salt})` is renamed `deriveOrderId` (implementation unchanged — it derives a contract orderId candidate).
    - `deriveOrderKey` now derives the **global** key: `deriveOrderKey({chainId, merchant, orderId})`. ⚠️ Same name, inverted meaning — guarded by a shared parity vector against beampay-cron.
    - `client.ts`: RESTful routes — `getOrder(orderKey)`, `getOrderRefunds(orderKey)`, `POST /v1/webhook/orders`; `createOrder` response is `{orderKey, orderId}`.

## 0.6.0

### Minor Changes

- dashboard: add `orderId` (full 32-byte order key) to `OrderRowSchema`

  The dashboard order wire previously carried only the abbreviated `short` key and a derived `id`. Adding the full `orderId` lets the merchant dashboard execute on-chain refunds (`refund(orderId, amount)`) directly from an order row without the operator re-pasting the key.

## 0.5.0

### Minor Changes

- dashboard: add `priceUsd` + `refundedAmount` to `OrderRowSchema` and `'partial'` to `OrderRowStatusSchema`

  Carries the paid-time frozen USD price and cumulative refunded token amount through the dashboard order wire so the orders list can render refunded-USD = `refundedAmount × priceUsd` without a live price lookup. `partial` surfaces partially-refunded orders distinctly from fully `paid`.

## 0.1.0

### Minor Changes

- Initial public release of @beampay/\* packages.

  Rename scope from `@beam/*` to `@beampay/*` and publish to the public npm registry.
  Adds `publishConfig`, `repository`, `files`, `license`, and `description` fields to
  every package so they are installable via `pnpm add @beampay/<name>` from any consumer
  (beam-demo, beam-api, beam-cron, beam-web, beam-checkout).
