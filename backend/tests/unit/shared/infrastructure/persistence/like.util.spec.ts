import { escapeLike } from '@src/infrastructure/persistence/like.util';

describe('escapeLike', () => {
  it('escapa %, _ e a barra invertida', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('não altera texto comum', () => {
    expect(escapeLike('Maria Souza')).toBe('Maria Souza');
  });
});
