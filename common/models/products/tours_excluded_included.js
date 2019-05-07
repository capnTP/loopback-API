module.exports = (ToursExcludedIncluded) => {
  ToursExcludedIncluded.add = async (tours_excluded_includeds) => {
    try {
      const toursExcludedIncluded = (await Promise.all(tours_excluded_includeds.map(async ({ tour_id, excluded_include_id, type }) => ToursExcludedIncluded.findOrCreate({ where: { tour_id, excluded_include_id } }, { tour_id, excluded_include_id, type })))).map(o => o[0])
      return Promise.resolve(toursExcludedIncluded)
    } catch (error) {
      console.log(error)
      return Promise.reject(error)
    }
  }
  ToursExcludedIncluded.remoteMethod('add', {
    description: 'add feature for tour',
    http: { verb: 'post', path: '/add' },
    accepts: [
      { arg: 'tours_features', type: '[ToursExcludedIncluded]', http: { source: 'body' } },
    ],
    returns: { type: '[ToursExcludedIncluded]', root: true },
  })

  ToursExcludedIncluded.delete = async (tours_excluded_includeds) => {
    try {
      const toursExcludedIncluded = (await Promise.all(tours_excluded_includeds.map(async ({ tour_id, excluded_include_id }) => ToursExcludedIncluded.destroyAll({ tour_id, excluded_include_id })))).reduce((cur, acc) => cur + acc.count, 0)
      return Promise.resolve(toursExcludedIncluded)
    } catch (error) {
      console.log(error)
      return Promise.reject(error)
    }
  }
  ToursExcludedIncluded.remoteMethod('delete', {
    description: 'delete feature for tour',
    http: { verb: 'post', path: '/delete' },
    accepts: [
      { arg: 'tours_features', type: '[ToursExcludedIncluded]', http: { source: 'body' } },
    ],
    returns: { arg: 'count', type: 'object' },
  })
}
