/**
 * Testes de services/eligibility: unitários em tests/unit/eligibility (espelham src/).
 * Os de integração (Postgres real) ficam em tests/integration/eligibility e rodam com `pnpm run test:integration`. Aliases: @src/* (src/),
 * @test/support/* (tests/support/eligibility), @shared/*.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/../../tests/unit/eligibility'],
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/../../tests/support/shared/unit-env.ts'],
  modulePaths: ['<rootDir>/node_modules'],
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@test/support/(.*)$': '<rootDir>/../../tests/support/eligibility/$1',
    '^@shared/contracts$': '<rootDir>/../../shared/src/contracts',
    '^@shared/bootstrap$': '<rootDir>/../../shared/src/bootstrap',
    '^@shared/testing/(.*)$': '<rootDir>/../../tests/support/shared/$1',
    '^@shared/(domain|application|infrastructure|presentation)/(.*)$': '<rootDir>/../../shared/src/$1/$2',
  },
};
