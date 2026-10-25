// Root component: boots the app layer once, unlocks audio on the first pointer or key gesture
// (browsers refuse sound before one), then renders the locked screen (another tab holds the game)
// or the game screen.
import { useEffect } from 'react'
import { unlockAudio } from '@/app/audio'
import { boot } from '@/app/boot'
import { selectLocked } from '@/app/selectors'
import { useGameStore } from '@/app/store'
import { GameScreen } from '@/ui/GameScreen'
import { LockedScreen } from '@/ui/LockedScreen'

export default function App() {
  const locked = useGameStore(selectLocked)
  useEffect(() => {
    void boot()
    const unlock = (): void => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true, passive: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])
  return locked ? <LockedScreen /> : <GameScreen />
}
