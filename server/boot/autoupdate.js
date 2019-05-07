const chalk = require('chalk');
const program = require('commander');

console.log('Auto update module checking for input....');
module.exports = function (app) {
    const path = require('path');
    const models = app.models;
    const datasources = app.datasources.theasia;
    function autoUpdateAll() {
        Object.keys(models).forEach((key) => {
            if (!(key == 'container' || key == 'Container')) {
                datasources.isActual(key, (err, actual) => {
                    if (!actual) {
                        datasources.autoupdate(key, (err) => {
                            if (err) throw err;
                            console.log(`Model ${key} updated`);
                        });
                    }
                    else {
                        console.log('No update required');
                    }
                });
            }
        });
    }

    program.command('autoupdate').alias('update-db').description('update db with existing models').action(() => {
        console.log(chalk.blue('Auto update called'));
        autoUpdateAll();
    });
    program.parse(process.argv);
};
