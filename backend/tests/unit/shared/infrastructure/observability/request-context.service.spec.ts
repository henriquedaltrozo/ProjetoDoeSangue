import { RequestContextService } from '@src/infrastructure/observability/request-context.service';

describe('RequestContextService', () => {
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
  });

  it('retorna undefined fora de um run()', () => {
    expect(service.getRequestId()).toBeUndefined();
  });

  it('expõe o requestId dentro do callback de run()', () => {
    service.run('req-1', () => {
      expect(service.getRequestId()).toBe('req-1');
    });
  });

  it('propaga o requestId para chamadas assíncronas iniciadas dentro de run()', async () => {
    let captured: string | undefined;
    await service.run('req-async', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      captured = service.getRequestId();
    });
    expect(captured).toBe('req-async');
  });

  it('mantém contextos isolados entre execuções concorrentes', async () => {
    const results: string[] = [];

    async function task(id: string, delayMs: number) {
      await service.run(id, async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        results.push(service.getRequestId() as string);
      });
    }

    await Promise.all([task('a', 10), task('b', 1)]);

    expect(results.sort()).toEqual(['a', 'b']);
  });

  it('duas instâncias compartilham a mesma store (estática)', () => {
    const otherInstance = new RequestContextService();
    service.run('req-compartilhado', () => {
      expect(otherInstance.getRequestId()).toBe('req-compartilhado');
    });
  });
});
