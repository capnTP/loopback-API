const axios = require('../axios');
const logger = require('../logger');

const GraphQlDefinition = require('./GraphQlDefinition');

const where = query => encodeURIComponent(JSON.stringify({ where: query }));

const getLanguage = ({ code, context }) => {
  const filter = where({ code });
  const url = `/languages/findone?filter=${filter}`;
  return axios.get(`${url}&access_token=${context.user.id}`).then(res => res.data);
};

module.exports = new GraphQlDefinition({
  mutation: {
    async addCity(root, params, context) {
      logger.debug('addCity', params);

      if (params.id && params.lang && params.lang !== 'en') {
        logger.debug(`${params.lang} is not default language`);

        const languageData = await getLanguage({ code: params.lang, context });

        const input = {
          lang_id: languageData.id,
          city_id: params.id,
          name: params.name,
        };
        logger.debug('input', input);

        return axios.post('/citieslangs', input).then(res => {
          logger.debug('done');
          return res.data;
        });
      }

      const input = {
        name: params.name,
        country_id: params.country_id,
      };

      return axios.post('/cities', input).then(res => res.data);
    },
    deleteCity(
      root,
      {
        input: { id },
      },
    ) {
      logger.log('deleteCity', id);
      return axios.delete(`/cities/${id}`).then(res => res.data);
    },
    async updateCity(root, input, context) {
      logger.debug('updateCity', input);
      const {
        query: { id, lang },
        update,
      } = input;

      if (lang && lang.length > 0 && lang !== 'en') {
        logger.debug(`${lang} is not default language`);

        const language = await getLanguage({ code: lang, context });
        logger.debug('language data', language);

        const whereParams = encodeURIComponent(
          JSON.stringify({ lang_id: language.id, city_id: id }),
        );
        update.city_id = id;

        return axios.post(`/citieslangs/update?where=${whereParams}`, update).then(() => {
          logger.debug('done', { id, ...update });
          return { id, ...update };
        });
      }

      return axios.patch(`/cities/${id}?access_token=${context.user.id}`, update).then(res => {
        logger.debug('done', res.data);
        return res.data;
      });
    },
  },
  query: {
    async city(
      root,
      {
        input: { id, lang },
      },
      context,
    ) {
      logger.debug('city', { id, lang });

      if (lang && lang !== 'en') {
        logger.debug(`${lang} is not default language`);

        const language = await getLanguage({ code: lang, context });
        logger.debug('language data', language);

        const filter = encodeURIComponent(
          JSON.stringify({ where: { city_id: id, lang_id: language.id } }),
        );
        return axios
          .get(`/citieslangs/findone?filter=${filter}&access_token=${context.user.id}`)
          .then(res => {
            logger.debug('done', { ...res.data, id });
            return { ...res.data, id };
          })
          .catch(err => {
            if (err.response) {
              if (err.response.status === 404) {
                return null;
              }
            }
            return err;
          });
      }
      return axios
        .get(`/cities/${id}?access_token=${context.user.id}`)
        .then(res => res.data)
        .catch(err => err);
    },
    cities() {
      return axios.get('/cities').then(res => res.data);
    },
  },
  resolver: {
    City: {
      country: data => axios.get(`/cities/${data.id}/city_country`).then(res => res.data),
    },
  },
  type: /* GraphQL */ `
    extend type Query {
      cities: [City]!
      city(input: CityInput): City
      cityList: [City]!

      getCityById(id: ID, lang: String): City
    }

    extend type Mutation {
      addCity(id: ID, lang: String, name: String, country_id: String): City

      deleteCity(input: CityInput): Success
      deleteCityById(id: ID): Success

      updateCity(query: CityInput, update: CityInput): City
      updateCityById(input: CityInput): City
    }

    type City {
      id: ID!

      active: Boolean

      banner: Image

      country_id: String
      country: ID
      countryName: String
      currency: Currency

      deleted: Boolean
      description: String

      language: Language
      latitude: String
      listImage: Image
      localization: [String]
      longitude: String

      main_image: String

      name: String

      products: [Product]

      slug: String
      seoTitle: String
      seoDescription: String
      seoKeywords: String
      seo_title: String
      seo_keywords: String
      seo_description: String

      tags: String
      timezone: String
      thumbnail_image: String
      thumbnail: Image
    }

    input CityInput {
      id: ID

      active: Boolean

      country: ID
      country_id: String
      countryName: String

      deleted: Boolean
      description: String

      lang: String

      main_image: String

      name: String

      latitude: String
      longitude: String
      localization: [String]

      seoTitle: String
      seoDescription: String
      seoKeywords: String
      seo_title: String
      seo_keywords: String
      seo_description: String
      slug: String

      tags: String
      thumbnail_image: String
      timezone: String
    }
  `,
});
