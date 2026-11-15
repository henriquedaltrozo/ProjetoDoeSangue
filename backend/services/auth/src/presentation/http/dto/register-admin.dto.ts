import { MaxPasswordBytes } from './password.validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class RegisterAdminDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxPasswordBytes()
  password: string;

  @ApiProperty()
  @IsString()
  @Length(3, 150)
  name: string;
}
