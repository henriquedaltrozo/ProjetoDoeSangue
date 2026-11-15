import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Corpo de POST /auth/verify-email: o token do link enviado por e-mail. */
export class VerifyEmailDto {
  @ApiProperty({ description: 'Token do link de confirmação de e-mail' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  token: string;
}

export class VerifyEmailResponseDto {
  @ApiProperty({ description: 'O e-mail confirmado (o login da conta a partir de agora)' })
  email: string;

  @ApiProperty({ description: 'true quando a confirmação concluiu uma troca de e-mail' })
  changed: boolean;
}

export class ResendVerificationResponseDto {
  @ApiProperty({
    nullable: true,
    description: 'Para qual endereço o link foi enviado (null se não havia nada a confirmar)',
  })
  sentTo: string | null;
}
