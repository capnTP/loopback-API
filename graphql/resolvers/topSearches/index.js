const { THE_ASIA_API } = require('../../config');
const ErrorResponse = require('../../shared/error');
const axios = require('../../axios')

const TOP_SEARCH_API = `${THE_ASIA_API}/TopSearches`;
const TOP_SEARCH_LANG_API = `${THE_ASIA_API}/TopSearchesLangs`;
const LANGUAGE_API = `${THE_ASIA_API}/Languages`;

const where = query => encodeURIComponent(JSON.stringify({ where: query }));

const getLanguage = ({ code, context }) => {
  const filter = where({ code });
  const url = `${LANGUAGE_API}/findone?filter=${filter}`;
  return axios
    .get(`${url}&access_token=${context.user.id}`)
    .then(res => res.data)
    .catch(err => err);
};

module.exports = {
  mutations: {
    async addTopSearch(root, params, context) {
      console.log(params);
      if (params.id && params.lang && params.lang !== 'en') {
        const languageData = await getLanguage({ code: params.lang, context });

        const input = {
          lang_id: languageData.id,
          keyword_id: params.id,
          keyword: params.keyword,
          url: params.url,
        };

        return axios
          .post(`${TOP_SEARCH_LANG_API}`, input)
          .then(res => {
            console.log('lang', res.data);
            return res.data;
          })
          .catch(err => {
            console.log('err-lang', err);
            return new ErrorResponse(err.response.data.error);
          });
      }

      const input = {
        keyword: params.keyword,
        url: params.url,
      };
      console.log(input);
      return axios
        .post(`${TOP_SEARCH_API}`, input)
        .then(res => {
          console.log('nolang', res.data);
          return res.data;
        })
        .catch(err => {
          console.log('err', err);
          return err;
        });
    },
    async updateTopSearch(root, input, context) {
      const {
        query: { id, lang },
        update,
      } = input;

      if (lang && lang.length > 0 && lang !== 'en') {
        const language = await getLanguage({ code: lang, context });
        const whereParams = encodeURIComponent(
          JSON.stringify({ lang_id: language.id, keyword_id: id }),
        );
        update.keyword_id = id;

        return axios
          .post(`${TOP_SEARCH_LANG_API}/update?where=${whereParams}`, update)
          .then(() => ({ id, ...update }))
          .catch(err => {
            console.log('err', err);
            return err;
          });
      }

      return axios
        .patch(`${TOP_SEARCH_API}/${id}?access_token=${context.user.id}`, update)
        .then(res => res.data)
        .catch(err => {
          console.log('err', err);
          return err;
        });
    },
  },
  query: {
    topsearches() {
      return axios
        .get(TOP_SEARCH_API)
        .then(res => res.data)
        .catch(err => err);
    },
    async topsearch(
      root,
      {
        input: { id, lang },
      },
      context,
    ) {
      if (lang && lang !== 'en') {
        const language = await getLanguage({ code: lang, context });
        const filter = encodeURIComponent(
          JSON.stringify({ where: { keyword_id: id, lang_id: language.id } }),
        );
        return axios
          .get(`${TOP_SEARCH_LANG_API}/findone?filter=${filter}&access_token=${context.user.id}`)
          .then(res => ({ ...res.data, id }))
          .catch(err => {
            // console.log(err);
            if (err.response) {
              console.log(err.response.status, 'bigStatus');
              if (err.response.status === 404) {
                return null;
              }
            }
            return err;
          });
      }
      return axios
        .get(`${TOP_SEARCH_API}/${id}`)
        .then(res => res.data)
        .catch(err => err);
    },
  },
};
