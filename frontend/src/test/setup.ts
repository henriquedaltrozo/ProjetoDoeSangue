import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sem `globals: true` no Vitest, o Testing Library não registra a limpeza automática:
// sem isto, o que um teste renderiza continua no DOM do teste seguinte.
afterEach(() => {
  cleanup()
})
