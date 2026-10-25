// Browser entry: validate content, put the theme classes on <html>, then mount React. Game code
// lives in src/app and src/ui, not here.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { store } from '@/app/store'
import { applyTheme } from '@/app/theme'
import { validateContent } from '@/content'
import './index.css'
import App from './App.tsx'

// Content tables are checked once at startup. A broken table throws here, before anything renders.
validateContent()

// The stored theme goes on <html> before the first render, so a dark-mode load does not paint the
// loading frame light. startTheme() in boot() takes over from here and follows later changes.
applyTheme(store.getState().ui.settings)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
