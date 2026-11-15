import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}

export class ForgotPasswordResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({
    required: false,
    description:
      'Token de redefinição, em texto puro - só presente quando o e-mail existe, nenhum ' +
      'provedor SMTP real está configurado (SMTP_HOST) e o serviço não está em produção ' +
      '(modo de desenvolvimento/CI). Em produção sem SMTP, o link vai só para o log do ' +
      'auth-service; com SMTP, vai por e-mail. Nesses casos o token nunca aparece nesta resposta.',
  })
  resetToken?: string;
}
