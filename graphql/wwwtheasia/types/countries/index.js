module.exports = [
  /* eslint-disable-next-line no-inline-comments */
  /* GraphQL */ `
    type Countries {
      id: ID!
      name: String
      flag: String
      code: String
      currency: String
      countryCode: String
      isoCode: String
      image: String
    }

    type Country {
      id: ID!

      cities: [City]
      code: String
      countryCode: String
      currency: String

      flag: String

      isoCode: String

      localizations: [CountryLocalization]

      name: String

      thumbnailUrl: String
      image: String
      mainImage: String
    }

    type CountryLocalization {
      id: String

      languageId: ID

      name: String
    }

    input CountriesFilter {
      active: Boolean
    }

    type CountryDestination {
      id: ID!
      name: String
      cities: [City]
      data: [TopSearches]
    }

    type TopSearches {
      id: ID
      keyword: String
      url: String
      order: Int
    }
  `,
];
