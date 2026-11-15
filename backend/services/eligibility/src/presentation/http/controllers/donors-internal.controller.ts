import type { DonorContactOutput, DonorRecipientOutput } from '@shared/application/dto';
import { InternalApiKeyGuard } from '@shared/presentation/auth';
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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnonymizeDataUseCase } from '../../../application/use-cases/anonymize-data.use-case';
import { CompleteDonationUseCase } from '../../../application/use-cases/complete-donation.use-case';
import { CreateDonorUseCase } from '../../../application/use-cases/create-donor.use-case';
import { FindDonorByUserUseCase } from '../../../application/use-cases/find-donor-by-user.use-case';
import { FindDonorContactUseCase } from '../../../application/use-cases/find-donor-contact.use-case';
import { ListContactsUseCase } from '../../../application/use-cases/list-contacts.use-case';
import { UpdateDonorIdentityUseCase } from '../../../application/use-cases/update-donor-identity.use-case';
import { CompleteDonationDto } from '../dto/complete-donation.dto';
import { CreateDonorDto } from '../dto/create-donor.dto';
import { ListContactsQueryDto } from '../dto/list-contacts-query.dto';
import { UpdateDonorIdentityDto } from '../dto/update-donor-identity.dto';
import { type DonorResponse, toDonorResponse } from '../presenters';

/**
 * Rotas de doador chamadas só por outros serviços (auth e scheduling), autenticadas pela
 * x-internal-api-key. O gateway não as repassa: respondem 404 na porta pública. Este controller é
 * registrado antes do DonorsController para que `GET /donors/internal/...` não caia em `GET /donors/:id`.
 */
@ApiTags('donors')
@Controller('donors')
@UseGuards(InternalApiKeyGuard)
export class InternalDonorsController {
  constructor(
    private readonly createDonor: CreateDonorUseCase,
    private readonly findDonorByUser: FindDonorByUserUseCase,
    private readonly listContactsUseCase: ListContactsUseCase,
    private readonly anonymizeData: AnonymizeDataUseCase,
    private readonly completeDonationUseCase: CompleteDonationUseCase,
    private readonly updateDonorIdentity: UpdateDonorIdentityUseCase,
    private readonly findDonorContact: FindDonorContactUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: '[interno] Cria o doador associado a um usuário recém-cadastrado' })
  async create(@Body() dto: CreateDonorDto): Promise<DonorResponse> {
    return toDonorResponse(await this.createDonor.execute(dto));
  }

  @Get('internal/by-user/:userId')
  @ApiOperation({
    summary:
      '[interno] Id do doador associado a um usuário (usado pelo auth-service para concluir ou ' +
      'desfazer um cadastro cujo resultado ficou incerto); 404 se não existir',
  })
  async idByUser(@Param('userId', ParseUUIDPipe) userId: string): Promise<{ id: string }> {
    const donor = await this.findDonorByUser.execute(userId);
    return { id: donor.id };
  }

  @Patch('internal/:id/identity')
  @ApiOperation({
    summary:
      '[interno] Troca nome e/ou e-mail do doador (chamado pelo auth-service em PATCH /auth/me)',
  })
  async updateIdentity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDonorIdentityDto,
  ): Promise<DonorResponse> {
    return toDonorResponse(await this.updateDonorIdentity.execute(id, dto));
  }

  @Get('internal/:id/contact')
  @ApiOperation({
    summary:
      '[interno] Nome e e-mail de um doador, para um aviso individual (ex.: agendamento cancelado); ' +
      '`active` falso = conta excluída. 404 se não existir',
  })
  contact(@Param('id', ParseUUIDPipe) id: string): Promise<DonorRecipientOutput> {
    return this.findDonorContact.execute(id);
  }

  @Get('internal/contacts')
  @ApiOperation({
    summary:
      '[interno] Contatos dos doadores ativos e aptos a doar hoje, opcionalmente filtrados por tipo sanguíneo ' +
      '(usado pelo scheduling-service para campanhas de urgência)',
  })
  listContacts(@Query() query: ListContactsQueryDto): Promise<DonorContactOutput[]> {
    return this.listContactsUseCase.execute(query.bloodType);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/anonymize')
  @ApiOperation({
    summary:
      '[LGPD, interno] Anonimiza os dados identificantes do doador (nome/CPF/telefone/e-mail e ' +
      'motivos em texto livre). Chamado pelo auth-service ao processar POST /auth/me/delete-data.',
  })
  async anonymize(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.anonymizeData.execute(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/donations/complete')
  @ApiOperation({
    summary:
      '[interno] Registra a conclusão de uma doação (atualiza lastDonationAt; idempotente, nunca recua a data)',
  })
  async completeDonation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteDonationDto,
  ): Promise<DonorResponse> {
    return toDonorResponse(await this.completeDonationUseCase.execute(id, dto.donationDate));
  }
}
