import { Role } from '@shared/domain/enums';
import { JwtAuthGuard, Roles, RolesGuard } from '@shared/presentation/auth';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FindCollectionUnitUseCase } from '../../../application/use-cases/collection-unit/find-collection-unit.use-case';
import { CreateCollectionUnitUseCase } from '../../../application/use-cases/collection-unit/create-collection-unit.use-case';
import { DeactivateCollectionUnitUseCase } from '../../../application/use-cases/collection-unit/deactivate-collection-unit.use-case';
import { ListActiveUnitsUseCase } from '../../../application/use-cases/collection-unit/list-active-units.use-case';
import { ListUnitsUseCase } from '../../../application/use-cases/collection-unit/list-units.use-case';
import { ReactivateCollectionUnitUseCase } from '../../../application/use-cases/collection-unit/reactivate-collection-unit.use-case';
import { CreateCollectionUnitDto } from '../dto/create-collection-unit.dto';
import { ListUnitsQueryDto } from '../dto/list-units-query.dto';
import {
  type CollectionUnitResponse,
  toCollectionUnitResponse,
} from '../presenters/collection-unit.presenter';

@ApiTags('collection-units')
@Controller('collection-units')
export class CollectionUnitsController {
  constructor(
    private readonly listActive: ListActiveUnitsUseCase,
    private readonly listUnits: ListUnitsUseCase,
    private readonly findUnit: FindCollectionUnitUseCase,
    private readonly createUnit: CreateCollectionUnitUseCase,
    private readonly deactivateUnit: DeactivateCollectionUnitUseCase,
    private readonly reactivateUnit: ReactivateCollectionUnitUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista as unidades de coleta ativas (usado pelo doador ao agendar)' })
  async list(): Promise<CollectionUnitResponse[]> {
    return (await this.listActive.execute()).map(toCollectionUnitResponse);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('admin/all')
  @ApiOperation({
    summary: '[admin] Lista todas as unidades, incluindo desativadas (para reativação)',
  })
  async listAll(@Query() query: ListUnitsQueryDto): Promise<CollectionUnitResponse[]> {
    return (await this.listUnits.execute(query.includeInactive ?? true)).map(
      toCollectionUnitResponse,
    );
  }

  @Get(':id')
  async find(@Param('id', ParseUUIDPipe) id: string): Promise<CollectionUnitResponse> {
    return toCollectionUnitResponse(await this.findUnit.execute(id));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: '[admin] Cadastra uma nova unidade de coleta' })
  async create(@Body() dto: CreateCollectionUnitDto): Promise<CollectionUnitResponse> {
    return toCollectionUnitResponse(await this.createUnit.execute(dto));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: '[admin] Desativa uma unidade de coleta' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<CollectionUnitResponse> {
    return toCollectionUnitResponse(await this.deactivateUnit.execute(id));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post(':id/reactivate')
  @ApiOperation({ summary: '[admin] Reativa uma unidade de coleta previamente desativada' })
  async reactivate(@Param('id', ParseUUIDPipe) id: string): Promise<CollectionUnitResponse> {
    return toCollectionUnitResponse(await this.reactivateUnit.execute(id));
  }
}
