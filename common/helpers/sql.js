const app = require('../../server/index.js');

function raw(query, params = []) {
  return new Promise((resolve, reject) => {
    app.dataSources.theasia.connector.query(query, params, (err, response) => {
      if (err) return resolve([])
      return resolve(response)
    })
  })
}

module.exports = {
  raw,
}
