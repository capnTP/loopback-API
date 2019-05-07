const axios = require('axios');

const { THE_ASIA_API: baseURL } = require('../config');
const ErrorResponse = require('../shared/error');
const logger = require('../../logger');
const tryGet = require('../helpers/tryGet');

const handleError = errorResponse => {
  const error = tryGet(() => errorResponse.data.error);
  logger.error(error);
  throw new ErrorResponse(Object.assign({}, error));
};

module.exports = {
  query: {
    languages() {
      return axios
        .request({
          method: 'GET',
          baseURL,
          url: '/languages',
        })
        .then(res => res.data)
        .catch(handleError);
    },
  },
  resolver: {
    Language: {
      displayName(root) {
        return root.display_name;
      },
      localeAvailable(root) {
        return root.locale_available;
      },
      abbr(root) {
        return root.code;
      },
    },
  },
};
