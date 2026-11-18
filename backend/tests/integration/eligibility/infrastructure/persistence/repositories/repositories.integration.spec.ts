import { CONSENT_TERM_VERSION } from '@shared/domain/consent/consent-term';
import {
  AssessmentSource,
  BloodType,
  EligibilityResult,
  IneligibilityReason,
  Role,
  Sex,
  AssessmentNotice,
} from '@shared/domain/enums';
import { UnfitnessCategory } from '@src/domain/enums';
import {
  cpfIndex,
  encryptDeterministicLegacy,
  nameWordIndexes,
} from '@shared/infrastructure/persistence';
import { ConsentTermAndLegalBasis1763200000000 } from '@src/infrastructure/persistence/migrations/1763200000000-consent-term-and-legal-basis';
import { EncryptDonorIdentity1763100000000 } from '@src/infrastructure/persistence/migrations/1763100000000-encrypt-donor-identity';
import { ReencryptBloodType1762100000000 } from '@src/infrastructure/persistence/migrations/1762100000000-reencrypt-blood-type';
import {
  createTestDatabase,
  pendingSchemaChanges,
  TestDatabase,
} from '@shared/testing/test-database';
import { AccessAudit, AuditAction } from '@src/domain/entities/access-audit';
import { Donor } from '@src/domain/entities/donor';
import { TemporaryUnfitness } from '@src/domain/entities/temporary-unfitness';
import { MIGRATIONS } from '@src/infrastructure/persistence/migrations';
import { AccessAuditOrmEntity } from '@src/infrastructure/persistence/orm-entities/access-audit.orm-entity';
import { EligibilityAssessmentOrmEntity } from '@src/infrastructure/persistence/orm-entities/assessment-eligibility.orm-entity';
import { DonorOrmEntity } from '@src/infrastructure/persistence/orm-entities/donor.orm-entity';
import { TemporaryUnfitnessOrmEntity } from '@src/infrastructure/persistence/orm-entities/temporary-unfitness.orm-entity';
import { AssessmentTypeOrmRepository } from '@src/infrastructure/persistence/repositories/assessment.typeorm-repository';
import { AuditTypeOrmRepository } from '@src/infrastructure/persistence/repositories/audit.typeorm-repository';
import { DonorTypeOrmRepository } from '@src/infrastructure/persistence/repositories/donor.typeorm-repository';
import { UnfitnessTypeOrmRepository } from '@src/infrastructure/persistence/repositories/unfitness.typeorm-repository';
import { ConflictError } from '@src/application/errors';

/** Integração com Postgres real (migrations de produção aplicadas em um banco descartável). */
describe('repositórios de eligibility (Postgres)', () => {
  let db: TestDatabase;
  let donors: DonorTypeOrmRepository;
  let unfitness: UnfitnessTypeOrmRepository;
  let assessments: AssessmentTypeOrmRepository;
  let audit: AuditTypeOrmRepository;

  beforeAll(async () => {
    db = await createTestDatabase({
      schema: 'eligibility',
      entities: [
        DonorOrmEntity,
        TemporaryUnfitnessOrmEntity,
        EligibilityAssessmentOrmEntity,
        AccessAuditOrmEntity,
      ],
      migrations: MIGRATIONS,
    });
    const ds = db.dataSource;
    donors = new DonorTypeOrmRepository(ds.getRepository(DonorOrmEntity));
    unfitness = new UnfitnessTypeOrmRepository(ds.getRepository(TemporaryUnfitnessOrmEntity));
    assessments = new AssessmentTypeOrmRepository(ds.getRepository(EligibilityAssessmentOrmEntity));
    audit = new AuditTypeOrmRepository(ds.getRepository(AccessAuditOrmEntity));
  });

  afterAll(() => db?.destroy());
  beforeEach(() => db.truncate());

  const NOBODY = '00000000-0000-4000-8000-00000000ffff';
  let seq = 0;
  const newDonor = (overrides: { name?: string; cpf?: string } = {}) => {
    seq += 1;
    return donors.create(
      Donor.draft(
        {
          userId: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
          completeName: overrides.name ?? 'Maria da Silva',
          cpf: overrides.cpf ?? String(10000000000 + seq),
          birthDate: '1995-05-05',
          sex: Sex.F,
          email: `maria${seq}@example.com`,
          weightKg: 62.5,
          healthDataConsent: true,
        },
        new Date(),
      ),
    );
  };

  describe('doadores', () => {
    it('concorrência otimista: gravar uma leitura antiga falha e não desfaz a outra gravação', async () => {
      const donor = await newDonor();
      const readByProfile = await donors.findById(donor.id);
      const readByDonation = await donors.findById(donor.id);

      readByDonation?.registerDonationCompleted('2026-09-01', '2026-10-02');
      const saved = await donors.save(readByDonation as Donor);
      expect(saved.version).toBe(donor.version + 1);

      readByProfile?.updateProfile({ phone: '81777776666' }, new Date());
      await expect(donors.save(readByProfile as Donor)).rejects.toBeInstanceOf(ConflictError);
      expect((await donors.findById(donor.id))?.lastDonationAt).toBe('2026-09-01');
    });

    it('cria e devolve os valores em texto puro, mas guarda os dados pessoais e de saúde cifrados', async () => {
      const donor = await newDonor({ name: 'José da Silva', cpf: '52998224725' });

      const loaded = await donors.findById(donor.id);
      expect(loaded?.weightKg).toBe(62.5);
      expect(loaded?.completeName).toBe('José da Silva');
      expect(loaded?.cpf).toBe('52998224725');
      expect(loaded?.birthDate).toBe('1995-05-05');
      expect(loaded?.email).toBe(`maria${seq}@example.com`);
      expect(loaded?.healthDataConsentAt).toBeInstanceOf(Date);
      // [LGPD] A versão do termo e as bases legais gravadas no cadastro voltam na leitura.
      expect(loaded?.consentTermVersion).toBe(CONSENT_TERM_VERSION);
      expect(loaded?.healthDataLegalBasis).toBe('LGPD_ART_11_I');
      expect(loaded?.personalDataLegalBasis).toBe('LGPD_ART_7_I');

      const [raw] = await db.dataSource.query('SELECT * FROM eligibility.donors WHERE id = $1', [
        donor.id,
      ]);
      for (const column of ['weightKg', 'completeName', 'cpf', 'birthDate', 'email']) {
        expect(String(raw[column])).toMatch(/^gcm:/);
      }
      // Nada identificante sobra em texto claro na linha (nem nos índices cegos).
      const row = JSON.stringify(raw);
      for (const clear of ['62.5', 'José', 'Silva', '52998224725', '1995-05-05', 'example.com']) {
        expect(row).not.toContain(clear);
      }
      expect(raw.cpfIndex).toBe(cpfIndex('52998224725'));
      expect(raw.nameIndexes).toEqual(nameWordIndexes('José da Silva'));
    });

    it('persiste atualização de contato e tipo sanguíneo (cifrado) e a anonimização', async () => {
      const donor = await newDonor();
      donor.updateProfile({ phone: '81888887777', bloodType: BloodType.O_NEGATIVE }, new Date());
      await donors.save(donor);

      const updated = await donors.findById(donor.id);
      expect(updated?.phone).toBe('81888887777');
      expect(updated?.bloodType).toBe(BloodType.O_NEGATIVE);
      expect(await donors.listAcceptingAlerts(BloodType.O_NEGATIVE)).toHaveLength(1);
      expect(await donors.listAcceptingAlerts(BloodType.A_POSITIVE)).toHaveLength(0);

      updated?.anonymize();
      await donors.save(updated as Donor);
      const anonymized = await donors.findById(donor.id);
      expect(anonymized?.active).toBe(false);
      expect(anonymized?.completeName).toBe('Doador anonimizado');
      expect(await donors.listAcceptingAlerts()).toHaveLength(0);
    });

    it('encontra por CPF (com ou sem máscara) ou userId e garante unicidade do CPF', async () => {
      const donor = await newDonor({ cpf: '99988877766' });

      expect((await donors.findByCpfOrUserId('99988877766', NOBODY))?.id).toBe(donor.id);
      expect((await donors.findByCpfOrUserId('999.888.777-66', NOBODY))?.id).toBe(donor.id);
      expect((await donors.findByUserId(donor.userId))?.id).toBe(donor.id);
      // A cifra tem IV aleatório: quem garante a unicidade é o índice cego do CPF.
      await expect(newDonor({ cpf: '99988877766' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('busca por CPF completo ou por palavras inteiras do nome (cifrados), mais recentes primeiro', async () => {
      await newDonor({ name: 'Ana Souza', cpf: '11111111111' });
      await newDonor({ name: 'Bruno 100% Lima', cpf: '22222222222' });
      await newDonor({ name: 'José da Silva', cpf: '33333333333' });

      const names = async (search: string | undefined, limit = 10, offset = 0) =>
        (await donors.find(search, limit, offset)).items.map((d) => d.completeName);
      // Palavra inteira, sem diferenciar acento nem maiúsculas; todas as palavras digitadas precisam constar.
      expect(await names('souza')).toEqual(['Ana Souza']);
      expect(await names('JOSE')).toEqual(['José da Silva']);
      expect(await names('silva jose')).toEqual(['José da Silva']);
      expect(await names('silva ana')).toEqual([]);
      // Pedaço de palavra não acha (a busca é por índice cego): só palavras inteiras.
      expect(await names('sou')).toEqual([]);
      expect(await names('%')).toEqual([]);
      // CPF completo, com ou sem máscara; CPF parcial não acha.
      expect(await names('222.222.222-22')).toEqual(['Bruno 100% Lima']);
      expect(await names('22222222222')).toEqual(['Bruno 100% Lima']);
      expect(await names('22222')).toEqual([]);
      // Paginação: a página traz só o pedaço pedido, e o total conta todos os encontrados.
      expect(await names(undefined, 2)).toEqual(['José da Silva', 'Bruno 100% Lima']);
      expect(await names(undefined, 2, 2)).toEqual(['Ana Souza']);

      expect((await donors.find(undefined, 2)).total).toBe(3);
      // Doador anonimizado (conta excluída) sai da busca.
      const ana = (await donors.find('souza', 10)).items[0];
      ana.anonymize();
      await donors.save(ana);
      expect(await names('souza')).toEqual([]);
      expect((await donors.find(undefined, 10)).total).toBe(2);
    });
  });

  it('as migrations criam exatamente o schema das entidades', async () => {
    expect(await pendingSchemaChanges(db.dataSource)).toEqual([]);
  });

  describe('migration que cifra os dados identificantes', () => {
    it('volta para o formato em claro (down) e cifra de novo (up) sem perder nem duplicar dados', async () => {
      const donor = await newDonor({ name: 'José da Silva', cpf: '52998224725' });
      const runner = db.dataSource.createQueryRunner();
      try {
        // down: o que estava cifrado volta em claro e o CPF volta a ser único em claro.
        await new EncryptDonorIdentity1763100000000().down(runner);
        const [legacy] = await db.dataSource.query(
          'SELECT "completeName", cpf, "birthDate"::text AS "birthDate", email FROM eligibility.donors WHERE id = $1',
          [donor.id],
        );
        expect(legacy).toEqual({
          completeName: 'José da Silva',
          cpf: '52998224725',
          birthDate: '1995-05-05',
          email: `maria${seq}@example.com`,
        });

        // up: cifra de novo, grava os índices cegos e o doador volta a ser achado pelo CPF e pelo nome.
        await new EncryptDonorIdentity1763100000000().up(runner);
      } finally {
        await runner.release();
      }
      const [raw] = await db.dataSource.query('SELECT * FROM eligibility.donors WHERE id = $1', [
        donor.id,
      ]);
      expect(String(raw.cpf)).toMatch(/^gcm:/);
      expect(raw.cpfIndex).toBe(cpfIndex('52998224725'));
      expect(raw.nameIndexes).toEqual(nameWordIndexes('José da Silva'));
      expect((await donors.findByCpfOrUserId('52998224725', NOBODY))?.completeName).toBe(
        'José da Silva',
      );
      expect((await donors.find('silva', 10)).items.map((d) => d.id)).toEqual([donor.id]);
      expect(await pendingSchemaChanges(db.dataSource)).toEqual([]);
    });
  });

  describe('migration da versão do termo e da base legal', () => {
    it('remove as colunas (down) e as recria vazias (up), sem tocar no resto do cadastro', async () => {
      const donor = await newDonor({ name: 'José da Silva', cpf: '52998224725' });
      const runner = db.dataSource.createQueryRunner();
      try {
        await new ConsentTermAndLegalBasis1763200000000().down(runner);
        const columns = await db.dataSource.query(
          `SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'eligibility' AND table_name = 'donors'
              AND column_name IN ('consentTermVersion', 'healthDataLegalBasis', 'personalDataLegalBasis')`,
        );
        expect(columns).toEqual([]);
        await new ConsentTermAndLegalBasis1763200000000().up(runner);
      } finally {
        await runner.release();
      }
      const [raw] = await db.dataSource.query('SELECT * FROM eligibility.donors WHERE id = $1', [
        donor.id,
      ]);
      // Cadastros anteriores à versão do termo ficam sem registro (não há como saber o que foi aceito).
      expect(raw.consentTermVersion).toBeNull();
      expect(raw.healthDataLegalBasis).toBeNull();
      expect(raw.personalDataLegalBasis).toBeNull();
      expect(String(raw.cpf)).toMatch(/^gcm:/);
      expect(await pendingSchemaChanges(db.dataSource)).toEqual([]);
    });
  });

  describe('migration do tipo sanguíneo (subchave do IV determinístico)', () => {
    it('regrava os valores do formato anterior, e a busca por tipo sanguíneo volta a encontrá-los', async () => {
      const donor = await newDonor();
      await db.dataSource.query('UPDATE eligibility.donors SET "bloodType" = $1 WHERE id = $2', [
        encryptDeterministicLegacy(BloodType.O_NEGATIVE),
        donor.id,
      ]);
      expect(await donors.listAcceptingAlerts(BloodType.O_NEGATIVE)).toHaveLength(0);

      const runner = db.dataSource.createQueryRunner();
      try {
        await new ReencryptBloodType1762100000000().up(runner);
      } finally {
        await runner.release();
      }

      const found = await donors.listAcceptingAlerts(BloodType.O_NEGATIVE);
      expect(found.map((d) => d.id)).toEqual([donor.id]);
      expect(found[0].bloodType).toBe(BloodType.O_NEGATIVE);
    });
  });

  describe('declarações do doador', () => {
    it('grava e lê as declarações, com o nome do responsável cifrado em repouso', async () => {
      const created = await donors.create(
        Donor.draft(
          {
            userId: '00000000-0000-4000-8000-0000000000aa',
            completeName: 'Jovem Doador',
            cpf: '55544433322',
            birthDate: '2009-05-01',
            sex: Sex.M,
            email: 'jovem@example.com',
            weightKg: 60,
            healthDataConsent: true,
            guardianName: 'Maria Responsável',
            guardianConsent: true,
          },
          new Date(),
        ),
      );
      created.updateDeclarations({ regularDonor: true });
      // A avaliação só é aceita a partir dos 70 anos: registrada "no futuro" só para testar a gravação.
      created.registerMedicalClearance(
        '00000000-0000-4000-8000-0000000000bb',
        new Date('2080-01-02T15:00:00.000Z'),
      );
      await donors.save(created);

      const loaded = await donors.findById(created.id);
      expect(loaded).toMatchObject({
        guardianName: 'Maria Responsável',
        guardianConsentDeclared: true,
        regularDonorDeclared: true,
        medicalClearanceAt: '2080-01-02',
        medicalClearanceBy: '00000000-0000-4000-8000-0000000000bb',
      });
      const [raw] = await db.dataSource.query(
        'SELECT "guardianName" FROM eligibility.donors WHERE id = $1',
        [created.id],
      );
      expect(raw.guardianName).not.toContain('Maria');
    });
  });

  describe('inaptidões temporárias', () => {
    it('findActive respeita as datas e o encerramento antecipado', async () => {
      const donor = await newDonor();
      const created = await unfitness.create(
        TemporaryUnfitness.draft({
          donorId: donor.id,
          reason: 'Tatuagem',
          category: UnfitnessCategory.CLINIC,
          startDate: '2026-09-01',
          expectedEndDate: '2026-12-01',
        }),
      );

      expect((await unfitness.findActive(donor.id, '2026-10-01'))?.id).toBe(created.id);
      expect(await unfitness.findActive(donor.id, '2026-12-02')).toBeNull();
      expect(await unfitness.findActive(donor.id, '2026-08-31')).toBeNull();

      created.end('2026-09-15', '2026-09-20');
      await unfitness.save(created);

      expect(await unfitness.findActive(donor.id, '2026-10-01')).toBeNull();
      // Vale até a véspera do encerramento; no próprio dia o doador já está liberado.
      expect((await unfitness.findActive(donor.id, '2026-09-14'))?.id).toBe(created.id);
      expect(await unfitness.findActive(donor.id, '2026-09-15')).toBeNull();
      expect((await unfitness.findByIdAndDonor(created.id, donor.id))?.actualEndDate).toBe(
        '2026-09-15',
      );
      expect(await unfitness.findByIdAndDonor(created.id, NOBODY)).toBeNull();
    });

    it('replaceReasons (LGPD) troca o motivo de todas as inaptidões do doador', async () => {
      const donor = await newDonor();
      for (const start of ['2026-01-01', '2026-02-01']) {
        await unfitness.create(
          TemporaryUnfitness.draft({
            donorId: donor.id,
            reason: 'Motivo identificante',
            category: UnfitnessCategory.CLINIC,
            startDate: start,
          }),
        );
      }

      await unfitness.replaceReasons(donor.id, '[removido]');

      const list = await unfitness.listByDonor(donor.id);
      expect(list.map((u) => u.reason)).toEqual(['[removido]', '[removido]']);
      expect(list.map((u) => u.startDate)).toEqual(['2026-02-01', '2026-01-01']);
    });
  });

  describe('avaliações e auditoria', () => {
    it('grava a avaliação com os motivos e lista por doador', async () => {
      const donor = await newDonor();
      await assessments.create({
        donorId: donor.id,
        appointmentId: null,
        result: EligibilityResult.TEMPORARY_UNFIT,
        reasons: [IneligibilityReason.INSUFFICIENT_WEIGHT],
        nextEligibilityDate: '2026-12-01',
        origin: AssessmentSource.DONOR_QUERY,
      });

      const [saved] = await assessments.listByDonor(donor.id);
      expect(saved.result).toBe(EligibilityResult.TEMPORARY_UNFIT);
      expect(saved.reasons).toEqual(['INSUFFICIENT_WEIGHT']);
      expect(saved.nextEligibilityDate).toBe('2026-12-01');
      expect(saved.notices).toEqual([]);
    });

    it('grava os avisos de uma avaliação apta', async () => {
      const donor = await newDonor();
      await assessments.create({
        donorId: donor.id,
        appointmentId: null,
        result: EligibilityResult.ELIGIBLE,
        reasons: [],
        notices: [AssessmentNotice.BRING_GUARDIAN_CONSENT],
        nextEligibilityDate: null,
        origin: AssessmentSource.DONOR_QUERY,
      });
      const [saved] = await assessments.listByDonor(donor.id);
      expect(saved.notices).toEqual(['BRING_GUARDIAN_CONSENT']);
    });

    it('registra a auditoria de acesso e respeita o limite da listagem', async () => {
      const donor = await newDonor();
      for (const action of [AuditAction.VIEW, AuditAction.UPDATE, AuditAction.EXPORT]) {
        await audit.create({
          donorId: donor.id,
          userId: null,
          userRole: Role.ADMIN,
          action,
        });
      }

      const all = await audit.listByDonor(donor.id, 10);
      expect(all).toHaveLength(3);
      expect(all[0]).toBeInstanceOf(AccessAudit);
      expect(await audit.listByDonor(donor.id, 2)).toHaveLength(2);
    });
  });
});
