export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js: '$1',
  },
  transform: {
    '^.+\\.js: 'babel-jest',
  },
  moduleFileExtensions: ['js'],
};