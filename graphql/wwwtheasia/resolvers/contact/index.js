const axios = require('axios');
const { THE_ASIA_API: BASE_API } = require('../../config');
const Locale = require('../common/locale');

const ErrorResponse = require('../../shared/error');

const CONTACT_US = `${BASE_API}/ContactUs`;

const mutations = {
  contactUs(
    root,
    { input: { name, lastName, email, message, categoryId: category, bookingNumber } = {} },
    context,
  ) {
    return Locale.resolve(context.locale || 'en')
      .then(({ data: { id: langId } = {} }) => {
        const payload = {
          name,
          last_name: lastName,
          email,
          lang_id: langId.toString(),
          message,
          category,
          booking_no: bookingNumber,
        };
        console.log('payload : ', payload);
        return axios
          .post(CONTACT_US, payload)
          .then(resMain => {
            console.log('SUCCESS : ', resMain.data);
            return !!resMain.data;
          })
          .catch(err => err);
      })
      .catch(({ response: { data: { error = {} } = {} } = {} }) => {
        console.log('ERROR :', error);
        throw new ErrorResponse(Object.assign({}, error));
      });
  },
};

module.exports = { mutations };
