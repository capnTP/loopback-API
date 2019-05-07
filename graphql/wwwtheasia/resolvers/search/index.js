const axios = require('../../axios');
const logger = require('../../../logger');

module.exports = {
  mutations: {
    storeSearch(root, args) {
      logger.debug('storeSearch', args);
      const { query } = args;

      if (!query) {
        return false;
      }

      return axios.post('/searchanalytics/record', { query }).then(res => {
        logger.debug('storeSearch::done', res.data);
        return res.data;
      });
    },
  },
  query: {},
  resolvers: {},
};
