import { Role } from '@shared/domain/enums';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ExistsAdminUseCase } from '@src/application/use-cases/exists-admin.use-case';
import { BootstrapOrAdminGuard } from '@src/presentation/http/guards/bootstrap-or-admin.guard';

const buildContext = (user?: unknown, setupToken?: string): ExecutionContext => {
  const request: Record<string, unknown> = {
    ...(user ? { user } : {}),
    headers: setupToken ? { 'x-setup-token': setupToken } : {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
};

describe('BootstrapOrAdminGuard', () => {
  let guard: BootstrapOrAdminGuard;
  let existsAdmin: { execute: jest.Mock };
  let config: { get: jest.Mock };
  let superCanActivateSpy: jest.SpyInstance;

  beforeEach(() => {
    existsAdmin = { execute: jest.fn() };
    config = { get: jest.fn().mockReturnValue('token-installation') };
    guard = new BootstrapOrAdminGuard(
      existsAdmin as unknown as ExistsAdminUseCase,
      config as unknown as ConfigService,
    );
    superCanActivateSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockResolvedValue(true as never);
  });

  afterEach(() => {
    superCanActivateSpy.mockRestore();
  });

  it('libera o primeiro admin com o token de instalação correto', async () => {
    existsAdmin.execute.mockResolvedValue(false);
    const context = buildContext(undefined, 'token-installation');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(superCanActivateSpy).not.toHaveBeenCalled();
  });

  it('recusa o bootstrap sem token ou com token errado', async () => {
    existsAdmin.execute.mockResolvedValue(false);

    await expect(guard.canActivate(buildContext())).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(buildContext(undefined, 'wrong'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('mantém o bootstrap fechado quando ADMIN_SETUP_TOKEN não está configurado', async () => {
    existsAdmin.execute.mockResolvedValue(false);
    config.get.mockReturnValue(undefined);

    await expect(guard.canActivate(buildContext(undefined, 'qualquer'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('exige JWT válido de admin quando já existe um admin cadastrado', async () => {
    existsAdmin.execute.mockResolvedValue(true);
    const context = buildContext({ role: Role.ADMIN });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(superCanActivateSpy).toHaveBeenCalledWith(context);
  });

  it('rejeita com ForbiddenException quando o usuário autenticado não é admin', async () => {
    existsAdmin.execute.mockResolvedValue(true);
    const context = buildContext({ role: Role.DONOR });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('propaga false quando a validação do JWT falha', async () => {
    existsAdmin.execute.mockResolvedValue(true);
    superCanActivateSpy.mockResolvedValue(false as never);
    const context = buildContext();

    await expect(guard.canActivate(context)).resolves.toBe(false);
  });
});
