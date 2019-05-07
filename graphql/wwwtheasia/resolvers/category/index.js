const axios = require('../../axios');

module.exports = {
  query: {},
  mutations: {},
  resolvers: {
    Category: {
      localizations(root) {
        return root.localization;
      },
      imageUrl({ image_url: imageUrl }) {
        return imageUrl;
      },
    },
    CategoryLocalization: {
      language(root) {
        return axios.get(`/languages/${root.lang_id}`).then(res => res.data);
      },
      languageId(root) {
        return root.lang_id;
      },
    },
  },
};
