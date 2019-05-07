const axios = require('../../axios');
const _ = require('underscore');

const { IMGIX_API } = require('../../config');
const Locale = require('../common/locale');
const ErrorResponse = require('../../shared/error');
// const logger = require('../../../logger');

module.exports = {
  query: {
    categoryTypes(root, args, context) {
      const { filter } = args;
      const params = {};

      if (!_.isEmpty(filter)) {
        params.filter = filter;
      }

      const locale = Locale.resolve(context.locale);
      const types = axios.get('/categorytypes', { params }).then(res => res.data);

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
  mutations: {},
  resolvers: {
    CategoryType: {
      categories(root, args, context) {
        const { where = {} } = args;
        where.category_type_id = root.id;
        const locale = Locale.resolve(context.locale);
        const categories = axios
          .get('/categories', {
            params: {
              filter: {
                where,
              },
            },
          })
          .then(res => res.data);

        return Promise.all([locale, categories])
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
      localizations(root) {
        return root.localization;
      },
      thumbnailUrl(root) {
        return `${IMGIX_API}/${
          root.filter_thumbnail
        }?crop=center,center&fit=crop&w=80&h=60&auto=compress&lossless=1`;
      },
    },
    CategoryTypeLocalization: {
      language(root) {
        return axios.get(`/languages/${root.lang_id}`).then(res => res.data);
      },
      languageId(root) {
        return root.lang_id;
      },
    },
  },
};
