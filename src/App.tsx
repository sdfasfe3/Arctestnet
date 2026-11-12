import { useCallback, useEffect, useState } from 'react'
import { Shell } from '@/components/Shell'
import { MerchantView } from '@/components/MerchantView'
import { CheckoutView } from '@/components/CheckoutView'

const INVOICE_ID = /^[a-f0-9]{12}$/

function readInvoiceId(): string | null {
  const id = new URLSearchParams(window.location.search).get('inv')
  return id && INVOICE_ID.test(id) ? id : null
}

export default function App() {
  const [invoiceId, setInvoiceId] = useState<string | null>(readInvoiceId)

  useEffect(() => {
    const onPop = () => setInvoiceId(readInvoiceId())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((id: string | null) => {
    window.history.pushState(null, '', id ? `/?inv=${id}` : '/')
    setInvoiceId(id)
  }, [])

  return (
    <Shell onHome={() => navigate(null)}>
      {invoiceId ? <CheckoutView id={invoiceId} /> : <MerchantView onOpen={navigate} />}
    </Shell>
  )
}
