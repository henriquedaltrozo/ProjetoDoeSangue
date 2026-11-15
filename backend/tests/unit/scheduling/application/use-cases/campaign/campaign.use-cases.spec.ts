import { BloodType } from '@shared/domain/enums';
import { CampaignType } from '@src/domain/enums';
import { OutboxEventType } from '@src/domain/outbox';
import { NotFoundError } from '@src/application/errors';
import {
  FakeAppointmentRepository,
  FakeCampaignRepository,
  FakeClock,
  FakeCollectionUnitRepository,
  FakeOutboxRepository,
  FakeUnitOfWork,
} from '@test/support/fakes';
import { InvalidValueError } from '@src/domain/errors';
import { oneCampaign, oneUnit } from '@test/support/builders';
import { FindCampaignUseCase } from '@src/application/use-cases/campaign/find-campaign.use-case';
import { CreateCampaignUseCase } from '@src/application/use-cases/campaign/create-campaign.use-case';
import { DeactivateCampaignUseCase } from '@src/application/use-cases/campaign/deactivate-campaign.use-case';
import { ListActiveCampaignsUseCase } from '@src/application/use-cases/campaign/list-active-campaigns.use-case';

describe('casos de uso de campanhas', () => {
  let repo: FakeCampaignRepository;
  let outbox: FakeOutboxRepository;
  let units: FakeCollectionUnitRepository;
  let create: CreateCampaignUseCase;

  const command = (type: CampaignType, targetBloodType?: BloodType) => ({
    title: 'Campanha de inverno',
    description: 'Estoque baixo',
    type,
    targetBloodType,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
  });

  beforeEach(() => {
    repo = new FakeCampaignRepository();
    outbox = new FakeOutboxRepository();
    units = new FakeCollectionUnitRepository();
    create = new CreateCampaignUseCase(
      new FakeUnitOfWork(new FakeAppointmentRepository(), outbox, repo),
      units,
      new FakeClock(),
    );
  });

  describe('CreateCampaignUseCase', () => {
    it('recusa uma campanha que já terminou', async () => {
      // "Hoje" (FakeClock) é 2026-09-10.
      await expect(
        create.execute({
          ...command(CampaignType.REGULAR),
          startDate: '2026-08-01',
          endDate: '2026-09-09',
        }),
      ).rejects.toBeInstanceOf(InvalidValueError);
      expect(repo.campaigns.size).toBe(0);
    });

    it('cria a campanha ativa, sem tipo sanguíneo nem unidade por padrão', async () => {
      const campaign = await create.execute(command(CampaignType.REGULAR));

      expect(campaign).toMatchObject({
        title: 'Campanha de inverno',
        active: true,
        targetBloodType: null,
        collectionUnitId: null,
      });
      expect(repo.campaigns.get(campaign.id)).toMatchObject(campaign);
      expect(campaign).not.toBe(repo.campaigns.get(campaign.id)); // output é cópia, não a entidade
    });

    it('campanhas que não são urgentes nem por tipo sanguíneo não geram aviso', async () => {
      await create.execute(command(CampaignType.REGULAR));

      expect(outbox.events.size).toBe(0);
    });

    it.each([BloodType.A_NEGATIVE, undefined])(
      'campanha urgente (tipo sanguíneo %s) grava, junto com a campanha, o evento que pede o aviso aos doadores',
      async (bloodType) => {
        const campaign = await create.execute(command(CampaignType.URGENT, bloodType));

        const [event] = [...outbox.events.values()];
        expect(event).toMatchObject({
          type: OutboxEventType.URGENT_CAMPAIGN_CREATED,
          payload: { campaignId: campaign.id },
        });
      },
    );

    it('recusa período invertido', async () => {
      await expect(
        create.execute({ ...command(CampaignType.REGULAR), endDate: '2026-08-31' }),
      ).rejects.toBeInstanceOf(InvalidValueError);
      expect(repo.campaigns.size).toBe(0);
    });

    it('recusa unidade inexistente (404 em vez de erro do banco)', async () => {
      await expect(
        create.execute({ ...command(CampaignType.REGULAR), collectionUnitId: 'nao-existe' }),
      ).rejects.toBeInstanceOf(NotFoundError);
      units.add(oneUnit({ id: 'unit-9' }));
      await expect(
        create.execute({ ...command(CampaignType.REGULAR), collectionUnitId: 'unit-9' }),
      ).resolves.toMatchObject({ collectionUnitId: 'unit-9' });
    });
  });

  it('lista só as campanhas ativas e ainda não encerradas', async () => {
    repo.add(oneCampaign({ id: 'c-1', active: true }));
    repo.add(oneCampaign({ id: 'c-2', active: false }));
    repo.add(oneCampaign({ id: 'c-3', active: true, endDate: '2026-09-09' }));

    // "Hoje" (FakeClock) é 2026-09-10.
    const campaigns = await new ListActiveCampaignsUseCase(repo, new FakeClock()).execute();

    expect(campaigns.map((c) => c.id)).toEqual(['c-1']);
  });

  it('busca uma campanha ou lança NotFoundError', async () => {
    repo.add(oneCampaign());
    const find = new FindCampaignUseCase(repo);

    await expect(find.execute('campaign-1')).resolves.toMatchObject({ id: 'campaign-1' });
    await expect(find.execute('not-exists')).rejects.toThrow(
      new NotFoundError('Campanha não encontrada.'),
    );
  });

  it('desativa uma campanha', async () => {
    repo.add(oneCampaign());

    const campaign = await new DeactivateCampaignUseCase(repo).execute('campaign-1');

    expect(campaign.active).toBe(false);
    expect(repo.campaigns.get('campaign-1')?.active).toBe(false);
  });

  it('lança NotFoundError ao desativar uma campanha inexistente', async () => {
    await expect(new DeactivateCampaignUseCase(repo).execute('not-exists')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
