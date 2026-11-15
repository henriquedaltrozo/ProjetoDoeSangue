import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@shared/presentation/auth';
import { Actor } from '@shared/application/auth';
import { Role } from '@shared/domain/enums';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthResult } from '../../../application/dto/user.output';
import { DeactivateAdminUseCase } from '../../../application/use-cases/deactivate-admin.use-case';
import { DeleteMyAccountUseCase } from '../../../application/use-cases/delete-my-account.use-case';
import { ForgotPasswordUseCase } from '../../../application/use-cases/forgot-password.use-case';
import { GetMeUseCase } from '../../../application/use-cases/get-me.use-case';
import { ListAdminsUseCase } from '../../../application/use-cases/list-admins.use-case';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { LogoutUseCase } from '../../../application/use-cases/logout.use-case';
import { ReactivateAdminUseCase } from '../../../application/use-cases/reactivate-admin.use-case';
import { RefreshSessionUseCase } from '../../../application/use-cases/refresh-session.use-case';
import { RegisterAdminUseCase } from '../../../application/use-cases/register-admin.use-case';
import { RegisterDonorUseCase } from '../../../application/use-cases/register-donor.use-case';
import { ResetPasswordUseCase } from '../../../application/use-cases/reset-password.use-case';
import { UpdateMyAccountUseCase } from '../../../application/use-cases/update-my-account.use-case';
import { ResendEmailVerificationUseCase } from '../../../application/use-cases/resend-email-verification.use-case';
import { VerifyEmailUseCase } from '../../../application/use-cases/verify-email.use-case';
import {
  ResendVerificationResponseDto,
  VerifyEmailDto,
  VerifyEmailResponseDto,
} from '../dto/verify-email.dto';
import {
  requireAllowedOrigin,
  writeRefreshCookie,
  readRefreshCookie,
  clearRefreshCookie,
} from '../cookies/refresh-cookie';
import { AuthResponseDto, UserResponseDto } from '../dto/auth-response.dto';
import { ForgotPasswordDto, ForgotPasswordResponseDto } from '../dto/forgot-password.dto';
import { DeleteMyDataDto } from '../dto/delete-my-data.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterAdminDto } from '../dto/register-admin.dto';
import { RegisterDonorDto } from '../dto/register-donor.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { UpdateMeDto } from '../dto/update-me.dto';
import { BootstrapOrAdminGuard } from '../guards/bootstrap-or-admin.guard';
import { toForgotPasswordResponse, toUserResponse } from '../presenters/auth.presenter';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerDonorUseCase: RegisterDonorUseCase,
    private readonly registerAdminUseCase: RegisterAdminUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly deleteMyAccountUseCase: DeleteMyAccountUseCase,
    private readonly listAdminsUseCase: ListAdminsUseCase,
    private readonly deactivateAdminUseCase: DeactivateAdminUseCase,
    private readonly reactivateAdminUseCase: ReactivateAdminUseCase,
    private readonly updateMyAccountUseCase: UpdateMyAccountUseCase,
    private readonly config: ConfigService,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly resendVerificationUseCase: ResendEmailVerificationUseCase,
  ) {}

  /** Move o refresh token para o cookie httpOnly e devolve só o que o cliente pode ver. */
  private withCookie(res: Response, result: AuthResult): AuthResponseDto {
    writeRefreshCookie(res, this.config, result.refreshToken, result.refreshExpiresAt);
    return { accessToken: result.accessToken, user: toUserResponse(result.user) };
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @Post('register')
  @ApiOperation({
    summary: 'Cadastro de doador (cria o usuário aqui e o doador no eligibility-service)',
  })
  async registerDonor(
    @Body() dto: RegisterDonorDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.withCookie(res, await this.registerDonorUseCase.execute(dto));
  }

  @UseGuards(ThrottlerGuard, BootstrapOrAdminGuard)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiBearerAuth()
  @Post('admin')
  @ApiOperation({
    summary:
      'Cadastro de novo usuário admin. Sem nenhum admin ainda cadastrado, o primeiro admin só ' +
      'pode ser criado com o header x-setup-token igual a ADMIN_SETUP_TOKEN (bootstrap); a ' +
      'partir do segundo, exige JWT de admin.',
  })
  async registerAdmin(@Body() dto: RegisterAdminDto): Promise<UserResponseDto> {
    return toUserResponse(await this.registerAdminUseCase.execute(dto));
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({
    summary:
      'Login. Limitado a 10 tentativas / 15min por IP e, por conta, bloqueio de 15min após 5 ' +
      'senhas erradas seguidas (429). O refresh token é gravado em cookie httpOnly.',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.withCookie(res, await this.loginUseCase.execute(dto));
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 15 * 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({
    summary: 'Rotaciona o refresh token (lido do cookie httpOnly) e emite um novo access token',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    requireAllowedOrigin(req, this.config);
    const refreshToken = readRefreshCookie(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Sessão ausente ou expirada.');
    }
    try {
      return this.withCookie(res, await this.refreshSessionUseCase.execute(refreshToken));
    } catch (err) {
      clearRefreshCookie(res, this.config);
      throw err;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  @ApiOperation({ summary: 'Revoga o refresh token do cookie e limpa o cookie' })
  async logout(
    @CurrentUser() user: Actor,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    requireAllowedOrigin(req, this.config);
    await this.logoutUseCase.execute(user.sub, readRefreshCookie(req));
    clearRefreshCookie(res, this.config);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  async me(@CurrentUser() user: Actor): Promise<UserResponseDto> {
    return toUserResponse(await this.getMeUseCase.execute(user.sub));
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({
    summary:
      'Troca o nome da própria conta (no doador, também no eligibility-service) e/ou pede a troca do ' +
      'e-mail: exige a senha atual e o novo e-mail só vale depois de confirmado pelo link enviado a ' +
      'ele (`pendingEmail` na resposta). Limitado a 10 requisições / 15min.',
  })
  async updateMe(@CurrentUser() user: Actor, @Body() dto: UpdateMeDto): Promise<UserResponseDto> {
    return toUserResponse(await this.updateMyAccountUseCase.execute(user.sub, dto));
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  @ApiOperation({
    summary:
      'Confirma o e-mail pelo token do link (sem login). Link de uma troca pendente: o novo e-mail ' +
      'vira o login e o endereço antigo é avisado. Limitado a 10 requisições / 15min por IP.',
  })
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<VerifyEmailResponseDto> {
    return this.verifyEmailUseCase.execute(dto.token);
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 15 * 60 * 1000 } })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('me/resend-verification')
  @ApiOperation({
    summary:
      'Reenvia o link de confirmação (do e-mail novo, se há troca pendente; senão, do atual, se não ' +
      'confirmado). Limitado a 3 requisições / 15min.',
  })
  resendVerification(@CurrentUser() user: Actor): Promise<ResendVerificationResponseDto> {
    return this.resendVerificationUseCase.execute(user.sub);
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('me/delete-data')
  @ApiOperation({
    summary:
      '[LGPD] Solicita a exclusão (anonimização) dos próprios dados pessoais. Exige a senha ' +
      'atual; restrito a contas de doador; encerra todas as sessões e limpa o cookie. ' +
      'Limitado a 5 tentativas / 15min.',
  })
  async deleteMyData(
    @CurrentUser() user: Actor,
    @Body() dto: DeleteMyDataDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.deleteMyAccountUseCase.execute(user.sub, dto.currentPassword);
    clearRefreshCookie(res, this.config);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  @ApiOperation({
    summary:
      'Solicita a redefinição de senha. Sempre responde com uma mensagem genérica (não revela ' +
      'se o e-mail existe); veja ForgotPasswordResponseDto sobre como o token é devolvido. ' +
      'Limitado a 5 requisições / 15min por IP (evita força bruta/spam de geração de token).',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ForgotPasswordResponseDto> {
    return toForgotPasswordResponse(await this.forgotPasswordUseCase.execute(dto));
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('reset-password')
  @ApiOperation({
    summary:
      'Redefine a senha usando o token gerado por /auth/forgot-password (válido por 15min). ' +
      'Limitado a 10 requisições / 15min por IP.',
  })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.resetPasswordUseCase.execute(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('admins')
  @ApiOperation({ summary: '[admin] Lista todos os usuários admin' })
  async listAdmins(): Promise<UserResponseDto[]> {
    return (await this.listAdminsUseCase.execute()).map(toUserResponse);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post('admins/:id/deactivate')
  @ApiOperation({
    summary:
      '[admin] Desativa outro usuário admin (bloqueado para a própria conta e para o último ' +
      'admin ativo)',
  })
  async deactivateAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: Actor,
  ): Promise<UserResponseDto> {
    return toUserResponse(await this.deactivateAdminUseCase.execute(id, user.sub));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post('admins/:id/reactivate')
  @ApiOperation({ summary: '[admin] Reativa um usuário admin previamente desativado' })
  async reactivateAdmin(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return toUserResponse(await this.reactivateAdminUseCase.execute(id));
  }
}
