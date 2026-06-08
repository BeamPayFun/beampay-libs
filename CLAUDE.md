# beam-libs developer notes

## Monorepo layout

- `packages/schemas` — Zod boundary schemas (no runtime deps except zod)
- `packages/common` — error codes, BaseResponse, ApiSignatureUtil, chain metadata (Web Crypto only)
- `packages/contracts-abi` — typed viem ABI + addresses + sync script
- `packages/sdk` — merchant SDK, depends on the other three packages + viem + hono

## Conventions

- Space indent, 100 line width, single quotes, as-needed semicolons (Biome)
- All packages build with `tsup` to `dist/`
- `src/index.ts` is the barrel export
- Tests live next to source (`test/*.test.ts`) and run with Vitest
- Web Crypto (`crypto.subtle`) is used for HMAC so code runs identically in Workers, Node 18+, and browser

## ABI sync

`packages/contracts-abi/scripts/sync-abi.ts` is a stub. A future CI step will:
1. Download the release artifact from `beam-contracts`
2. Overwrite `src/BeamPayRouter.abi.json`
3. Re-run `tsup` so the `as const` TS file is rebuilt

## Two signature protocols — do not conflate

There are **two unrelated** HMAC schemes. Mixing them (one shared secret signing
both) was the cross-merchant webhook-forgery bug; they are now fully separate.

### 1. Internal proxyAuth — `packages/common/src/signature.ts` (`ApiSignatureUtil`)

First-party `beampay-api` ↔ `beampay-cron`, byte-identical to `beam-monitor`/`cf-api`.
Shared secret `PROXY_AUTH_SALT` (renamed from `SIGNATURE_SALT`; value unchanged).

1. Filter out `signature` key
2. Sort keys lexicographically
3. JSON-stringify non-string values
4. HMAC-SHA256(`getSignatureStr(query)+getSignatureStr(body)`, `PROXY_AUTH_SALT`+salt) → **0x-hex**

Auth fields (`timestamp/recvWindow/salt/signature`) ride **in the body**. This is
also the shape of `OrderWebhookBodySchema` (the internal relay) — leave it intact.

### 2. Merchant webhook — `packages/common/src/webhook-signature.ts` (Standard Webhooks)

Per-merchant symmetric secret (`whsec_…`), one per merchant — no cross-merchant
trust. Spec: https://www.standardwebhooks.com.

- Signed content: `` `${webhookId}.${timestampSec}.${rawBody}` `` (UNIX **seconds**; exact transmitted bytes).
- `signature = base64( HMAC-SHA256(secretBytes, signedContent) )` — **base64, not 0x-hex**.
- Auth rides **in headers**: `webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<b64> v1,<b64prev>` (space-separated, one per active secret → zero-downtime rotation).
- `webhookId = ${chain}:${txHash}:${logIndex}` (globally unique + merchant idempotency key).
- Body schema: `MerchantWebhookEventSchema` in `packages/schemas` (NO auth fields in body).
- Merchant-side verify: `verifyWebhook(rawBody, headers, { secret, toleranceSec })` in `packages/sdk`.
