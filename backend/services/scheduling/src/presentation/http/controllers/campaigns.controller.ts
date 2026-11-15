import { Role } from '@shared/domain/enums';
import { JwtAuthGuard, Roles, RolesGuard } from '@shared/presentation/auth';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FindCampaignUseCase } from '../../../application/use-cases/campaign/find-campaign.use-case';
import { CreateCampaignUseCase } from '../../../application/use-cases/campaign/create-campaign.use-case';
import { DeactivateCampaignUseCase } from '../../../application/use-cases/campaign/deactivate-campaign.use-case';
import { ListActiveCampaignsUseCase } from '../../../application/use-cases/campaign/list-active-campaigns.use-case';
import { CreateCampaignDto } from '../dto/create-campaign.dto';
import { type CampaignResponse, toCampaignResponse } from '../presenters/campaign.presenter';

@ApiTags('campaigns')
@Controller('campaigns')
export class CampaignsController {
  constructor(
    private readonly listActive: ListActiveCampaignsUseCase,
    private readonly findCampaign: FindCampaignUseCase,
    private readonly createCampaign: CreateCampaignUseCase,
    private readonly deactivateCampaign: DeactivateCampaignUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista campanhas ativas (usado na home do portal do doador)' })
  async list(): Promise<CampaignResponse[]> {
    return (await this.listActive.execute()).map(toCampaignResponse);
  }

  @Get(':id')
  async find(@Param('id', ParseUUIDPipe) id: string): Promise<CampaignResponse> {
    return toCampaignResponse(await this.findCampaign.execute(id));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({
    summary:
      '[admin] Cria uma campanha; campanhas URGENT disparam ' +
      'notificação assíncrona (BullMQ) para os doadores compatíveis',
  })
  async create(@Body() dto: CreateCampaignDto): Promise<CampaignResponse> {
    return toCampaignResponse(await this.createCampaign.execute(dto));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: '[admin] Desativa uma campanha' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<CampaignResponse> {
    return toCampaignResponse(await this.deactivateCampaign.execute(id));
  }
}
