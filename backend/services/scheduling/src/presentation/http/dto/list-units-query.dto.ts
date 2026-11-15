import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * [admin] Filtro de GET /collection-units/admin/all: sem o parâmetro, a rota devolve também as
 * unidades desativadas (para reativá-las); `includeInactive=false` devolve só as ativas. O público
 * (agendamento) usa GET /collection-units, que só lista as ativas.
 */
export class ListUnitsQueryDto {
  @ApiPropertyOptional({
    description: '[admin] Se false, devolve só as unidades ativas.',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;
}
