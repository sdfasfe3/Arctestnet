import { arcTestnet } from 'viem/chains'
import { buildTxExplorerUrl, getUsdc } from '@/onchain-facts'
import { formatUsdc } from '@/onchain-money'

export const ARC_CHAIN_ID = arcTestnet.id

const usdcFact = getUsdc(ARC_CHAIN_ID)
if (!usdcFact) throw new Error('USDC is not available on Arc Testnet in the onchain facts')
export const USDC_ADDRESS = usdcFact.address as `0x${string}`

export interface Invoice {
  id: string
  merchant: string
  title: string
  memo: string
  amountRaw: string
  status: 'open' | 'paid'
  createdAt: number
  paidAt?: number
  payer?: string
  txHash?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json' },
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(data.error ?? 'Request failed')
  return data as T
}

export const api = {
  list: (merchant: string) => request<Invoice[]>(`/invoices?merchant=${merchant}`),
  get: (id: string) => request<Invoice>(`/invoices/${id}`),
  create: (input: { merchant: string; title: string; amount: string; memo: string }) =>
    request<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(input) }),
  confirm: (id: string, txHash: string) =>
    request<Invoice>(`/invoices/${id}/confirm`, { method: 'POST', body: JSON.stringify({ txHash }) }),
}

/** Formats a raw USDC amount as a dollar-style string with at least 2 decimals. */
export function formatUsd(raw: bigint | string): string {
  const s = formatUsdc(BigInt(raw))
  const [whole, frac = ''] = s.split('.')
  return `${whole}.${frac.padEnd(2, '0')}`
}

export const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

export const txUrl = (hash: string) => buildTxExplorerUrl(ARC_CHAIN_ID, hash)

export function parseOnchainError(error: unknown): string | null {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  if (message.includes('user rejected') || message.includes('user denied')) return null
  if (message.includes('insufficient funds') || message.includes('exceeds balance')) {
    return 'Insufficient USDC balance. Use "Get test USDC" in the sidebar, then try again.'
  }
  if (message.includes('reverted')) return 'The transaction failed onchain. Please try again.'
  if (message.includes('network') || message.includes('timeout')) return 'Network issue. Check your connection and retry.'
  return 'Something went wrong. Please try again.'
}
