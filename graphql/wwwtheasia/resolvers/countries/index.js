const axios = require('axios');
const _ = require('underscore');

const Locale = require('../common/locale');
const ErrorResponse = require('../../shared/error');
const { THE_ASIA_API: BASE_API, IMGIX_API } = require('../../config');

const COUNTRIES_API = `${BASE_API}/Countries`;
const COUNTRIES_DESTINATIONS_API = `${BASE_API}/Countries/destinations`;

const resolvers = {
  Countries: {
    code({ country_code: code = '' }) {
      return code;
    },
    currency({ currency_code: currency = '' }) {
      return currency;
    },
    countryCode({ country_code: countryCode = '' }) {
      return countryCode;
    },
    isoCode({ iso_code: isoCode = '' }) {
      return isoCode;
    },
    image({ thumbnail_image: image = '' }) {
      return image;
    },
  },
  Country: {
    cities(root, args, context) {
      const locale = Locale.resolve(context.locale);
      const city = axios
        .request({
          method: 'get',
          baseURL: BASE_API,
          url: '/cities',
          params: {
            filter: {
              where: {
                country_id: root.id,
              },
            },
          },
        })
        .then(res => res.data);

      return Promise.all([locale, city])
        .then(([lang, cities]) => {
          const { data: { id = 0, code = 'en' } = {} } = lang;
          let citiesMain = cities;
          if (id && code !== 'en') {
            citiesMain = cities.reduce((acc, item, index) => {
              const localizeProduct = item.localization.find(
                localeItem => Number(localeItem.lang_id) === id,
              );
              acc.push(Object.assign({}, cities[index], localizeProduct, { id: cities[index].id }));
              return acc;
            }, []);
          }
          // Remove null keys from data
          return _.map(citiesMain, item => _.pick(item, _.identity));
        })
        .catch(({ response: { data: { error = {} } = {} } = {} }) => {
          throw new ErrorResponse(Object.assign({}, error));
        });
    },
    code({ country_code: code = '' }) {
      return code;
    },
    currency({ currency_code: currency = '' }) {
      return currency;
    },
    countryCode({ country_code: countryCode = '' }) {
      return countryCode;
    },
    isoCode({ iso_code: isoCode = '' }) {
      return isoCode;
    },
    localizations(root) {
      return root.localization;
    },
    thumbnailUrl(root) {
      return `${IMGIX_API}/${
        root.thumbnail_image
      }?crop=center,center&fit=crop&w=80&h=60&auto=compress&lossless=1`;
    },
    image({ thumbnail_image: image = '' }) {
      return image;
    },
    mainImage({ main_image: mainImage = '' }) {
      return `${IMGIX_API}/${mainImage}?auto=compress&lossless=1`;
    },
  },
  CountryLocalization: {
    languageId(root) {
      return root.lang_id;
    },
  },
};

const query = {
  countries(root, args, context) {
    // NOTE: added withoutLocale because some usage of this query doesn't need locale,
    // billing country selection for example
    const { where, withoutLocale = false } = args;
    const locale = Locale.resolve(context.locale);
    const destinations = axios.get(COUNTRIES_API, { params: { filter: { where } } }).then(res =>
      res.data.sort((a, b) => {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      }),
    );

    return Promise.all([locale, destinations])
      .then(([lang, country]) => {
        const { data: { id = 0, code = 'en' } = {} } = lang;
        let countryMain = country;
        if (!withoutLocale && id && code !== 'en') {
          countryMain = country.reduce((acc, item, index) => {
            const localizeProduct = item.localization.find(
              localeItem => Number(localeItem.lang_id) === id,
            );
            acc.push(Object.assign({}, country[index], localizeProduct, { id: country[index].id }));
            return acc;
          }, []);
        }
        // Remove null keys from data
        return _.map(countryMain, item => _.pick(item, _.identity));
      })
      .catch(({ response: { data: { error = {} } = {} } = {} }) => {
        throw new ErrorResponse(Object.assign({}, error));
      });
  },
  countryTour() {
    return axios
      .get(COUNTRIES_API, {
        params: {
          filter: {
            where: {
              active: true,
            },
          },
        },
      })
      .then(res =>
        res.data.sort((a, b) => {
          if (a.name < b.name) return -1;
          if (a.name > b.name) return 1;
          return 0;
        }),
      )
      .catch(error => Promise.reject(error));
  },
  countryDestinations(root, args, context) {
    const locale = Locale.resolve(context.locale);

    return locale.then(localeData => {
      const {
        data: { id = 1 },
      } = localeData;
      return axios
        .get(COUNTRIES_DESTINATIONS_API, {
          params: {
            lang_id: id,
          },
        })
        .then(res =>
          res.data.sort((a, b) => {
            if (a.id < b.id) return -1;
            if (a.id > b.id) return 1;
            return 0;
          }),
        )
        .catch(error => Promise.reject(error));
    });
  },
};

module.exports = { resolvers, query };
