import { applyDecorators } from '@nestjs/common';
import { IsDateString, Matches } from 'class-validator';

/**
 * Data de calendário (sem hora) no formato AAAA-MM-DD, e que exista. O `@IsDateString()` sozinho
 * aceita data com hora (que quebraria o cálculo do dia) e datas como 2026-02-30 (que o JavaScript
 * transforma em outro dia sem avisar).
 */
export function IsCalendarDate(): PropertyDecorator {
  return applyDecorators(
    Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '$property deve estar no formato AAAA-MM-DD.' }),
    IsDateString({ strict: true }, { message: '$property não é uma data válida.' }),
  );
}
