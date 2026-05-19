import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const originalDebug = window.console.debug.bind(window.console)

  window.console.debug = (...args) => {
    const firstArg = typeof args[0] === 'string' ? args[0] : ''

    if (
      firstArg.startsWith('[vite] hot updated:') ||
      firstArg.startsWith('[vite] css hot updated:')
    ) {
      return
    }

    originalDebug(...args)
  }
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
