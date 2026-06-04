# @beampay/signer

Reference EIP-712 order signer for BeamPay merchants. **You self-host it; BeamPay holds zero keys** — the protocol's non-custodial invariant is preserved.

A merchant backend uses this to sign a v1.4 `Order` so a buyer can pay it through `@beampay/checkout` without the merchant wallet touching every transaction.

## Usage

```ts
import { signOrder, newOrderId } from '@beampay/signer'

const envelope = await signOrder({
  privateKey: process.env.MERCHANT_KEY as `0x${string}`, // KMS/secret — never client-side
  chain: 'bsc-testnet',
  merchant: '0x…',     // order owner / refund caller
  receiver: '0x…',     // payout destination
  token: '0x…',        // ERC-20 or NATIVE_TOKEN sentinel
  amount: '1500000',   // wei (compute server-side from the cart — never trust client prices)
  orderId: newOrderId(),
  createdAt: Math.floor(Date.now() / 1000),
  expiresAt: Math.floor(Date.now() / 1000) + 3600, // short TTL for pull/checkout sessions
})
// → OrderEnvelope, validated by @beampay/schemas OrderEnvelopeSchema
```

## Self-sign vs delegate

- **Self-sign** — the key's address equals `merchant`; the contract accepts it directly. `isDelegate === false`. No on-chain setup.
- **Delegate** — a backend key authorized on-chain via `BeamPayRouter.setSigner(delegate)`; `signer !== merchant`, `isDelegate === true`. Lets a hot key sign without the merchant wallet.

`feeBps` is carried for display/forwarding only — it is **not** part of the signed EIP-712 struct.

## Security

- Keep the private key in a secret store (CF secret, KMS) — never in source, never client-side.
- Lock `receiver` / `token` / amount limits server-side; compute `amount` from the cart.
- Use a short `expiresAt` TTL to bound a leaked hot key's blast radius (only in-flight orders; the contract holds no funds).
