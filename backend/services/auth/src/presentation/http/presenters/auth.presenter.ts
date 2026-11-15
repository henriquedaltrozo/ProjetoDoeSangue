import type { UserOutput } from '../../../application/dto';
import type { ForgotPasswordOutput } from '../../../application/use-cases/forgot-password.use-case';
import type { UserResponseDto } from '../dto/auth-response.dto';
import type { ForgotPasswordResponseDto } from '../dto/forgot-password.dto';

/** Representação HTTP de um usuário (contrato da API, independente do application). */
export function toUserResponse(user: UserOutput): UserResponseDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    donorId: user.donorId,
    active: user.active,
    emailVerified: user.emailVerified,
    pendingEmail: user.pendingEmail,
  };
}

/** Resposta do "esqueci a senha": o token só aparece quando o application o devolveu (modo sem SMTP). */
export function toForgotPasswordResponse(output: ForgotPasswordOutput): ForgotPasswordResponseDto {
  return output.resetToken === undefined
    ? { message: output.message }
    : { message: output.message, resetToken: output.resetToken };
}
