const OFF = 0;
const WARN = 1;
const ERROR = 2;

module.exports = {
  extends: ['airbnb-base', 'prettier', 'prettier/standard'],
  plugins: ['prettier'],
  rules: {
    camelcase: OFF,
    'import/order': [WARN, { 'newlines-between': 'always' }],
    'no-underscore-dangle': OFF,
    'prettier/prettier': [
      ERROR,
      {
        singleQuote: true,
        trailingComma: 'all',
        bracketSpacing: true,
        jsxBracketSameLine: false,
        printWidth: 100,
        tabWidth: 2,
      },
    ],
    'no-param-reassign': OFF,
    'no-buffer-constructor': OFF, // FOR NODE VER 11.6.0 +
    'eqeqeq': OFF,
    'no-plusplus': OFF,
    'no-unused-vars': [WARN, { argsIgnorePattern: "^_" }],
    'func-names': OFF
  },
};
