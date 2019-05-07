/**
 * loopback-discover-database.js
 * run: node ./bin/discovery.js
 */

var fs = require('fs');
var loopback = require('loopback');
var commonFolder = '../../common';
var modelsFolder = commonFolder+'/models';
var serverPath = '../../server/';
var modelConfig = require(serverPath + 'model-config');
var dataSources = require(serverPath + 'datasources');
var dataSourceName = 'theasia';

var ds = loopback.createDataSource('postgres', dataSources[dataSourceName]);

initMain();

function initMain(){

  if (!fs.existsSync(commonFolder)){
      fs.mkdirSync(commonFolder);
  }
  if (!fs.existsSync(modelsFolder)){
      fs.mkdirSync(modelsFolder);
  }

  discoverAndCreate();
}

function discoverAndCreate(callback){
  ds.discoverModelDefinitions({ schema: 'main' },function (err, models) {
    console.log(models);
    models.forEach(function (def, index, array) {
      // def.name ~ the model name
      ds.discoverSchema(def.name, {associations: true}, function (err, schema) {
        schema.name = schema.name.toLowerCase();
        fs.writeFile('common/models/'+def.name+'.json', prettyJSON(schema), function(err){
          if (err) throw err;
          console.log('It\'s saved!');
          //If last, then save
          if(index === array.length - 1){
            saveAndExposeSchemas();
          }
        });
        addSchema(schema.name);
      });
    });
  });
}

function addSchema(schema){
  modelConfig[schema] = {
    dataSource: dataSourceName,
    public: true,
    $promise: {},
    $resolved: true
  };
}

function saveAndExposeSchemas(){
  fs.writeFile('server/model-config.json', prettyJSON(modelConfig), function(err){
    if (err) throw err;
    console.log('Schemas are exposed!');
  });
}

function prettyJSON(str){
  return JSON.stringify(str, null, '  ');
}