const axios = require('axios');
const moment = require('moment');
const _ = require('underscore');
const lodash = require('lodash');

const { THE_ASIA_API: BASE_API, IMGIX_API } = require('../../config');
const Locale = require('../common/locale');
const ErrorResponse = require('../../shared/error');

const CITIES_API = `${BASE_API}/Cities`;
const COUNTRIES_API = `${BASE_API}/Countries`;
const CATEGORY_TYPES_API = `${BASE_API}/CategoryTypes`;

const countriesHash = {};
const resolvers = {
  City: {
    countryId({ country_id: countryId }) {
      return countryId;
    },
    country({ city_country: country = '', country_id: countryId }) {
      const cityCountry = country.name ? country.name : country;
      if (!cityCountry && !countriesHash[countryId] && countryId) {
        return axios.get(`${COUNTRIES_API}/${countryId}`).then(({ data: { name } = {} }) => {
          countriesHash[countryId] = name;
          return name;
        });
      }
      if (cityCountry) {
        countriesHash[countryId] = cityCountry;
      }
      return countriesHash[countryId] || cityCountry;
    },
    filterThumbnail(root) {
      return `${IMGIX_API}/${
        root.filter_thumbnail
      }?crop=center,center&fit=crop&w=80&h=60&auto=compress&lossless=1`;
    },
    localizations(root) {
      return root.localization;
    },
    time({ timezone = '0' }) {
      const cityTimeZone = parseInt(timezone, 10);
      return moment()
        .utc()
        [cityTimeZone < 0 ? 'subtract' : 'add'](Math.abs(cityTimeZone), 'hours')
        .format('hh:mm');
    },
    seoTitle({ seo_title: seoTitle = '' }) {
      return seoTitle;
    },
    seoDescription({ seo_description: seoDescription = '' }) {
      return seoDescription;
    },
    seoKeywords({ seo_keywords: seoKeywords = '' }) {
      return seoKeywords;
    },
    currency({ city_country: { country_currency: currency = '' } = {} }) {
      return currency;
    },
    language({ city_country: { country_language: language = '' } = {} }) {
      return language;
    },
    image({ thumbnail_image: image }) {
      return `${IMGIX_API}/${image}?auto=compress&lossless=1`;
    },
    ratings({ rating: ratings }) {
      return ratings;
    },
    toursCount(root) {
      const toursCount = lodash.get(root, 'tours_count.total', 0);
      return toursCount;
    },
    categoryType({ slug }, args, context) {
      const locale = Locale.resolve(context.locale);
      const types = axios
        .get(CATEGORY_TYPES_API, {
          params: {
            filter: {
              city_slug: slug,
            },
          },
        })
        .then(res => res.data);

      return Promise.all([locale, types])
        .then(([lang, category]) => {
          const { data: { id = 0, code = 'en' } = {} } = lang;
          let categoryMain = category;
          if (id && code !== 'en') {
            categoryMain = category.reduce((acc, item, index) => {
              const localizeProduct = item.localization.find(
                localeItem => Number(localeItem.lang_id) === id,
              );
              acc.push(
                Object.assign({}, category[index], localizeProduct, { id: category[index].id }),
              );
              return acc;
            }, []);
          }
          // Remove null keys from data
          return _.map(categoryMain, item => _.pick(item, _.identity));
        })
        .catch(({ response: { data: { error = {} } = {} } = {} }) => {
          throw new ErrorResponse(Object.assign({}, error));
        });
    },
  },
  CityLocalization: {
    languageId(root) {
      return root.lang_id;
    },
  },
  ToursCount: {
    total({ total = 0 }) {
      return total;
    },
    tours({ tours = 0 }) {
      return tours;
    },
    activities({ actvities: activities = 0 }) {
      return activities;
    },
    transportation({ transportation = 0 }) {
      return transportation;
    },
  },
};

const query = {
  cities(obj, args, { locale: userLocale = '' }) {
    const locale = Locale.resolve(userLocale);
    const citiesData = axios.get(CITIES_API).then(({ data }) => data);

    return axios
      .all([locale, citiesData])
      .then(
        axios.spread((lang, cities) => {
          const { data: { id = 0, code = 'en' } = {} } = lang;
          let citiesMain = cities;
          if (id && code !== 'en') {
            citiesMain = cities.reduce((acc, item, index) => {
              try {
                const localizeProduct = item.localization.find(
                  localeItem => Number(localeItem.lang_id) === id,
                );
                localizeProduct.city_country = item.city_country.localization.find(
                  localeItem => Number(localeItem.lang_id) === id,
                );
                acc.push(
                  Object.assign({}, cities[index], localizeProduct, { id: cities[index].id }),
                );
              } catch (e) {
                acc.push(item);
              }

              return acc;
            }, []);
          }

          // Remove null keys from data
          return _.map(citiesMain, item => _.pick(item, _.identity));
        }),
      )
      .catch(({ response: { data: { error = {} } = {} } = {} }) => {
        throw new ErrorResponse(Object.assign({}, error));
      });
  },
};

module.exports = { query, resolvers };
