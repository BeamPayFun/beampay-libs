import { ApiSignatureUtil, BaseResponse } from '@beampay/common'
import type { OrderDetail, OrderEnvelope, RefundEvent } from '@beampay/schemas'
import { Hono } from 'hono'
import { hc } from 'hono/client'

function generateSalt(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

// Minimal app type for hc inference — mirrors beam-api RESTful routes.
const _app = new Hono()
  .get('/v1/orders/:orderKey', (c) => c.json(BaseResponse.ok({} as OrderDetail).toJSON()))
  .get('/v1/orders/:orderKey/refunds', (c) => c.json(BaseResponse.ok([] as RefundEvent[]).toJSON()))
  .post('/v1/orders', (c) => c.json(BaseResponse.ok({ orderKey: '', orderId: '' }).toJSON()))
  .post('/v1/webhook/orders', (c) => c.json(BaseResponse.ok({ received: true }).toJSON()))

export type AppType = typeof _app

export class BeamPay {
  private client: ReturnType<typeof hc<AppType>>
  private secret: string
  private token?: string

  /**
   * @param apiUrl beam-api base URL
   * @param secret proxyAuth HMAC secret (signs every request — webhook/relay routes)
   * @param token  optional dashboard Bearer token, required by the tokenAuth order
   *               routes (`/v1/orders`, `/v1/orders/:orderKey(/refunds)`)
   */
  constructor({ apiUrl, secret, token }: { apiUrl: string; secret: string; token?: string }) {
    this.secret = secret
    this.token = token
    this.client = hc<AppType>(apiUrl, {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(input.toString())
        const timestamp = Date.now()
        const recvWindow = 5000
        const salt = generateSalt()

        const query: Record<string, unknown> = {}
        url.searchParams.forEach((v, k) => {
          query[k] = v
        })

        let body: Record<string, unknown> | undefined
        if (init?.body && typeof init.body === 'string') {
          try {
            body = JSON.parse(init.body)
          } catch {
            // non-JSON body, ignore
          }
        }

        const message = ApiSignatureUtil.getSignatureStr({
          query,
          body,
          salt,
          timestamp,
          recvWindow,
        })
        const signature = await ApiSignatureUtil.sign(message, this.secret)

        url.searchParams.set('timestamp', String(timestamp))
        url.searchParams.set('recvWindow', String(recvWindow))
        url.searchParams.set('salt', salt)
        url.searchParams.set('signature', signature)

        // tokenAuth routes need a Bearer token; proxyAuth routes ignore it.
        const headers = this.token
          ? { ...(init?.headers ?? {}), authorization: `Bearer ${this.token}` }
          : init?.headers
        return fetch(url.toString(), { ...init, headers })
      },
    })
  }

  /** Look up a single order by its global order key. */
  async getOrder(orderKey: string) {
    const res = await this.client.v1.orders[':orderKey'].$get({ param: { orderKey } })
    return (await res.json()) as ReturnType<BaseResponse<OrderDetail>['toJSON']>
  }

  /** List refund events for an order (newest-first). */
  async getOrderRefunds(orderKey: string) {
    const res = await this.client.v1.orders[':orderKey'].refunds.$get({ param: { orderKey } })
    return (await res.json()) as ReturnType<BaseResponse<RefundEvent[]>['toJSON']>
  }

  /**
   * Register a signed EIP-712 order envelope. The caller builds + signs the
   * envelope (the API recovers + verifies the signer); the SDK only relays it.
   * Returns the display `id` plus the global `orderKey` and contract `orderId`.
   */
  async createOrder(envelope: OrderEnvelope) {
    const res = await this.client.v1.orders.$post({ json: envelope })
    return (await res.json()) as ReturnType<
      BaseResponse<{ id: string; orderKey: string; orderId: string }>['toJSON']
    >
  }
}
