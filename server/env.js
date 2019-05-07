/* eslint-disable no-console */
const chalk = require('chalk');

const env = {
  IS_DISABLE_GRAPHIQL: process.env.IS_DISABLE_GRAPHIQL === 'true',
};

console.group(chalk.bold('\nEnvironment variables from env.js'));
Object.keys(env).forEach(key => {
  console.log(`  ${key}=${chalk.green(env[key])}`);
});
console.log('\n');
console.groupEnd();

module.exports = env;
