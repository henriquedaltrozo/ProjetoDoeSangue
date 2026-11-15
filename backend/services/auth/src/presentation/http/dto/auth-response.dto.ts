import { Role } from '@shared/domain/enums';
import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: Role }) role: Role;
  @ApiProperty({ required: false, nullable: true }) donorId: string | null;
  @ApiProperty() active: boolean;
  @ApiProperty({ description: 'Confirmou o e-mail (sem confirmar, o doador não agenda)' })
  emailVerified: boolean;
  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Novo e-mail à espera de confirmação',
  })
  pendingEmail: string | null;
}

/** Corpo devolvido ao cliente: o refresh token vai só no cookie httpOnly, nunca no JSON. */
export class AuthResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
}
