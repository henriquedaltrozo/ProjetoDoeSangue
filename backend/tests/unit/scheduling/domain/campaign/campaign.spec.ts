import { BloodType } from '@shared/domain/enums';
import { CampaignType } from '@src/domain/enums';
import { BusinessRuleError, InvalidValueError } from '@src/domain/errors';
import { Campaign } from '@src/domain/campaign/campaign';

const NOW = new Date('2026-09-10T12:00:00.000Z');

const oneCampaign = (type = CampaignType.REGULAR, active = true) =>
  new Campaign({
    id: 'c-1',
    title: 'Campaign',
    description: 'Doe',
    type,
    targetBloodType: null,
    collectionUnitId: null,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    active,
    createdAt: NOW,
    updatedAt: NOW,
  });

describe('Campaign', () => {
  it('nova nasce ativa, com tipo sanguíneo e unidade nulos se não informados', () => {
    expect(
      Campaign.draft({
        title: 'Campaign',
        description: 'Doe',
        type: CampaignType.REGULAR,
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      }),
    ).toEqual({
      title: 'Campaign',
      description: 'Doe',
      type: CampaignType.REGULAR,
      targetBloodType: null,
      collectionUnitId: null,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      active: true,
    });
  });

  it('nova guarda o tipo sanguíneo e a unidade informados', () => {
    const draft = Campaign.draft({
      title: 'Campaign',
      description: 'Doe',
      type: CampaignType.REGULAR,
      targetBloodType: BloodType.A_NEGATIVE,
      collectionUnitId: 'u-1',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });

    expect(draft.targetBloodType).toBe(BloodType.A_NEGATIVE);
    expect(draft.collectionUnitId).toBe('u-1');
  });

  it('desativar marca a campanha como inativa', () => {
    const campaign = oneCampaign();

    campaign.deactivate();

    expect(campaign.active).toBe(false);
  });

  it('recusa período invertido; o tipo sanguíneo é opcional', () => {
    const data = {
      title: 'Campaign',
      description: 'Doe',
      type: CampaignType.REGULAR,
      startDate: '2026-09-10',
      endDate: '2026-09-09',
    };
    expect(() => Campaign.draft(data)).toThrow(InvalidValueError);
    expect(
      Campaign.draft({ ...data, type: CampaignType.URGENT, endDate: '2026-09-30' }).targetBloodType,
    ).toBeNull();
  });

  describe('ensureAcceptsAppointment', () => {
    // 2026-09-15T13:00Z = 10:00 de 15/09 em Brasília.
    const inside = new Date('2026-09-15T13:00:00.000Z');

    it('aceita um horário dentro do período, em qualquer unidade se a campanha não tem unidade', () => {
      expect(() => oneCampaign().ensureAcceptsAppointment('u-1', inside)).not.toThrow();
    });

    it('recusa horário fora do período (o último dia conta pelo horário de Brasília)', () => {
      // 01/10 às 02:00Z ainda é 30/09 em Brasília: dentro.
      expect(() =>
        oneCampaign().ensureAcceptsAppointment('u-1', new Date('2026-10-01T02:00:00.000Z')),
      ).not.toThrow();
      expect(() =>
        oneCampaign().ensureAcceptsAppointment('u-1', new Date('2026-10-01T13:00:00.000Z')),
      ).toThrow(/fora do período/);
    });

    it('recusa outra unidade quando a campanha é de uma unidade', () => {
      const campaign = new Campaign({ ...oneCampaign(), collectionUnitId: 'u-1' });
      expect(() => campaign.ensureAcceptsAppointment('u-2', inside)).toThrow(/outra unidade/);
    });

    it('recusa campanha inativa', () => {
      expect(() =>
        oneCampaign(CampaignType.REGULAR, false).ensureAcceptsAppointment('u-1', inside),
      ).toThrow(new BusinessRuleError('Campanha inativa.'));
    });
  });

  it('ensureActive só rejeita campanhas inativas', () => {
    expect(() => oneCampaign(CampaignType.REGULAR, true).ensureActive()).not.toThrow();
    expect(() => oneCampaign(CampaignType.REGULAR, false).ensureActive()).toThrow(
      new BusinessRuleError('Campanha inativa.'),
    );
  });

  it.each([
    [CampaignType.REGULAR, false],
    [CampaignType.URGENT, true],
  ])('requiresDonorNotification para %s: %s', (type, expected) => {
    expect(oneCampaign(type).requiresDonorNotification()).toBe(expected);
  });
});
