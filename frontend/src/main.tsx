import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from '@/app/ErrorBoundary'
import { queryClient } from '@/shared/api/queryClient'
import App from './App.tsx'
import './index.css'

// biome-ignore lint/style/noNonNullAssertion: o elemento #root sempre existe em index.html
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
