/**
 * E2E multiprocesso: cada serviço é um processo Node separado, executando o
 * build (`services/<nome>/dist`) com seu próprio node_modules, e cada um com
 * seu próprio banco (`<schema>_db`). O teste só fala HTTP com o gateway e
 * consulta os bancos para observar os efeitos assíncronos.
 * Pré-requisitos: Postgres e Redis no ar e `pnpm run build` em cada serviço.
 */
import { ChildProcess, spawn } from 'child_process';
import { createHmac } from 'crypto';
import * as path from 'path';
import axios, { AxiosInstance } from 'axios';
import { Client } from 'pg';
import { EligibilityResult, Role, NotificationJobType } from '@shared/contracts';

// Valores que a API e os bancos devolvem. Os enums ficam dentro de cada serviço (scheduling e
// notification); o teste é caixa-preta, então compara direto com o valor que trafega.
const AppointmentStatus = {
  ELIGIBILITY_CONFIRMED: 'ELIGIBILITY_CONFIRMED',
  CONFIRMED: 'CONFIRMED',
  CHECKIN_PERFORMED: 'CHECKIN_PERFORMED',
  COMPLETED: 'COMPLETED',
} as const;
const NotificationStatus = { SENT: 'SENT' } as const;

const PORTS = {
  gateway: 13000,
  auth: 13001,
  eligibility: 13002,
  scheduling: 13003,
  notification: 13004,
};
const SERVICES = ['auth', 'eligibility', 'scheduling', 'notification', 'gateway'] as const;
const SCHEMAS = ['auth', 'eligibility', 'scheduling', 'notification'] as const;
const SETUP_TOKEN = 'e2e-setup-token';
const FRONT_ORIGIN = 'http://localhost:5173';
const ROOT = path.resolve(__dirname, '../..');

const dbConfig = (database: string) => {
  const service = database.replace(/_db$/, '').toUpperCase();
  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env[`${service}_DB_USERNAME`] ?? process.env.DB_USERNAME ?? 'postgres',
    password: process.env[`${service}_DB_PASSWORD`] ?? process.env.DB_PASSWORD ?? 'postgres',
    database,
  };
};

/** Recria um banco por serviço (auth_db, eligibility_db, ...), cada um com seu schema. */
async function resetDatabases(): Promise<void> {
  // Com E2E_SKIP_RESET=1 os bancos/usuários já foram criados (ex.: por infra/postgres/init-databases.sh).
  if (process.env.E2E_SKIP_RESET === '1') return;
  const admin = new Client(dbConfig(process.env.DB_ADMIN_DATABASE ?? 'postgres'));
  await admin.connect();
  try {
    for (const s of SCHEMAS) {
      await admin.query(`DROP DATABASE IF EXISTS ${s}_db WITH (FORCE)`);
      await admin.query(`CREATE DATABASE ${s}_db`);
    }
  } finally {
    await admin.end();
  }
  for (const s of SCHEMAS) {
    const c = new Client(dbConfig(`${s}_db`));
    await c.connect();
    await c.query(`CREATE SCHEMA IF NOT EXISTS ${s}`);
    await c.end();
  }
}

const processes: ChildProcess[] = [];

async function waitHealth(port: number, name: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 40_000) {
    try {
      const res = await axios.get(`http://localhost:${port}/health`, {
        validateStatus: () => true,
      });
      if (res.status === 200) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Serviço ${name} não ficou saudável a tempo.`);
}

/**
 * Assina um link como os serviços fazem (HMAC com chave derivada do JWT_SECRET e de um rótulo). O
 * registro de envios guarda os e-mails com os tokens omitidos, então o teste monta o link que o
 * doador recebeu em vez de lê-lo de lá.
 */
function signLink(label: string, payload: object): string {
  const key = createHmac('sha256', process.env.JWT_SECRET ?? '')
    .update(label)
    .digest();
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`;
}

async function startServices(): Promise<void> {
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    ADMIN_SETUP_TOKEN: SETUP_TOKEN,
    CORS_ORIGINS: FRONT_ORIGIN,
    GATEWAY_PORT: String(PORTS.gateway),
    AUTH_SERVICE_PORT: String(PORTS.auth),
    ELIGIBILITY_SERVICE_PORT: String(PORTS.eligibility),
    SCHEDULING_SERVICE_PORT: String(PORTS.scheduling),
    NOTIFICATION_SERVICE_PORT: String(PORTS.notification),
    AUTH_SERVICE_URL: `http://localhost:${PORTS.auth}`,
    ELIGIBILITY_SERVICE_URL: `http://localhost:${PORTS.eligibility}`,
    SCHEDULING_SERVICE_URL: `http://localhost:${PORTS.scheduling}`,
    NOTIFICATION_SERVICE_URL: `http://localhost:${PORTS.notification}`,
    ...Object.fromEntries(SCHEMAS.map((s) => [`${s.toUpperCase()}_DB_DATABASE`, `${s}_db`])),
  };
  for (const name of SERVICES) {
    const dir = path.join(ROOT, 'services', name);
    const child = spawn('node', [`dist/services/${name}/src/main.js`], {
      cwd: dir,
      env,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    processes.push(child);
  }
  await Promise.all(SERVICES.map((name) => waitHealth(PORTS[name], name)));
}

async function poll<T>(
  fn: () => Promise<T | null | undefined>,
  { timeoutMs = 15_000, intervalMs = 250 } = {},
): Promise<T> {
  const start = Date.now();
  for (;;) {
    const result = await fn();
    if (result) return result;
    if (Date.now() - start > timeoutMs) throw new Error('Timeout aguardando condição no polling.');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

describe('Fluxo completo (e2e via gateway)', () => {
  let db: Client; // banco do notification-service
  let dbEligibility: Client;
  let dbScheduling: Client;
  let http: AxiosInstance;

  const suffix = Date.now();
  const adminEmail = `admin.e2e.${suffix}@example.com`;
  const donorEmail = `donor.e2e.${suffix}@example.com`;
  const cpf = String(10_000_000_000 + (suffix % 89_999_999_999)).padStart(11, '0');

  let adminToken: string;
  let donorToken: string;
  let donorId: string;
  let donorUserId: string;
  let unitId: string;
  let appointmentId: string;
  let appointmentDateTime: string;

  beforeAll(async () => {
    await resetDatabases();
    await startServices();
    db = new Client(dbConfig('notification_db'));
    await db.connect();
    dbEligibility = new Client(dbConfig('eligibility_db'));
    await dbEligibility.connect();
    dbScheduling = new Client(dbConfig('scheduling_db'));
    await dbScheduling.connect();
    http = axios.create({
      baseURL: `http://localhost:${PORTS.gateway}`,
      validateStatus: () => true,
    });
  }, 120_000);

  afterAll(async () => {
    await db?.end();
    await dbEligibility?.end();
    await dbScheduling?.end();
    for (const p of processes) p.kill('SIGTERM');
  });

  it('bootstrap: cria o primeiro admin sem autenticação (BootstrapOrAdminGuard)', async () => {
    const adminBody = { email: adminEmail, password: 'passwordAdmin123', name: 'Admin E2E' };

    // Sem o token de instalação (ou com token errado) o primeiro admin não pode ser criado.
    const withoutToken = await http.post('/auth/admin', adminBody);
    expect(withoutToken.status).toBe(403);
    const wrongToken = await http.post('/auth/admin', adminBody, {
      headers: { 'x-setup-token': 'wrong' },
    });
    expect(wrongToken.status).toBe(403);

    const res = await http.post('/auth/admin', adminBody, {
      headers: { 'x-setup-token': SETUP_TOKEN },
    });
    expect(res.status).toBe(201);
    expect(res.data.role).toBe(Role.ADMIN);

    // Logo em seguida, uma segunda tentativa sem token deve ser barrada -
    // a janela de bootstrap fecha assim que o primeiro admin existe.
    const secondAttempt = await http.post('/auth/admin', {
      email: `other.${suffix}@example.com`,
      password: 'passwordAdmin123',
      name: 'Outro Admin',
    });
    expect([401, 403]).toContain(secondAttempt.status);

    const login = await http.post('/auth/login', {
      email: adminEmail,
      password: 'passwordAdmin123',
    });
    expect(login.status).toBe(200);
    adminToken = login.data.accessToken;
    expect(adminToken).toBeTruthy();
  });

  it('cadastra um doador (auth-service + eligibility-service orquestrados)', async () => {
    const res = await http.post('/auth/register', {
      email: donorEmail,
      password: 'donorPassword123',
      name: 'Donor E2E',
      cpf,
      birthDate: '1995-04-12',
      sex: 'F',
      weightKg: 65,
      healthDataConsent: true,
    });
    expect(res.status).toBe(201);
    expect(res.data.user.donorId).toBeTruthy();
    donorToken = res.data.accessToken;
    donorId = res.data.user.donorId;
    donorUserId = res.data.user.id;
    expect(res.data.user.emailVerified).toBe(false);
  });

  it('o doador confirma o e-mail pelo link das boas-vindas', async () => {
    const welcome = await poll(async () => {
      const { rows } = await db.query(
        `SELECT * FROM notification.sent_notifications WHERE type = $1 AND recipient = $2`,
        [NotificationJobType.WELCOME, donorEmail],
      );
      return rows[0] ?? null;
    });
    // O registro de envios não guarda o token do link.
    expect(welcome.message).toContain('verify-email?token=[omitido]');

    const token = signLink('email-verification:v1', {
      u: donorUserId,
      e: donorEmail,
      x: Date.now() + 3_600_000,
      v: 1,
    });
    const verified = await http.post('/auth/verify-email', { token });
    expect(verified.status).toBe(200);
    expect(verified.data).toEqual({ email: donorEmail, changed: false });

    // O token de acesso do cadastro ainda diz "não confirmado": a sessão renovada já vem confirmada.
    const login = await http.post('/auth/login', {
      email: donorEmail,
      password: 'donorPassword123',
    });
    expect(login.data.user.emailVerified).toBe(true);
    donorToken = login.data.accessToken;
  });

  it('o eligibility-service informa o doador de um usuário (consulta interna da reconciliação do cadastro)', async () => {
    const internal = axios.create({
      baseURL: `http://localhost:${PORTS.eligibility}`,
      validateStatus: () => true,
      headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY ?? '' },
    });

    const found = await internal.get(`/donors/internal/by-user/${donorUserId}`);
    const missing = await internal.get(
      '/donors/internal/by-user/00000000-0000-4000-8000-000000000000',
    );
    const noKey = await axios.get(
      `http://localhost:${PORTS.eligibility}/donors/internal/by-user/${donorUserId}`,
      { validateStatus: () => true },
    );

    expect(found.status).toBe(200);
    expect(found.data).toEqual({ id: donorId });
    expect(missing.status).toBe(404);
    expect(noKey.status).toBe(401);
  });

  it('[admin] cadastra uma unidade de coleta', async () => {
    const res = await http.post(
      '/collection-units',
      {
        name: 'Hemocentro E2E',
        address: 'Rua dos Testes, 123',
        neighborhood: 'Centro',
        city: 'São Paulo',
        uf: 'SP',
        phone: '1122223333',
        simultaneousCapacity: 2,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(res.status).toBe(201);
    unitId = res.data.id;
  });

  it('doador agenda uma doação e tem a elegibilidade confirmada de forma síncrona', async () => {
    // Próximo horário da grade de 30 min (com ao menos 1 min de folga): o doador ainda pode
    // confirmar presença nos passos seguintes.
    const slotMs = 30 * 60_000;
    const dateTime = new Date(Math.ceil((Date.now() + 60_000) / slotMs) * slotMs).toISOString();
    const res = await http.post(
      '/appointments',
      { donorId, collectionUnitId: unitId, dateTime },
      { headers: { Authorization: `Bearer ${donorToken}` } },
    );
    expect(res.status).toBe(201);
    expect(res.data.status).toBe(AppointmentStatus.ELIGIBILITY_CONFIRMED);
    expect(res.data.eligibilityAssessment.result).toBe(EligibilityResult.ELIGIBLE);
    appointmentId = res.data.id;
    appointmentDateTime = res.data.dateTime;
  });

  it('o lembrete de 24h é processado de forma assíncrona pelo notification-service', async () => {
    const line = await poll(async () => {
      const { rows } = await db.query(
        `SELECT * FROM notification.sent_notifications WHERE "jobId" = $1`,
        [`reminder-${appointmentId}`],
      );
      return rows[0] ?? null;
    });
    expect(line.type).toBe(NotificationJobType.REMINDER_24H);
    expect(line.recipient).toBe(donorEmail);
    expect(line.status).toBe(NotificationStatus.SENT);
  });

  it('o doador confirma a presença pelo link do e-mail, sem login, e o agendamento fica CONFIRMED', async () => {
    // O link vai no corpo do lembrete (o agendamento é para daqui a menos de 24 h, então o lembrete
    // já leva o link de confirmação). O registro de envios guarda o texto com o token omitido; o
    // teste monta o mesmo link que o doador recebeu.
    const { rows } = await db.query(
      `SELECT message FROM notification.sent_notifications WHERE "jobId" = $1`,
      [`reminder-${appointmentId}`],
    );
    expect(rows[0].message).toContain('confirm-attendance?token=[omitido]');
    const token = signLink('attendance-confirmation:v1', {
      a: appointmentId,
      e: new Date(appointmentDateTime).getTime(),
      v: 1,
    });

    const tampered = await http.post('/appointments/confirm-attendance', {
      token: `${token}x`,
    });
    expect(tampered.status).toBe(400);

    const confirmed = await http.post('/appointments/confirm-attendance', { token });
    expect(confirmed.status).toBe(200);
    expect(confirmed.data.status).toBe(AppointmentStatus.CONFIRMED);
    expect(confirmed.data.confirmedAt).toBeTruthy();
    expect(confirmed.data).not.toHaveProperty('donorId');

    // Idempotente: clicar de novo no link não dá erro.
    const again = await http.post('/appointments/confirm-attendance', { token });
    expect(again.status).toBe(200);
    expect(again.data.status).toBe(AppointmentStatus.CONFIRMED);

    const detail = await http.get(`/appointments/${appointmentId}`, {
      headers: { Authorization: `Bearer ${donorToken}` },
    });
    expect(detail.data.status).toBe(AppointmentStatus.CONFIRMED);
  });

  it('[admin] faz check-in e conclui o agendamento', async () => {
    const checkin = await http.post(
      `/appointments/${appointmentId}/checkin`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(checkin.status).toBe(201);
    expect(checkin.data.status).toBe(AppointmentStatus.CHECKIN_PERFORMED);

    const complete = await http.post(
      `/appointments/${appointmentId}/complete`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(complete.status).toBe(201);
    expect(complete.data.status).toBe(AppointmentStatus.COMPLETED);
  });

  it('a conclusão atualiza lastDonationAt no eligibility-service e enfileira o aviso de intervalo', async () => {
    const donor = await poll(async () => {
      const res = await http.get(`/donors/${donorId}`, {
        headers: { Authorization: `Bearer ${donorToken}` },
      });
      return res.data?.lastDonationAt ? res.data : null;
    });
    expect(donor.lastDonationAt).toBeTruthy();

    const line = await poll(async () => {
      const { rows } = await db.query(
        `SELECT * FROM notification.sent_notifications
         WHERE "donorId" = $1 AND type = $2
         ORDER BY "sentAt" DESC LIMIT 1`,
        [donorId, NotificationJobType.INTERVAL_COMPLETED],
      );
      return rows[0] ?? null;
    });
    expect(line.recipient).toBe(donorEmail);
    expect(line.status).toBe(NotificationStatus.SENT);
  });

  describe('segurança', () => {
    it('envia cabeçalhos de segurança (helmet) e não expõe x-powered-by', async () => {
      const res = await http.get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('rotas internas (serviço a serviço) não são alcançáveis pelo gateway, nem com a chave', async () => {
      const headers = { 'x-internal-api-key': process.env.INTERNAL_API_KEY ?? 'qualquer' };
      const contacts = await http.get('/donors/internal/contacts', { headers });
      const create = await http.post('/donors', {}, { headers });
      const assess = await http.post('/eligibility/internal/assess', {}, { headers });
      expect([contacts.status, create.status, assess.status]).toEqual([404, 404, 404]);
    });

    it('CORS: só a origem do front recebe permissão', async () => {
      const allowed = await http.options('/auth/login', {
        headers: { Origin: FRONT_ORIGIN, 'Access-Control-Request-Method': 'POST' },
      });
      expect(allowed.headers['access-control-allow-origin']).toBe(FRONT_ORIGIN);
      expect(allowed.headers['access-control-allow-credentials']).toBe('true');

      const denied = await http.options('/auth/login', {
        headers: {
          Origin: 'http://site-malicioso.example',
          'Access-Control-Request-Method': 'POST',
        },
      });
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('refresh token fica só no cookie httpOnly e a sessão renova por ele', async () => {
      const login = await http.post('/auth/login', {
        email: donorEmail,
        password: 'donorPassword123',
      });
      expect(login.status).toBe(200);
      expect(login.data).not.toHaveProperty('refreshToken');

      const setCookie = (login.headers['set-cookie'] ?? []) as string[];
      const cookie = setCookie.find((c) => c.startsWith('doesangue_rt='));
      expect(cookie).toBeTruthy();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Path=\/auth/i);
      const value = (cookie as string).split(';')[0];

      const withoutCookie = await http.post('/auth/refresh');
      expect(withoutCookie.status).toBe(401);

      const badOrigin = await http.post('/auth/refresh', undefined, {
        headers: { Cookie: value, Origin: 'http://site-malicioso.example' },
      });
      expect(badOrigin.status).toBe(403);

      const renewed = await http.post('/auth/refresh', undefined, {
        headers: { Cookie: value, Origin: FRONT_ORIGIN },
      });
      expect(renewed.status).toBe(200);
      expect(renewed.data.accessToken).toBeTruthy();
      expect(renewed.headers['set-cookie']).toBeDefined();

      // O token antigo foi rotacionado: reutilizá-lo é recusado.
      const reuse = await http.post('/auth/refresh', undefined, { headers: { Cookie: value } });
      expect(reuse.status).toBe(401);
    });

    it('bloqueia a conta após 5 senhas erradas seguidas (429), mesmo com a senha certa', async () => {
      const email = `block.${suffix}@example.com`;
      await http.post(
        '/auth/admin',
        { email, password: 'passwordAdmin123', name: 'Alvo' },
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );

      for (let i = 0; i < 5; i += 1) {
        const failure = await http.post('/auth/login', { email, password: 'errada' });
        expect(failure.status).toBe(401);
      }
      const blocked = await http.post('/auth/login', { email, password: 'passwordAdmin123' });
      expect(blocked.status).toBe(429);
    });
  });

  describe('confiabilidade do outbox', () => {
    const admin = () => ({ headers: { Authorization: `Bearer ${adminToken}` } });
    // O evento da conclusão (o agendamento também tem o APPOINTMENT_CONFIRMED, dos e-mails dele).
    const appointmentEvent = async () => {
      const { rows } = await dbScheduling.query(
        `SELECT * FROM scheduling.outbox_events WHERE payload->>'appointmentId' = $1 AND type = 'DONATION_COMPLETED' ORDER BY "createdAt"`,
        [appointmentId],
      );
      return rows;
    };
    const insertFailure = async (nextAttempt: string, reprocessings = 0) => {
      const { rows } = await dbScheduling.query(
        `INSERT INTO scheduling.outbox_events
           (type, payload, status, attempts, reprocessings, "nextAttemptAt", "createdAt", "lastError")
         VALUES ('DONATION_COMPLETED', $1, 'FAILURE', 8, $2, ${nextAttempt}, now(), 'simulado')
         RETURNING id`,
        [JSON.stringify({ appointmentId, donorId, donationDate: '2020-01-01' }), reprocessings],
      );
      return rows[0].id as string;
    };
    const warningLines = async () =>
      (
        await db.query(
          `SELECT 1 FROM notification.sent_notifications WHERE "donorId" = $1 AND type = $2`,
          [donorId, NotificationJobType.INTERVAL_COMPLETED],
        )
      ).rowCount;

    it('a conclusão gerou exatamente um evento, já processado', async () => {
      const events = await poll(async () => {
        const e = await appointmentEvent();
        return e.length && e.every((x) => x.status === 'PROCESSED') ? e : null;
      });
      expect(events).toHaveLength(1);
      expect(events[0].payload.donationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('só admin enxerga as falhas do outbox', async () => {
      const asAdmin = await http.get('/outbox/failures', admin());
      expect(asAdmin.status).toBe(200);
      expect(asAdmin.data).toEqual([]);

      const asDonor = await http.get('/outbox/failures', {
        headers: { Authorization: `Bearer ${donorToken}` },
      });
      expect(asDonor.status).toBe(403);
    });

    it('um admin reprocessa um evento em FAILURE; repetir não recua a data nem duplica o aviso', async () => {
      const before = (await http.get(`/donors/${donorId}`, admin())).data.lastDonationAt;
      const notices = await warningLines();
      const id = await insertFailure("now() + interval '1 day'");

      const list = await http.get('/outbox/failures', admin());
      expect(list.data.map((e: { id: string }) => e.id)).toContain(id);

      const res = await http.post(`/outbox/${id}/reprocess`, {}, admin());
      expect(res.status).toBe(200);

      await poll(async () => {
        const { rows } = await dbScheduling.query(
          'SELECT status FROM scheduling.outbox_events WHERE id = $1',
          [id],
        );
        return rows[0].status === 'PROCESSED' ? rows[0] : null;
      });

      const after = (await http.get(`/donors/${donorId}`, admin())).data.lastDonationAt;
      expect(after).toBe(before); // donationDate 2020-01-01 era mais antiga: não recua
      expect(await warningLines()).toBe(notices); // mesmo jobId: sem segundo e-mail
    });

    it('a reconciliação recria o evento de uma conclusão que ficou sem evento', async () => {
      // Linha-base mais antiga: a reconciliação só considera conclusões posteriores ao primeiro
      // evento do outbox (para não reprocessar doações anteriores a ele).
      await dbScheduling.query(
        `INSERT INTO scheduling.outbox_events (type, payload, status, attempts, reprocessings, "nextAttemptAt", "createdAt")
         VALUES ('DONATION_COMPLETED', '{}', 'PROCESSED', 0, 0, now(), now() - interval '1 day')`,
      );
      await dbScheduling.query(
        `DELETE FROM scheduling.outbox_events WHERE payload->>'appointmentId' = $1`,
        [appointmentId],
      );

      const res = await http.post('/outbox/reconcile', {}, admin());
      expect(res.status).toBe(200);
      expect(res.data.eventsCreated).toBe(1);

      const events = await poll(async () => {
        const e = await appointmentEvent();
        return e.length === 1 && e[0].status === 'PROCESSED' ? e : null;
      });
      expect(events[0].payload.donationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(await warningLines()).toBe(1); // mesmo jobId: o aviso não é reenviado
    });

    it('a reconciliação reativa sozinha um evento em FAILURE depois do período de espera', async () => {
      const id = await insertFailure("now() - interval '1 minute'");

      const res = await http.post('/outbox/reconcile', {}, admin());
      expect(res.data.eventsReactivated).toBeGreaterThanOrEqual(1);

      const event = await poll(async () => {
        const { rows } = await dbScheduling.query(
          'SELECT status, reprocessings FROM scheduling.outbox_events WHERE id = $1',
          [id],
        );
        return rows[0].status === 'PROCESSED' ? rows[0] : null;
      });
      expect(event.reprocessings).toBe(1);
    });
  });
});
