module.exports = {
  root: true,
  env: { browser: true, es2023: true },
  extends: ['eslint:recommended', 'plugin:react/recommended'],
  settings: { react: { version: 'detect' } },
  parserOptions: { ecmaVersion: 2023, sourceType: 'module' },
  rules: { 'react/react-in-jsx-scope': 'off' }
}