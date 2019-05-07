// https://loopback.io/doc/en/lb3/Discovering-models-from-relational-databases.html
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const mkdirp = require('mkdirp');

const ModelWriter = require('./ModelWriter');

async function asyncDiscoverModels() {
  const configFilePath = path.resolve(__dirname, '../../model-config.json');
  const modelsFolderPath = path.resolve(__dirname, '../../../common/models');
  const asyncMkdirp = promisify(mkdirp);
  await asyncMkdirp(modelsFolderPath);

  const asyncReadFile = promisify(fs.readFile);
  const configJson = await asyncReadFile(configFilePath, 'utf-8');
  const modelConfig = JSON.parse(configJson);
  const modelWriter = new ModelWriter(modelsFolderPath, modelConfig);
  await modelWriter.asyncWriteModelFiles('offers');
  await modelWriter.asyncWriteModelFiles('offer_transactions');
  await modelWriter.asyncWriteModelFiles('offer_constraint_categories');
  await modelWriter.asyncWriteModelFiles('offer_constraint_types');
  await modelWriter.asyncWriteConfigFile(configFilePath);
}

asyncDiscoverModels().then(
  () => process.exit(),
  error => {
    console.error('UNHANDLED ERROR:\n', error);
    process.exit(1);
  },
);
