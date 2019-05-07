// // https://github.com/mirek/node-pg-safe-numbers/blob/master/src/index.js
// const pg = require('pg')
// // const pg = require('loopback-connector-postgresql/node_modules/pg')
// const util = require('util')
// const logger = require('../../common/utility').loggerBuilder('PGDataType')

// module.exports = function (server) {
//   // Returns text for unsafe int
//   function defaultUnsafeint(parsed, text) {
//     logger.error(`Unsafe int parse ${util.inspect(text)} to ${util.inspect(parsed)}.`)
//     return text
//   }

//   function safeParseInt(text) {
//     const parsed = parseInt(text, 10)
//     if (Number.isSafeInteger(parsed) || isNaN(parsed)) {
//       return parsed
//     }
//     return defaultUnsafeint(parsed, text)
//   }

//   // Retain Numeric type for Get requests
//   // https://github.com/brianc/node-pg-types/
//   // https://github.com/brianc/node-pg-types/issues/28
//   // 20 = bigint
//   pg.types.setTypeParser(20, 'text', safeParseInt)
// }
