/**
 * Standard Webhooks signing primitive (https://www.standardwebhooks.com).
 *
 * This is the MERCHANT-facing webhook signature — per-merchant symmetric secret,
 * carried in headers, base64-encoded HMAC. It is deliberately SEPARATE from the
 * internal proxyAuth protocol in `signature.ts` (`ApiSignatureUtil`, sorted-keys
 * body, 0x-hex HMAC, shared `PROXY_AUTH_SALT`). Do not conflate the two: mixing
 * them is the cross-merchant-forgery bug this module exists to kill.
 *
 * Signed content (exact byte order): `${webhookId}.${timestampSec}.${rawBody}`
 *   - timestamp is UNIX SECONDS (not ms).
 *   - rawBody is the EXACT transmitted bytes — never re-serialized JSON.
 *   - signature = base64( HMAC-SHA256(secretBytes, signedContent) ).
 *
 * Web Crypto only, so this runs identically in Cloudflare Workers, Node 18+, and
 * the browser.
 */

export const WEBHOOK_SIGNATURE_VERSION = 'v1'

/** Standard Webhooks symmetric-secret prefix. The bytes after it are base64. */
export const WEBHOOK_SECRET_PREFIX = 'whsec_'

const encoder = new TextEncoder()

function toBytes(s: string): Uint8Array {
  return encoder.encode(s)
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * Standard Webhooks secret → raw HMAC key bytes.
 *   - `whsec_<base64>`  → strict base64-decode the suffix (throws on invalid).
 *   - any other string  → raw UTF-8 bytes (NO base64 guessing, so two distinct
 *     secret strings can never collapse to the same key — the aliasing hole).
 * Throws on an empty/zero-length key so a blank secret never reaches WebCrypto.
 */
function secretToKeyBytes(secret: string): Uint8Array {
  if (secret.startsWith(WEBHOOK_SECRET_PREFIX)) {
    const decoded = base64ToBytes(secret.slice(WEBHOOK_SECRET_PREFIX.length))
    if (decoded.length === 0) throw new Error('empty webhook signing secret')
    return decoded
  }
  if (secret.length === 0) throw new Error('empty webhook signing secret')
  return toBytes(secret)
}

async function hmacSha256(keyBytes: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msg as BufferSource)
  return new Uint8Array(sig)
}

/** Constant-time string compare (assumes both base64 of equal length on a match). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

/** Globally-unique webhook id / merchant idempotency key: `${chain}:${txHash}:${logIndex}`. */
export function webhookId(chain: string, txHash: string, logIndex: number | string): string {
  return `${chain}:${txHash}:${logIndex}`
}

export interface SignWebhookInput {
  webhookId: string
  /** UNIX SECONDS. */
  timestamp: number
  /** Exact transmitted body — sign these bytes, never a re-serialized object. */
  payload: string | Uint8Array
  secret: string
}

/** Compute the base64 HMAC signature for one secret (no `v1,` prefix). */
export async function signWebhook(input: SignWebhookInput): Promise<string> {
  const prefix = toBytes(`${input.webhookId}.${input.timestamp}.`)
  const body = typeof input.payload === 'string' ? toBytes(input.payload) : input.payload
  const msg = new Uint8Array(prefix.length + body.length)
  msg.set(prefix, 0)
  msg.set(body, prefix.length)
  const mac = await hmacSha256(secretToKeyBytes(input.secret), msg)
  return bytesToBase64(mac)
}

export interface WebhookHeadersInput {
  webhookId: string
  /** UNIX SECONDS. */
  timestamp: number
  /** One base64 signature per active secret (current first, then rotating-out). */
  signatures: string[]
}

/**
 * Build the three Standard Webhooks headers. `webhook-signature` is a
 * space-separated list of `v1,<b64>` — one entry per active secret, so a
 * rotation overlap is delivered without downtime.
 */
export function buildWebhookHeaders(input: WebhookHeadersInput): {
  'webhook-id': string
  'webhook-timestamp': string
  'webhook-signature': string
} {
  return {
    'webhook-id': input.webhookId,
    'webhook-timestamp': String(input.timestamp),
    'webhook-signature': input.signatures.map((s) => `${WEBHOOK_SIGNATURE_VERSION},${s}`).join(' '),
  }
}

/** Parse a `webhook-signature` header into the base64 sigs tagged `v1`. */
export function parseSignatureHeader(header: string): string[] {
  return header
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const comma = part.indexOf(',')
      if (comma < 0) return null
      const version = part.slice(0, comma)
      const sig = part.slice(comma + 1)
      return version === WEBHOOK_SIGNATURE_VERSION ? sig : null
    })
    .filter((s): s is string => s !== null)
}

export interface VerifyWebhookSignatureInput {
  webhookId: string
  /** UNIX SECONDS. */
  timestamp: number
  payload: string | Uint8Array
  /** Raw `webhook-signature` header value (may carry multiple `v1,` entries). */
  signatureHeader: string
  /** Merchant's active secret(s) — current plus any in rotation overlap. */
  secrets: string[]
}

/**
 * Pure signature check: passes if ANY `v1,` entry in the header matches the HMAC
 * computed under ANY supplied secret (rotation overlap). Timestamp/replay
 * tolerance is the caller's responsibility (see SDK `verifyWebhook`).
 */
export async function verifyWebhookSignature(input: VerifyWebhookSignatureInput): Promise<boolean> {
  const presented = parseSignatureHeader(input.signatureHeader)
  if (presented.length === 0 || input.secrets.length === 0) return false

  for (const secret of input.secrets) {
    let expected: string
    try {
      expected = await signWebhook({
        webhookId: input.webhookId,
        timestamp: input.timestamp,
        payload: input.payload,
        secret,
      })
    } catch {
      // Malformed/empty stored secret → fail closed for that secret, never throw.
      continue
    }
    for (const sig of presented) {
      if (timingSafeEqual(expected, sig)) return true
    }
  }
  return false
}
