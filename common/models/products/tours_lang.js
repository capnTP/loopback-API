const { newLoopbackError, HTTPStatusCode: { FORBIDDEN } } = require('../../utility')

const sampleValidMapObject = [{ title: 'string', description: 'string', latitude: '100.1', longitude: '100.1' }]

module.exports = (ToursLang) => {
  // validation map
  ToursLang.observe('before save', (ctx, next) => {
    const newData = ctx.instance || ctx.data
    if (!newData || !newData.map || newData.map === '') return next()
    try {
      const mapsArrays = JSON.parse(newData.map)
      if (mapsArrays.length === 0) return next()
      const isValid = mapsArrays
        .map(mapObject => (mapObject.title != undefined && mapObject.description != undefined && mapObject.latitude != undefined && mapObject.longitude != undefined))
        .reduce((acc, cur) => acc && cur)
      if (!isValid) return next(newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'Tours.map validation error', { map: newData.map, sampleValidMapObject }))
    } catch (error) {
      return next(newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'ToursLang.map validation error', { map: newData.map, sampleValidMapObject }))
    }
    return next()
  })
}
