import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class CreateCollectionUnitDto {
  @ApiProperty()
  @IsString()
  @Length(3, 150)
  name: string;

  @ApiProperty()
  @IsString()
  @Length(3, 255)
  address: string;

  @ApiProperty({ example: 'Centro' })
  @IsString()
  @Length(2, 100)
  neighborhood: string;

  @ApiProperty()
  @IsString()
  @Length(2, 100)
  city: string;

  @ApiProperty({ example: 'RS' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'A UF deve ter 2 letras.' })
  uf: string;

  @ApiProperty({ description: 'DDD + número, só dígitos (10 ou 11)' })
  @IsString()
  @Matches(/^\d{10,11}$/, { message: 'Informe o telefone com DDD, só números (10 ou 11 dígitos).' })
  phone: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  simultaneousCapacity: number;

  @ApiProperty({ required: false, description: 'Ex: {"seg": ["08:00-17:00"]}' })
  @IsOptional()
  @IsObject()
  operatingHours?: Record<string, string[]>;
}
