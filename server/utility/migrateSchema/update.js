const chalk = require('chalk');

const app = require('../..');

const tables = require('./tables');

app.on('started', () => {
  console.log(chalk.bold('\nDB migration (update) started ...'));
  const ds = app.dataSources.theasia;

  ds.autoupdate(tables, async (error, ...rest) => {
    console.log('rest', rest);
    if (error) {
      throw error;
    }
    console.log(
      chalk.green(`\nDB migration finished, see effected tables below`),
      `\n- ${tables.join('\n- ')}\n`,
    );

    ds.disconnect();
    process.exit(0);
  });
});
