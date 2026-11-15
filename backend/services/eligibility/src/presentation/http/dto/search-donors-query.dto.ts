import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

/** [admin] Busca paginada de doadores por nome ou CPF (tela Doadores do painel). */
export class SearchDonorsQueryDto {
  @ApiProperty({
    description: 'Nome (parcial) ou CPF (parcial/completo), com ao menos 2 caracteres.',
  })
  @IsString()
  @Length(2, 150)
  search!: string;

  @ApiPropertyOptional({ description: 'Página (começa em 1).', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page: number = 1;
}
