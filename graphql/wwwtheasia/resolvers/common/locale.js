const axios = require('axios');

const { THE_ASIA_API: BASE_API } = require('../../config');

const LANGUAGES_API = `${BASE_API}/Languages`;

let savedLocale = '';
const resolve = code => {
  if (savedLocale) return Promise.resolve({ data: savedLocale.find(item => item.code === code) });
  return axios.get(LANGUAGES_API).then(res => {
    savedLocale = res.data;
    return { data: res.data.find(item => item.code === code) };
  });
};

module.exports = { resolve };
