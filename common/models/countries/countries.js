const _ = require('lodash');
// const fs = require('fs');
// const countryData = require('../../helpers/countries');

module.exports = function (Countries) {
  Countries.beforeRemote('find', (ctx, products, next) => {
    if (ctx.args.filter) {
      ctx.args.filter.include = [{
        relation: 'localization',
      }];
    } else {
      ctx.args.filter = {
        include: [{
          relation: 'localization',
        }],
      }
    }
    next();
  });
  Countries.beforeRemote('findById', (ctx, product, next) => {
    if (ctx.args.filter) {
      ctx.args.filter.include = [{
        relation: 'localization',
      }, {
        relation: 'cities', scope: { include: { relation: 'localization' } },
      }];
    } else {
      ctx.args.filter = {
        include: [{
          relation: 'localization',
        }, {
          relation: 'cities', scope: { include: { relation: 'localization' } },
        }],
      }
    }
    next();
  });


  Countries.destinations = async (lang_id, cb) => {
    if (!lang_id) {
      lang_id = 1
    }
    const Cities = Countries.app.models.Cities;
    const TopSearches = Countries.app.models.TopSearches;
    let response = [];
    let filter = {
      order: 'rating DESC',
      limit: 5,
      fields: {
        id: true,
        name: true
      },
    }
    filter.include = [{
      relation: 'localization',
      scope: {
        fields: {
          id: true,
          name: true,
          lang_id: true
        },
      },
    }, {
      relation: 'cities',
      scope: {
        // fields: {  id: true, name: true, localization: true, slug:true,country_id:true },
        include: [{
          relation: 'localization',
          scope: {
            fields: {
              id: true,
              name: true,
              lang_id: true
            },
          },
        }],
      },
    }];
    let results = await Countries.find(filter)

    _.map(results, (result, index) => {
        const nameObject = _.find(result.localization(), {
          lang_id
        });
        if (nameObject && nameObject.name) {
          results[index].name = nameObject.name
        }
        _.map(result.cities(), (city, i) => {
          const cityNameObject = _.find(city.localization(), {
            lang_id
          });
          if (cityNameObject && cityNameObject.name) {
            results[index].cities()[i].name = cityNameObject.name
          }
        })
    });

    response = results;
    filter = {
      order: 'rating DESC',
      limit: 8,
      fields: {
        id: true,
        name: true,
        localization: true,
        slug: true,
        thumbnail_image: true,
        main_image: true
      },
    }
    filter.include = [{
      relation: 'localization',
      scope: {
        fields: {
          id: true,
          name: true,
          lang_id: true
        },
      },
    }];
    results = await Cities.find(filter);
    _.map(results, (result, index) => {
        const nameObject = _.find(result.localization(), {
          lang_id
        });
        if (nameObject && nameObject.name) {
          results[index].name = nameObject.name
        }
    });

    const topSearches = await TopSearches.find({
      where: {
        active: true
      },
      order: 'order desc',
      limit: 10,
      include: [{
        relation: 'localization'
      }]
    });

        if (topSearches && topSearches.length) {
          _.map(topSearches, (search, i) => {
            // console.log(' search', search.localization(), lang_id);
            const searchKeyword = _.findWhere(search.localization(), {
              lang_id: parseInt(lang_id, 10)
            });
            // console.log('locale top searches', searchKeyword);
            if (searchKeyword && searchKeyword.keyword) {
              topSearches[i].keyword = searchKeyword.keyword
              topSearches[i].url = searchKeyword.url
            }
          });
        }

        const hot_destinations = [{
          name: 'Top Searches',
          id: 0,
          data: topSearches
        }];

        if (lang_id == 2) {
          hot_destinations[0].name = '인기 여행지'
        } else if (lang_id == 3) {
          hot_destinations[0].name = '热门搜索'
        } else if (lang_id == 4) {
          hot_destinations[0].name = 'การค้นหายอดนิยม'
        }

        response = hot_destinations.concat(response);
        return response;
  };


  Countries.remoteMethod('destinations', {
    accepts: [
      {
        arg: 'lang_id',
        type: 'string',
      }],
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/destinations',
      verb: 'get',
    },
  });

  Countries.getCountryForDropDown = async () => {
    const filter = {
      include: [{
        relation: 'localization',
      }],
      order: 'order desc',
      where: {
        order: { 'gt': 0 }
      }
    };
    try {
      const top = await Countries.find(filter);
      filter.order = 'name asc';
      filter.where = { order: 0 }
      const others = await Countries.find(filter);
      const result = top.concat(others)
      return result;
    }
    catch (e) {
      console.log('e', e)
      return [];
    }
  }

  Countries.remoteMethod('getCountryForDropDown', {
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/getCountries',
      verb: 'get',
    },
  });
};
