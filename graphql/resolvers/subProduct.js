const { THE_ASIA_API } = require('../../config');
const logger = require('../logger');
const axios = require('../axios')

module.exports = {
  mutations: {
    duplicateSubProduct(root, args) {
      logger.debug('duplicateSubProduct', args);

      return axios
        .request({
          baseURL: THE_ASIA_API,
          data: args,
          method: 'POST',
          url: '/subproducts/duplicate',
        })
        .then(({ data: { result } }) => result)
        .catch(error => error);
    },
  },
  queries: {},
  resolvers: {},
};
