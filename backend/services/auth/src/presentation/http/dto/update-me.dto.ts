import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

/** Troca de nome e/ou e-mail da própria conta. Trocar o e-mail exige a senha atual. */
export class UpdateMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Senha atual; obrigatória para trocar o e-mail' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentPassword?: string;
}
