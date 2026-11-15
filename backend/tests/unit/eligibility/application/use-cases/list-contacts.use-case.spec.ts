import { BloodType, Sex } from '@shared/domain/enums';
import { ListContactsUseCase } from '@src/application/use-cases/list-contacts.use-case';
import { createTestDonor, createTestUnfitness, dateWithOffset } from '@test/support/fixtures.fake';
import {
  FixedClock,
  InMemoryDonorRepository,
  InMemoryUnfitnessRepository,
} from '@test/support/in-memory-repositories.fake';

describe('ListContactsUseCase', () => {
  let donors: InMemoryDonorRepository;
  let unfitness: InMemoryUnfitnessRepository;
  let useCase: ListContactsUseCase;

  beforeEach(() => {
    donors = new InMemoryDonorRepository();
    unfitness = new InMemoryUnfitnessRepository();
    useCase = new ListContactsUseCase(donors, unfitness, new FixedClock());
  });

  it('devolve só doadores ativos e apenas os dados de contato', async () => {
    donors.seed(
      createTestDonor({ id: 'd-1', bloodType: BloodType.O_NEGATIVE }),
      createTestDonor({ id: 'd-2', bloodType: BloodType.A_POSITIVE }),
      createTestDonor({ id: 'd-3', bloodType: BloodType.O_NEGATIVE, active: false }),
    );
    const contacts = await useCase.execute();
    expect(contacts.map((c) => c.id)).toEqual(['d-1', 'd-2']);
    expect(Object.keys(contacts[0]).sort()).toEqual([
      'bloodType',
      'completeName',
      'email',
      'id',
      'phone',
    ]);
  });

  it('deixa de fora quem desmarcou os avisos no perfil ou ainda não confirmou o e-mail', async () => {
    donors.seed(
      createTestDonor({ id: 'd-1' }),
      createTestDonor({ id: 'd-2', receiveAlerts: false }),
      createTestDonor({ id: 'd-3', emailVerified: false }),
    );
    const contacts = await useCase.execute();
    expect(contacts.map((c) => c.id)).toEqual(['d-1']);
  });

  it('filtra por tipo sanguíneo', async () => {
    donors.seed(
      createTestDonor({ id: 'd-1', bloodType: BloodType.O_NEGATIVE }),
      createTestDonor({ id: 'd-2', bloodType: BloodType.A_POSITIVE }),
    );
    const contacts = await useCase.execute(BloodType.O_NEGATIVE);
    expect(contacts.map((c) => c.id)).toEqual(['d-1']);
  });

  it('não avisa quem não pode doar hoje (inapto permanente, inaptidão em vigor ou intervalo)', async () => {
    donors.seed(
      createTestDonor({ id: 'apto' }),
      createTestDonor({ id: 'permanente', permanentUnfit: true }),
      createTestDonor({ id: 'inaptidao' }),
      createTestDonor({ id: 'doou-agora', sex: Sex.F, lastDonationAt: dateWithOffset(-10) }),
    );
    unfitness.seed(
      createTestUnfitness({ donorId: 'inaptidao', expectedEndDate: dateWithOffset(5) }),
    );

    const contacts = await useCase.execute();

    expect(contacts.map((c) => c.id)).toEqual(['apto']);
  });
});
