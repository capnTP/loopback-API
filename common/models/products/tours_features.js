module.exports = (ToursFeatures) => {
  ToursFeatures.add = async (tours_features) => {
    try {
      const toursFeatures = (await Promise.all(tours_features.map(async ({ tour_id, feature_id }) => ToursFeatures.findOrCreate({ where: { tour_id, feature_id } }, { tour_id, feature_id })))).map(o => o[0])
      return Promise.resolve(toursFeatures)
    } catch (error) {
      console.log(error)
      return Promise.reject(error)
    }
  }
  ToursFeatures.remoteMethod('add', {
    description: 'add feature for tour',
    http: { verb: 'post', path: '/add' },
    accepts: [
      { arg: 'tours_features', type: '[ToursFeatures]', http: { source: 'body' } },
    ],
    returns: { type: '[ToursFeatures]', root: true },
  })

  ToursFeatures.delete = async (tours_features) => {
    try {
      const toursFeatures = (await Promise.all(tours_features.map(async ({ tour_id, feature_id }) => ToursFeatures.destroyAll({ tour_id, feature_id })))).reduce((cur, acc) => cur + acc.count, 0)
      return Promise.resolve(toursFeatures)
    } catch (error) {
      console.log(error)
      return Promise.reject(error)
    }
  }
  ToursFeatures.remoteMethod('delete', {
    description: 'delete feature for tour',
    http: { verb: 'post', path: '/delete' },
    accepts: [
      { arg: 'tours_features', type: '[ToursFeatures]', http: { source: 'body' } },
    ],
    returns: { arg: 'count', type: 'object' },
  })
}
