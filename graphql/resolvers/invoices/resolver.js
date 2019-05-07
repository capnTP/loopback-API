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
  Invoice: {
    details: root => {
			if (!root.details || root.details.length === 0) {
				return null;
			}

			let params = {
				order : 'created_at DESC',
			};
			params.where = { id: { inq: root.details } };

			return loopbackRef.app.models.Booking.find(params);
    },
    payer_id: async root => {
      const user = await loopbackRef.app.models.Users.findById(root.payer_id);
      // console.log(user)
      // let payer_name = '';

      if (user.affiliate_id && user.affiliate_id != 0) {
        const affiliate = await loopbackRef.app.models.Affiliates.findById(user.affiliate_id);

        return affiliate.company_name;
      }
      return user.email;
    },
    receiver_id: async root => {
      const receiver = await loopbackRef.app.models.Company.findById(root.receiver_id);
      // console.log(receiver)

      return receiver.company_name;
    },
  },
};
