# @beampay/demo-signer

Reference self-hosted merchant signer (Cloudflare Worker) for the BeamPay checkout demo. Wraps [`@beampay/signer`](../../packages/signer). Holds the **demo merchant's own** BSC-testnet burner key — **not** a BeamPay protocol key; the protocol stays zero-key/non-custodial.

One endpoint serves both flows:
- **Pull (Mode C)** — the checkout widget calls `POST /sign` per checkout with the order amount.
- **Push (Mode A/B)** — the merchant calls `POST /sign` once and shares the result (inline / pay link).

## Endpoints

Both endpoints return the unified BeamPay envelope `{ code, msg, data, timestamp }`
(matches `beampay-api`; `code: "000000000"` = success, `data` holds the payload).

- `GET /health` → `{ "code": "000000000", "msg": "ok", "data": { "ok": true }, "timestamp": … }`
- `POST /sign` body `{ "amount": "4500000", "merchant": "0x…", "receiver": "0x…", "token"?, "orderId"?, "createdAt"?, "expiresAt"?, "feeBps"?, "memo"? }`
  → `data` is a validated `OrderEnvelope`. `amount` (wei string), `merchant` and `receiver` are
  required; the rest fall back to a server default (`token` = the demo store token,
  fresh `orderId`, `now + TTL`).
  Failures return a non-`000000000` `code` (`"400"` invalid order, `"500"` signer misconfigured) with `data: null`.
  **Demo only:** it signs whatever the caller sends — a production signer MUST authenticate the
  caller and validate the amount/receiver before signing.

## Run locally

```bash
cp .dev.vars.example .dev.vars      # then put a BSC-testnet burner key in MERCHANT_SIGNER_PRIVATE_KEY
pnpm --filter @beampay/demo-signer dev
curl -s localhost:8787/sign -H 'content-type: application/json' \
  -d '{"amount":"4500000","merchant":"0xYourMerchantAddr","receiver":"0xYourMerchantAddr"}'
```

## Deploy

```bash
wrangler secret put MERCHANT_SIGNER_PRIVATE_KEY    # paste the burner key (never committed)
pnpm --filter @beampay/demo-signer deploy
```

The merchant `receiver` is the burner key's own address (self-sign). Delegate signing (an on-chain `setSigner` authorized key) is a later hardening step.
