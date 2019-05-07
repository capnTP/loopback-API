const request = require('request')
const fs = require('fs')
const mime = require('mime-to-extensions')
const winston = require('winston')
const _ = require('lodash')
const { errorReporting } = require('./helpers/slack')

module.exports.constants = {
  isProduction: process.env.NODE_ENV === 'production',
  developmentEmail: 'test1@mail.theasiadev.com',
  noreplyEmail: 'no-reply@theasia.com',
  bizEmail: 'biz@theasia.com',
}

/**
 * avoid cannot read property of undefined
 * exanple object = {a:lot:{of='x'}};
 * getSafe(()=>object.a.log.of.properties) will returned undefined
 * getSafe(()=>object.a.log.of) will returned 'x'
 * @param {function} () => obj.a.lot.of.properties
 */
module.exports.getSafe = (fn) => {
  try {
    return fn();
  } catch (error) {
    return undefined;
  }
};

module.exports.download = async uri =>
  new Promise((resolve, reject) => {
    request(uri).on('response', (response) => {
      try {
        const type = response.headers['content-type'];
        const filename = `${(new Date()).getTime()}.${mime.extension(type)}`;
        return response.pipe(fs.createWriteStream(`downloads/tmp/${filename}`)).on('close', () => resolve({ filename, type }));
      } catch (error) {
        return reject(error);
      }
    });
  });

/**
 * Create error object for loop back response with status 403 with out stack
 * @param {String} name
 * @param {String} message
 * @param {Objcet} details
 */
module.exports.newLoopbackClientError = (name, message = undefined, details = undefined) => ({ name, message, status: 403, details })
/**
 * Create error object for loop back response with status 500 with out stack
 * @param {String} name
 * @param {String} message
 * @param {Objcet} details
 */
module.exports.newLoopbackServerError = (name, message = undefined, details = undefined) => ({ name, message, status: 500, details })
/**
 * Create error object for loop back response
 * @param {Http-Status-Code} status (200, 403 500)
 * @param {String} name
 * @param {String} message
 * @param {Objcet} details
 */
module.exports.newLoopbackError = (status, name, message = undefined, details = undefined) => ({ name, message, status, details })
module.exports.HTTPStatusCode = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  MOVE_PERMANENTLY: 301,
  NOT_MODIFIED: 304,
  REDIRECTED: 308,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
  SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
}

// { error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 }

module.exports.loggerBuilder = label => new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      colorize: (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'development'),
      level: 'debug',
      label,
      prettyPrint: true,
    }),
  ],
})

module.exports.generalErrorHandler = function (filename, functionName, error) {
  const text = `
    Filename: \`${filename}\` \n` +
    `Function: \`${functionName}\` \n` +
    `Error: \`\`\`${error}\`\`\` \n 
  `
  errorReporting(text)
  const { newLoopbackError, HTTPStatusCode } = module.exports
  return newLoopbackError(HTTPStatusCode.SERVER_ERROR, 'SERVER_ERROR', 'UNHANDLED_SERVER_ERROR', error)
}
