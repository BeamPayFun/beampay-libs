import { verifyWebhookSignature } from '@beampay/common'

export interface WebhookHeaders {
  'webhook-id': string
  'webhook-timestamp': string
  'webhook-signature': string
}

export interface VerifyWebhookOptions {
  /** Merchant signing secret(s). Pass an array during a rotation overlap. */
  secret: string | string[]
  /** Replay tolerance in seconds (default 300). */
  toleranceSec?: number
}

/**
 * Verify a BeamPay merchant webhook (Standard Webhooks).
 *
 * Pass the EXACT received body bytes (`rawBody`) and the three `webhook-*`
 * headers. Auth is header-carried, never in the body — do NOT parse the body
 * first and re-serialize it; sign/verify operate on the transmitted bytes.
 *
 * Passes only if (a) the timestamp is within `toleranceSec` of now AND (b) some
 * `v1,` signature in the header matches the HMAC under some supplied secret.
 */
export async function verifyWebhook(
  rawBody: string | Uint8Array,
  headers: WebhookHeaders,
  opts: VerifyWebhookOptions,
): Promise<boolean> {
  const id = headers['webhook-id']
  const tsRaw = headers['webhook-timestamp']
  const sigHeader = headers['webhook-signature']
  if (!id || !tsRaw || !sigHeader) return false

  const timestamp = Number(tsRaw)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false

  const toleranceSec = opts.toleranceSec ?? 300
  // Guard NaN/Infinity/negative — `abs > NaN` is false, which would silently
  // disable the replay window.
  if (!Number.isFinite(toleranceSec) || toleranceSec < 0) return false
  const nowSec = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSec - timestamp) > toleranceSec) return false

  const secrets = Array.isArray(opts.secret) ? opts.secret : [opts.secret]

  return verifyWebhookSignature({
    webhookId: id,
    timestamp,
    payload: rawBody,
    signatureHeader: sigHeader,
    secrets,
  })
}
