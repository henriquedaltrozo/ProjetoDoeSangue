import { IsCalendarDate } from '@shared/presentation/http';
import { IsOptional } from 'class-validator';

/**
 * Corpo de POST /donors/:id/donations/complete (chamada interna). `donationDate` (AAAA-MM-DD) é a
 * data em que a doação foi concluída: com ela a operação é idempotente (repetir ou atrasar a
 * chamada dá o mesmo resultado) e nunca recua uma `lastDonationAt` mais recente. Sem ela, vale hoje.
 */
export class CompleteDonationDto {
  @IsOptional()
  @IsCalendarDate()
  donationDate?: string;
}
