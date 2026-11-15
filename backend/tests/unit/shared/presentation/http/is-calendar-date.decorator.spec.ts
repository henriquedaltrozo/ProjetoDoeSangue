import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IsCalendarDate } from '@src/presentation/http/is-calendar-date.decorator';

class Query {
  @IsCalendarDate()
  date: string;
}

const errorsFor = (date: unknown) => validateSync(plainToInstance(Query, { date }));

describe('IsCalendarDate', () => {
  it.each(['2026-09-15', '2024-02-29'])('aceita %s', (date) => {
    expect(errorsFor(date)).toHaveLength(0);
  });

  it.each(['2026-09-15T10:00:00Z', '2026-02-30', '2026-9-15', '15/09/2026', ''])(
    'recusa %p',
    (date) => {
      expect(errorsFor(date)).toHaveLength(1);
    },
  );
});
