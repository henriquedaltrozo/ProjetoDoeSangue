import { CONSENT_TERM_VERSION } from '@shared/domain/consent/consent-term';
import { BloodType, Sex } from '@shared/domain/enums';
import { ConflictError } from '@src/application/errors/application.errors';
import { CreateDonorUseCase } from '@src/application/use-cases/create-donor.use-case';
import { InvalidValueError } from '@src/domain/errors';
import { FixedClock, InMemoryDonorRepository } from '@test/support/in-memory-repositories.fake';
import { createTestDonor } from '@test/support/fixtures.fake';

describe('CreateDonorUseCase', () => {
  let donors: InMemoryDonorRepository;
  let useCase: CreateDonorUseCase;

  const dto = {
    userId: 'user-1',
    completeName: 'Fulano de Tal',
    cpf: '12345678901',
    birthDate: '1995-04-12',
    sex: Sex.M,
    email: 'fulano@example.com',
    weightKg: 70,
    healthDataConsent: true,
  };

  beforeEach(() => {
    donors = new InMemoryDonorRepository();
    useCase = new CreateDonorUseCase(donors, new FixedClock());
  });

  it('cria um doador quando não há conflito de CPF/usuário', async () => {
    const donor = await useCase.execute(dto);
    expect(donor.cpf).toBe(dto.cpf);
    expect(donor.active).toBe(true);
    expect(donor.permanentUnfit).toBe(false);
    expect(donor.healthDataConsentAt).toEqual(new FixedClock().now());
    // [LGPD] A versão do termo e as bases legais ficam gravadas com o consentimento.
    expect(donor.consentTermVersion).toBe(CONSENT_TERM_VERSION);
    expect(donor.healthDataLegalBasis).toBe('LGPD_ART_11_I');
    expect(donor.personalDataLegalBasis).toBe('LGPD_ART_7_I');
    // O telefone é opcional no cadastro: sem ele, fica vazio (pode ser informado no perfil).
    expect(donor.phone).toBeNull();
    expect(donors.items.size).toBe(1);
  });

  it('grava o telefone informado no cadastro', async () => {
    const donor = await useCase.execute({ ...dto, phone: '55991616163' });
    expect(donor.phone).toBe('55991616163');
  });

  it('grava o tipo sanguíneo informado no cadastro', async () => {
    const donor = await useCase.execute({ ...dto, bloodType: BloodType.O_NEGATIVE });
    expect(donor.bloodType).toBe(BloodType.O_NEGATIVE);
  });

  it('recusa o cadastro com a versão do termo desatualizada', async () => {
    await expect(useCase.execute({ ...dto, consentTermVersion: '2020-01-01' })).rejects.toThrow(
      /termo de consentimento mudou/,
    );
    expect(donors.items.size).toBe(0);
  });

  it('recusa o cadastro sem o consentimento para os dados de saúde', async () => {
    await expect(useCase.execute({ ...dto, healthDataConsent: false })).rejects.toThrow(
      /dados de saúde/,
    );
    expect(donors.items.size).toBe(0);
  });

  it('grava as declarações e a última doação informadas no cadastro', async () => {
    const donor = await useCase.execute({
      ...dto,
      birthDate: '1962-03-01',
      donatedBefore60: true,
      lastDonationDate: '2026-06-01',
    });
    expect(donor).toMatchObject({
      donatedBefore60: true,
      lastDonationAt: '2026-06-01',
      donationDates: ['2026-06-01'],
    });
  });

  it('recusa o cadastro de quem tem 60 anos ou mais sem responder se doou antes dos 60', async () => {
    await expect(useCase.execute({ ...dto, birthDate: '1962-03-01' })).rejects.toBeInstanceOf(
      InvalidValueError,
    );
    expect(donors.items.size).toBe(0);
  });

  it('rejeita com ConflictError quando o CPF já existe', async () => {
    donors.seed(createTestDonor({ id: 'other-donor', userId: 'other-user' }));
    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejeita com ConflictError quando o usuário já tem doador', async () => {
    donors.seed(createTestDonor({ id: 'other-donor', cpf: '00000000000' }));
    await expect(useCase.execute(dto)).rejects.toThrow(
      'Já existe um doador cadastrado com este CPF ou usuário.',
    );
  });
});
