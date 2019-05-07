const axios = require('axios');

const { THE_ASIA_API: baseURL } = require('./config');
const adminValidation = require('./helpers/adminValidation');

const axiosIntance = axios.create({ baseURL });

axiosIntance.interceptors.response.use(
  response => response,
  adminValidation,
  // error => {
  //   throw adminValidation(error);
  // },
);

module.exports = axiosIntance;
