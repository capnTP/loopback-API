const chalk = require('chalk');

const app = require('../..');

const seed = require('./seed');
const tables = require('./tables');

app.on('started', () => {
  console.log(chalk.bold('\nDB migration (update) started ...'));
  const ds = app.dataSources.theasia;

  ds.automigrate(tables, async (error, ...rest) => {
    console.log('rest', rest);
    if (error) {
      throw error;
    }
    console.log(
      chalk.green(`\nDB migration finished, see effected tables below`),
      `\n- ${tables.join('\n- ')}\n`,
    );

    await seed(app);

    ds.disconnect();
    process.exit(0);
  });
});
