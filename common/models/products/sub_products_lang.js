const { newLoopbackError, HTTPStatusCode: { FORBIDDEN } } = require('../../utility')

const sampleValidMapObject = [{ title: 'string', description: 'string', latitude: '100.1', longitude: '100.1' }]
const sampleValidItineraryObject = [{ title: 'string', description: 'string', time: { from: '09:00', to: '11:00' } }]

module.exports = function (SubProductsLang) {
  // hide delete remote method
  // SubProductsLang.disableRemoteMethodByName('deleteById');
  SubProductsLang.disableRemoteMethodByName('prototype.__delete__accessTokens');
  SubProductsLang.disableRemoteMethodByName('prototype.__destroyById__accessTokens');

  // valadation map
  SubProductsLang.observe('before save', (ctx, next) => {
    const newData = ctx.instance || ctx.data
    if (!newData || !newData.map || newData.map === '') return next()
    try {
      const mapsArrays = JSON.parse(newData.map)
      if (mapsArrays.length === 0) return next()
      const isValid = mapsArrays
        .map(mapObject => (mapObject.title != undefined && mapObject.description != undefined && mapObject.latitude != undefined && mapObject.longitude != undefined))
        .reduce((acc, cur) => acc && cur)
      if (!isValid) return next(newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'SubProductsLang.map validation error', { map: newData.map, sampleValidMapObject }))
    } catch (error) {
      return next(newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'SubProductsLang.map validation error', { map: newData.map, sampleValidMapObject }))
    }
    return next()
  })

  // valadation itinerary
  SubProductsLang.observe('before save', (ctx, next) => {
    const newData = ctx.instance || ctx.data
    if (!newData || !newData.itinerary || newData.itinerary === '') return next()
    try {
      const itinerarysArrays = JSON.parse(newData.itinerary)
      if (itinerarysArrays.length === 0) return next()
      const isValid = itinerarysArrays
        .map(itineraryObject => (itineraryObject.title != undefined && itineraryObject.description != undefined
          && itineraryObject.time != undefined && itineraryObject.time.from != undefined && itineraryObject.time.to != undefined))
        .reduce((acc, cur) => acc && cur)
      if (!isValid) return next(newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'SubProductsLang.itinerary validation error', { itinerary: newData.itinerary, sampleValidItineraryObject }))
    } catch (error) {
      return next(newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'SubProductsLang.itinerary validation error', { itinerary: newData.itinerary, sampleValidItineraryObject }))
    }
    return next()
  })
};
