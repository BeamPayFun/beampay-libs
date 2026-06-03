# @beampay/demo-signer

Reference self-hosted merchant signer (Cloudflare Worker) for the BeamPay checkout demo. Wraps [`@beampay/signer`](../../packages/signer). Holds the **demo merchant's own** BSC-testnet burner key — **not** a BeamPay protocol key; the protocol stays zero-key/non-custodial.

One endpoint serves both flows:
- **Pull (Mode C)** — the checkout widget calls `POST /sign` per checkout with the cart.
- **Push (Mode A/B)** — the merchant calls `POST /sign` once and shares the result (inline / pay link).

## Endpoints

- `GET /health` → `{ ok: true }`
- `POST /sign` body `{ "items": { "mug": 1, "tee": 2 } }` → a validated `OrderEnvelope`.
  Price catalog + `receiver` + `token` are **server-locked** (client prices are never trusted).

## Run locally

```bash
cp .dev.vars.example .dev.vars      # then put a BSC-testnet burner key in MERCHANT_KEY
pnpm --filter @beampay/demo-signer dev
curl -s localhost:8787/sign -H 'content-type: application/json' -d '{"items":{"mug":1}}'
```

## Deploy

```bash
wrangler secret put MERCHANT_KEY    # paste the burner key (never committed)
pnpm --filter @beampay/demo-signer deploy
```

The merchant `receiver` is the burner key's own address (self-sign). Delegate signing (an on-chain `setSigner` authorized key) is a later hardening step.
