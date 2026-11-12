import { useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { ConnectKitButton } from 'connectkit'
import { Wallet } from 'lucide-react'
import { getShareBase } from '@/lib/share'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { api, ARC_CHAIN_ID, formatUsd } from '@/lib/payments'
import { CreateLinkForm } from '@/components/CreateLinkForm'
import { LinkRow } from '@/components/LinkRow'

export function MerchantView({ onOpen }: { onOpen: (id: string) => void }) {
  const { address } = useAccount()
  const [shareBase, setShareBase] = useState<string | null>(null)

  useEffect(() => {
    void getShareBase().then(setShareBase)
  }, [])

  const { data: invoices, isLoading, error } = useQuery({
    queryKey: ['invoices', address],
    queryFn: () => api.list(address as string),
    enabled: !!address,
    refetchInterval: 5000,
  })

  const stats = useMemo(() => {
    const decimals = usdcDecimalsFor(ARC_CHAIN_ID)
    const paid = (invoices ?? []).filter((i) => i.status === 'paid')
    const total = Amount.sum(
      paid.map((i) => Amount.fromRaw(BigInt(i.amountRaw), decimals)),
      decimals,
    )
    return { paidCount: paid.length, total: formatUsd(total.raw) }
  }, [invoices])

  if (!address) {
    return (
      <section className="card rounded-3xl p-6 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl" style={{ background: 'var(--surface-muted)' }}>
          <Wallet className="size-6" />
        </div>
        <h1 className="display mb-2 text-balance text-2xl font-bold">Get paid in USDC, instantly</h1>
        <p className="mx-auto mb-5 max-w-[34ch] text-pretty text-sm" style={{ color: 'var(--muted)' }}>
          Connect your wallet, create a payment link, and share it. Payments settle on Arc Testnet straight into your wallet.
        </p>
        <div className="flex justify-center">
          <ConnectKitButton label="Connect wallet" />
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden rounded-3xl">
        <div className="h-1" style={{ background: 'var(--spectral)' }} />
        <div className="p-5">
          <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
            Received through payment links
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="display text-4xl font-bold tabular-nums">{isLoading ? '...' : stats.total}</span>
            <span className="text-lg font-medium" style={{ color: 'var(--subtle)' }}>
              USDC
            </span>
          </div>
          <p className="mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>
            {stats.paidCount} paid · Arc Testnet
          </p>
        </div>
      </section>

      <CreateLinkForm merchant={address} />

      <section>
        <h2 className="display mb-3 px-1 text-lg font-bold">Your links</h2>
        {error && (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>
            Could not load your links. The payments service may be restarting.
          </p>
        )}
        {!isLoading && !error && invoices?.length === 0 && (
          <p className="inner rounded-2xl p-4 text-sm" style={{ color: 'var(--muted)' }}>
            No links yet. Create your first one above.
          </p>
        )}
        <ul className="space-y-3">
          {invoices?.map((inv) => (
            <LinkRow key={inv.id} invoice={inv} shareBase={shareBase} onOpen={onOpen} />
          ))}
        </ul>
      </section>
    </div>
  )
}
