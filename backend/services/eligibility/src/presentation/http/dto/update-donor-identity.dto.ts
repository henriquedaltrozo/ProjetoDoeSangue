import type { UpdateDonorIdentityInput } from '@shared/application/dto';
import { IsBoolean, IsEmail, IsOptional, IsString, Length } from 'class-validator';

/** [interno] Nome e e-mail repassados pelo auth-service. */
export class UpdateDonorIdentityDto implements UpdateDonorIdentityInput {
  @IsOptional()
  @IsString()
  @Length(3, 150)
  completeName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;
}
