// M0 shell: proves Tailwind 4, the shadcn tokens and Button render. Real screens arrive in M2 under src/ui.
import { Button } from '@/components/ui/button'

// Same geometry as public/favicon.svg, recoloured with shadcn tokens so it follows the theme.
function Die({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="A die showing five">
      <rect x="2" y="2" width="60" height="60" rx="12" strokeWidth="2" className="fill-primary stroke-border" />
      <g className="fill-primary-foreground">
        <circle cx="19" cy="19" r="5.5" />
        <circle cx="45" cy="19" r="5.5" />
        <circle cx="32" cy="32" r="5.5" />
        <circle cx="19" cy="45" r="5.5" />
        <circle cx="45" cy="45" r="5.5" />
      </g>
    </svg>
  )
}

export default function App() {
  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Nice Dice</h1>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">M0 scaffold</span>
      </header>
      <p className="sr-only">This is the M0 scaffold. The game is not playable yet.</p>
      <section className="flex flex-1 items-center justify-center p-4">
        <div className="flex flex-col items-center gap-6 rounded-xl border bg-card p-8 text-card-foreground">
          <Die className="size-24" />
          {/* The disabled button drops pointer events, so the wrapper carries the tooltip too. */}
          <span title="Arrives in M1">
            <Button disabled title="Arrives in M1">
              Roll
            </Button>
          </span>
        </div>
      </section>
    </main>
  )
}
