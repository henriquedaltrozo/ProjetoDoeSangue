/**
 * Testes de shared: unitários em tests/unit/shared (espelham src/).
 * Os de integração (Postgres real) ficam em tests/integration/shared e rodam com `pnpm run test:integration`. Aliases: @src/* (src/),
 * @test/support/* (tests/support/shared), @shared/*.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/../tests/unit/shared'],
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  testEnvironment: 'node',
  modulePaths: ['<rootDir>/node_modules'],
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@test/support/(.*)$': '<rootDir>/../tests/support/shared/$1',
    '^@shared/contracts$': '<rootDir>/src/contracts',
    '^@shared/bootstrap$': '<rootDir>/src/bootstrap',
    '^@shared/testing/(.*)$': '<rootDir>/../tests/support/shared/$1',
    '^@shared/(domain|application|infrastructure|presentation)/(.*)$': '<rootDir>/src/$1/$2',
  },
};
