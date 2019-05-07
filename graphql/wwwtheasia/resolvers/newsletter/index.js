const axios = require('axios');
const { THE_ASIA_API: BASE_API } = require('../../config');

const NEWSLETTER_API = `${BASE_API}/Newsletters`;

const mutation = {
  subscribeNewsLetter(
    root,
    {
      input: { email },
    },
  ) {
    return axios
      .get(NEWSLETTER_API, {
        params: {
          filter: {
            where: { email },
          },
        },
      })
      .then(res => {
        const isExist = res.data.length > 0;
        if (isExist) {
          return {
            status: false,
            error: true,
            errorMessage: 'Email address is already subscribed',
          };
        }
        return axios
          .post(NEWSLETTER_API, { email, user_id: 0 })
          .then(response => ({
            status: !!response.data,
            error: false,
            errorMessage: '',
          }))
          .catch(() => ({
            status: false,
            error: true,
            errorMessage: 'Network error. Please try again.',
          }));
      });
  },
};

module.exports = { mutation };
