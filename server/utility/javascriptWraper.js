const request = require('request');
const fs = require('fs');
const mime = require('mime-to-extensions');

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
