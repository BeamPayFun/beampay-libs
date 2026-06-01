# @beampay/schemas

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
