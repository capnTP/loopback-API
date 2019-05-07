const money = require('money');
const _ = require('lodash');

const Locale = require('../common/locale');
const axios = require('../../axios');
const objectHelper = require('../../helpers/object');
const priceHelper = require('../../helpers/price');
const logger = require('../../../logger');
const getCurrencyHelper = require('../../../helpers/currency');

module.exports = {
  mutations: {},
  query: {
    async discover(root, args, context) {
      const {
        input: {
          query: searchKeyword = '',
          countryId: country_id = 0,
          citySlug: city_slug = '',
          cityIds: city_ids = [],
          categoryTypeIds: category_type_ids = [],
          categoryIds: category_ids = [],
          featureIds: feature_ids = [],
          priceRange: price_range = [],
          ratingRange: rating = [],
          recommended = true,
          trending = false,
          promotions = false,
          promotionPage = false,
          sort = '',
        } = {},
        page = 1,
      } = args;
      const params = {
        query: searchKeyword,
        country_id,
        city_slug,
        city_ids,
        category_type_ids,
        category_ids,
        feature_ids,
        price_range,
        rating,
        sort,
        offset: 0,
        limit: 16,
        recommended,
        trending,
        promotions,
        promotionPage,
      };

      logger.debug('params', params);
      logger.debug('page', page);

      params.offset = (page - 1) * params.limit;

      const currencyCode = objectHelper.safeGet(() => context.currency.code);

      if (currencyCode && currencyCode !== 'USD') {
        const currencyHelper = getCurrencyHelper();
        await currencyHelper.asyncSetExchangeRates();

        params.price_range = price_range.map(p =>
          priceHelper.convert(money, p, currencyCode, 'USD'),
        );
      }

      return Locale.resolve(context.locale || 'en').then(
        ({ data: { id: lang_id, code: langCode } = {} }) => {
          params.lang_id = lang_id;
          const mainRequest = axios.get('/tours/discover', { params }).then(res => res.data);
          const toursCountRequest = axios
            .get('/tours/discover', {
              params: {
                ...params,
                count: true,
              },
            })
            .then(res => res.data)
            .catch(() => ({ count: 0 }));

          return Promise.all([mainRequest, toursCountRequest]).then(values => {
            const [discover, discoverCount] = values;
            return {
              ...discover,
              language: {
                id: lang_id,
                code: langCode,
              },
              toursCount: discoverCount.count || 0,
            };
          });
        },
      );
    },
    async discoverToursCount(root, args, context) {
      const { input } = args;

      let params = { count: true };

      if (input) {
        const {
          query: searchKeyword = '',
          countryId: country_id = 0,
          citySlug: city_slug = '',
          cityIds: city_ids = [],
          categoryTypeIds: category_type_ids = [],
          categoryIds: category_ids = [],
          featureIds: feature_ids = [],
          priceRange: price_range = [],
          ratingRange: rating = [],
        } = input;
        params = {
          ...params,
          query: searchKeyword,
          country_id,
          city_slug,
          city_ids,
          category_type_ids,
          category_ids,
          feature_ids,
          price_range,
          rating,
        };

        const currencyCode = objectHelper.safeGet(() => context.currency.code);

        if (currencyCode && currencyCode !== 'USD') {
          const currencyHelper = getCurrencyHelper();
          await currencyHelper.asyncSetExchangeRates();

          params.price_range = price_range.map(p =>
            priceHelper.convert(money, p, currencyCode, 'USD'),
          );
        }
      }

      return axios
        .get('/tours/discover', { params })
        .then(res => res.data)
        .then(({ status, count }) => {
          if (status) {
            return count;
          }
          return 0;
        });
    },
  },
  resolvers: {
    Discover: {
      tours(root) {
        const { products } = root;
        if (_.isEmpty(products)) {
          return [];
        }

        if (!Array.isArray(products)) {
          return [];
        }

        return products;
      },
      city(root) {
        if (_.isEmpty(root.city)) {
          return null;
        }
        return root.city;
      },
    },
  },
};
