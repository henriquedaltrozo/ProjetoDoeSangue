#!/usr/bin/env node
/**
 * Cria contas de teste, uma para cada cenário de doação (ver docs/07-cenarios-teste.md), mais um
 * admin, duas unidades de coleta e três campanhas. Tudo passa pela API de verdade (cadastro, ações
 * do admin, agendamentos), então os dados seguem as mesmas regras de um uso real.
 *
 * - Pode rodar de novo: o que já existe é reaproveitado (nada é apagado).
 * - Respeita o limite de tentativas do cadastro (10 a cada 15 min por IP): quando ele é atingido,
 *   o script espera o tempo pedido pelo servidor e continua.
 * - Só para ambiente de desenvolvimento: as senhas são de teste e ficam no guia.
 *
 * Uso (com o Docker no ar, na versão atual do código):
 *   pnpm seed:scenarios
 *   SEED_ONLY=historico,agendado pnpm seed:scenarios   (só esses cenários)
 *
 * Lê do .env da raiz: ADMIN_SETUP_TOKEN (cria o admin de teste se ainda não houver nenhum admin) e
 * INTERNAL_API_KEY (registra doações antigas). Variáveis opcionais:
 *   GATEWAY_URL (padrão http://localhost:3000), ELIGIBILITY_URL (padrão http://127.0.0.1:3002),
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (um admin já existente, se o de teste não puder ser criado).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------------------------
// Configuração

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const env = { ...readDotEnv(resolve(ROOT, '.env')), ...process.env };

const GATEWAY = env.GATEWAY_URL ?? 'http://localhost:3000';
const ELIGIBILITY = env.ELIGIBILITY_URL ?? 'http://127.0.0.1:3002';
const INTERNAL_KEY = env.INTERNAL_API_KEY ?? 'troque-esta-chave-interna-em-producao';
const SETUP_TOKEN = env.ADMIN_SETUP_TOKEN;

/** Senha de todas as contas de teste (só desenvolvimento; também está no guia). */
export const TEST_PASSWORD = 'Teste@12345';
const ADMIN_EMAIL = 'admin@doesangue.test';
const DOMAIN = 'doesangue.test';

// ---------------------------------------------------------------------------------------------
// Datas (no horário de Brasília, como o backend)

const businessDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
const TODAY = businessDate();

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Data de nascimento de quem tem `years` anos completos (fez aniversário há ~1 mês). */
function bornYearsAgo(years) {
  const d = new Date(`${addDays(TODAY, -30)}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

/** Próximo horário da grade de 30 min ainda hoje (Brasília), com folga de 5 min; null se o dia acabou. */
function nextSlotToday() {
  const [hours, minutes] = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date())
    .split(':')
    .map(Number);
  const next = Math.ceil((hours * 60 + minutes + 5) / 30) * 30;
  if (next >= 24 * 60) return null;
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`;
}

/** Instante (ISO) de um dia e hora em Brasília. */
const at = (date, time) => new Date(`${date}T${time}:00-03:00`).toISOString();

// ---------------------------------------------------------------------------------------------
// Cenários

/**
 * Cada cenário vira uma conta `cenario-<id>@doesangue.test`. `setup` roda depois do cadastro, com o
 * doador e o token do admin, para o que o cadastro sozinho não cria.
 */
const SCENARIOS = [
  {
    id: 'apto',
    name: 'Ana Apta Teste',
    sex: 'F',
    age: 30,
    weightKg: 62,
    bloodType: 'A+',
    phone: '55991110001',
  },
  { id: 'sem-tipo-sanguineo', name: 'Bruno Sem Tipo Teste', sex: 'M', age: 27, weightKg: 80 },
  {
    id: 'intervalo-homem',
    name: 'Carlos Intervalo Teste',
    sex: 'M',
    age: 35,
    weightKg: 78,
    bloodType: 'O+',
    lastDonationDate: addDays(TODAY, -30),
  },
  {
    id: 'intervalo-mulher',
    name: 'Daniela Intervalo Teste',
    sex: 'F',
    age: 28,
    weightKg: 58,
    bloodType: 'B+',
    lastDonationDate: addDays(TODAY, -60),
  },
  {
    id: 'limite-anual-homem',
    name: 'Eduardo Limite Teste',
    sex: 'M',
    age: 40,
    weightKg: 85,
    bloodType: 'A-',
    lastDonationDate: addDays(TODAY, -300),
    // 4 doações em 12 meses (homem), a última há 90 dias: o intervalo já passou, o limite não.
    pastDonations: [-230, -160, -90],
  },
  {
    id: 'limite-anual-mulher',
    name: 'Fernanda Limite Teste',
    sex: 'F',
    age: 33,
    weightKg: 64,
    bloodType: 'AB+',
    lastDonationDate: addDays(TODAY, -300),
    // 3 doações em 12 meses (mulher), a última há 100 dias.
    pastDonations: [-200, -100],
  },
  { id: 'peso-baixo', name: 'Gabriela Peso Teste', sex: 'F', age: 25, weightKg: 45, bloodType: 'O+' },
  {
    id: 'menor-15-anos',
    name: 'Heitor Menor Teste',
    sex: 'M',
    age: 15,
    weightKg: 60,
    guardianName: 'Helena Responsável Teste',
    guardianConsent: true,
  },
  {
    id: 'menor-17-com-termo',
    name: 'Isabela Menor Teste',
    sex: 'F',
    age: 17,
    weightKg: 55,
    bloodType: 'A+',
    guardianName: 'Ivo Responsável Teste',
    guardianConsent: true,
  },
  {
    id: '60-ja-doou',
    name: 'João Sessenta Teste',
    sex: 'M',
    age: 65,
    weightKg: 76,
    bloodType: 'O-',
    donatedBefore60: true,
  },
  {
    id: '60-primeira-vez',
    name: 'Karla Sessenta Teste',
    sex: 'F',
    age: 63,
    weightKg: 68,
    bloodType: 'B-',
    donatedBefore60: false,
  },
  {
    id: '70-nao-regular',
    name: 'Luiz Setenta Teste',
    sex: 'M',
    age: 72,
    weightKg: 74,
    donatedBefore60: true,
    regularDonor: false,
  },
  {
    id: '70-sem-avaliacao',
    name: 'Marta Setenta Teste',
    sex: 'F',
    age: 74,
    weightKg: 66,
    bloodType: 'A+',
    donatedBefore60: true,
    regularDonor: true,
  },
  {
    id: '70-com-avaliacao',
    name: 'Nelson Setenta Teste',
    sex: 'M',
    age: 71,
    weightKg: 79,
    bloodType: 'O+',
    donatedBefore60: true,
    regularDonor: true,
    setup: async ({ donorId, admin }) => {
      await api('POST', `${GATEWAY}/donors/${donorId}/medical-clearance`, { token: await admin() });
    },
  },
  {
    id: 'inaptidao-temporaria',
    name: 'Otávio Inapto Teste',
    sex: 'M',
    age: 29,
    weightKg: 82,
    bloodType: 'B+',
    setup: async ({ donorId, admin }) => {
      const adminToken = await admin();
      const list = await api('GET', `${GATEWAY}/donors/${donorId}/unfitness`, { token: adminToken });
      if (list.some((u) => !u.actualEndDate)) return;
      await api('POST', `${GATEWAY}/donors/${donorId}/unfitness`, {
        token: adminToken,
        body: {
          reason: 'Tatuagem recente (teste)',
          category: 'BEHAVIORAL',
          startDate: TODAY,
          expectedEndDate: addDays(TODAY, 30),
        },
      });
    },
  },
  {
    id: 'inaptidao-permanente',
    name: 'Paula Inapta Teste',
    sex: 'F',
    age: 45,
    weightKg: 70,
    bloodType: 'A+',
    setup: async ({ donorId, admin }) => {
      const adminToken = await admin();
      const donor = await api('GET', `${GATEWAY}/donors/${donorId}`, { token: adminToken });
      if (donor.permanentUnfit) return;
      await api('POST', `${GATEWAY}/donors/${donorId}/permanent-unfitness`, {
        token: adminToken,
        body: { reason: 'Hepatite B confirmada em exame (teste)' },
      });
    },
  },
  {
    id: 'agendado',
    name: 'Rafael Agendado Teste',
    sex: 'M',
    age: 31,
    weightKg: 77,
    bloodType: 'O+',
    setup: async ({ donorId, token, units }) => {
      if (await hasOpenAppointment(token)) return;
      await createAppointment(token, donorId, units.centro, at(addDays(TODAY, 1), '10:00'));
    },
  },
  {
    id: 'historico',
    name: 'Sofia Histórico Teste',
    sex: 'F',
    age: 36,
    weightKg: 63,
    bloodType: 'A+',
    setup: async ({ donorId, token, admin, units }) => {
      // Cada passo confere o que já existe: uma execução interrompida no meio continua de onde parou.
      let mine = await api('GET', `${GATEWAY}/appointments/me`, { token });
      const findOpen = () => mine.find((a) => ['ELIGIBILITY_CONFIRMED', 'CONFIRMED'].includes(a.status));
      // 1) agendado e cancelado pelo doador, com motivo
      if (!mine.some((a) => a.status === 'CANCELED') && !findOpen()) {
        const canceled = await createAppointment(token, donorId, units.centro, at(addDays(TODAY, 2), '09:00'));
        await api('POST', `${GATEWAY}/appointments/${canceled.id}/cancel`, {
          token,
          body: { cancellationReason: 'Imprevisto no trabalho (teste)' },
        });
        mine = await api('GET', `${GATEWAY}/appointments/me`, { token });
      }
      // 2) agendado para hoje, com check-in e concluído pelo admin (vira a última doação: hoje). O
      //    check-in só é aceito no dia do agendamento, então ele é marcado para o próximo horário de hoje.
      if (!mine.some((a) => a.status === 'COMPLETED')) {
        const slot = nextSlotToday();
        if (!slot) {
          console.log('  ...sem horário restante hoje: a doação concluída do histórico fica para outra execução');
          return;
        }
        let done = findOpen();
        if (done && businessDate(new Date(done.dateTime)) !== TODAY) {
          // Agendamento em aberto de outro dia (execução anterior): cancela para marcar o de hoje.
          await api('POST', `${GATEWAY}/appointments/${done.id}/cancel`, {
            token,
            body: { cancellationReason: 'Reagendado para hoje (teste)' },
          });
          done = undefined;
        }
        done ??= await createAppointment(token, donorId, units.centro, at(TODAY, slot));
        const adminToken = await admin();
        await api('POST', `${GATEWAY}/appointments/${done.id}/checkin`, { token: adminToken });
        await api('POST', `${GATEWAY}/appointments/${done.id}/complete`, { token: adminToken });
      }
    },
  },
  {
    id: 'campanha-o-negativo',
    name: 'Tiago Campanha Teste',
    sex: 'M',
    age: 27,
    weightKg: 72,
    bloodType: 'O-',
  },
];

const UNITS = {
  centro: {
    name: 'Hemocentro Centro (teste)',
    address: 'Rua dos Andradas, 100',
    neighborhood: 'Centro',
    city: 'Ijuí',
    uf: 'RS',
    phone: '5533320000',
    simultaneousCapacity: 3,
  },
  bairro: {
    name: 'Unidade Bairro Novo (teste)',
    address: 'Avenida Brasil, 2500',
    neighborhood: 'Bairro Novo',
    city: 'Ijuí',
    uf: 'RS',
    phone: '5533321111',
    simultaneousCapacity: 2,
    operatingHours: {
      seg: ['08:00-12:00', '13:00-17:00'],
      ter: ['08:00-12:00', '13:00-17:00'],
      qua: ['08:00-12:00', '13:00-17:00'],
      qui: ['08:00-12:00', '13:00-17:00'],
      sex: ['08:00-12:00', '13:00-17:00'],
      sab: ['08:00-12:00'],
    },
  },
};

const CAMPAIGNS = [
  {
    title: 'Estoque crítico de O- (teste)',
    description: 'Os estoques de sangue O- estão no limite. Se você é O-, agende sua doação.',
    type: 'URGENT',
    targetBloodType: 'O-',
  },
  {
    title: 'Precisamos de A+ (teste)',
    description: 'Campanha para doadores do tipo A+.',
    type: 'REGULAR',
    targetBloodType: 'A+',
  },
  {
    title: 'Doe sangue, doe vida (teste)',
    description: 'Campanha permanente de incentivo à doação.',
    type: 'REGULAR',
  },
];

// ---------------------------------------------------------------------------------------------
// Execução

async function main() {
  console.log(`Gateway: ${GATEWAY} | Eligibility (interno): ${ELIGIBILITY} | Hoje (Brasília): ${TODAY}\n`);
  // O acesso do admin dura 15 min, e o script pode esperar o limite de cadastros nesse meio-tempo:
  // o token é renovado (novo login) quando tem mais de 10 min.
  let adminCache = { token: await adminToken(), at: Date.now() };
  const admin = async () => {
    if (Date.now() - adminCache.at > 10 * 60_000) {
      adminCache = { token: await adminToken(), at: Date.now() };
    }
    return adminCache.token;
  };
  const units = await ensureUnits(await admin());
  await ensureCampaigns(await admin());

  // SEED_ONLY=apto,agendado roda só esses cenários (útil para completar uma execução interrompida).
  const only = env.SEED_ONLY ? new Set(env.SEED_ONLY.split(',').map((id) => id.trim())) : null;
  const results = [];
  for (const [index, scenario] of SCENARIOS.entries()) {
    if (only && !only.has(scenario.id)) continue;
    const email = `cenario-${scenario.id}@${DOMAIN}`;
    try {
      const { token, donorId, created } = await ensureDonor(scenario, index, email);
      for (const offset of scenario.pastDonations ?? []) {
        await api('POST', `${ELIGIBILITY}/donors/${donorId}/donations/complete`, {
          internal: true,
          body: { donationDate: addDays(TODAY, offset) },
        });
      }
      await scenario.setup?.({ donorId, token, admin, units });
      results.push({ email, status: created ? 'criada' : 'já existia' });
      console.log(`  ok  ${email}${created ? '' : ' (já existia)'}`);
    } catch (err) {
      results.push({ email, status: `ERRO: ${err.message}` });
      console.log(`  ERRO ${email}: ${err.message}`);
    }
  }

  const failed = results.filter((r) => r.status.startsWith('ERRO'));
  console.log(`\n${results.length - failed.length}/${results.length} contas prontas. Senha de todas: ${TEST_PASSWORD}`);
  console.log(`Admin de teste: ${ADMIN_EMAIL}. Guia dos cenários: docs/07-cenarios-teste.md`);
  if (failed.length > 0) process.exitCode = 1;
}

let adminCreatedOnce = false;

/** Token do admin de teste: entra; se não existir, cria (com o token de instalação ou outro admin). */
async function adminToken() {
  const login = await tryLogin(ADMIN_EMAIL, TEST_PASSWORD);
  if (login) return login.accessToken;
  if (adminCreatedOnce) throw new Error(`não foi possível entrar de novo como ${ADMIN_EMAIL}.`);
  adminCreatedOnce = true;

  const body = { name: 'Admin Teste', email: ADMIN_EMAIL, password: TEST_PASSWORD };
  if (env.SEED_ADMIN_EMAIL && env.SEED_ADMIN_PASSWORD) {
    const existing = await tryLogin(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD);
    if (!existing) throw new Error('SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD não conseguiram entrar.');
    await api('POST', `${GATEWAY}/auth/admin`, { token: existing.accessToken, body });
  } else {
    if (!SETUP_TOKEN) throw new Error('ADMIN_SETUP_TOKEN não encontrado no .env da raiz.');
    try {
      await api('POST', `${GATEWAY}/auth/admin`, { headers: { 'x-setup-token': SETUP_TOKEN }, body });
    } catch (err) {
      throw new Error(
        `não foi possível criar ${ADMIN_EMAIL} (${err.message}). Se já existe outro admin, rode com ` +
          'SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD de um admin existente.',
      );
    }
  }
  const created = await tryLogin(ADMIN_EMAIL, TEST_PASSWORD);
  if (!created) throw new Error(`o admin ${ADMIN_EMAIL} foi criado, mas o login falhou.`);
  console.log(`  ok  ${ADMIN_EMAIL} (admin criado)`);
  return created.accessToken;
}

async function ensureUnits(admin) {
  const all = await api('GET', `${GATEWAY}/collection-units/admin/all`, { token: admin });
  const ids = {};
  for (const [key, unit] of Object.entries(UNITS)) {
    let found = all.find((u) => u.name === unit.name);
    if (found && !found.active) {
      found = await api('POST', `${GATEWAY}/collection-units/${found.id}/reactivate`, { token: admin });
    }
    if (!found) {
      found = await api('POST', `${GATEWAY}/collection-units`, { token: admin, body: unit });
      console.log(`  ok  unidade "${unit.name}"`);
    }
    ids[key] = found.id;
  }
  return ids;
}

async function ensureCampaigns(admin) {
  const active = await api('GET', `${GATEWAY}/campaigns`, { token: admin });
  for (const campaign of CAMPAIGNS) {
    if (active.some((c) => c.title === campaign.title)) continue;
    await api('POST', `${GATEWAY}/campaigns`, {
      token: admin,
      body: { ...campaign, startDate: TODAY, endDate: addDays(TODAY, 30) },
    });
    console.log(`  ok  campanha "${campaign.title}"`);
  }
}

/**
 * Cadastra o doador do cenário ou, se a conta já existe (409), entra nela. Tenta o cadastro primeiro
 * para não gastar o limite de tentativas de login com contas que ainda não existem.
 */
async function ensureDonor(scenario, index, email) {
  // Completando cenários de uma execução anterior (SEED_ONLY), as contas já devem existir: entra
  // direto, sem gastar o limite de cadastros.
  if (env.SEED_ONLY) {
    const existing = await tryLogin(email, TEST_PASSWORD);
    if (existing) return { token: existing.accessToken, donorId: existing.user.donorId, created: false };
  }
  const body = {
    name: scenario.name,
    email,
    password: TEST_PASSWORD,
    cpf: testCpf(index),
    birthDate: bornYearsAgo(scenario.age),
    sex: scenario.sex,
    weightKg: scenario.weightKg,
    healthDataConsent: true,
    ...(scenario.phone && { phone: scenario.phone }),
    ...(scenario.bloodType && { bloodType: scenario.bloodType }),
    ...(scenario.lastDonationDate && { lastDonationDate: scenario.lastDonationDate }),
    ...(scenario.guardianName && { guardianName: scenario.guardianName }),
    ...(scenario.guardianConsent !== undefined && { guardianConsent: scenario.guardianConsent }),
    ...(scenario.donatedBefore60 !== undefined && { donatedBefore60: scenario.donatedBefore60 }),
    ...(scenario.regularDonor !== undefined && { regularDonor: scenario.regularDonor }),
  };
  try {
    const auth = await api('POST', `${GATEWAY}/auth/register`, { body });
    return { token: auth.accessToken, donorId: auth.user.donorId, created: true };
  } catch (err) {
    if (err.status !== 409) throw err;
  }
  const existing = await tryLogin(email, TEST_PASSWORD);
  if (!existing) throw new Error('a conta já existe, mas a senha de teste não entra (foi alterada?).');
  return { token: existing.accessToken, donorId: existing.user.donorId, created: false };
}

async function tryLogin(email, password) {
  try {
    return await api('POST', `${GATEWAY}/auth/login`, { body: { email, password } });
  } catch (err) {
    if (err.status === 401) return null;
    throw err;
  }
}

/** Mesma regra do backend: com check-in feito, ou esperando por ele até o fim do dia do agendamento. */
async function hasOpenAppointment(token) {
  const mine = await api('GET', `${GATEWAY}/appointments/me`, { token });
  const waiting = ['SCHEDULED', 'ELIGIBILITY_CONFIRMED', 'CONFIRMED'];
  return mine.some(
    (a) =>
      a.status === 'CHECKIN_PERFORMED' ||
      (waiting.includes(a.status) && businessDate(new Date(a.dateTime)) >= TODAY),
  );
}

function createAppointment(token, donorId, collectionUnitId, dateTime) {
  return api('POST', `${GATEWAY}/appointments`, { token, body: { donorId, collectionUnitId, dateTime } });
}

/** CPF válido e fixo por cenário (o mesmo a cada execução), na faixa 900.000.0xx-xx. */
function testCpf(index) {
  const digits = [...`9000000${String(index + 10).padStart(2, '0')}`].map(Number);
  for (const length of [9, 10]) {
    const sum = digits.slice(0, length).reduce((acc, digit, i) => acc + digit * (length + 1 - i), 0);
    const remainder = sum % 11;
    digits.push(remainder < 2 ? 0 : 11 - remainder);
  }
  return digits.join('');
}

// ---------------------------------------------------------------------------------------------
// HTTP

/**
 * Chamada à API. Erros viram exceções com a mensagem do servidor. Quando o limite de tentativas é
 * atingido (429), espera o tempo pedido (Retry-After) e tenta de novo.
 */
async function api(method, url, { token, body, headers = {}, internal = false } = {}) {
  for (;;) {
    const response = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token && { authorization: `Bearer ${token}` }),
        ...(internal && { 'x-internal-api-key': INTERNAL_KEY }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 429) {
      const seconds = Number(response.headers.get('retry-after')) || 60;
      console.log(`  ...limite de tentativas atingido; esperando ${seconds}s para continuar`);
      await new Promise((r) => setTimeout(r, (seconds + 1) * 1000));
      continue;
    }
    const text = await response.text();
    const data = text ? safeJson(text) : null;
    if (!response.ok) {
      const message = Array.isArray(data?.message) ? data.message.join('; ') : data?.message;
      const error = new Error(`${method} ${new URL(url).pathname}: ${response.status} ${message ?? text}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Lê KEY=VALOR de um .env (sem imprimir nada dele). */
function readDotEnv(path) {
  if (!existsSync(path)) return {};
  const values = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

main().catch((err) => {
  console.error(`\nFalhou: ${err.message}`);
  process.exitCode = 1;
});
