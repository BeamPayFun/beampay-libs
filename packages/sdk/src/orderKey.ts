import { encodeAbiParameters, keccak256, parseAbiParameters } from 'viem'

/**
 * Deterministically derive a candidate contract `orderId` from order params.
 *
 * Solidity equivalent:
 *   keccak256(abi.encode(merchant, token, amount, salt))
 *
 * NOTE: this is the merchant-facing contract orderId (the pay/refund call
 * parameter), NOT the global order key. For the global key use deriveOrderKey.
 */
export interface DeriveOrderIdArgs {
  merchant: string
  token: string
  amount: bigint | string | number
  salt: string
}

export function deriveOrderId({ merchant, token, amount, salt }: DeriveOrderIdArgs): string {
  return keccak256(
    encodeAbiParameters(parseAbiParameters('address, address, uint256, bytes32'), [
      merchant as `0x${string}`,
      token as `0x${string}`,
      BigInt(amount),
      salt as `0x${string}`,
    ]),
  )
}

/**
 * Derive the global unique order key.
 *
 * Solidity equivalent:
 *   keccak256(abi.encode(uint256 chainId, address merchant, bytes32 orderId))
 *
 * This is the platform-wide unique reference (folds chainId in), used as the
 * REST resource key and order↔refund join key. Must stay byte-identical to
 * beampay-cron's deriveOrderKey — guarded by a shared test vector.
 */
export interface DeriveOrderKeyArgs {
  chainId: number | bigint
  merchant: string
  orderId: string
}

export function deriveOrderKey({ chainId, merchant, orderId }: DeriveOrderKeyArgs): string {
  return keccak256(
    encodeAbiParameters(parseAbiParameters('uint256, address, bytes32'), [
      BigInt(chainId),
      merchant as `0x${string}`,
      orderId as `0x${string}`,
    ]),
  )
}
