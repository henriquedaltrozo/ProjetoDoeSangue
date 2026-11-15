import { createTestDonor, createTestUnfitness } from '@test/support/fixtures.fake';
import { toDonorOutput, toTemporaryUnfitnessOutput } from '@src/application/dto/outputs';

describe('mappers de saída de eligibility', () => {
  it('doador: objeto simples, sem métodos nem referência à entidade', () => {
    const donor = createTestDonor();
    const record = toDonorOutput(donor) as unknown as Record<string, unknown>;

    expect(Object.getPrototypeOf(record)).toBe(Object.prototype);
    expect(record.id).toBe(donor.id);
    expect(record.cpf).toBe(donor.cpf);
    expect(typeof record.anonymize).toBe('undefined');
    expect(typeof record.updateContact).toBe('undefined');
  });

  it('inaptidão: objeto simples sem os métodos da entidade', () => {
    const unfitness = createTestUnfitness();
    const record = toTemporaryUnfitnessOutput(unfitness) as unknown as Record<string, unknown>;

    expect(Object.getPrototypeOf(record)).toBe(Object.prototype);
    expect(record.id).toBe(unfitness.id);
    expect(typeof record.end).toBe('undefined');
    expect(typeof record.isActiveAt).toBe('undefined');
  });
});
