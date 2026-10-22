import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setLocale } from '@rebodocs/react'
import './index.css'
import App from './App.tsx'

// In English to begin with; the selector in the status bar changes it.
setLocale('en')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
