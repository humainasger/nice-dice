// Browser entry: validate content, theme bootstrap, then mount React. Game code lives in src/app
// and src/ui, not here.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { validateContent } from '@/content'
import './index.css'
import App from './App.tsx'

// shadcn's dark variant is the .dark class on <html>. Follow the OS until a settings UI exists (M2).
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function applyTheme(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

applyTheme(darkQuery.matches)
darkQuery.addEventListener('change', (event) => applyTheme(event.matches))

// Content tables are checked once at startup. A broken table throws here, before anything renders.
validateContent()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
