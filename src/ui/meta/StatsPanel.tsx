// The Stats panel: lifetime rolls, best roll, time played, luck resets, lifetime luck, points earned, and the
// hands seen (rolls whose best hand was each combo). Every number arrives formatted or as a count.
import { useMemo } from 'react'
import { content, type ComboId } from '@/content'
import { selectRolls } from '@/app/selectors'
import { selectLuckTotal } from '@/app/selectors.luck'
import {
  selectBestRollText,
  selectHandCount,
  selectHandsSeenTotal,
  selectPlayTimeText,
  selectPrestiges,
  selectRunEarnedText,
  selectTotalEarnedText,
} from '@/app/selectors.meta'
import { useGameStore } from '@/app/store'
import { PanelCard, PanelTitle } from './parts'

function Tile({ label, value, testId }: { readonly label: string; readonly value: string | number; readonly testId?: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd data-testid={testId} className="text-xl font-semibold tracking-tight tabular">
        {value}
      </dd>
    </div>
  )
}

function HandRow({ id, name, total }: { readonly id: ComboId; readonly name: string; readonly total: number }) {
  const selector = useMemo(() => selectHandCount(id), [id])
  const count = useGameStore(selector)
  const share = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <li data-testid={`hand-${id}`} className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className={count > 0 ? 'text-foreground' : 'text-muted-foreground'}>{name}</span>
      <span className="text-muted-foreground tabular">
        <span className={count > 0 ? 'font-medium text-foreground' : ''}>{count}</span>
        {count > 0 && <span className="ml-2 text-xs">{share}%</span>}
      </span>
    </li>
  )
}

export function StatsPanel() {
  const rolls = useGameStore(selectRolls)
  const bestRoll = useGameStore(selectBestRollText)
  const played = useGameStore(selectPlayTimeText)
  const prestiges = useGameStore(selectPrestiges)
  const luckTotal = useGameStore(selectLuckTotal)
  const totalEarned = useGameStore(selectTotalEarnedText)
  const runEarned = useGameStore(selectRunEarnedText)
  const handsTotal = useGameStore(selectHandsSeenTotal)

  return (
    <div data-testid="stats-panel" className="flex flex-col gap-4">
      <PanelCard className="flex flex-col gap-3">
        <PanelTitle>Lifetime</PanelTitle>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Tile label="Rolls" value={rolls} testId="stat-rolls" />
          <Tile label="Best roll" value={bestRoll} testId="stat-best-roll" />
          <Tile label="Time played" value={played} testId="stat-time" />
          <Tile label="Luck resets" value={prestiges} testId="stat-prestiges" />
          <Tile label="Lifetime luck" value={luckTotal} testId="stat-luck" />
          <Tile label="Points earned" value={totalEarned} />
        </dl>
        <p className="text-xs text-muted-foreground">
          This run: <span className="tabular">{runEarned}</span> points.
        </p>
      </PanelCard>

      <PanelCard className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <PanelTitle>Hands seen</PanelTitle>
          <span className="text-sm text-muted-foreground tabular">{handsTotal}</span>
        </div>
        {handsTotal === 0 ? (
          <p className="pt-1 text-sm text-muted-foreground">Roll two dice or more and matching faces start to count.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {content.combos.map((def) => (
              <HandRow key={def.id} id={def.id} name={def.name} total={handsTotal} />
            ))}
          </ul>
        )}
      </PanelCard>
    </div>
  )
}
