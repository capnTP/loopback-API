const xml2js = require('xml2js')

function xml2Json(xml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, (error, parsed) => {
      if (error) return reject(error)
      const json = JSON.parse(JSON.stringify(parsed))
      return resolve(json)
    })
  })
}

function json2xml(json) {
  const builder = new xml2js.Builder()
  return builder.buildObject(json)
}

module.exports = {
  xml2Json,
  json2xml,
}
