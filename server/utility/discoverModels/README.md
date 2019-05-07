# How to automatically discover new model
- Create a new table in DB for example, the table name is `some_transactions`
- Manually edit function [asyncDiscoverModels]('./index.js')
```js
// Add this line and it must be before `asyncWriteConfigFile` function
// it will create model file into specific folder
await modelWriter.asyncWriteModelFiles('some_transactions');
// This is for updating `model-config.json`
await modelWriter.asyncWriteConfigFile(configFilePath);
```
- In terminal, run command
```sh
npm run discover-models
```
