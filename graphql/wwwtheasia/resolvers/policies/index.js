const axios = require('axios');
const _ = require('underscore');

const { THE_ASIA_API: BASE_API } = require('../../config');
const Locale = require('../common/locale');
const ErrorResponse = require('../../shared/error');

const CANCELLATION_POLICIES = `${BASE_API}/CancellationPolicies`;

const resolvers = {
  CancellationPolicy: {
    name({ name = '' }) {
      return name;
    },
    description({ description = '' }) {
      return description;
    },
  },
};

const query = {
  cancellationPolicies(obj, args, context) {
    const locale = Locale.resolve(context.locale);
    const policies = axios.get(CANCELLATION_POLICIES).then(res => res.data);
    return axios
      .all([locale, policies])
      .then(
        axios.spread((lang, policy) => {
          const { data: { id = 0, code = 'en' } = {} } = lang;
          let policyData = policy;
          if (id && code !== 'en') {
            policyData = policy.reduce((acc, item, index) => {
              const localizePolicy = item.localization.find(
                localeItem => Number(localeItem.lang_id) === id,
              );
              acc.push(
                Object.assign({}, policyData[index], _.pick(localizePolicy, _.identity), {
                  id: policy[index].id,
                }),
              );
              return acc;
            }, []);
          }
          return _.map(policyData, item => _.pick(item, _.identity));
        }),
      )
      .catch(({ response: { data: { error = {} } = {} } = {} }) => {
        throw new ErrorResponse(Object.assign({}, error));
      });
  },
};

module.exports = { resolvers, query };
