import type { ReactNode } from 'react'

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="max-w-6xl mx-auto px-6 py-12">{children}</div>
}
