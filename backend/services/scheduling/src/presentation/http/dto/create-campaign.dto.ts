import { BloodType } from '@shared/domain/enums';
import { CampaignType } from '../../../domain/enums';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { IsCalendarDate } from '@shared/presentation/http';

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  @Length(3, 150)
  title: string;

  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @Length(3, 2000)
  description: string;

  @ApiProperty({ enum: CampaignType })
  @IsEnum(CampaignType)
  type: CampaignType;

  @ApiProperty({ enum: BloodType, required: false })
  @IsOptional()
  @IsEnum(BloodType)
  targetBloodType?: BloodType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  collectionUnitId?: string;

  @ApiProperty()
  @IsCalendarDate()
  startDate: string;

  @ApiProperty()
  @IsCalendarDate()
  endDate: string;
}
