const axios = require('../../axios');

module.exports = {
  query: {
    features() {
      return axios.get('/features').then(res => res.data);
    },
  },
  mutation: {},
  resolver: {
    Feature: {
      localizations(root) {
        return root.localization;
      },
    },
    FeatureLocalization: {
      language(root) {
        return axios.get(`/languages/${root.lang_id}`).then(res => res.data);
      },
      languageId(root) {
        return root.lang_id;
      },
    },
  },
};
