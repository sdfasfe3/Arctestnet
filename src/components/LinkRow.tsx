import { Check, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { formatUsd, shortAddress, txUrl, type Invoice } from '@/lib/payments'

interface Props {
  invoice: Invoice
  shareBase: string | null
  onOpen: (id: string) => void
}

export function LinkRow({ invoice, shareBase, onOpen }: Props) {
  const paid = invoice.status === 'paid'

  const copy = async () => {
    if (!shareBase) return
    try {
      await navigator.clipboard.writeText(`${shareBase}/?inv=${invoice.id}`)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <li className="inner rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{invoice.title}</p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--subtle)' }}>
            {new Date(invoice.createdAt).toLocaleDateString()}
            {paid && invoice.payer ? ` · from ${shortAddress(invoice.payer)}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="display text-lg font-bold tabular-nums">{formatUsd(invoice.amountRaw)}</p>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{
              color: paid ? 'var(--success)' : 'var(--muted)',
              background: paid ? 'rgba(26,128,71,0.12)' : 'var(--surface-muted)',
            }}
          >
            {paid && <Check className="size-3" />}
            {paid ? 'Paid' : 'Awaiting payment'}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {!paid && (
          <button className="btn-ghost inline-flex items-center gap-1.5" disabled={!shareBase} onClick={() => void copy()}>
            <Copy className="size-3.5" /> Copy link
          </button>
        )}
        <button className="btn-ghost" onClick={() => onOpen(invoice.id)}>
          {paid ? 'View receipt' : 'Preview checkout'}
        </button>
        {paid && invoice.txHash && (
          <a
            className="btn-ghost inline-flex items-center gap-1.5 leading-9"
            href={txUrl(invoice.txHash)}
            target="_blank"
            rel="noreferrer"
          >
            Explorer <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    </li>
  )
}
