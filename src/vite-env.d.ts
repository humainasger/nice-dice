// Ambient types for Vite's import.meta.env and glob, plus vite-plugin-pwa's virtual:pwa-register module.
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /**
   * Which host the build targets. Unset for the dev server and the GitHub Pages build; 'itch' for
   * scripts/build-itch.mjs, where the app skips service worker registration (src/app/swUpdate.ts).
   */
  readonly VITE_PLATFORM?: string
}
