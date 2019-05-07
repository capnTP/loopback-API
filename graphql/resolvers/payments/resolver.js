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
  Payment: {
    booking_id: data => loopbackRef.app.models.Booking.findById(data.booking_id),
    payment_method: data => loopbackRef.app.models.PaymentMethods.findById(data.payment_method_id),
    payment_status: data => loopbackRef.app.models.PaymentStatus.findById(data.payment_status_id),
 },

};
