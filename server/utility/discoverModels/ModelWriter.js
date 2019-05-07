// https://loopback.io/doc/en/lb3/Discovering-models-from-relational-databases.html
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const loopback = require('loopback');
const mkdirp = require('mkdirp');
const changeCase = require('change-case');

const writeFile = promisify(fs.writeFile);

const promisifyMkdirp = promisify(mkdirp);

const DATASOURCE_NAME = 'theasia';
const dataSourceConfig = require('../../datasources.json');

const db = new loopback.DataSource(dataSourceConfig[DATASOURCE_NAME]);

function ModelWriter(modelsFolderPath, modelConfig) {
  this.path = modelsFolderPath;
  this.config = Object.assign({}, modelConfig);
}

ModelWriter.prototype.asyncWriteModelFiles = async function asyncWriteModelFiles(tableName) {
  const schemaName = 'main';
  const tableNameWithSchema = `${schemaName}.${tableName}`;
  // It's important to pass the same "options" object to all calls
  // of dataSource.discoverSchemas(), it allows the method to cache
  // discovered related models
  const options = { relations: true, schema: schemaName };

  const schema = await db.discoverSchemas(tableName, options);
  // rename fields to snake case
  const props = schema[tableNameWithSchema].properties;
  schema[tableNameWithSchema].properties = Object.keys(props).reduce((newProps, key) => {
    const snakeCaseKey = changeCase.snake(key);
    newProps[snakeCaseKey] = props[key]; // eslint-disable-line no-param-reassign
    return newProps;
  }, {});
  const {
    options: { relations },
  } = schema[tableNameWithSchema];
  Object.keys(relations).forEach(key => {
    const relation = relations[key];
    if (relation) {
      relation.foreignKey = changeCase.snake(relation.foreignKey);
    }
  });

  await promisifyMkdirp(path.join(this.path, tableName));
  await writeFile(
    path.join(this.path, `${tableName}/${tableName}.json`),
    JSON.stringify(schema[tableNameWithSchema], null, 2),
  );

  const configName = changeCase.pascalCase(tableName);
  this.config[configName] = { dataSource: DATASOURCE_NAME, public: true };
};

ModelWriter.prototype.asyncWriteConfigFile = async function asyncWriteConfigFile(destinationPath) {
  await writeFile(destinationPath, JSON.stringify(this.config, null, 2));
};

module.exports = ModelWriter;
