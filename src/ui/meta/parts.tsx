// Small pieces the meta panels share: a panel card, a section title, a locked-state card and a
// thin progress bar whose fill can be amber (default) or cool.
import type { ReactNode } from 'react'
import { LockIcon } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export function PanelCard({ className, children, ...rest }: { readonly className?: string; readonly children: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <section {...rest} className={cn('rounded-xl bg-card px-5 py-4 text-card-foreground shadow-soft ring-1 ring-foreground/10', className)}>
      {children}
    </section>
  )
}

export function PanelTitle({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return <h2 className={cn('text-xs font-medium tracking-wide text-muted-foreground uppercase', className)}>{children}</h2>
}

/** What a locked tab says: the headline is the unlock, the detail says how to get there. */
export function LockedCard({ headline, detail, testId }: { readonly headline: string; readonly detail?: string; readonly testId?: string }) {
  return (
    <PanelCard data-testid={testId ?? 'locked-card'} className="flex items-start gap-3 py-5">
      <span aria-hidden="true" className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <LockIcon className="size-4" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium">{headline}</p>
        {detail !== undefined && <p className="text-sm text-muted-foreground">{detail}</p>}
      </div>
    </PanelCard>
  )
}

/** A 6 px bar. tone amber is the primary fill; cool for charms and luck. */
export function Bar({ value, tone = 'amber', className, label }: { readonly value: number; readonly tone?: 'amber' | 'cool'; readonly className?: string; readonly label?: string }) {
  return (
    <Progress
      value={Math.min(100, Math.max(0, value))}
      aria-label={label}
      className={cn('h-1.5', tone === 'cool' && '[&_[data-slot=progress-indicator]]:bg-cool', className)}
    />
  )
}
