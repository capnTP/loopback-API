/* eslint-disable */
const getSlug = require('speakingurl');
const _ = require('lodash');
const utility = require('../../../server/helpers/utility');

const getLanguageCode = (lang_id) => {
  switch (parseInt(lang_id, 10)) {
    case 1:
      return 'en';
    case 2:
      return 'ko'
    case 3:
     return 'zh'
    case 4:
     return 'th'
    default:
     return 0;
  }
}

module.exports = function (Cities) {
  Cities.beforeRemote('find', (ctx, cities, next) => {
    if (ctx.args.filter) {
      ctx.args.filter.include = [{
        relation: 'localization',
      },
      {
        relation: 'city_country',
        scope: {
          include: [
                        { relation: 'localization' },
                        { relation: 'country_currency' },
                        { relation: 'country_language' },
                        { relation: 'country_region' },
          ],
        },
      }];
    } else {
      ctx.args.filter = {
        include: [{
          relation: 'localization',
        },
        {
          relation: 'city_country',
          scope: {
            include: [
                            { relation: 'localization' },
                            { relation: 'country_currency' },
                            { relation: 'country_language' },
                            { relation: 'country_region' },
            ],
          },
        }],
      }
    }
    next();
  });
  Cities.beforeRemote('findById', (ctx, product, next) => {
    if (ctx.args.filter) {
      ctx.args.filter.include = [{
        relation: 'localization',
      },
      {
        relation: 'city_country',
        scope: {
          include: [
                        { relation: 'localization' },
                        { relation: 'country_currency' },
                        { relation: 'country_language' },
                        { relation: 'country_region' },
          ],
        },
      }];
    } else {
      ctx.args.filter = {
        include: [{
          relation: 'localization',
        },
        {
          relation: 'cities_tours',
        },
        {
          relation: 'city_country',
          scope: {
            include: [
                            { relation: 'localization' },
                            { relation: 'country_currency' },
                            { relation: 'country_language' },
                            { relation: 'country_region' },
            ],
          },
        }],
      }
    }
    next();
  });

  Cities.observe('after save', (ctx, next) => {
    if (ctx.instance) {
      const name = ctx.instance.name;
      const slug = getSlug(name);
      ctx.instance.updateAttributes({ slug })
      next();
    }
  });


  Cities.findBySlug = function (slug, cb) {
    const filter = {
      include: [{
        relation: 'localization',
      },
      {
        relation: 'city_country',
        scope: {
          include: [
                        { relation: 'localization' },
                        { relation: 'country_currency' },
                        { relation: 'country_language' },
                        { relation: 'country_region' },
          ],
        },
      }],
    };
    filter.where = { slug }
    Cities.findOne(filter, (err, city) => {
      if (err) {
        return cb(err);
      }
      if (city) {
        return cb(null, city);
      }
      const error = new Error('City not found, Incorrect or Invalid slug');
      return cb(error);
    })
  };


  Cities.remoteMethod('findBySlug', {
    accepts: [
      {
        arg: 'slug',
        type: 'string',
        required: true,
      }],
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

  Cities.sitemap = function (cb) {
    const Tours = Cities.app.models.Tours;
    const filter = {
      where: { status: true },
      fields: { id: true, slug: true, enable:true },
      include : ['localization']
    };
    const response = [];
    Cities.find(filter, (err, cities) => {
      if (err) {
        cb(err);
      }
      _.each(cities, (city, index) => {
        response.push({ slug: `city/${city.slug}` })
        response.push({ slug: `ko/city/${city.slug}` })
        response.push({ slug: `zh/city/${city.slug}` })
        response.push({ slug: `th/city/${city.slug}` })
      });
      Tours.find(filter, (err, tours) => {
        if (err) {
          cb(err);
        }
        _.each(tours, (tour, index) => {
          if(tour.enable)
          {
            response.push({ slug: `discover/${tour.slug}` })
          }
          if(tour.localization() && tour.localization().length){
            _.each(tour.localization(),(langObj) => {
              const lanCode = getLanguageCode(langObj.lang_id);
              if(langObj.enable)
              response.push({ slug: `${lanCode}/discover/${tour.slug}` })
            })
          }
        })
        cb(null, response);
      })
    })
  }

  Cities.getCitySlider = function (cb) {
    const filter = {
      fields: { id: true, slug: true,name:true, description:true,main_image:true  },
    }
    Cities.find(filter,function(err,results){
       return cb(null,results);
    })

  }

  Cities.afterRemote('getCitySlider',function(ctx, result, next){
    _.each(ctx.result,function(city,i){
      ctx.result[i].main_image = 'https://theasia.imgix.net/sandbox/' + ctx.result[i].main_image;
    })
    ctx.result = {cities:result};
    //result.__data.full_image_url = 'https://theasia.imgix.net/' + result.main_image
      next();
  })

  Cities.remoteMethod('getCitySlider', {
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/getCitySlider',
      verb: 'get',
    },
  });


  Cities.remoteMethod('sitemap', {
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/sitemap',
      verb: 'get',
    },
  });
};
