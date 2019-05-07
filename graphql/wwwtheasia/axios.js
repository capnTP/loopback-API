const axios = require('axios');

const ErrorResponse = require('./shared/error');
const { THE_ASIA_API: baseURL } = require('./config');

const axiosIntance = axios.create({ baseURL });
// axios.defaults.timeout = 5000;
axiosIntance.interceptors.response.use(
  response => response,
  error => {
    // Sometimes, Axios will throw error without .response
    // see https://github.com/axios/axios#handling-errors
    if (error.response) {
      throw new ErrorResponse(error.response.data.error);
    }

    throw error;
  },
);

module.exports = axiosIntance;
