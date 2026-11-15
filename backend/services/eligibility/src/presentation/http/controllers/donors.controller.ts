import { Role } from '@shared/domain/enums';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@shared/presentation/auth';
import { Actor } from '@shared/application/auth';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EndUnfitnessUseCase } from '../../../application/use-cases/end-unfitness.use-case';
import { DeleteUnfitnessUseCase } from '../../../application/use-cases/delete-unfitness.use-case';
import { ExportDataUseCase } from '../../../application/use-cases/export-data.use-case';
import { FindDonorByIdUseCase } from '../../../application/use-cases/find-donor-by-id.use-case';
import { FindDonorByUserUseCase } from '../../../application/use-cases/find-donor-by-user.use-case';
import { FindDonorsUseCase } from '../../../application/use-cases/find-donors.use-case';
import { ListAuditUseCase } from '../../../application/use-cases/list-audit.use-case';
import { ListUnfitnessUseCase } from '../../../application/use-cases/list-unfitness.use-case';
import { RegisterMedicalClearanceUseCase } from '../../../application/use-cases/register-medical-clearance.use-case';
import { RegisterTemporaryUnfitnessUseCase } from '../../../application/use-cases/register-temporary-unfitness.use-case';
import { RevokeMedicalClearanceUseCase } from '../../../application/use-cases/revoke-medical-clearance.use-case';
import { RegisterPermanentUnfitnessUseCase } from '../../../application/use-cases/register-permanent-unfitness.use-case';
import { RevokePermanentUnfitnessUseCase } from '../../../application/use-cases/revoke-permanent-unfitness.use-case';
import { UpdateDonorUseCase } from '../../../application/use-cases/update-donor.use-case';
import { EndTemporaryUnfitnessDto } from '../dto/end-temporary-unfitness.dto';
import { ListDonorsQueryDto } from '../dto/list-donors-query.dto';
import { SearchDonorsQueryDto } from '../dto/search-donors-query.dto';
import { RegisterPermanentUnfitnessDto } from '../dto/register-permanent-unfitness.dto';
import { RegisterTemporaryUnfitnessDto } from '../dto/register-temporary-unfitness.dto';
import { UpdateDonorDto } from '../dto/update-donor.dto';
import {
  type AuditResponse,
  type DonorSearchResponse,
  type DataExportResponse,
  type DonorResponse,
  type UnfitnessResponse,
  toAuditResponse,
  toDataExportResponse,
  toDonorResponse,
  toUnfitnessResponse,
} from '../presenters';

/**
 * Rotas públicas de doador (passam pelo gateway, com JWT). Leituras e alterações de dados pessoais
 * são autorizadas e auditadas dentro dos próprios casos de uso. As rotas serviço-a-serviço ficam no
 * InternalDonorsController.
 */
@ApiTags('donors')
@Controller('donors')
export class DonorsController {
  constructor(
    private readonly findDonorByUser: FindDonorByUserUseCase,
    private readonly findDonors: FindDonorsUseCase,
    private readonly findDonorById: FindDonorByIdUseCase,
    private readonly updateDonor: UpdateDonorUseCase,
    private readonly registerTemporaryUnfitness: RegisterTemporaryUnfitnessUseCase,
    private readonly listUnfitnessUseCase: ListUnfitnessUseCase,
    private readonly endUnfitnessUseCase: EndUnfitnessUseCase,
    private readonly deleteUnfitnessUseCase: DeleteUnfitnessUseCase,
    private readonly exportData: ExportDataUseCase,
    private readonly listAudit: ListAuditUseCase,
    private readonly registerMedicalClearance: RegisterMedicalClearanceUseCase,
    private readonly revokeMedicalClearance: RevokeMedicalClearanceUseCase,
    private readonly registerPermanentUnfitness: RegisterPermanentUnfitnessUseCase,
    private readonly revokePermanentUnfitness: RevokePermanentUnfitnessUseCase,
  ) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Perfil do doador autenticado' })
  async me(@CurrentUser() user: Actor): Promise<DonorResponse> {
    return toDonorResponse(await this.findDonorByUser.execute(user.sub));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: '[admin] Lista/busca doadores por nome ou CPF, ou pelos ids' })
  async list(
    @Query() query: ListDonorsQueryDto,
    @CurrentUser() user: Actor,
  ): Promise<DonorResponse[]> {
    return (await this.findDonors.execute(query.search, user, query.ids)).map(toDonorResponse);
  }

  // Antes de ':id', senão "search" seria lido como o id de um doador.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('search')
  @ApiOperation({
    summary: '[admin] Busca paginada de doadores por nome ou CPF, ordenada por nome',
  })
  async search(
    @Query() query: SearchDonorsQueryDto,
    @CurrentUser() user: Actor,
  ): Promise<DonorSearchResponse> {
    const result = await this.findDonors.searchPage(query.search, query.page, user);
    return { ...result, items: result.items.map(toDonorResponse) };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: Actor,
  ): Promise<DonorResponse> {
    return toDonorResponse(await this.findDonorById.execute(id, user));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({
    summary:
      'Atualiza os dados do perfil (CPF, nascimento, sexo, telefone, peso, tipo sanguíneo, última ' +
      'doação) e as declarações. Nome e e-mail são trocados em PATCH /auth/me.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDonorDto,
    @CurrentUser() user: Actor,
  ): Promise<DonorResponse> {
    return toDonorResponse(await this.updateDonor.execute(id, dto, user));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post(':id/unfitness')
  @ApiOperation({ summary: '[admin] Registra um período de inaptidão temporária' })
  async registerUnfitness(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterTemporaryUnfitnessDto,
    @CurrentUser() user: Actor,
  ): Promise<UnfitnessResponse> {
    return toUnfitnessResponse(await this.registerTemporaryUnfitness.execute(id, dto, user));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/unfitness')
  async listUnfitness(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: Actor,
  ): Promise<UnfitnessResponse[]> {
    return (await this.listUnfitnessUseCase.execute(id, user)).map(toUnfitnessResponse);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Patch(':id/unfitness/:unfitnessId/end')
  @ApiOperation({
    summary: '[admin] Encerra antecipadamente um período de inaptidão temporária em aberto',
  })
  async endUnfitness(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('unfitnessId', ParseUUIDPipe) unfitnessId: string,
    @Body() dto: EndTemporaryUnfitnessDto,
    @CurrentUser() user: Actor,
  ): Promise<UnfitnessResponse> {
    return toUnfitnessResponse(await this.endUnfitnessUseCase.execute(id, unfitnessId, dto, user));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/unfitness/:unfitnessId')
  @ApiOperation({ summary: '[admin] Exclui uma inaptidão temporária registrada por engano' })
  async deleteUnfitness(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('unfitnessId', ParseUUIDPipe) unfitnessId: string,
    @CurrentUser() user: Actor,
  ): Promise<void> {
    await this.deleteUnfitnessUseCase.execute(id, unfitnessId, user);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/export')
  @ApiOperation({
    summary:
      '[LGPD] Exporta (portabilidade) todos os dados que o eligibility-service guarda sobre ' +
      'o doador: cadastro, inaptidões temporárias e avaliações de elegibilidade',
  })
  async export(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: Actor,
  ): Promise<DataExportResponse> {
    return toDataExportResponse(await this.exportData.execute(id, user));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post(':id/medical-clearance')
  @ApiOperation({
    summary:
      '[admin] Registra a avaliação médica favorável que libera um doador regular com 70 anos ou mais',
  })
  async clearMedically(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: Actor,
  ): Promise<DonorResponse> {
    return toDonorResponse(await this.registerMedicalClearance.execute(id, user));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Delete(':id/medical-clearance')
  @ApiOperation({ summary: '[admin] Desfaz a avaliação médica (ex.: nova avaliação desfavorável)' })
  async revokeClearance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: Actor,
  ): Promise<DonorResponse> {
    return toDonorResponse(await this.revokeMedicalClearance.execute(id, user));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post(':id/permanent-unfitness')
  @ApiOperation({ summary: '[admin] Registra a inaptidão permanente do doador (com o motivo)' })
  async markPermanentlyUnfit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterPermanentUnfitnessDto,
    @CurrentUser() user: Actor,
  ): Promise<DonorResponse> {
    return toDonorResponse(await this.registerPermanentUnfitness.execute(id, dto.reason, user));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Delete(':id/permanent-unfitness')
  @ApiOperation({ summary: '[admin] Desfaz a inaptidão permanente (registro feito por engano)' })
  async undoPermanentUnfitness(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: Actor,
  ): Promise<DonorResponse> {
    return toDonorResponse(await this.revokePermanentUnfitness.execute(id, user));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get(':id/audit')
  @ApiOperation({
    summary: '[admin] Histórico de quem acessou/alterou o perfil deste doador (log de auditoria)',
  })
  async audit(@Param('id', ParseUUIDPipe) id: string): Promise<AuditResponse[]> {
    return (await this.listAudit.execute(id)).map(toAuditResponse);
  }
}
