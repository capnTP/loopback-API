const chalk = require('chalk');

async function createRecords(app, modelName, data) {
  try {
    const model = app.models[modelName];
    if (!model) {
      throw new Error(`Can not find model ${modelName}`);
    }

    const records = await model.create(data);

    console.log(
      chalk.green(`Done seeding data for "${modelName}", ${records.length} records created.`),
    );
  } catch (e) {
    console.error('Can not seed data for', modelName, e);
  }
}

module.exports = async function seed(app) {
  await createRecords(app, 'OfferConstraintTypes', [
    { id: 1, title: 'Category', description: '' },
    { id: 2, title: 'City', description: '' },
    { id: 3, title: 'Country', description: '' },
  ]);
};
