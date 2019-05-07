'use strict';

const fs = require('fs');
const path = require('path');

module.exports = (app) => {
  // const dir = path.resolve('downloads/tmp')
  // if (!fs.existsSync(dir)) {
  //   console.log('create tmp download dir')
  //   fs.mkdirSync(dir)
  // }

  const renameIncomingFile = function (file, req, res) {
    const origFilename = file.name;
    const parts = origFilename.split('.');
    const extension = parts[parts.length - 1];
    const newFilename = `${parts[parts.length - 2]}_${(new Date()).getTime()}.${extension}`
    return newFilename
  }

  // app.dataSources.localFileStorage.connector.getFilename = renameIncomingFile;
  // app.dataSources.storage.connector.getFilename = renameIncomingFile;
  app.dataSources.uniqNameStorage.connector.getFilename = renameIncomingFile;
};
