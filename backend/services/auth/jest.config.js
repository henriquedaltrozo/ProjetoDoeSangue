/**
 * Testes de services/auth: unitários em tests/unit/auth (espelham src/).
 * Os de integração (Postgres real) ficam em tests/integration/auth e rodam com `pnpm run test:integration`. Aliases: @src/* (src/),
 * @test/support/* (tests/support/auth), @shared/*.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/../../tests/unit/auth'],
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  testEnvironment: 'node',
  modulePaths: ['<rootDir>/node_modules'],
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@test/support/(.*)$': '<rootDir>/../../tests/support/auth/$1',
    '^@shared/contracts$': '<rootDir>/../../shared/src/contracts',
    '^@shared/bootstrap$': '<rootDir>/../../shared/src/bootstrap',
    '^@shared/testing/(.*)$': '<rootDir>/../../tests/support/shared/$1',
    '^@shared/(domain|application|infrastructure|presentation)/(.*)$': '<rootDir>/../../shared/src/$1/$2',
  },
};
