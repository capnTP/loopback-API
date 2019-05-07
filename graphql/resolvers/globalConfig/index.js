const { THE_ASIA_API } = require('../../config');
const axios = require('../../axios')

const GLOBAL_CONFIGS_API = `${THE_ASIA_API}/GlobalConfigs`;

module.exports = {
  mutations: {
    async addConfig(root, args) {
      return axios
        .post(`${GLOBAL_CONFIGS_API}`, args)
        .then(res => res.data)
        .catch(err => console.log(err.response.data.error.detail));
    },
    deleteConfig(root, { id }) {
      return axios
        .delete(`${GLOBAL_CONFIGS_API}/${id}`)
        .then(res => res.data)
        .catch(err => console.log(err.response.data.error.detail));
    },
    async updateConfig(root, args) {
      return axios
        .patch(`${GLOBAL_CONFIGS_API}/${args.id}`, args)
        .then(res => res.data)
        .catch(error => console.log(error.response.data.error.detail));
    },
  },
  query: {
    globalConfigs() {
      return axios
        .get(GLOBAL_CONFIGS_API)
        .then(res => res.data)
        .catch(err => err);
    },
    globalConfig(root, { input }) {
      return axios
        .get(`${GLOBAL_CONFIGS_API}/${input.id}`)
        .then(res => res.data)
        .catch(err => err);
    },
  },
};
