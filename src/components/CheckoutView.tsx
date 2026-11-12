import { useEffect, useRef } from 'react'
import { erc20Abi } from 'viem'
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ConnectKitButton } from 'connectkit'
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  api,
  ARC_CHAIN_ID,
  formatUsd,
  parseOnchainError,
  shortAddress,
  txUrl,
  USDC_ADDRESS,
  type Invoice,
} from '@/lib/payments'

export function CheckoutView({ id }: { id: string }) {
  const qc = useQueryClient()
  const { address, chainId, isConnected } = useAccount()
  const { switchChain, isPending: switching } = useSwitchChain()

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get(id),
    retry: false,
    refetchInterval: (q) => (q.state.data?.status === 'open' ? 5000 : false),
  })

  const amount = invoice ? BigInt(invoice.amountRaw) : 0n

  const { data: balance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 8000 },
  })

  const { writeContract, data: hash, isPending: signing, error: writeError, reset } = useWriteContract()
  const { isLoading: mining, isSuccess: mined, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    chainId: ARC_CHAIN_ID,
  })

  const confirm = useMutation({
    mutationFn: (txHash: string) => api.confirm(id, txHash),
    onSuccess: (inv: Invoice) => {
      qc.setQueryData(['invoice', id], inv)
      toast.success('Payment confirmed')
    },
  })

  const submitted = useRef<string | null>(null)
  const { mutate: confirmPayment } = confirm
  useEffect(() => {
    if (mined && hash && submitted.current !== hash) {
      submitted.current = hash
      confirmPayment(hash)
    }
  }, [mined, hash, confirmPayment])

  if (isLoading) {
    return <div className="card h-64 animate-pulse rounded-3xl" />
  }
  if (error || !invoice) {
    return (
      <section className="card rounded-3xl p-6 text-center">
        <h1 className="display mb-2 text-xl font-bold">Payment link not found</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          This link may be wrong or expired. Ask the sender for a new one.
        </p>
      </section>
    )
  }

  const paid = invoice.status === 'paid'
  const wrongChain = isConnected && chainId !== ARC_CHAIN_ID
  const insufficient = balance !== undefined && balance < amount
  const errorText = writeError ? parseOnchainError(writeError) : receiptError ? parseOnchainError(receiptError) : null

  const pay = () => {
    if (wrongChain) {
      switchChain({ chainId: ARC_CHAIN_ID })
      return
    }
    reset()
    writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [invoice.merchant as `0x${string}`, amount],
      chainId: ARC_CHAIN_ID,
    })
  }

  const busy = signing || mining || confirm.isPending || switching

  return (
    <section className="card overflow-hidden rounded-3xl">
      <div className="h-1" style={{ background: 'var(--spectral)' }} />
      <div className="p-5">
        <p className="text-xs font-semibold uppercase" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
          Pay {shortAddress(invoice.merchant)}
        </p>
        <h1 className="display mt-1 text-balance text-xl font-bold">{invoice.title}</h1>

        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="display text-5xl font-bold tabular-nums">{formatUsd(invoice.amountRaw)}</span>
          <span className="text-lg font-medium" style={{ color: 'var(--subtle)' }}>
            USDC
          </span>
        </div>
        {invoice.memo && (
          <p className="mt-2 text-pretty text-sm" style={{ color: 'var(--muted)' }}>
            {invoice.memo}
          </p>
        )}

        {paid ? (
          <div className="inner mt-5 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--success)' }}>
              <CheckCircle2 className="size-5" /> Paid and confirmed
            </div>
            {invoice.payer && (
              <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                From {shortAddress(invoice.payer)} on {invoice.paidAt ? new Date(invoice.paidAt).toLocaleString() : ''}
              </p>
            )}
            {invoice.txHash && (
              <a
                href={txUrl(invoice.txHash)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold"
                style={{ color: 'var(--accent-hover)' }}
              >
                View on ArcScan <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <dl className="inner space-y-2 rounded-2xl p-4 text-xs">
              <div className="flex justify-between">
                <dt style={{ color: 'var(--muted)' }}>Network</dt>
                <dd className="font-semibold">Arc Testnet</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: 'var(--muted)' }}>Network fee</dt>
                <dd className="font-semibold">Paid in USDC</dd>
              </div>
              {balance !== undefined && (
                <div className="flex justify-between">
                  <dt style={{ color: 'var(--muted)' }}>Your USDC balance</dt>
                  <dd className="font-semibold tabular-nums">{formatUsd(balance)}</dd>
                </div>
              )}
            </dl>

            {!isConnected ? (
              <div className="flex justify-center">
                <ConnectKitButton label="Connect wallet to pay" />
              </div>
            ) : (
              <button className="btn-primary" disabled={busy || (!wrongChain && insufficient)} onClick={pay}>
                {wrongChain ? (
                  'Switch to Arc Testnet'
                ) : signing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> Confirm in wallet...
                  </span>
                ) : mining ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> Confirming onchain...
                  </span>
                ) : confirm.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> Verifying payment...
                  </span>
                ) : insufficient ? (
                  'Insufficient USDC balance'
                ) : (
                  `Pay ${formatUsd(invoice.amountRaw)} USDC`
                )}
              </button>
            )}

            {insufficient && !wrongChain && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Use "Get test USDC" in the sidebar to fund your wallet, then come back.
              </p>
            )}
            {errorText && (
              <p className="text-xs" style={{ color: 'var(--danger)' }}>
                {errorText}
              </p>
            )}
            {confirm.error && hash && (
              <div className="text-xs" style={{ color: 'var(--danger)' }}>
                {confirm.error.message}{' '}
                <button className="font-semibold underline" onClick={() => confirm.mutate(hash)}>
                  Retry verification
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
