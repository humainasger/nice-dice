// Root component: boots the app layer once, then renders the locked screen (another tab holds the
// game), the title screen until the player taps Continue (audio is unlocked on that tap, the first
// user gesture), or the game screen. boot() runs under the title, so the save is loaded by the time
// the tap lands; the recovery dialog renders above the title when boot found an unreadable save, so
// that flow is unchanged.
import { useEffect } from 'react'
import { boot } from '@/app/boot'
import { selectLocked, selectTitleDismissed } from '@/app/selectors'
import { useGameStore } from '@/app/store'
import { GameScreen } from '@/ui/GameScreen'
import { LockedScreen } from '@/ui/LockedScreen'
import { RecoveryDialog } from '@/ui/RecoveryDialog'
import { TitleScreen } from '@/ui/title/TitleScreen'

export default function App() {
  const locked = useGameStore(selectLocked)
  const titleDismissed = useGameStore(selectTitleDismissed)
  useEffect(() => {
    void boot()
  }, [])
  if (locked) return <LockedScreen />
  if (!titleDismissed) {
    return (
      <>
        <TitleScreen />
        <RecoveryDialog />
      </>
    )
  }
  return <GameScreen />
}
