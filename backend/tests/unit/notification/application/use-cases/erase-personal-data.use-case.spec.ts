import {
  ERASED_MARKER,
  ErasePersonalDataUseCase,
} from '@src/application/use-cases/erase-personal-data.use-case';

describe('ErasePersonalDataUseCase', () => {
  it('apaga destinatário e texto dos envios do titular, pelo usuário e pelo doador', async () => {
    const logs = {
      save: jest.fn(),
      wasSent: jest.fn(),
      erasePersonalData: jest.fn().mockResolvedValue(3),
      purgeOlderThan: jest.fn(),
      listPage: jest.fn(),
      isErased: jest.fn(),
    };
    const logger = { warn: jest.fn(), error: jest.fn() };

    await new ErasePersonalDataUseCase(logs, logger).execute({ userId: 'u1', donorId: 'd1' });

    expect(logs.erasePersonalData).toHaveBeenCalledWith('u1', 'd1', ERASED_MARKER);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('3 registro'),
      expect.any(String),
    );
  });
});
