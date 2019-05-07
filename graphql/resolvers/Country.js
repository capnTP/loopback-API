const axios = require('../axios');

const GraphQlDefinition = require('./GraphQlDefinition');

module.exports = new GraphQlDefinition({
  query: {
    countries(root, arg) {
      const limit = arg.limit || 300;
      const offset = arg.offset || 0;
      const where = arg.input || {};
      where.deleted = false;
      return axios
        .get('/countries', { params: { filter: { limit, offset, where } } })
        .then(res => res.data);
    },
  },
  type: /* GraphQL */ `
    extend type Query {
      countries(input: CountryInput, limit: Int, offset: Int): [Countries]
      countryCount: Success

      getCountryById(id: ID, lang: String): Countries
    }

    extend type Mutation {
      addCountryByLang(input: CountryInput): Countries

      deleteCountryById(id: ID): Success

      updateCountryById(input: CountryInput): Countries
      updateCountryFlag(id: ID, active: Boolean, deleted: Boolean): Countries
    }

    type Countries {
      id: ID!
      created_at: String
      updated_at: String

      active: Boolean

      bucket_path: String

      country_id: String
      currency_id: String
      country_code: String
      currency_code: String

      deleted: Boolean
      description: String

      flag: String

      iso_code: String

      lang_id: String

      main_image: String

      name: String

      postal_code: String

      rating: String
      region_id: String

      seo_description: String
      seo_keywords: String
      seo_title: String
      slug: String

      timezone: String
    }

    input CountryInput {
      id: ID
      created_at: String
      updated_at: String

      active: Boolean

      country_code: String
      country_id: String
      currency_code: String
      currency_id: String

      description: String

      iso_code: String

      lang: String
      lang_id: String
      limit: ID

      main_image: String

      name: String

      offset: ID

      postal_code: String

      rating: String
      region_id: String

      seo_title: String
      seo_description: String
      seo_keywords: String
      slug: String

      timezone: String
    }
  `,
});
