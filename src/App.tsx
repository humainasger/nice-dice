// Root component: boots the app layer once, then renders the locked screen (another tab holds the
// game) or the game screen.
import { useEffect } from 'react'
import { boot } from '@/app/boot'
import { selectLocked } from '@/app/selectors'
import { useGameStore } from '@/app/store'
import { GameScreen } from '@/ui/GameScreen'
import { LockedScreen } from '@/ui/LockedScreen'

export default function App() {
  const locked = useGameStore(selectLocked)
  useEffect(() => {
    void boot()
  }, [])
  return locked ? <LockedScreen /> : <GameScreen />
}
