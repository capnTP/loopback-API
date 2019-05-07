const winston = require('winston');

const appConfig = require('../config');

const logger = new winston.Logger({
  level: appConfig.loggingLevel,
  transports: [
    new winston.transports.Console({
      prettyPrint: true,
      colorize: true,
    }),
  ],
});

module.exports = logger;
