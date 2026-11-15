import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** Confirmação da exclusão da conta: a senha atual (a exclusão não tem volta). */
export class DeleteMyDataDto {
  @ApiProperty({ description: 'Senha atual da conta' })
  @IsString()
  @Length(1, 200)
  currentPassword: string;
}
