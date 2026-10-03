import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { setupUpdates } from './pwa'
import { initAppearance } from './theme/appearance'
import './theme/global.css'

initAppearance()
setupUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
