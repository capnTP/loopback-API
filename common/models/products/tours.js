/* eslint-disable no-shadow */
const getSlug = require('speakingurl');
const _ = require('lodash');

const countryHelper = require('../../helpers/country');
const sqlHelper = require('../../helpers/sql');
const utility = require('../../../server/helpers/utility');
const { getSafe } = require('../../utility');
const guessLanguage = require('../../helpers/language/guessLanguage');
const priceHelper = require('../../helpers/priceV2');
const {
  newLoopbackError,
  HTTPStatusCode: { FORBIDDEN },
} = require('../../utility');
const logger = require('../../utility').loggerBuilder('Tour');

const searchTypes = {
  1: 'all',
  2: 'destinations',
  3: 'tours_activity',
};
const sampleValidMapObject = [
  {
    title: 'string',
    description: 'string',
    latitude: '100.1',
    longitude: '100.1',
  },
];

module.exports = Tours => {
  // hide delete remote method
  Tours.disableRemoteMethodByName('deleteById');
  Tours.disableRemoteMethodByName('prototype.__delete__accessTokens');
  Tours.disableRemoteMethodByName('prototype.__destroyById__accessTokens');

  const defaultFilter = {
    include: [
      {
        relation: 'features',
        scope: {
          include: {
            relation: 'feature',
            scope: {
              include: 'localization',
            },
          },
        },
      },
      {
        relation: 'categories',
        scope: {
          include: {
            relation: 'category',
            scope: {
              include: 'localization',
            },
          },
        },
      },
      {
        relation: 'excluded_included',
        scope: {
          include: {
            relation: 'exclude_include',
            scope: {
              include: 'localization',
            },
          },
        },
      },
      {
        relation: 'tour_medias',
        scope: {
          include: 'details',
        },
      },
      {
        relation: 'sub_product',
        scope: {
          include: ['localization'],
        },
      },
      {
        relation: 'cities',
        scope: {
          include: 'localization',
        },
      },
      'suppliers',
      'currencies',
      'localization',
    ],
  };

  Tours.beforeRemote('find', (ctx, tours, next) => {
    ctx.args.filter = {
      ...defaultFilter,
      limit: 40,
      ...ctx.args.filter,
    };
    return next();
  });

  Tours.beforeRemote('findById', (ctx, tour, next) => {
    ctx.args.filter = {
      ...defaultFilter,
      ...ctx.args.filter,
    };
    return next();
  });

  Tours.afterRemote('find', (ctx, instance, next) => {
    try {
      if (ctx.result) {
        ctx.result = ctx.result.map(tour => tour.toObject());
        ctx.result = ctx.result.map(tour => {
          tour.tour_medias = tour.tour_medias.sort((a, b) =>
            a.details.name.localeCompare(b.details.name),
          );
          return tour;
        });
      }
      return next();
    } catch (error) {
      console.log(error);
      return next();
    }
  });

  Tours.afterRemote('findById', (ctx, instance, next) => {
    try {
      if (ctx.result) {
        ctx.result = ctx.result.toObject();
        ctx.result.tour_medias = ctx.result.tour_medias.sort((a, b) =>
          a.details.name.localeCompare(b.details.name),
        );
      }
      return next();
    } catch (error) {
      console.log(error);
      return next();
    }
  });

  // after PATCH /tours/:id
  Tours.afterRemote('prototype.patchAttributes', async (__, instance, next) => {
    try {
      await Tours.updateDiscountPercentage([instance.id]);
      await Tours.updateMinimumPriceValueOfProduct([instance.id]);
      return next();
    } catch (error) {
      console.log('After remote updateAll', error);
      return next();
    }
  });

  const checkSlugExist = (name, mode, ctx, next, callback) => {
    if (mode === 'create') {
      Tours.findOne(
        {
          where: {
            slug: name,
          },
        },
        (err, tour) => {
          if (err) {
            console.log(err);
            return next(err);
          }
          if (tour && tour.id && ctx.instance.id != tour.id) return callback(true);
          return callback(false);
        },
      );
    }
  };
  const makeSlug = (name, ctx, next) => {
    let slug = getSlug(name);
    slug = `${slug}-${ctx.instance.id}`;
    checkSlugExist(slug, 'create', ctx, next, result => {
      if (result) {
        slug = `${utility.randomInt(1, 40)}-${slug}`;
        return makeSlug(slug, ctx, next);
      }
      ctx.instance.updateAttributes({
        slug,
      });
      return next();
    });
  };

  // validation map
  Tours.observe('before save', (ctx, next) => {
    const newData = ctx.instance || ctx.data;
    if (!newData || !newData.map || newData.map === '') return next();
    try {
      const mapsArrays = JSON.parse(newData.map);
      if (mapsArrays.length === 0) return next();
      const isValid = mapsArrays
        .map(
          mapObject =>
            mapObject.title != undefined &&
            mapObject.description != undefined &&
            mapObject.latitude != undefined &&
            mapObject.longitude != undefined,
        )
        .reduce((acc, cur) => acc && cur);
      if (!isValid) {
        return next(
          newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'Tours.map validation error', {
            map: newData.map,
            sampleValidMapObject,
          }),
        );
      }
    } catch (error) {
      return next(
        newLoopbackError(FORBIDDEN, 'VALIDATION_ERROR', 'Tours.map validation error', {
          map: newData.map,
          sampleValidMapObject,
        }),
      );
    }
    return next();
  });

  Tours.observe('after save', (ctx, next) => {
    if (ctx.isNewInstance) {
      const name = ctx.instance.name;
      return makeSlug(name, ctx, next);
    }
    return next();
  });

  Tours.observe('after save', async ctx => {
    try {
      // Category
      if (
        ctx.isNewInstance &&
        ctx.instance.id &&
        ctx.instance.category &&
        ctx.instance.category.length
      ) {
        const tour_id = getSafe(() => ctx.instance.id) || getSafe(() => ctx.where.id);
        const newTourCategoriesModel = ctx.instance.category.map(category_id => ({
          category_id,
          tour_id,
        }));
        await Tours.app.models.ToursCategories.add(newTourCategoriesModel);
      }
      if (ctx.data && ctx.where && ctx.where.id && ctx.data.category && ctx.data.category.length) {
        const tour_id = getSafe(() => ctx.instance.id) || getSafe(() => ctx.where.id);
        await Tours.app.models.ToursCategories.destroyAll({
          tour_id,
        });
        const newTourCategoriesModel = ctx.data.category.map(category_id => ({
          category_id,
          tour_id,
        }));
        await Tours.app.models.ToursCategories.add(newTourCategoriesModel);
      }
      // Feature
      if (
        ctx.isNewInstance &&
        ctx.instance.id &&
        ctx.instance.feature &&
        ctx.instance.feature.length
      ) {
        const tour_id = getSafe(() => ctx.instance.id) || getSafe(() => ctx.where.id);
        const newTourFeaturesModel = ctx.instance.feature.map(feature_id => ({
          feature_id,
          tour_id,
        }));
        await Tours.app.models.ToursFeatures.add(newTourFeaturesModel);
      }
      if (ctx.data && ctx.where && ctx.where.id && ctx.data.feature && ctx.data.feature.length) {
        const tour_id = getSafe(() => ctx.instance.id) || getSafe(() => ctx.where.id);
        await Tours.app.models.ToursFeatures.destroyAll({
          tour_id,
        });
        const newTourFeaturesModel = ctx.data.feature.map(feature_id => ({
          feature_id,
          tour_id,
        }));
        // console.log(newTourFeaturesModel)
        await Tours.app.models.ToursFeatures.add(newTourFeaturesModel);
      }
      return Promise.resolve();
    } catch (error) {
      console.log('ERROR - Tours.after save', error);
      return Promise.resolve();
    }
  });

  const detectLanguageId = (text, cb) => {
    if (typeof cb === 'function') {
      guessLanguage.detect(text, language => {
        if (language || language == 'unknow') {
          switch (language) {
            case 'th':
              return cb(null, 4);
            case 'zh':
              return cb(null, 3);
            case 'ko':
              return cb(null, 2);
            default:
              return cb(null, 1);
          }
        } else {
          return cb(null, 1);
        }
      });
    } else {
      return new Promise(resolve => {
        guessLanguage.detect(text, language => {
          switch (language) {
            case 'th':
              return resolve(4);
            case 'zh':
            case 'zh-TW':
              return resolve(3);
            case 'ko':
              return resolve(2);
            default:
              return resolve(1);
          }
        });
      });
    }
  };

  Tours.autocomplete = (query, type, lang_id, cb) => {
    if (!query || query.length < 1) {
      return cb(null, []);
    }

    return detectLanguageId(query, (err, result_lang_id) => {
      lang_id = result_lang_id;

      let sql = '';
      if (type === 'city') {
        if (lang_id === 1) {
          // city and english
          sql = `SELECT main.cities.name as name, main.cities.id as id,main.cities.slug as slug,'city' as type FROM main.cities
                    where (LOWER(cities.name) LIKE LOWER('%${query}%') ) ORDER BY name ASC limit 5`;
        } else {
          // city and other
          sql = `SELECT main.cities_lang.name as name,main.cities_lang.city_id as id,main.cities.slug as slug,'city' as type FROM main.cities_lang left join main.cities on main.cities_lang.city_id = main.cities.id
                    where main.cities_lang.lang_id = ${lang_id} and (LOWER(cities_lang.name) LIKE LOWER('%${query}%') ) ORDER BY name ASC limit 5`;
        }
      } else if (lang_id === 1) {
        // english
        sql = `(SELECT main.cities.name as name, main.cities.id as id,main.cities.slug as slug,'city' as type FROM main.cities
                  where (LOWER(cities.name) LIKE LOWER('%${query}%') ) ORDER BY name ASC limit 5) UNION
                  (SELECT main.tours.name as name, main.tours.id as id,main.tours.slug as slug,'discover' as type FROM main.tours where main.tours.default_language_id = ${lang_id} and (LOWER(tours.name) LIKE LOWER('%${query}%') ) and main.tours.status = true ORDER BY name ASC limit 5)
                  ORDER BY type ASC limit 5`;
      } else {
        // other language
        sql = `(SELECT main.cities_lang.name as name,main.cities_lang.city_id as id,main.cities.slug as slug,'city' as type FROM main.cities_lang left join main.cities on main.cities_lang.city_id = main.cities.id
                  where main.cities_lang.lang_id = ${lang_id} and (LOWER(cities_lang.name) LIKE LOWER('%${query}%') ) ORDER BY name ASC limit 5)
                  UNION
                  (SELECT main.tours_lang.name as name,main.tours_lang.tour_id as id,main.tours.slug as slug,'discover' as type FROM main.tours_lang left join main.tours on main.tours_lang.tour_id = main.tours.id
                  where main.tours_lang.lang_id = ${lang_id} and (LOWER(tours_lang.name) LIKE LOWER('%${query}%') ) and main.tours.status = true ORDER BY name ASC limit 5)
                  ORDER BY type ASC limit 5`;
      }

      const connector = Tours.app.dataSources.theasia.connector;
      connector.query(sql, [], (queryerr, response) => {
        if (queryerr) {
          return cb(queryerr);
        }
        // console.log(response)
        if (response && response.length) {
          return cb(null, response);
        }
        return cb(null, []);
      });
    });
  };

  const processAllCities = async (groupBycity = [], cities) => {
    const promisesToAwait = [];
    const cityObj = {};
    _.each(groupBycity, (cityData, key) => {
      const To = cityData['1'] ? cityData['1'].length : 0;
      const Ac = cityData['2'] ? cityData['2'].length : 0;
      const Ex = cityData['4'] ? cityData['4'].length : 0;
      const Tr = cityData['3'] ? cityData['3'].length : 0;
      const data = {
        total: To + Ac + Ex + Tr,
        tours: To,
        activities: Ac,
        experiences: Ex,
        transportation: Tr,
      };
      cityObj[key] = data;
    });
    _.each(cities, (city, key) => {
      if (city) {
        promisesToAwait.push(
          city.updateAttributes({
            tours_count: {
              total: cityObj[city.id],
            },
          }),
        );
      }
    });
    const responses = await Promise.all(promisesToAwait);
    return responses;
  };
  Tours.citiesToursCountCron = async () => {
    const categoryTypes = await Tours.app.models.CategoryType.find({});
    const Cities = Tours.app.models.Cities;
    try {
      const cities = await Cities.find({});
      const tours = await Tours.find({
        where: {
          status: true,
        },
        fields: {
          city_id: true,
          id: true,
          category_type_id: true,
        },
      });
      const groupBycity = _.groupBy(tours, 'city_id');
      const groupByCategoryType = _.groupBy(tours, 'category_type_id');
      _.each(groupBycity, (tourObj, i) => {
        const groupByCategoryType = _.groupBy(tourObj, 'category_type_id');
        groupBycity[i] = groupByCategoryType;
      });
      const cTPromise = [];
      _.each(categoryTypes, (type, key) => {
        cTPromise.push(
          type.updateAttributes({
            count: groupByCategoryType[type.id] ? groupByCategoryType[type.id].length : 0,
          }),
        );
      });
      // console.log(groupBycity, 'grouped')
      await processAllCities(groupBycity, cities);
      await Promise.all(cTPromise);
      return { status: 'done' };
    } catch (e) {
      console.log(e);
      return e;
    }
  };

  const defaultSearchResult = (type, lang_id) => {
    let sql = '';
    if (!lang_id) {
      lang_id = 1;
    }
    if (type === 'destinations' || searchTypes[type] == 'destinations') {
      if (lang_id == 1) {
        // city and english
        sql = `SELECT main.cities.name as name, main.cities.id as id,main.cities.tours_count as stats,main.cities.slug as slug,'city' as type FROM main.cities
              ORDER BY main.cities.rating DESC limit 5`;
      } else {
        // city and other
        sql = `SELECT main.cities_lang.name as name,main.cities_lang.city_id as id, main.cities.tours_count as stats, main.cities.slug as slug,'city' as type FROM main.cities_lang left join main.cities on main.cities_lang.city_id = main.cities.id
                  where main.cities_lang.lang_id = ${lang_id}  ORDER BY main.cities.rating DESC limit 5`;
      }
    } else if (type === 'tours_activity' || searchTypes[type] == 'tours_activity') {
      // english
      if (lang_id == 1) {
        // english
        sql = `SELECT main.tours.name as name, main.tours.id as id,main.tours.slug as slug,'discover' as type FROM main.tours where main.tours.default_language_id = ${lang_id} and main.tours.status = true ORDER BY main.tours.rating DESC limit 5`;
      } else {
        // other language
        sql = `SELECT main.tours_lang.name as name,main.tours_lang.tour_id as id,main.tours.slug as slug,'discover' as type FROM main.tours_lang left join main.tours on main.tours_lang.tour_id = main.tours.id
                where main.tours_lang.lang_id = ${lang_id} and main.tours.status = true ORDER BY main.tours.rating DESC limit 5`;
      }
    } else if (type === 'all' || searchTypes[type] == 'all') {
      // english
      if (lang_id == 1) {
        // english
        sql = `(SELECT main.cities.name as name, main.cities.id as id,main.cities.tours_count as stats,main.cities.slug as slug,'city' as type FROM main.cities
                ORDER BY main.cities.rating DESC limit 5) UNION ALL
                (SELECT main.tours.name as name, main.tours.id as id,'{}' as stats,main.tours.slug as slug,'discover' as type FROM main.tours where main.tours.default_language_id = ${lang_id}  and main.tours.status = true ORDER BY main.tours.rating DESC limit 5)
                ORDER BY type ASC limit 6`;
      } else {
        // other language
        sql = `(SELECT main.cities_lang.name as name,main.cities_lang.city_id as id,main.cities.tours_count as stats,main.cities.slug as slug,'city' as type FROM main.cities_lang left join main.cities on main.cities_lang.city_id = main.cities.id
                where main.cities_lang.lang_id = ${lang_id}  ORDER BY main.cities.rating DESC limit 5)
                UNION ALL
                (SELECT main.tours_lang.name as name,main.tours_lang.tour_id as id,'{}' as stats, main.tours.slug as slug,'discover' as type FROM main.tours_lang left join main.tours on main.tours_lang.tour_id = main.tours.id
                where main.tours_lang.lang_id = ${lang_id}  and main.tours.status = true ORDER BY main.tours.rating DESC limit 5)
                ORDER BY type ASC limit 6`;
      }
    }
    return sql;
  };

  Tours.powersearch = (query, type, lang_id, cb) => {
    let sql = '';
    // console.log('language', lang_id, type, query)
    const connector = Tours.app.dataSources.theasia.connector;
    if (!query || query.length < 1) {
      sql = defaultSearchResult(type, lang_id);
      if (sql != '') {
        // console.log(sql);
        connector.query(sql, [], (queryerr, response) => {
          if (queryerr) {
            return cb(queryerr);
          }
          // console.log(response)
          if (response && response.length) {
            return cb(null, response);
          }
          return cb(null, []);
        });
      } else {
        return cb(null, []);
      }
    } else {
      return detectLanguageId(query, (err, result_lang_id) => {
        lang_id = result_lang_id;

        if (type === 'destinations' || searchTypes[type] == 'destinations') {
          if (lang_id === 1) {
            // city and english
            sql = `SELECT main.cities.name as name, main.cities.id as id,main.cities.tours_count as stats,main.cities.slug as slug,'city' as type FROM main.cities
                      where (LOWER(cities.name) LIKE LOWER('%${query}%') ) or (LOWER(cities.tags) LIKE LOWER('%${query}%') ) ORDER BY name ASC limit 5`;
          } else {
            // city and other
            sql = `SELECT main.cities_lang.name as name,main.cities_lang.city_id as id, main.cities.tours_count as stats, main.cities.slug as slug,'city' as type FROM main.cities_lang left join main.cities on main.cities_lang.city_id = main.cities.id
                      where main.cities_lang.lang_id = ${lang_id} and ((LOWER(cities_lang.name) LIKE LOWER('%${query}%') ) or (LOWER(cities_lang.tags) LIKE LOWER('%${query}%'))) ORDER BY name ASC limit 5`;
          }
        } else if (type === 'tours_activity' || searchTypes[type] == 'tours_activity') {
          // english
          if (lang_id === 1) {
            // english
            sql = `SELECT main.tours.name as name, main.tours.id as id,main.tours.slug as slug,'discover' as type FROM main.tours where main.tours.default_language_id = ${lang_id} and ((LOWER(tours.name) LIKE LOWER('%${query}%'))  or (LOWER(tours.tags) LIKE LOWER('%${query}%') )) and main.tours.status = true and main.tours.enable = true ORDER BY name ASC limit 5`;
          } else {
            // other language
            sql = `SELECT main.tours_lang.name as name,main.tours_lang.tour_id as id,main.tours.slug as slug,'discover' as type FROM main.tours_lang left join main.tours on main.tours_lang.tour_id = main.tours.id
                    where main.tours_lang.lang_id = ${lang_id} and ((LOWER(tours_lang.name) LIKE LOWER('%${query}%'))  or (LOWER(tours_lang.tags) LIKE LOWER('%${query}%') )) and main.tours.status = true and main.tours_lang.enable = true ORDER BY name ASC limit 5`;
          }
        } else if (type === 'all' || searchTypes[type] == 'all') {
          // english
          if (lang_id === 1) {
            // english
            sql = `(SELECT main.cities.name as name, main.cities.id as id,main.cities.tours_count as stats,main.cities.slug as slug,'city' as type FROM main.cities
                    where (LOWER(cities.name) LIKE LOWER('%${query}%') ) or (LOWER(cities.tags) LIKE LOWER('%${query}%'))  ORDER BY name ASC limit 5) UNION ALL
                    (SELECT main.tours.name as name, main.tours.id as id,'{}' as stats,main.tours.slug as slug,'discover' as type FROM main.tours where main.tours.default_language_id = ${lang_id} and ((LOWER(tours.name) LIKE LOWER('%${query}%'))  or (LOWER(tours.tags) LIKE LOWER('%${query}%') )) and main.tours.status = true and main.tours.enable = true ORDER BY name ASC limit 5)
                    ORDER BY type ASC limit 6`;
          } else {
            // other language
            sql = `(SELECT main.cities_lang.name as name,main.cities_lang.city_id as id,main.cities.tours_count as stats,main.cities.slug as slug,'city' as type FROM main.cities_lang left join main.cities on main.cities_lang.city_id = main.cities.id
                    where main.cities_lang.lang_id = ${lang_id} and ((LOWER(cities_lang.name) LIKE LOWER('%${query}%') ) or (LOWER(cities_lang.tags) LIKE LOWER('%${query}%') ) ) ORDER BY name ASC limit 5)
                    UNION ALL
                    (SELECT main.tours_lang.name as name,main.tours_lang.tour_id as id,'{}' as stats, main.tours.slug as slug,'discover' as type FROM main.tours_lang left join main.tours on main.tours_lang.tour_id = main.tours.id
                    where main.tours_lang.lang_id = ${lang_id} and ((LOWER(tours_lang.name) LIKE LOWER('%${query}%')) or (LOWER(tours_lang.tags) LIKE LOWER('%${query}%') )) and main.tours.status = true and main.tours_lang.enable = true ORDER BY name ASC limit 5)
                    ORDER BY type ASC limit 6`;
          }
        }
        connector.query(sql, [], (queryerr, response) => {
          if (queryerr) {
            return cb(queryerr);
          }
          // console.log(response)
          if (response && response.length) {
            return cb(null, response);
          }
          return cb(null, []);
        });
      });
    }
  };

  Tours.search = (query, cb) => {
    if (!query || query.length < 1) return cb(null, []);
    let lang_id = 1;
    return detectLanguageId(query, (err, result_lang_id) => {
      lang_id = result_lang_id;

      let sql = '';
      if (lang_id === 1) {
        // english
        sql = `SELECT main.tours.name as name, main.tours.id as id FROM main.tours where main.tours.default_language_id = ${lang_id} and (LOWER(tours.name) LIKE LOWER('%${query}%') ) and main.tours.status = true ORDER BY name ASC limit 10`;
      } else {
        // other language
        sql = `SELECT main.tours_lang.name as name,main.tours_lang.tour_id as id FROM main.tours_lang left join main.tours on main.tours_lang.tour_id = main.tours.id
                    where main.tours_lang.lang_id = ${lang_id} and (LOWER(tours_lang.name) LIKE LOWER('%${query}%') ) and main.tours.status = true ORDER BY name ASC limit 10`;
      }

      const connector = Tours.app.dataSources.theasia.connector;
      connector.query(sql, [], (queryerr, response) => {
        if (queryerr) {
          return cb(queryerr);
        }
        // console.log(response)
        if (response && response.length) {
          return cb(null, response);
        }
        return cb(null, []);
      });
    });
  };

  const getLanguageCode = lang_id => {
    switch (parseInt(lang_id, 10)) {
      case 1:
        return 'en';
      case 2:
        return 'ko';
      case 3:
        return 'zh';
      case 4:
        return 'th';
      default:
        return 0;
    }
  };

  Tours.tourAvailableLangBySlug = async slug => {
    const filter = {};
    slug = slug.toLowerCase();
    filter.where = {
      slug,
    };
    const tour = await Tours.findOne(filter);
    const availableLanguages = [];
    if (tour && tour.id) {
      if (tour.enable) {
        availableLanguages.push('en');
      }
      const tourLangs = await Tours.app.models.ToursLang.find({ where: { tour_id: tour.id } });
      if (tourLangs && tourLangs.length) {
        _.each(tourLangs, (langObj, index) => {
          // console.log('here', langObj.lang_id)
          const langCode = getLanguageCode(langObj.lang_id);
          // console.log('langCode', langCode)
          if (langCode && langObj.enable) {
            availableLanguages.push(langCode);
          }
        });
      }
    }
    return availableLanguages;
  };

  Tours.findBySlug = (slug, cb) => {
    const filter = {
      ...defaultFilter,
    };

    slug = slug.toLowerCase();
    filter.where = {
      slug,
    };
    Tours.findOne(filter, (err, tour) => {
      if (err) {
        return cb(err);
      }
      if (tour) {
        return cb(null, tour);
      }
      const error = new Error(`Product not found by slug : ,${slug} Incorrect or Invalid slug`);
      return cb(error);
    });
  };

  // Duplicate all except reviews
  Tours.duplicate = async (tour_id, name, supplier_id) => {
    const filter = {
      include: [
        'localization',
        'categories',
        'tour_medias',
        'features',
        'excluded_included',
        {
          relation: 'sub_product',
          scope: {
            include: ['localization', 'price'],
          },
        },
      ],
    };
    let tx;
    try {
      let tour = await Tours.findById(tour_id, filter);
      tour = tour.toObject();

      delete tour.id;
      delete tour.created_at;
      delete tour.updated_at;
      tour.name = name || `${tour.name} Copy`;
      tour.supplier_id = supplier_id || tour.supplier_id;
      tour.status = false;
      tour.enable = false;

      tx = await Tours.beginTransaction({
        isolationLevel: Tours.Transaction.READ_COMMITTED,
        timeout: 10000,
      });
      const transaction = {
        transaction: tx,
      };

      const dupTour = await Tours.create(tour);

      const dup = (models, Model, subProductId) =>
        models.map(model => {
          const item = { ...model, tour_id: dupTour.id };
          if (subProductId) {
            delete item.tour_id;
            item.sub_product_id = subProductId;
          }
          if (Model.definition.name === 'ToursLang') {
            item.enable = false;
          }
          delete item.id;
          delete item.created_at;
          delete item.updated_at;
          return Model.create(item, transaction);
        });

      await Promise.all(dup(tour.localization, Tours.app.models.ToursLang));
      await Promise.all(dup(tour.categories, Tours.app.models.ToursCategories));
      await Promise.all(dup(tour.tour_medias, Tours.app.models.ToursMedias));
      await Promise.all(dup(tour.features, Tours.app.models.ToursFeatures));
      await Promise.all(dup(tour.excluded_included, Tours.app.models.ToursExcludedIncluded));
      await Promise.all(
        tour.sub_product.map(async subProduct => {
          const sub = { ...subProduct, tour_id: dupTour.id, status: false };
          delete sub.id;
          delete sub.created_at;
          delete sub.updated_at;
          const dupSubProduct = await Tours.app.models.SubProducts.create(sub, transaction);
          await Promise.all(
            dup(sub.localization, Tours.app.models.SubProductsLang, dupSubProduct.id),
          );
          await Promise.all(dup(sub.price, Tours.app.models.Pricing, dupSubProduct.id));
          return null;
        }),
      );

      const txErr = await tx.commit();
      if (txErr) {
        logger.error('[Tours duplicate] TX Commit error:', txErr);
        return Promise.reject(new Error('Tours duplicate failed'));
      }

      return dupTour;
    } catch (error) {
      console.error('Duplicate Product error:', error);
      if (tx) await tx.rollback();
      return Promise.reject(error);
    }
  };

  Tours.remoteMethod('duplicate', {
    accepts: [
      { arg: 'tour_id', type: 'string', required: true },
      { arg: 'name', type: 'string' },
      { arg: 'supplier_id', type: 'string' },
    ],
    returns: { arg: 'response', type: 'object', root: true },
  });

  Tours.remoteMethod('autocomplete', {
    accepts: [
      {
        arg: 'input',
        type: 'string',
      },
      {
        arg: 'type',
        type: 'string',
      },
      {
        arg: 'lang_id',
        type: 'string',
      },
    ],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/autocomplete/:input',
      verb: 'get',
    },
  });

  Tours.remoteMethod('powersearch', {
    accepts: [
      {
        arg: 'query',
        type: 'string',
      },
      {
        arg: 'type',
        type: 'string',
        description:
          ' `destinations` for countries & Cities , `tours_activity` for Tours , `all` for All (general) ',
      },
      {
        arg: 'lang_id',
        type: 'string',
      },
    ],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/powersearch',
      verb: 'get',
    },
  });

  Tours.remoteMethod('search', {
    accepts: [
      {
        arg: 'input',
        type: 'string',
      },
    ],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/search/:input',
      verb: 'get',
    },
  });

  Tours.remoteMethod('findBySlug', {
    accepts: [
      {
        arg: 'slug',
        type: 'string',
        required: true,
      },
    ],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/findBySlug/:slug',
      verb: 'get',
    },
  });

  Tours.remoteMethod('tourAvailableLangBySlug', {
    accepts: [
      {
        arg: 'slug',
        type: 'string',
        required: true,
      },
    ],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/tourAvailableLangBySlug/:slug',
      verb: 'get',
    },
  });

  Tours.remoteMethod('citiesToursCountCron', {
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/cities_tour_count_cron',
      verb: 'get',
    },
  });

  /**
   * update discount percentage
   * @param {[ID]} tour_ids - (optional) array of tour id if null will update all
   * @param {callback} callback - (optional) dont need for promise
   */
  Tours.updateDiscountPercentage = async (tour_ids = null, callback = null) => {
    const handlerReturn = (error, result) => {
      if (callback) return callback(error, result);
      if (error) return Promise.reject(error);
      return Promise.resolve(result);
    };
    try {
      // prepare filter for query
      const filter = {
        ...defaultFilter,
      };
      if (tour_ids) {
        filter.where = {
          id: {
            inq: tour_ids,
          },
        };
      }
      const tours = await Tours.find(filter);
      // update discount for all tour found
      const updateDiscountResult = await Promise.all(
        tours.map(async tour => {
          if (tour.sub_product() && tour.sub_product().length) {
            const maxDiscount = priceHelper.getMaxDiscountActiveSubproduct(tour.sub_product());
            if (Number(maxDiscount).toFixed(2) !== Number(tour.discount_percent).toFixed(2)) {
              try {
                await tour.updateAttribute('discount_percent', maxDiscount);
              } catch (error) {
                console.log(`FAIL - update tour ${tour.id} discount percent ${error.toString()}`);
                return null;
              }
            }
            return {
              id: tour.id,
              discount_percent: maxDiscount,
            };
          }
          return null;
        }),
      );
      return handlerReturn(null, updateDiscountResult);
    } catch (error) {
      console.log('ERROR - Tour.updatediscountPercentage unexpect', error.toString());
      return handlerReturn(error);
    }
  };

  /**
   * update minimum price
   * @param {[ID]} tour_ids - (optional) array of tour id if null will update all
   * @param {callback} callback - (optional) dont need for promise
   */
  Tours.updateMinimumPriceValueOfProduct = async (tour_ids = null, callback = null) => {
    const handlerReturn = (error, result) => {
      if (callback) return callback(error, result);
      if (error) return Promise.reject(error);
      return Promise.resolve(result);
    };
    try {
      // prepare filter for query
      const filter = {
        ...defaultFilter,
      };
      if (tour_ids) {
        filter.where = {
          id: {
            inq: tour_ids,
          },
        };
      }
      const tours = await Tours.find(filter);
      // update minimum price for all tour found
      const updateMinimumPriceResult = (await Promise.all(
        tours.map(async tour => {
          if (tour.sub_product() && tour.sub_product().length) {
            const minPrice = priceHelper.getMinPriceActiveSubProduct(tour.sub_product());
            const min_adult_price = getSafe(() => parseFloat(minPrice.sellingPrice.adults));
            if (
              tour &&
              tour.currencies() &&
              tour.currencies().currency_code &&
              min_adult_price > 0
            ) {
              const latest_minimum_price = min_adult_price / tour.currencies().exchange_rate;
              try {
                await tour.updateAttribute('latest_minimum_price', latest_minimum_price);
                // console.log(`SUCCESS - update tour ${tour.id} minimum prices ${latest_minimum_price}`)
                return {
                  id: tour.id,
                  latest_minimum_price,
                };
              } catch (error) {
                console.log(`FAIL - update tour ${tour.id} minimum prices ${latest_minimum_price}`);
              }
            }
            return null;
          }
          return null;
        }),
      )).filter(res => res !== null);
      return handlerReturn(null, updateMinimumPriceResult);
    } catch (error) {
      console.log('Tours.updateMinimumPriceValueOfProduct unexcept error', error);
      return handlerReturn(error);
    }
  };

  const queryGeneratorReviewProducts = (
    lang_id = 1,
    city_ids = [],
    subquery,
    limit = 5,
    offset = 0,
    orderby,
  ) => {
    if (city_ids && city_ids.length) {
      city_ids = city_ids.join(',');
      city_ids = `P.city_id in (${city_ids}) and`;
    } else {
      city_ids = '';
    }
    // console.log('orderby', orderby)
    let sql = '';
    if (lang_id == 1) {
      sql = `SELECT P.id,P.latest_minimum_price as starting_price,P.slug as slug,P.city_id as city_id,C.name as city_name,P.rating as rating,P.discount_percent,P.is_discounted,P.name as name,P.short_description as short_description,P.seo_title as seo_title,P.seo_description as seo_description, M.bucket_path as bucket_path, M.name as image_name,M.alt_text as alt_text,'placeholder/theasia_placeholder.png' as image, R.review_title,R.id as rating_id, R.review, R.reviewer_name, R.nationality, RN.flag as flag, ${subquery} FROM main.tours P LEFT JOIN  main.cities C on C.id = P.city_id LEFT JOIN main.tours_media TM on P.id = TM.tour_id and TM.is_thumbnail = true  LEFT JOIN main.medias M on M.id = TM.media_id Left JOIN main.reviews as R on P.id = R.tour_id and R.language_id = ${lang_id}  LEFT JOIN main.countries as RN on R.nationality = RN.id where   ${city_ids}  P.status = true and P.enable = true and R.review IS NOT NULL ${orderby} offset ${offset} limit ${limit}`;
    } else {
      subquery = `(select array_agg(SPL.name) from main.tours_features SPF left join main.tours SP on SPF.tour_id = SP.id left join main.features SF on SPF.feature_id = SF.id LEFT JOIN main.features_lang SPL on SPF.feature_id = SPL.feature_id and SPL.lang_id = ${lang_id} where SP.id = P.id group by SP.id) as feature_name`;
      sql = `SELECT P.id,P.latest_minimum_price as starting_price,P.slug as slug, P.city_id as city_id,CL.name as city_name,P.rating as rating,P.discount_percent,P.is_discounted,PL.name as name,PL.short_description as short_description,PL.seo_title as seo_title,PL.seo_description as seo_description, M.bucket_path as bucket_path, M.name as image_name,M.alt_text as alt_text,'placeholder/theasia_placeholder.png' as image,  R.review_title,R.id as rating_id, R.review, R.reviewer_name, R.nationality, RN.flag as flag, ${subquery} FROM main.tours P LEFT JOIN main.tours_lang as PL on PL.tour_id = P.id and PL.lang_id = ${lang_id} LEFT JOIN  main.cities_lang CL on CL.city_id = P.city_id and CL.lang_id = ${lang_id} LEFT JOIN main.tours_media TM on P.id = TM.tour_id and TM.is_thumbnail = true  LEFT JOIN main.medias M on M.id = TM.media_id Left JOIN main.reviews as R on P.id = R.tour_id and R.language_id = ${lang_id} LEFT JOIN main.countries as RN on R.nationality = RN.id where ${city_ids} P.status = true and PL.enable = true and R.review IS NOT NULL ${orderby} offset ${offset} limit ${limit}`;
    }
    // console.log('here', sql)
    return sql;
  };

  const queryGenerator = (
    lang_id,
    query,
    city_ids = [],
    category_type_ids = [],
    tour_ids = [],
    price_range = [],
    rating = [],
    subquery,
    limit,
    offset,
    orderby,
    tour_ids_not_in = [],
    count,
    promotionPage = false,
    supplier_id,
    application_name = 'WEBSITE',
  ) => {
    let discount_percent = '';
    if (tour_ids && tour_ids.length) {
      tour_ids = `P.id in (${tour_ids}) and`;
    } else {
      tour_ids = '';
    }

    if (tour_ids_not_in && tour_ids_not_in.length) {
      tour_ids_not_in = `P.id not in (${tour_ids_not_in}) and`;
    } else {
      tour_ids_not_in = '';
    }

    if (category_type_ids && category_type_ids.length) {
      category_type_ids = category_type_ids.join(',');
      category_type_ids = `P.category_type_id in (${category_type_ids}) and`;
    } else {
      category_type_ids = '';
    }

    if (city_ids && city_ids.length) {
      city_ids = city_ids.join(',');
      city_ids = `P.city_id in (${city_ids}) and`;
    } else {
      city_ids = '';
    }

    if (price_range && price_range.length == 2) {
      price_range = `P.latest_minimum_price >=  ${price_range[0]} and P.latest_minimum_price <= ${
        price_range[1]
      } and`;
    }

    if (rating && rating.length == 2) {
      rating = `P.rating >=  ${rating[0]} and P.rating <= ${rating[1]} and `;
    }

    if (supplier_id && application_name == 'PARTNERS') {
      supplier_id = `P.supplier_id = ${supplier_id} and `;
    } else {
      supplier_id = '';
    }

    let likeQuery = '';
    if (query) {
      if (lang_id == 1) {
        likeQuery = `LOWER(P.name) LIKE LOWER('%${query}%') and`;
      } else {
        likeQuery = `LOWER(PL.name) LIKE LOWER('%${query}%') and`;
      }
    }

    if (promotionPage) {
      discount_percent = 'P.discount_percent > 0 and P.is_discounted = true and';
    }

    let sql = '';
    if (count) {
      if (lang_id == 1) {
        sql = `
        SELECT count(*)
        FROM main.tours P LEFT JOIN  main.cities C on C.id = P.city_id LEFT JOIN main.tours_media TM on P.id = TM.tour_id and TM.is_thumbnail = true  LEFT JOIN main.medias M on M.id = TM.media_id
        where ${tour_ids}  ${category_type_ids}  ${city_ids}  ${price_range}  ${rating} ${likeQuery} ${tour_ids_not_in} ${discount_percent} ${supplier_id} P.status = true and P.enable = true`;
      } else {
        subquery = `(select array_agg(SPL.name) from main.tours_features SPF left join main.tours SP on SPF.tour_id = SP.id left join main.features SF on SPF.feature_id = SF.id LEFT JOIN main.features_lang SPL on SPF.feature_id = SPL.feature_id and SPL.lang_id = ${lang_id} where SP.id = P.id group by SP.id) as feature_name`;
        sql = `
        SELECT count(*)
        FROM main.tours P LEFT JOIN main.tours_lang as PL on PL.tour_id = P.id and PL.lang_id = ${lang_id} LEFT JOIN  main.cities_lang CL on CL.city_id = P.city_id and CL.lang_id = ${lang_id} LEFT JOIN main.tours_media TM on P.id = TM.tour_id and TM.is_thumbnail = true  LEFT JOIN main.medias M on M.id = TM.media_id
        where ${tour_ids}  ${category_type_ids}  ${city_ids}  ${price_range}  ${rating} ${likeQuery} ${tour_ids_not_in} ${discount_percent} ${supplier_id} P.status = true and PL.enable = true`;
      }
    } else if (lang_id == 1) {
      sql = `SELECT P.id,P.latest_minimum_price as starting_price,P.slug as slug,P.city_id as city_id,C.name as city_name,P.rating as rating,P.discount_percent,P.is_discounted,P.name as name,P.short_description as short_description,P.seo_title as seo_title,P.seo_description as seo_description, M.bucket_path as bucket_path, M.name as image_name,M.alt_text as alt_text,'placeholder/theasia_placeholder.png' as image, ${subquery} FROM main.tours P LEFT JOIN  main.cities C on C.id = P.city_id LEFT JOIN main.tours_media TM on P.id = TM.tour_id and TM.is_thumbnail = true  LEFT JOIN main.medias M on M.id = TM.media_id where ${tour_ids}  ${category_type_ids}  ${city_ids}  ${price_range}  ${rating} ${likeQuery} ${tour_ids_not_in} ${discount_percent} ${supplier_id} P.status = true and P.enable = true ${orderby} offset ${offset} limit ${limit}`;
    } else {
      subquery = `(select array_agg(SPL.name) from main.tours_features SPF left join main.tours SP on SPF.tour_id = SP.id left join main.features SF on SPF.feature_id = SF.id LEFT JOIN main.features_lang SPL on SPF.feature_id = SPL.feature_id and SPL.lang_id = ${lang_id} where SP.id = P.id group by SP.id) as feature_name`;
      sql = `SELECT P.id,P.latest_minimum_price as starting_price,P.slug as slug, P.city_id as city_id,CL.name as city_name,P.rating as rating,P.discount_percent,P.is_discounted,PL.name as name,PL.short_description as short_description,PL.seo_title as seo_title,PL.seo_description as seo_description, M.bucket_path as bucket_path, M.name as image_name,M.alt_text as alt_text,'placeholder/theasia_placeholder.png' as image, ${subquery} FROM main.tours P LEFT JOIN main.tours_lang as PL on PL.tour_id = P.id and PL.lang_id = ${lang_id} LEFT JOIN  main.cities_lang CL on CL.city_id = P.city_id and CL.lang_id = ${lang_id} LEFT JOIN main.tours_media TM on P.id = TM.tour_id and TM.is_thumbnail = true  LEFT JOIN main.medias M on M.id = TM.media_id where ${tour_ids}  ${category_type_ids}  ${city_ids}  ${price_range}  ${rating} ${likeQuery} ${tour_ids_not_in} ${discount_percent} ${supplier_id} P.status = true and PL.enable = true ${orderby} offset ${offset} limit ${limit}`;
    }
    return sql;
  };

  Tours.getTopRatedProducts = async (lang_id, country_id, city_id, limit, offset) => {
    const orderby = 'ORDER by R.id DESC';
    const subquery =
      '(select array_agg(SF.name) from main.tours_features SPF left join main.tours SP on SPF.tour_id = SP.id left join main.features SF on SPF.feature_id = SF.id where SP.id = P.id group by SP.id) as feature_name';
    let city_ids = [];
    if (country_id) {
      const countryObject = _.findWhere(countryHelper.get(), {
        id: country_id,
      });
      if (countryObject && countryObject.cities() && countryObject.cities().length) {
        city_ids = _.map(countryObject.cities(), 'id');
      }
    } else if (city_id) {
      city_ids.push(city_id);
    }
    const sql = queryGeneratorReviewProducts(lang_id, city_ids, subquery, limit, offset, orderby);
    const topReviews = await sqlHelper.raw(sql, []);
    return topReviews;
  };

  const getRecommendedProducts = async (
    lang_id,
    query,
    city_ids,
    category_type_ids,
    tour_ids,
    price_range,
    rating,
    subquery,
    limit,
    offset,
    orderby,
    tour_ids_not_in,
  ) => {
    orderby = 'ORDER by P.recommended,P.latest_minimum_price DESC';
    query = '';
    const sql = queryGenerator(
      lang_id,
      '',
      city_ids,
      [],
      [],
      [],
      [],
      subquery,
      5,
      0,
      orderby,
      tour_ids_not_in,
      false,
    );
    const recommended = await sqlHelper.raw(sql, []);
    return recommended;
  };

  const getTrendingProducts = async (
    lang_id,
    query,
    city_ids,
    category_type_ids,
    tour_ids,
    price_range,
    rating,
    subquery,
    limit,
    offset,
    orderby,
    tour_ids_not_in,
  ) => {
    query = '';
    orderby = 'ORDER by P.recommended,P.created_at DESC'; // This is false factor , Later on Can be changed based on real values and requirements
    const sql = queryGenerator(
      lang_id,
      '',
      city_ids,
      [],
      [],
      [],
      [],
      subquery,
      5,
      0,
      orderby,
      tour_ids_not_in,
      false,
    );
    const trending = await sqlHelper.raw(sql, []);
    return trending;
  };

  const getPromotionProducts = async (
    lang_id,
    query,
    city_ids,
    category_type_ids,
    tour_ids,
    price_range,
    rating,
    subquery,
    limit,
    offset,
    orderby,
    tour_ids_not_in,
  ) => {
    query = '';
    orderby = 'ORDER by P.discount_percent ASC';
    const sql = queryGenerator(
      lang_id,
      '',
      city_ids,
      [],
      [],
      [],
      [],
      subquery,
      5,
      0,
      orderby,
      tour_ids_not_in,
      false,
    );
    const promotions = await sqlHelper.raw(sql, []);
    return promotions;
  };

  /**
   * discover2.0
   * Note : A fallback for recommended sorting is used as we don't have a Criteria for recommended tours, Later on when defined , recommended values in tours should be updated daily via cron based on factors provided
   */
  Tours.discover = async (
    query,
    country_id,
    city_slug,
    city_ids,
    category_type_ids,
    category_ids,
    feature_ids,
    price_range,
    rating,
    lang_id,
    sort,
    offset = 0,
    limit = 16,
    recommended,
    trending,
    promotions,
    count = 0,
    promotionPage = false,
    latest = false,
    supplier_id,
    application_name = 'WEBSITE',
  ) => {
    let orderby;
    let err = false;
    let message = '';
    let recommendedProducts = [];
    let trendingProducts = [];
    let promotionProducts = [];
    if (sort) {
      if (sort == 1) {
        orderby = 'ORDER by P.rating DESC';
      } else if (sort == 2) {
        orderby = 'ORDER by P.latest_minimum_price ASC';
      } else if (sort == 3) {
        orderby = 'ORDER by P.is_discounted DESC';
      } else if (sort == 4) {
        orderby = 'ORDER by P.recommended,P.latest_minimum_price DESC';
      } else {
        orderby = 'ORDER by P.recommended DESC';
      }
    } else if (promotionPage) {
      orderby = 'ORDER by P.discount_percent DESC';
    } else if (latest) {
      orderby = 'ORDER by P.created_at DESC';
    } else {
      orderby = 'ORDER by P.recommended,P.latest_minimum_price DESC';
    }
    const subquery =
      '(select array_agg(SF.name) from main.tours_features SPF left join main.tours SP on SPF.tour_id = SP.id left join main.features SF on SPF.feature_id = SF.id where SP.id = P.id group by SP.id) as feature_name';
    let tour_ids = [];
    let tour_ids_not_in = [];
    if (category_ids && category_ids.length) {
      const tours = await Tours.app.models.ToursCategories.find({
        where: {
          category_id: {
            inq: category_ids,
          },
        },
      });
      const tourIds = _.uniq(_.map(tours, 'tour_id'));
      tour_ids = [...new Set([...tour_ids, ...tourIds])];
    }
    if (feature_ids && feature_ids.length) {
      const tours = await Tours.app.models.ToursFeatures.find({
        where: {
          feature_id: {
            inq: feature_ids,
          },
        },
      });
      const tourIds = _.uniq(_.map(tours, 'tour_id'));
      tour_ids = [...new Set([...tour_ids, ...tourIds])];
    }

    if (!lang_id) {
      lang_id = 1;
    }
    let cityObject = {};
    let countryObject = {};

    tour_ids = _.difference(tour_ids, tour_ids_not_in); // removing recommended & trending products

    let sql = await queryGenerator(
      lang_id,
      '',
      [],
      [],
      [],
      [],
      [],
      subquery,
      limit,
      offset,
      orderby,
      tour_ids_not_in,
      count,
      promotionPage,
      supplier_id,
      application_name,
    ); // general
    if (query) {
      lang_id = await detectLanguageId(query);
      sql = await queryGenerator(
        lang_id,
        query,
        city_ids,
        category_type_ids,
        tour_ids,
        price_range,
        rating,
        subquery,
        limit,
        offset,
        orderby,
        tour_ids_not_in,
        count,
        promotionPage,
        supplier_id,
        application_name,
      );
    } else if (country_id) {
      // console.log('country page')
      query = '';
      countryObject = _.findWhere(countryHelper.get(), {
        id: country_id,
      });
      if (countryObject && countryObject.cities() && countryObject.cities().length) {
        if (!city_ids || !city_ids.length) {
          city_ids = _.map(countryObject.cities(), 'id');
        }
        sql = await queryGenerator(
          lang_id,
          query,
          city_ids,
          category_type_ids,
          tour_ids,
          price_range,
          rating,
          subquery,
          limit,
          offset,
          orderby,
          tour_ids_not_in,
          count,
          promotionPage,
          supplier_id,
          application_name,
        );
      } else {
        err = true;
        message = `Country with following ${country_id} not found`;
      }
    } else if (city_slug) {
      // console.log('city page')
      query = '';
      cityObject = _.findWhere(countryHelper.get('city'), {
        slug: city_slug,
      });
      if (cityObject && cityObject.id) {
        city_ids = [cityObject.id];
        sql = await queryGenerator(
          lang_id,
          query,
          city_ids,
          category_type_ids,
          tour_ids,
          price_range,
          rating,
          subquery,
          limit,
          offset,
          orderby,
          tour_ids_not_in,
          count,
          promotionPage,
          supplier_id,
          application_name,
        );
      } else {
        err = true;
        message = `Cities with following ${city_slug} not found`;
      }
    } else {
      query = '';
      sql = await queryGenerator(
        lang_id,
        query,
        city_ids,
        category_type_ids,
        tour_ids,
        price_range,
        rating,
        subquery,
        limit,
        offset,
        orderby,
        tour_ids_not_in,
        count,
        promotionPage,
        supplier_id,
        application_name,
      );
    }

    if (!err) {
      try {
        console.log('SQl', sql);
        const response = await sqlHelper.raw(sql, []);
        if (response && response.length) {
          const productFounds = _.map(response, 'id');
          tour_ids_not_in = [...new Set([...tour_ids_not_in, ...productFounds])];
        }

        if (recommended) {
          recommendedProducts = count
            ? []
            : await getRecommendedProducts(
                lang_id,
                query,
                city_ids,
                category_type_ids,
                tour_ids,
                price_range,
                rating,
                subquery,
                limit,
                offset,
                orderby,
                tour_ids_not_in,
              );
          const recommendedProductsIds = _.map(recommendedProducts, 'id');
          tour_ids_not_in = [...new Set([...tour_ids_not_in, ...recommendedProductsIds])];
        }
        if (trending) {
          trendingProducts = count
            ? []
            : await getTrendingProducts(
                lang_id,
                query,
                city_ids,
                category_type_ids,
                tour_ids,
                price_range,
                rating,
                subquery,
                limit,
                offset,
                orderby,
                tour_ids_not_in,
              );
          const trendingProductsIds = _.map(trendingProducts, 'id');
          tour_ids_not_in = [...new Set([...tour_ids_not_in, ...trendingProductsIds])];
        }
        if (promotions) {
          promotionProducts = count
            ? []
            : await getPromotionProducts(
                lang_id,
                query,
                city_ids,
                category_type_ids,
                tour_ids,
                price_range,
                rating,
                subquery,
                limit,
                offset,
                orderby,
                tour_ids_not_in,
              );
          const promotionProductsIds = _.map(promotionProducts, 'id');
          tour_ids_not_in = [...new Set([...tour_ids_not_in, ...promotionProductsIds])];
        }

        if (response && response.length) {
          if (count) {
            return {
              status: true,
              count: parseInt(response[0].count, 10),
            };
          }
          return {
            status: true,
            products: response,
            error: false,
            city: cityObject,
            country: countryObject,
            promotions: promotionProducts,
            recommended: recommendedProducts,
            trending: trendingProducts,
          };
        }

        return {
          status: false,
          products: [],
          error: false,
          city: cityObject,
          country: countryObject,
          promotions: promotionProducts,
          recommended: recommendedProducts,
          trending: trendingProducts,
        };
      } catch (err) {
        return {
          status: false,
          products: [],
          error: err,
          city: cityObject,
          country: countryObject,
          promotions: promotionProducts,
          recommended: recommendedProducts,
          trending: trendingProducts,
        };
      }
    } else {
      return Promise.resolve({
        error: true,
        status: false,
        message,
      });
    }
  };

  Tours.getPriceRange = async () => {
    const sql =
      'SELECT max(main.tours.latest_minimum_price) as high, min(main.tours.latest_minimum_price) as low from main.tours where main.tours.status = true and main.tours.latest_minimum_price > 0';
    const result = await sqlHelper.raw(sql, []);
    if (result && result.length) {
      return result[0];
    }

    return {
      low: 2,
      hight: 340,
    };
  };

  Tours.remoteMethod('getPriceRange', {
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/getPriceRange',
      verb: 'get',
    },
  });

  Tours.remoteMethod('getTopRatedProducts', {
    accepts: [
      {
        arg: 'lang_id',
        type: 'number',
        description: 'which language to search in',
        required: false,
      },
      {
        arg: 'country_id',
        type: 'number',
        description:
          'Country IDs (Coming through Country links  with or without filter in case of discover page it will be empty), default empty array',
        required: false,
      },
      {
        arg: 'city_id',
        type: 'array',
        description:
          'City ids array, This is only when the search is not on the discover page, default & and city pages is empty array',
        required: false,
      },
      {
        arg: 'limit',
        type: 'number',
        required: false,
      },
      {
        arg: 'offset',
        type: 'number',
        required: false,
      },
    ],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/getTopRatedProducts',
      verb: 'get',
    },
  });

  Tours.remoteMethod('discover', {
    accepts: [
      {
        arg: 'query',
        type: 'string',
        description: 'Search Query (Keyword not City)',
        required: false,
      },
      {
        arg: 'country_id',
        type: 'number',
        description:
          'Country IDs (Coming through Country links  with or without filter in case of discover page it will be empty), default empty array',
        required: false,
      },
      {
        arg: 'city_slug',
        type: 'string',
        description:
          'City slug (While Coming through city links with or without filter in case of discover page it will be empty), default empty array',
        required: false,
      },
      {
        arg: 'city_ids',
        type: 'array',
        description:
          'City ids array, This is only when the search is not on the discover page, default & and city pages is empty array',
        required: false,
      },
      {
        arg: 'category_type_ids',
        type: 'array',
        description: 'Filter by particular category type or multiple , default empty array',
        required: false,
      },
      {
        arg: 'category_ids',
        type: 'array',
        description: 'Filter by particular categories or multiple , default empty array',
        required: false,
      },
      {
        arg: 'feature_ids',
        type: 'array',
        description: 'Filter by particular features or multiple , default empty array',
        required: false,
      },
      {
        arg: 'price_range',
        type: 'array',
        description:
          'Filter by price range between low to high first value is the lower one, values will always come in pair,default empty array no values',
        required: false,
      },
      {
        arg: 'rating',
        type: 'array',
        description:
          'Filter by rating range between low to high first value is the lower one, values will always come in pair,default empty array no values',
        required: false,
      },
      {
        arg: 'lang_id',
        type: 'number',
        description: 'which language to search in',
        required: false,
      },
      {
        arg: 'sort',
        type: 'number',
        required: false,
      },
      {
        arg: 'offset',
        type: 'number',
        required: false,
      },
      {
        arg: 'limit',
        type: 'number',
        required: false,
      },
      {
        arg: 'recommended',
        type: 'boolean',
        required: false,
      },
      {
        arg: 'trending',
        type: 'boolean',
        required: false,
      },
      {
        arg: 'promotions',
        type: 'boolean',
        required: false,
      },
      {
        arg: 'count',
        type: 'boolean',
        required: false,
      },
      {
        arg: 'promotionPage',
        type: 'boolean',
        required: false,
      },
      {
        arg: 'latest',
        type: 'boolean',
        required: false,
      },
      {
        arg: 'supplier_id',
        type: 'number',
        required: false,
      },
      {
        arg: 'application_name',
        type: 'string',
        required: false,
      },
    ],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/discover',
      verb: 'get',
    },
  });
};
