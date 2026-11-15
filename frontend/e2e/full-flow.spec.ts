import { expect, type Page, test } from '@playwright/test'
import { ensureMailpit, linkIn, pathOf, waitForEmail } from './support/mailpit'

/**
 * E2E do fluxo completo do sistema, num navegador real, contra o build de
 * produção do front (`vite preview`) e o backend já rodando (ver README).
 *
 * Roda como um único teste sequencial (não vários `test()` independentes)
 * porque cada etapa depende do estado deixado pela anterior (admin criado,
 * unidade cadastrada, agendamento em andamento etc.) - dividir em testes
 * separados exigiria recriar esse estado em cada um, ou compartilhar page
 * entre testes, e este fluxo é mais claro como uma jornada única.
 *
 * Os e-mails (confirmação de e-mail, agendamento, troca de e-mail, senha, campanha urgente) são lidos
 * no Mailpit: a stack precisa estar com o SMTP padrão do docker-compose (ver support/mailpit.ts).
 */
test.describe.configure({ mode: 'serial' })

test.beforeAll(ensureMailpit)

test('fluxo completo: bootstrap admin, unidade, campanha, doador, agendamento, admin', async ({ page }) => {
  const suffix = Date.now()
  const adminEmail = `admin.e2e.${suffix}@example.com`
  const donorEmail = `donor.e2e.${suffix}@example.com`
  const donorNewEmail = `donor.e2e.${suffix}.novo@example.com`
  const adminPassword = 'passwordAdmin123'
  const donorPassword = 'donorPassword123'
  const donorNewPassword = 'donorNovaSenha456'
  const cpf = validCpf(suffix)
  const unitName = `Hemocentro E2E ${suffix}`
  const campaignName = `Campaign E2E ${suffix}`
  const urgentName = `Urgente E2E ${suffix}`

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    // O access token vive só em memória: depois de um page.goto (recarga), a primeira chamada leva 401
    // e a sessão é renovada pelo cookie, como previsto. Esses 401 de rede não são erros da tela; os
    // de logout/refresh, que seriam, são conferidos à parte (sessionErrors).
    if (msg.type() === 'error' && !/status of 401/.test(msg.text())) consoleErrors.push(msg.text())
  })
  const sessionErrors: string[] = []
  page.on('response', (response) => {
    if (response.status() === 401 && /\/auth\/(logout|refresh)$/.test(new URL(response.url()).pathname)) {
      sessionErrors.push(`${response.request().method()} ${response.url()}`)
    }
  })

  await test.step('bootstrap do primeiro admin via /setup-admin (rota pública)', async () => {
    await page.goto('/setup-admin')
    await page.getByLabel('Nome completo', { exact: true }).fill('Admin E2E')
    await page.getByLabel('E-mail', { exact: true }).fill(adminEmail)
    await page.getByLabel('Senha', { exact: true }).fill(adminPassword)
    await page.getByLabel('Confirmar senha', { exact: true }).fill(adminPassword)
    await page.getByLabel('Token de instalação').fill(process.env.E2E_SETUP_TOKEN ?? 'troque-este-token-installation')
    await page.click('button[type=submit]')
    await expect(page.getByText('Admin cadastrado com sucesso.')).toBeVisible()
  })

  await login(page, adminEmail, adminPassword)
  await expect(page).toHaveURL(/\/admin$/)

  await test.step('admin cadastra uma unidade de coleta', async () => {
    await page.goto('/admin/units')
    await page.getByLabel('Nome', { exact: true }).fill(unitName)
    await page.getByLabel('Endereço', { exact: true }).fill('Rua E2E, 100')
    await page.getByLabel('Bairro', { exact: true }).fill('Centro')
    await page.getByLabel('Cidade', { exact: true }).fill('São Paulo')
    await page.getByLabel('UF', { exact: true }).fill('SP')
    await page.getByLabel('Telefone', { exact: true }).fill('1133334444')
    await page.getByLabel('Capacidade simultânea (por horário)', { exact: true }).fill('3')
    await page.click('button[type=submit]')
    await expect(page.getByText('Unidade cadastrada com sucesso.')).toBeVisible()
    await expect(page.getByText(unitName)).toBeVisible()
  })

  await test.step('admin cadastra uma campanha regular', async () => {
    await page.goto('/admin/campaigns')
    await page.getByLabel('Título', { exact: true }).fill(campaignName)
    await page.getByLabel('Descrição', { exact: true }).fill('Campanha criada pelo teste e2e.')
    const today = new Date().toISOString().slice(0, 10)
    const in30Days = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    await page.getByLabel('Data de início', { exact: true }).fill(today)
    await page.getByLabel('Data de fim', { exact: true }).fill(in30Days)
    await page.click('button:has-text("Cadastrar campanha")')
    await expect(page.getByText('Campanha cadastrada com sucesso.')).toBeVisible()
    await expect(page.getByText(campaignName)).toBeVisible()
  })

  await test.step('logout do admin e cadastro de um doador', async () => {
    await logout(page)
    await expect(page).toHaveURL(/\/login$/)

    await page.goto('/registration')
    await page.getByLabel('Nome completo', { exact: true }).fill('Donor E2E')
    await page.getByLabel('E-mail', { exact: true }).fill(donorEmail)
    await page.getByLabel('Senha', { exact: true }).fill(donorPassword)
    await page.getByLabel('CPF', { exact: true }).fill(cpf)
    await page.getByLabel('Data de nascimento', { exact: true }).fill('1995-04-12')
    await page.getByLabel('Sexo', { exact: true }).selectOption('F')
    await page.getByLabel('Peso (kg)', { exact: true }).fill('65')
    await page.getByLabel('Confirmar senha', { exact: true }).fill(donorPassword)
    await page.getByLabel(/Concordo com o uso dos meus dados de saúde/).check()
    await page.click('button[type=submit]')
    await expect(page).toHaveURL(/\/appointments$/)
    // Até confirmar o e-mail, o doador não agenda: o aviso fica no topo das telas.
    await expect(page.getByText('Confirme o seu e-mail', { exact: true })).toBeVisible()
  })

  await test.step('doador confirma o e-mail pelo link das boas-vindas', async () => {
    const welcome = await waitForEmail(donorEmail, 'Boas-vindas ao DoeSangue')
    await page.goto(pathOf(linkIn(welcome, '/verify-email')))
    await page.getByRole('button', { name: 'Confirmar meu e-mail' }).click()
    await expect(page.getByText(`Pronto: o e-mail ${donorEmail} está confirmado.`)).toBeVisible()
    await page.getByRole('link', { name: 'Continuar' }).click()
    await expect(page).toHaveURL(/\/appointments$/)
    await expect(page.getByText('Confirme o seu e-mail', { exact: true })).toHaveCount(0)
  })

  await test.step('doador vê a campanha ativa em /campaigns', async () => {
    await page.goto('/campaigns')
    await expect(page.getByText(campaignName)).toBeVisible()
  })

  await test.step('doador atualiza o próprio perfil (telefone/peso/tipo sanguíneo)', async () => {
    await page.goto('/profile')
    await page.click('button:has-text("Editar dados")')
    await page.getByLabel('Telefone (opcional)', { exact: true }).fill('11988887777')
    await page.getByLabel('Peso (kg)', { exact: true }).fill('66')
    await page.getByLabel('Tipo sanguíneo', { exact: true }).selectOption('O-')
    await page.click('button:has-text("Salvar alterações")')
    await expect(page.getByText('Dados atualizados com sucesso.')).toBeVisible()
    // Recarrega e confere que persistiu (não é só otimismo do formulário).
    await page.reload()
    await expect(page.getByText('(11) 98888-7777')).toBeVisible()
    await expect(page.getByText('66 kg')).toBeVisible()
  })

  await test.step('doador agenda uma doação e depois cancela com um motivo', async () => {
    await page.goto('/schedule')
    // A situação para doar aparece no topo de "Agendar doação".
    await expect(page.getByText('Você pode doar hoje')).toBeVisible()
    await scheduleDonation(page, unitName, 1, '09:00')
    await expect(page).toHaveURL(/\/appointments$/)
    await expect(page.getByText('Elegibilidade confirmada').first()).toBeVisible()
    await waitForEmail(donorEmail, 'Agendamento confirmado')

    await page.getByRole('button', { name: 'Cancelar' }).click()
    await page.getByLabel('Motivo (opcional)').fill('Imprevisto de última hora')
    await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
    // O cancelado vai para o histórico, que fica recolhido.
    await page.getByRole('button', { name: /Ver histórico/ }).click()
    await expect(page.getByText('Cancelado', { exact: true })).toBeVisible()
    await expect(page.getByText('Imprevisto de última hora')).toBeVisible()
    await waitForEmail(donorEmail, 'Agendamento cancelado')
  })

  await test.step('doador agenda de novo, para hoje (o admin fará o check-in)', async () => {
    // Só um agendamento em aberto por vez: com o anterior cancelado, dá para agendar outro. Hoje, no
    // primeiro horário que ainda não passou, porque o check-in só é aceito no dia do agendamento.
    await page.goto('/schedule')
    await scheduleDonation(page, unitName, 0)
    await expect(page).toHaveURL(/\/appointments$/)
  })

  await test.step('doador troca o e-mail em Meu perfil: só vale depois do link no e-mail novo', async () => {
    await page.goto('/profile')
    await page.click('button:has-text("Editar dados")')
    await page.getByLabel('E-mail', { exact: true }).fill(donorNewEmail)
    await page.getByLabel('Senha atual (para trocar o e-mail)', { exact: true }).fill(donorPassword)
    await page.click('button:has-text("Salvar alterações")')
    await expect(page.getByText('Dados atualizados com sucesso.')).toBeVisible()
    await expect(page.getByText('Confirme o seu novo e-mail', { exact: true })).toBeVisible()

    const verification = await waitForEmail(donorNewEmail, 'Confirme seu novo e-mail')
    await page.goto(pathOf(linkIn(verification, '/verify-email')))
    await page.getByRole('button', { name: 'Confirmar meu e-mail' }).click()
    await expect(page.getByText(`o e-mail da sua conta agora é ${donorNewEmail}`)).toBeVisible()
    await page.getByRole('link', { name: 'Continuar' }).click()
    await expect(page.getByText('Confirme o seu novo e-mail', { exact: true })).toHaveCount(0)
    // O endereço antigo recebe o aviso de segurança da troca.
    await waitForEmail(donorEmail, 'O e-mail da sua conta foi alterado')
  })

  await test.step('doador redefine a senha pelo link de "Esqueci minha senha"', async () => {
    await logout(page)
    await page.goto('/password-forgot')
    await page.getByLabel('E-mail', { exact: true }).fill(donorNewEmail)
    await page.getByRole('button', { name: 'Enviar' }).click()
    const reset = await waitForEmail(donorNewEmail, 'Redefinição de senha')
    await page.goto(pathOf(linkIn(reset, '/password-reset')))
    await page.getByLabel('Nova senha', { exact: true }).fill(donorNewPassword)
    await page.getByLabel('Confirmar nova senha', { exact: true }).fill(donorNewPassword)
    await page.getByRole('button', { name: 'Redefinir senha' }).click()
    await expect(page.getByText('Senha redefinida com sucesso.')).toBeVisible()
    await waitForEmail(donorNewEmail, 'Sua senha foi alterada')
    // Entra com o e-mail e a senha novos.
    await login(page, donorNewEmail, donorNewPassword)
  })

  await test.step('logout do doador e login do admin', async () => {
    await logout(page)
    await login(page, adminEmail, adminPassword)
  })

  await test.step('campanha urgente avisa o doador compatível, que se descadastra pelo link', async () => {
    await page.goto('/admin/campaigns')
    await page.getByLabel('Título', { exact: true }).fill(urgentName)
    await page.getByLabel('Descrição', { exact: true }).fill('Estoque baixo de O-.')
    await page.getByLabel('Tipo', { exact: true }).selectOption('URGENT')
    await page.getByLabel('Tipo sanguíneo (opcional)', { exact: true }).selectOption('O-')
    const today = new Date().toISOString().slice(0, 10)
    const in7Days = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    await page.getByLabel('Data de início', { exact: true }).fill(today)
    await page.getByLabel('Data de fim', { exact: true }).fill(in7Days)
    await page.click('button:has-text("Cadastrar campanha")')
    await expect(page.getByText('Campanha cadastrada com sucesso.')).toBeVisible()

    const alert = await waitForEmail(donorNewEmail, `Campanha urgente: ${urgentName}`)
    // Descadastro de um clique, para os provedores que mostram o botão "cancelar inscrição".
    expect(alert.headers['List-Unsubscribe']?.[0]).toContain('/unsubscribe')
    await page.goto(pathOf(linkIn(alert, '/unsubscribe')))
    await page.getByRole('button', { name: 'Não quero mais receber esses avisos' }).click()
    await expect(page.getByText('Pronto: você não vai mais receber esses avisos.')).toBeVisible()
  })

  await test.step('admin vê os envios na tela E-mails', async () => {
    await page.goto('/admin/notifications')
    // O destinatário aparece mascarado (do***@example.com); o assunto identifica o envio.
    await expect(page.getByText(`Campanha urgente: ${urgentName}`)).toBeVisible()
  })

  await test.step('admin faz check-in e conclui o agendamento (antes da inaptidão: o check-in reavalia)', async () => {
    await page.goto('/admin')
    await page.click('button:has-text("Check-in")')
    await expect(page.locator('button:has-text("Concluir")')).toBeVisible()
    await page.click('button:has-text("Concluir")')
    await expect(page.locator('span:text-is("Concluído")')).toBeVisible()
    await waitForEmail(donorNewEmail, 'Obrigado por doar!')
  })

  await test.step('admin encontra o doador pela busca em /admin/doadores', async () => {
    await page.goto('/admin/donors')
    await page.getByLabel('Buscar por nome ou CPF', { exact: true }).fill('Donor E2E')
    await expect(page.getByText('Donor E2E')).toBeVisible()
    await page.click('text=Donor E2E')
    await expect(page).toHaveURL(/\/admin\/donors\//)
    await expect(page.getByText('(11) 98888-7777')).toBeVisible()
  })

  await test.step('admin registra uma inaptidão temporária no perfil do doador', async () => {
    // O formulário fica escondido até clicar; o cartão da inaptidão permanente também tem um "Motivo",
    // então os campos são buscados dentro do formulário da temporária.
    // Há um "Registrar inaptidão" em cada cartão: o da temporária é o do cartão "Inaptidões temporárias".
    await page
      .locator('.rounded-xl', { has: page.getByRole('heading', { name: 'Inaptidões temporárias' }) })
      .getByRole('button', { name: 'Registrar inaptidão', exact: true })
      .click()
    const form = page.locator('form', { has: page.getByLabel('Categoria', { exact: true }) })
    // Escolher o motivo da lista já preenche a categoria (Comportamental) e o fim previsto (12 meses).
    await form
      .getByLabel('Motivo', { exact: true })
      .selectOption({ label: 'Tatuagem, maquiagem definitiva ou piercing' })
    const today = new Date().toISOString().slice(0, 10)
    await form.getByLabel('Data de início', { exact: true }).fill(today)
    await form.getByRole('button', { name: 'Registrar', exact: true }).click()
    await expect(page.getByText('Inaptidão registrada.')).toBeVisible()
  })

  await test.step('admin desativa e depois reativa a unidade de coleta', async () => {
    await page.goto('/admin/units')
    // `.rounded-xl` é a classe do componente <Card> - usamos ela em vez de
    // "div" genérico porque um <div>{hasText} qualquer casa com vários
    // ancestrais (layout, coluna, lista) e também com a div interna que só
    // envolve o texto (sem o botão); `.last()` nesse caso pegava essa div
    // interna, que não contém o botão "Desativar" como descendente.
    const unitCard = page.locator('.rounded-xl', { hasText: unitName })
    await unitCard.getByRole('button', { name: 'Desativar' }).click()
    // Desativar cancela os agendamentos futuros da unidade, então a tela pede confirmação.
    await unitCard.getByRole('button', { name: 'Confirmar desativação' }).click()
    await expect(page.getByText(unitName)).not.toBeVisible()

    await page.getByLabel('Mostrar desativadas').check()
    await expect(page.getByText('(desativada)')).toBeVisible()
    const inactiveCard = page.locator('.rounded-xl', { hasText: unitName })
    await inactiveCard.getByRole('button', { name: 'Reativar' }).click()
    await expect(page.getByRole('button', { name: 'Reativar' })).toHaveCount(0)
  })

  await test.step('admin desativa a campanha', async () => {
    await page.goto('/admin/campaigns')
    const campaignCard = page.locator('.rounded-xl', { hasText: campaignName })
    await campaignCard.getByRole('button', { name: 'Desativar' }).click()
    // Desativar campanha não tem volta, então a tela pede confirmação.
    await campaignCard.getByRole('button', { name: 'Confirmar desativação' }).click()
    await expect(page.getByText(campaignName)).not.toBeVisible()
  })

  // Regressão: um bug real (401 no logout por limpar o token antes da
  // requisição sair) só apareceu aqui, via esse listener - não em testes
  // unitários nem no `tsc`. Mantemos a checagem para não reintroduzi-lo.
  expect(consoleErrors, `Erros inesperados no console: ${consoleErrors.join('; ')}`).toEqual([])
  expect(sessionErrors, `401 inesperado na sessão: ${sessionErrors.join('; ')}`).toEqual([])
})

/**
 * CPF único por execução e com dígitos verificadores corretos (o cadastro valida os dígitos).
 * Os 9 primeiros dígitos saem do timestamp; os 2 últimos são calculados.
 */
function validCpf(seed: number): string {
  const base = String(100_000_000 + (seed % 800_000_000)).slice(0, 9)
  const digits = [...base].map(Number)
  for (const length of [9, 10]) {
    const sum = digits.slice(0, length).reduce((acc, digit, i) => acc + digit * (length + 1 - i), 0)
    const remainder = sum % 11
    digits.push(remainder < 2 ? 0 : 11 - remainder)
  }
  return digits.join('')
}

/** O "Sair" fica no menu da conta (o botão com o nome no topo). */
async function logout(page: Page): Promise<void> {
  await page.locator('button[aria-haspopup="menu"]').click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
}

/**
 * Preenche e envia o formulário de "Agendar doação" daqui a `days` dias (no dia de Brasília), no
 * horário informado ou, sem ele, no primeiro horário disponível.
 */
async function scheduleDonation(page: Page, unitName: string, days: number, time?: string): Promise<void> {
  // Espera as unidades carregarem no <select> antes de escolher uma.
  await expect(page.getByRole('option', { name: `${unitName} - São Paulo/SP` })).toBeAttached()
  await page.getByLabel('Unidade de coleta', { exact: true }).selectOption({ label: `${unitName} - São Paulo/SP` })
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
    new Date(Date.now() + days * 24 * 3600 * 1000),
  )
  await page.getByLabel('Data', { exact: true }).fill(date)
  await page.getByLabel('Horário', { exact: true }).selectOption(time ?? { index: 0 })
  await page.click('button:has-text("Confirmar agendamento")')
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.click('button[type=submit]')
  await expect(page).toHaveURL(/\/(admin|appointments)$/)
}
