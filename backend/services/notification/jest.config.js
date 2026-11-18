/**
 * Testes de services/notification: unitários em tests/unit/notification (espelham src/).
 * Os de integração (Postgres real) ficam em tests/integration/notification e rodam com `pnpm run test:integration`. Aliases: @src/* (src/),
 * @test/support/* (tests/support/notification), @shared/*.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/../../tests/unit/notification'],
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/../../tests/support/shared/unit-env.ts'],
  modulePaths: ['<rootDir>/node_modules'],
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@test/support/(.*)$': '<rootDir>/../../tests/support/notification/$1',
    '^@shared/contracts$': '<rootDir>/../../shared/src/contracts',
    '^@shared/bootstrap$': '<rootDir>/../../shared/src/bootstrap',
    '^@shared/testing/(.*)$': '<rootDir>/../../tests/support/shared/$1',
    '^@shared/(domain|application|infrastructure|presentation)/(.*)$': '<rootDir>/../../shared/src/$1/$2',
  },
};
