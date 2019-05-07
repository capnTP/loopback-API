const axios = require('axios');
const { isArray } = require('underscore');

const { THE_ASIA_API, IMGIX_API: IMGIX_BASE_URL } = require('../../config');
const loopbackRef = require('../../reference')
const axiosInstance = require('../../axios');

const safeJsonParse = (target, defaultValue) => {
  try {
    return JSON.parse(target);
  } catch (e) {
    return defaultValue;
  }
};

const parseJsonArray = value => {
  const result = safeJsonParse(value, []);

  if (!Array.isArray(result)) {
    return [];
  }

  return result;
};

module.exports = {
  Payout: {
    payment_method: data => loopbackRef.app.models.PaymentMethods.findById(data.payment_method_id),
    company: data => {
      return loopbackRef.app.models.Company.findById(data.payer_company_id)
   },
    supplier: data => loopbackRef.app.models.Suppliers.findById(data.reciever_id)
  },

};
