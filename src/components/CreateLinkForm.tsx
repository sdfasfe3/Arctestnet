import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { api, shortAddress } from '@/lib/payments'

export function CreateLinkForm({ merchant }: { merchant: string }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')

  const create = useMutation({
    mutationFn: () => api.create({ merchant, title, amount, memo }),
    onSuccess: () => {
      setTitle('')
      setAmount('')
      setMemo('')
      void qc.invalidateQueries({ queryKey: ['invoices', merchant] })
      toast.success('Payment link created')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const ready = title.trim().length > 0 && Number(amount) > 0

  return (
    <form
      className="card rounded-3xl p-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready) create.mutate()
      }}
    >
      <h2 className="display mb-1 text-lg font-bold">New payment link</h2>
      <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>
        Payments go straight to your wallet {shortAddress(merchant)}.
      </p>

      <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--muted)' }} htmlFor="title">
        What is it for
      </label>
      <input
        id="title"
        className="field mb-3 text-sm"
        placeholder="Logo design, Order 1042..."
        maxLength={60}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--muted)' }} htmlFor="amount">
        Amount
      </label>
      <div className="inner mb-3 flex items-baseline gap-2 rounded-2xl px-4 py-3">
        <input
          id="amount"
          inputMode="decimal"
          placeholder="0.00"
          className="display w-full bg-transparent text-3xl font-bold tabular-nums outline-none placeholder:text-slate-300"
          value={amount}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, '')
            if (/^\d*\.?\d{0,6}$/.test(v)) setAmount(v)
          }}
        />
        <span className="text-sm font-medium" style={{ color: 'var(--subtle)' }}>
          USDC
        </span>
      </div>

      <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--muted)' }} htmlFor="memo">
        Note (optional)
      </label>
      <input
        id="memo"
        className="field mb-4 text-sm"
        placeholder="Shown to the payer"
        maxLength={140}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
      />

      <button type="submit" className="btn-primary" disabled={!ready || create.isPending}>
        <span className="flex items-center justify-center gap-2">
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {create.isPending ? 'Creating...' : 'Create payment link'}
        </span>
      </button>
    </form>
  )
}
