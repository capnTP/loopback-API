const _ = require('lodash');
const oxr = require('open-exchange-rates');

const updateWebsiteExchangeRate = require('../../../server/helpers/website');
const configCredential = require('../../../server/config/env-service');

module.exports = function(Currencies) {
  Currencies.beforeRemote('find', (ctx, products, next) => {
    if (ctx.args.filter) {
      ctx.args.filter.include = {
        relation: 'localization',
      };
    } else {
      ctx.args.filter = {
        include: {
          relation: 'localization',
        },
      };
    }
    ctx.args.filter.where = {
      default: true,
    };
    ctx.args.filter.order = 'order desc';
    next();
  });
  Currencies.beforeRemote('findById', (ctx, product, next) => {
    if (ctx.args.filter) {
      ctx.args.filter.include = {
        relation: 'localization',
      };
    } else {
      ctx.args.filter = {
        include: {
          relation: 'localization',
        },
      };
    }
    next();
  });

  Currencies.updateExchangeRate = async () => {
    try {
      oxr.set({ app_id: configCredential.openExchangeRate });
      /**
       * update exchange rate
       */
      await new Promise((resolve, reject) => oxr.latest(() => resolve()));
      const updateExchangeResult = await Promise.all(
        Object.keys(oxr.rates).map(async currency_code => {
          const exchange_rate = oxr.rates[currency_code];
          const where = { currency_code };
          const data = { exchange_rate };
          try {
            const info = (await Currencies.updateAll(where, data)).count;
            // console.log(`SUCCESS - update exchange rate ${exchange_rate} : ${info}`)
            return { currency_code, exchange_rate };
          } catch (error) {
            console.log(
              `FAIL - update exchange rate ${exchange_rate} where: ${JSON.stringify(
                where,
              )} data: ${JSON.stringify(data)}`,
            );
            return error;
          }
        }),
      );
      /**
       * Update website's exchange rate
       */
      updateWebsiteExchangeRate();

      /**
       * update tour
       */
      const updateMinimumPriceResult = await Currencies.app.models.Tours.updateMinimumPriceValueOfProduct();
      return Promise.resolve({ updateExchangeResult, updateMinimumPriceResult });
    } catch (error) {
      console.log(error);
      return Promise.reject(error);
    }
  };

  Currencies.remoteMethod('updateExchangeRate', {
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/exchangeRates',
      verb: 'POST',
    },
  });

  Currencies.getCurrencyForDropDown = async () => {
    const filter = {
      include: [
        {
          relation: 'localization',
        },
      ],
      order: 'order desc',
      where: {
        order: { gt: 0 },
      },
    };

    try {
      const top = await Currencies.find(filter);
      filter.order = 'currency_name asc';
      filter.where.order = 0;
      filter.where.default = true;
      const others = await Currencies.find(filter);
      const result = top.concat(others);
      return result;
    } catch (e) {
      console.log('e', e);
      return [];
    }
  };

  Currencies.remoteMethod('getCurrencyForDropDown', {
    returns: {
      arg: 'response',
      type: 'string',
      root: true,
    },
    http: {
      path: '/getCurrency',
      verb: 'get',
    },
  });
};
