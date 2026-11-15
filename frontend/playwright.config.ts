import { defineConfig, devices } from '@playwright/test'

/**
 * Config do e2e (Playwright) - roda o fluxo completo do usuário (doador +
 * admin) num navegador real, contra o build de produção do front servido
 * localmente (`vite preview`) e o backend já rodando à parte.
 *
 * Pré-requisito: o backend (gateway + serviços) precisa estar rodando e
 * acessível em VITE_API_URL (ver front/.env) antes de `npm run e2e`, com os
 * e-mails indo para o Mailpit (ver docker-compose.e2e.yml na raiz).
 *
 * Com E2E_BASE_URL (ex.: http://localhost:5173, o front do Compose), testa esse
 * front já no ar em vez de subir o `vite preview`.
 */
const externalBaseUrl = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 120_000,
  use: {
    baseURL: externalBaseUrl ?? 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Usa o Chromium já instalado no ambiente em vez de baixar um novo.
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'npm run preview -- --port 4173',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
})
