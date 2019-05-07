const axios = require('../../axios');
const _ = require('underscore');

const AVAILABLE_PAYMENT_API = '/Payments/getAvailablePaymentOptions';
const { IMGIX_API } = require('../../config');

const query = {
  availablePayments() {
    return axios
      .get(AVAILABLE_PAYMENT_API)
      .then((res) => {
        const responseData = [];
        _.each(res.data, (item) => {
          responseData.push({
            id: item.id,
            name: item.name,
            icon: `${IMGIX_API}/${item.icon}?auto=compress&lossless=1`,
            type: item.type,
            currencies: item.currencies,
          });
        });
        return responseData;
      });
  },
};
module.exports = { query };
