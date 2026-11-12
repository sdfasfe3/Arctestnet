import type { ReactNode } from 'react'
import { ConnectKitButton } from 'connectkit'
import { TokenUSDC } from '@web3icons/react'

export function Shell({ children, onHome }: { children: ReactNode; onHome: () => void }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md px-4 pb-24 pt-5">
      <header className="mb-6 flex items-center justify-between">
        <button onClick={onHome} className="flex min-h-[44px] items-center gap-2" aria-label="Go to dashboard">
          <TokenUSDC variant="branded" size={26} />
          <span className="display text-lg font-bold">Arc Pay Links</span>
        </button>
        <ConnectKitButton showBalance={false} />
      </header>
      {children}
    </div>
  )
}
