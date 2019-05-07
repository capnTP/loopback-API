const _ = require('lodash')

module.exports = (ToursCategories) => {
  ToursCategories.beforeRemote('find', (ctx, c, next) => {
    ctx.args.filter = {
      include: 'category',
      ...ctx.args.filter,
    }
    return next()
  })

  ToursCategories.beforeRemote('findById', (ctx, c, next) => {
    ctx.args.filter = {
      include: 'category',
      ...ctx.args.filter,
    }
    return next()
  })


  ToursCategories.discover = function (city_id, category_ids = [], offset = 0, limit = 12, sort, lang_id = 0, count = false, cb) {
    let orderby = ''
    if (sort) {
      if (sort.name == 'name' && sort.type == -1) {
        orderby = 'ORDER by P.name DESC'
      }
      if (sort.name == 'name' && sort.type == 1) {
        orderby = 'ORDER by P.name ASC'
      }
      if (sort.name == 'rating' && sort.type == -1) {
        orderby = 'ORDER by P.rating DESC'
      }
      if (sort.name == 'rating' && sort.type == 1) {
        orderby = 'ORDER by P.rating ASC'
      }
      if (sort.name == 'price' && sort.type == -1) {
        orderby = 'ORDER by P.latest_minimum_price DESC'
      }
      if (sort.name == 'price' && sort.type == 1) {
        orderby = 'ORDER by P.latest_minimum_price ASC'
      }
    } else {
      orderby = 'ORDER by P.name ASC'
    }
    category_ids = category_ids.join(',')
    const connector = ToursCategories.app.dataSources.theasia.connector
    let sql = ''
    const subqury = '(select array_agg(SF.id) from main.tours_features SPF left join main.tours SP on SPF.tour_id = SP.id left join main.features SF on SPF.feature_id = SF.id where SP.id = P.id group by SP.id) as feature_ids'
    if (count) {
      if (category_ids.length) {
        sql = `SELECT P.*,PL.name as localized_name, PL.seo_description as localized_seo_description,PL.short_description as localized_short_description, ${subqury} FROM main.tours_categories PC left join main.tours P ON PC.tour_id = P.id and P.city_id = ${city_id} and P.status = true left join main.tours_lang as PL on PL.lang_id = ${lang_id} and PC.tour_id = PL.tour_id where P.id is NOT null and PC.category_id in ( ${category_ids} ) and P.latest_minimum_price > 0  GROUP BY PC.tour_id,P.id,PL.name,PL.seo_description,PL.short_description ${orderby}`
      } else {
        sql = `SELECT P.*,PL.name as localized_name, PL.seo_description as localized_seo_description,PL.short_description as localized_short_description, ${subqury} FROM main.tours_categories PC left join main.tours P ON PC.tour_id = P.id and P.city_id = ${city_id} and P.status = true left join main.tours_lang as PL on PL.lang_id = ${lang_id} and PC.tour_id = PL.tour_id where P.id is NOT null and P.latest_minimum_price > 0 GROUP BY PC.tour_id,P.id,PL.name,PL.seo_description,PL.short_description ${orderby}`
      }
    }
    else if (category_ids.length) {
        sql = `SELECT P.*,PL.name as localized_name, PL.seo_description as localized_seo_description,PL.short_description as localized_short_description, ${subqury} FROM main.tours_categories PC left join main.tours P ON PC.tour_id = P.id and P.city_id = ${city_id} and P.status = true left join main.tours_lang as PL on PL.lang_id = ${lang_id} and PC.tour_id = PL.tour_id where P.id is NOT null and PC.category_id in ( ${category_ids} ) and P.latest_minimum_price > 0  GROUP BY PC.tour_id,P.id,PL.name,PL.seo_description,PL.short_description ${orderby} limit ${limit} offset ${offset}`
      } else {
        sql = `SELECT P.*,PL.name as localized_name, PL.seo_description as localized_seo_description,PL.short_description as localized_short_description, ${subqury} FROM main.tours_categories PC left join main.tours P ON PC.tour_id = P.id and P.city_id = ${city_id} and P.status = true left join main.tours_lang as PL on PL.lang_id = ${lang_id} and PC.tour_id = PL.tour_id where P.id is NOT null and P.latest_minimum_price > 0 GROUP BY PC.tour_id,P.id,PL.name,PL.seo_description,PL.short_description ${orderby} limit ${limit} offset ${offset}`
    }


    connector.query(sql, [], (err, response) => {
      if (err) {
        return cb(err)
      }
      _.map(response, (tour, index) => {
        if (tour.localized_name) {
          response[index].name = tour.localized_name
        }
        if (tour.localized_short_description) {
          response[index].short_description = tour.localized_short_description
        }
        if (tour.localized_seo_description) {
          response[index].seo_description = tour.localized_seo_description
        }
      })
      if (count) {
        return cb(null, { count: response.length })
      }
      else {
        return cb(null, response)
      }
    })
  }

  ToursCategories.remoteMethod('discover', {
    accepts: [
      { arg: 'city_id', type: 'number', required: true },
      { arg: 'category_ids', type: 'array' },
      { arg: 'offset', type: 'number' },
      { arg: 'limit', type: 'number' },
      { arg: 'sort', type: 'object' },
      { arg: 'lang_id', type: 'number' },
      { arg: 'count', type: 'boolean' },
    ],
    returns: { arg: 'response', type: 'string', root: true },
    http: { path: '/discover/:city_id', verb: 'get' },
  })


  ToursCategories.discoverAll = function (category_ids = [], offset = 0, limit = 12, sort, lang_id = 0, count = false, cb) {
    let orderby = ''
    if (sort) {
      if (sort.name == 'name' && sort.type == -1) {
        orderby = 'ORDER by P.name DESC'
      }
      if (sort.name == 'name' && sort.type == 1) {
        orderby = 'ORDER by P.name ASC'
      }
      if (sort.name == 'rating' && sort.type == -1) {
        orderby = 'ORDER by P.rating DESC'
      }
      if (sort.name == 'rating' && sort.type == 1) {
        orderby = 'ORDER by P.rating ASC'
      }
      if (sort.name == 'price' && sort.type == -1) {
        orderby = 'ORDER by P.latest_minimum_price DESC'
      }
      if (sort.name == 'price' && sort.type == 1) {
        orderby = 'ORDER by P.latest_minimum_price ASC'
      }
    } else {
      orderby = 'ORDER by P.name ASC'
    }
    category_ids = category_ids.join(',')
    const connector = ToursCategories.app.dataSources.theasia.connector
    let sql = ''
    const subqury = '(select array_agg(SF.id) from main.tours_features SPF left join main.tours SP on SPF.tour_id = SP.id left join main.features SF on SPF.feature_id = SF.id where SP.id = P.id group by SP.id) as feature_ids'
    if (count) {
      if (category_ids.length) {
        sql = `SELECT P.*,PL.name as localized_name, PL.seo_description as localized_seo_description,PL.short_description as localized_short_description, ${subqury} FROM main.tours_categories PC left join main.tours P ON PC.tour_id = P.id and P.status = true left join main.tours_lang as PL on PL.lang_id = ${lang_id} and PC.tour_id = PL.tour_id where P.id is NOT null and PC.category_id in ( ${category_ids} ) and P.latest_minimum_price > 0  GROUP BY PC.tour_id,P.id,PL.name,PL.seo_description,PL.short_description ${orderby}`
      } else {
        sql = `SELECT P.*,PL.name as localized_name, PL.seo_description as localized_seo_description,PL.short_description as localized_short_description, ${subqury} FROM main.tours_categories PC left join main.tours P ON PC.tour_id = P.id and P.status = true left join main.tours_lang as PL on PL.lang_id = ${lang_id} and PC.tour_id = PL.tour_id where P.id is NOT null and P.latest_minimum_price > 0 GROUP BY PC.tour_id,P.id,PL.name,PL.seo_description,PL.short_description ${orderby}`
      }
    }
    else if (category_ids.length) {
      sql = `SELECT P.*,PL.name as localized_name, PL.seo_description as localized_seo_description,PL.short_description as localized_short_description, ${subqury} FROM main.tours_categories PC left join main.tours P ON PC.tour_id = P.id and P.status = true left join main.tours_lang as PL on PL.lang_id = ${lang_id} and PC.tour_id = PL.tour_id where P.id is NOT null and PC.category_id in ( ${category_ids} ) and P.latest_minimum_price > 0  GROUP BY PC.tour_id,P.id,PL.name,PL.seo_description,PL.short_description ${orderby} limit ${limit} offset ${offset}`
    } else {
      sql = `SELECT P.*,PL.name as localized_name, PL.seo_description as localized_seo_description,PL.short_description as localized_short_description, ${subqury} FROM main.tours_categories PC left join main.tours P ON PC.tour_id = P.id and P.status = true left join main.tours_lang as PL on PL.lang_id = ${lang_id} and PC.tour_id = PL.tour_id where P.id is NOT null and P.latest_minimum_price > 0 GROUP BY PC.tour_id,P.id,PL.name,PL.seo_description,PL.short_description ${orderby} limit ${limit} offset ${offset}`
    }
    connector.query(sql, [], (err, response) => {
      if (err) {
        return cb(err)
      }
      _.map(response, (tour, index) => {
        if (tour.localized_name) {
          response[index].name = tour.localized_name
        }
        if (tour.localized_short_description) {
          response[index].short_description = tour.localized_short_description
        }
        if (tour.localized_seo_description) {
          response[index].seo_description = tour.localized_seo_description
        }
      })
      if (count) {
        return cb(null, { count: response.length })
      }
      else {
        return cb(null, response)
      }
    })
  }

  ToursCategories.remoteMethod('discoverAll', {
    accepts: [
      { arg: 'category_ids', type: 'array' },
      { arg: 'offset', type: 'number' },
      { arg: 'limit', type: 'number' },
      { arg: 'sort', type: 'object' },
      { arg: 'lang_id', type: 'number' },
      { arg: 'count', type: 'boolean' },
    ],
    returns: { arg: 'response', type: 'string', root: true },
    http: { path: '/discover/all', verb: 'get' },
  })

  ToursCategories.promotionsAll = function (offset = 0, limit = 30, lang_id = 0, cb) {
    const orderby = 'ORDER by P.rating DESC'
    const connector = ToursCategories.app.dataSources.theasia.connector
    let sql = ''
    const subqury = '(select array_agg(SF.id) from main.tours_features SPF left join main.tours SP on SPF.tour_id = SP.id left join main.features SF on SPF.feature_id = SF.id where SP.id = P.id group by SP.id) as feature_ids'
    sql = `SELECT P.*,PL.name as localized_name, PL.seo_description as localized_seo_description,PL.short_description as localized_short_description, ${subqury} FROM main.tours_categories PC left join main.tours P ON PC.tour_id = P.id and P.status = true left join main.tours_lang as PL on PL.lang_id = ${lang_id} and PC.tour_id = PL.tour_id where P.id is NOT null and P.discount_percent is NOT null and P.discount_percent > 0 and  P.is_discounted = true and P.latest_minimum_price > 0 GROUP BY PC.tour_id,P.id,PL.name,PL.seo_description,PL.short_description ${orderby} limit ${limit} offset ${offset}`

    connector.query(sql, [], (err, response) => {
      if (err) {
        return cb(err)
      }
      _.map(response, (tour, index) => {
        if (tour.localized_name) {
          response[index].name = tour.localized_name
        }
        if (tour.localized_short_description) {
          response[index].short_description = tour.localized_short_description
        }
        if (tour.localized_seo_description) {
          response[index].seo_description = tour.localized_seo_description
        }
      })
      return cb(null, response)
    })
  }

  ToursCategories.remoteMethod('promotionsAll', {
    accepts: [
      { arg: 'offset', type: 'Number' },
      { arg: 'limit', type: 'Number' },
      { arg: 'lang_id', type: 'Number' },
    ],
    returns: { arg: 'response', type: 'string', root: true },
    http: { path: '/promotions/all', verb: 'get' },
  })

  ToursCategories.add = async (tours_catrgories) => {
    try {
      const toursCategories = (await Promise.all(tours_catrgories.map(async ({ tour_id, category_id }) => ToursCategories.findOrCreate({ where: { tour_id, category_id } }, { tour_id, category_id })))).map(o => o[0])
      return Promise.resolve(toursCategories)
    } catch (error) {
      console.log(error)
      return Promise.reject(error)
    }
  }
  ToursCategories.remoteMethod('add', {
    description: 'add category for tour',
    http: { verb: 'post', path: '/add' },
    accepts: [
      { arg: 'tours_catrgories', type: '[ToursCategories]', http: { source: 'body' } },
    ],
    returns: { type: '[ToursCategories]', root: true },
  })

  ToursCategories.delete = async (tours_catrgories) => {
    try {
      const toursCategories = (await Promise.all(tours_catrgories.map(async ({ tour_id, category_id }) => ToursCategories.destroyAll({ tour_id, category_id })))).reduce((cur, acc) => cur + acc.count, 0)
      return Promise.resolve(toursCategories)
    } catch (error) {
      console.log(error)
      return Promise.reject(error)
    }
  }
  ToursCategories.remoteMethod('delete', {
    description: 'delete category for tour',
    http: { verb: 'post', path: '/delete' },
    accepts: [
      { arg: 'tours_catrgories', type: '[ToursCategories]', http: { source: 'body' } },
    ],
    returns: { arg: 'count', type: 'object' },
  })
}
