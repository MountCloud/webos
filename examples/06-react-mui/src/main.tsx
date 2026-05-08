import React from 'react'
import ReactDOM from 'react-dom/client'
import { WebosThemeProvider } from '@webos/mui-theme'
import { App } from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WebosThemeProvider>
      <App />
    </WebosThemeProvider>
  </React.StrictMode>,
)
