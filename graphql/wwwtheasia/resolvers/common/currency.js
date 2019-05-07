const axios = require('axios');

const { THE_ASIA_API: BASE_API } = require('../../config');
const Locale = require('../common/locale');
const ErrorResponse = require('../../shared/error');

const CURRENCY = `${BASE_API}/currencies`;

const resolvers = {
  Currency: {
    code(c) {
      return c.code || c.currency_code;
    },
    symbol(c) {
      return c.symbol || c.currency_symbol;
    },
    name(c) {
      return c.name || c.currency_name;
    },
    displayName(c) {
      const code = c.code || c.currency_code;
      const name = c.name || c.currency_name;
      return `${name} (${code})`;
    },
    exchangeRate(c) {
      return c.exchange_rate;
    },
  },
};

const query = {
  currencies(obj, args, context) {
    const locale = Locale.resolve(context.locale);
    const currencies = axios.get(CURRENCY).then(res => res.data);
    return axios
      .all([locale, currencies])
      .then(
        axios.spread((lang, currency) => {
          const { data: { id = 0, code = 'en' } = {} } = lang;
          let currencyData = currency;
          if (id && code !== 'en') {
            currencyData = currency.reduce((acc, item, index) => {
              const localizeCurrency = item.localization.find(
                localeItem => Number(localeItem.lang_id) === id,
              );
              acc.push(
                Object.assign({}, currency[index], localizeCurrency, { id: currency[index].id }),
              );
              return acc;
            }, []);
          }
          return currencyData;
        }),
      )
      .catch(({ response: { data: { error = {} } = {} } = {} }) => {
        throw new ErrorResponse(Object.assign({}, error));
      });
  },
};

module.exports = { resolvers, query };
