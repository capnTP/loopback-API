const money = require('money');
const moment = require('moment');

const axios = require('../axios');
const logger = require('../logger');

function CurrencyHelper() {
  // NOTE: to make HTTP request once per query
  let currenciesHttpRequest = null;
  // NOTE: to make HTTP request once per day
  let latestFetchDateOfExchangeRates = null;

  function debug(...args) {
    logger.debug('[CurrencyHelper]', ...args);
  }

  debug('Init');

  // NOTE: money needs exchange_rate to work
  async function asyncSetExchangeRates() {
    const wasFetchedToday =
      latestFetchDateOfExchangeRates &&
      moment(latestFetchDateOfExchangeRates).isSame(new Date(), 'day');

    debug(`wasFetchedToday=${wasFetchedToday}`);

    if (!wasFetchedToday) {
      debug('start fetching');

      if (!currenciesHttpRequest) {
        debug('init HTTP request');
        currenciesHttpRequest = axios
          .get('/currencies')
          .then(res => res.data)
          .catch(error => {
            throw new Error('[error] on fetching /currencies', error);
          });
      }

      const currencies = await currenciesHttpRequest;
      debug(`currencies=${currencies.length}`);

      currenciesHttpRequest = null;

      currencies.forEach(i => {
        money.rates[i.currency_code] = i.exchange_rate;
      });

      latestFetchDateOfExchangeRates = new Date();

      debug(`latestFetchDateOfExchangeRates=${latestFetchDateOfExchangeRates}`);
    }
  }

  async function asyncConvert(price, from, to) {
    await asyncSetExchangeRates();
    return money(price)
      .from(from)
      .to(to);
  }

  return { asyncConvert, asyncSetExchangeRates };
}

let currencyHelper = null;

// NOTE: singleton factory
module.exports = function getCurrencyHelper() {
  if (!currencyHelper) {
    currencyHelper = new CurrencyHelper();
  }
  return currencyHelper;
};
