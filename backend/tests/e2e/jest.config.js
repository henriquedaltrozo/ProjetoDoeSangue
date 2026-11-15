module.exports = {
  rootDir: '.',
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  testEnvironment: 'node',
  testTimeout: 60000,
  modulePaths: ['<rootDir>/node_modules', '<rootDir>/../../shared/node_modules'],
  moduleNameMapper: { '^@shared/contracts$': '<rootDir>/../../shared/src/contracts' },
};
