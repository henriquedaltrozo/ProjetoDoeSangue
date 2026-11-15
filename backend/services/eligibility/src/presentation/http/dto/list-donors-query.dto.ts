import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsOptional, IsString, IsUUID, Length } from 'class-validator';

/** Quantos doadores `ids` busca de uma vez (uma tela de agendamentos do dia cabe com folga). */
export const MAX_DONOR_IDS = 100;

/** [admin] Busca doadores por nome ou CPF - usado pelo painel admin para localizar um doador
 * sem depender de já ter um agendamento dele (ver AdminDonorsPage no front). */
export class ListDonorsQueryDto {
  @ApiPropertyOptional({ description: 'Filtra por nome (parcial) ou CPF (parcial/completo).' })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  search?: string;

  @ApiPropertyOptional({
    description:
      'Ids de doadores separados por vírgula (ex.: para mostrar os nomes numa lista de agendamentos). ' +
      'Com ids, a busca por texto é ignorada.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsUUID('all', { each: true })
  @ArrayMaxSize(MAX_DONOR_IDS)
  ids?: string[];
}
