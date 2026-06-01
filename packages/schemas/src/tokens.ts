export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as const

export interface TokenMeta {
  chain: string
  address: string
  symbol: string
  name: string
  decimals: number
  color: string
  isNative?: boolean
}

const tokenList: TokenMeta[] = [
  {
    chain: 'bsc',
    address: NATIVE_TOKEN_ADDRESS,
    symbol: 'BNB',
    name: 'BNB',
    decimals: 18,
    color: '#F0B90B',
    isNative: true,
  },
  {
    chain: 'bsc',
    address: '0x55d398326f99059fF775485246999027B3197955',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 18,
    color: '#26A17B',
  },
  {
    chain: 'bsc',
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 18,
    color: '#2775CA',
  },
  {
    chain: 'ethereum',
    address: NATIVE_TOKEN_ADDRESS,
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
    color: '#627EEA',
    isNative: true,
  },
  {
    chain: 'ethereum',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    color: '#26A17B',
  },
  {
    chain: 'ethereum',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    color: '#2775CA',
  },
  {
    chain: 'ethereum',
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    color: '#F4B731',
  },
  {
    chain: 'bsc-testnet',
    address: NATIVE_TOKEN_ADDRESS,
    symbol: 'BNB',
    name: 'tBNB',
    decimals: 18,
    color: '#F0B90B',
    isNative: true,
  },
  {
    chain: 'bsc-testnet',
    address: '0x0c6DfFCbb941d2fDec9c8107e8128dcb6651951c',
    symbol: 'tUSDT',
    name: 'Mock Tether USD',
    decimals: 6,
    color: '#26A17B',
  },
  {
    chain: 'bsc-testnet',
    address: '0x44a25C4cbe72a249866B6750F8594ba170a653fC',
    symbol: 'tUSDC',
    name: 'Mock USD Coin',
    decimals: 6,
    color: '#2775CA',
  },
]

const tokensByKey: Record<string, TokenMeta> = Object.fromEntries(
  tokenList.map((t) => [`${t.chain}:${t.address.toLowerCase()}`, t]),
)

export function lookupToken(chain: string, address: string): TokenMeta | undefined {
  return tokensByKey[`${chain}:${address.toLowerCase()}`]
}

export function lookupTokensByChain(chain: string): TokenMeta[] {
  return tokenList.filter((t) => t.chain === chain)
}

export function isNativeAddress(address: string): boolean {
  return address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
}

const fallbackColor = '#8b91a7'

export function formatTokenAmount(
  rawAmount: string,
  decimals: number,
  maxFractionDigits = 2,
): string {
  if (!rawAmount) return '0'
  const negative = rawAmount.startsWith('-')
  const digits = negative ? rawAmount.slice(1) : rawAmount
  if (!/^\d+$/.test(digits)) return rawAmount
  const padded = digits.padStart(decimals + 1, '0')
  const intPart = padded.slice(0, padded.length - decimals)
  let fracPart = padded.slice(padded.length - decimals)
  if (maxFractionDigits < decimals) {
    fracPart = fracPart.slice(0, maxFractionDigits)
  }
  fracPart = fracPart.replace(/0+$/, '')
  const intWithCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const out = fracPart ? `${intWithCommas}.${fracPart}` : intWithCommas
  return negative ? `-${out}` : out
}

/**
 * Canonical wire money: raw wei integer string → decimal string.
 * No thousands separators, no rounding, full token precision, trailing zeros
 * trimmed, never empty (`'0'`). Preserves a leading `-` (net amounts can be
 * negative). This is the machine contract value — the frontend formats it for
 * display; do NOT round or group here.
 */
export function toTokenDecimalString(rawWei: string, decimals: number): string {
  if (!rawWei) return '0'
  const negative = rawWei.startsWith('-')
  const digits = negative ? rawWei.slice(1) : rawWei
  if (!/^\d+$/.test(digits)) return '0'
  const padded = digits.padStart(decimals + 1, '0')
  const intPart = padded.slice(0, padded.length - decimals).replace(/^0+(?=\d)/, '')
  const fracPart = padded.slice(padded.length - decimals).replace(/0+$/, '')
  const out = fracPart ? `${intPart}.${fracPart}` : intPart
  if (out === '0') return '0'
  return negative ? `-${out}` : out
}

export function tokenSymbolOrFallback(chain: string, address: string): string {
  return lookupToken(chain, address)?.symbol ?? `${address.slice(0, 6)}…`
}

export function tokenDecimalsOrFallback(chain: string, address: string): number {
  return lookupToken(chain, address)?.decimals ?? 18
}

export function tokenColorOrFallback(chain: string, address: string): string {
  return lookupToken(chain, address)?.color ?? fallbackColor
}
