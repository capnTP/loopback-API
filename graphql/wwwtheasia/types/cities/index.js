module.exports = [
  /* eslint-disable-next-line no-inline-comments */
  /* GraphQL */ `
    type City {
      # Below keys should not be important. See Discover/city resolver
      id: ID!

      country: String
      countryId: ID!
      currency: Currency

      description: String

      filterThumbnail: String

      timezone: String

      image: String

      language: String
      latitude: String
      localizations: [CityLocalization]
      longitude: String

      mainImage: String

      name: String

      ratings: Int

      seoDescription: String
      seoKeywords: String
      seoTitle: String
      slug: String

      time: String
      toursCount: ToursCount
      categoryType: [CategoryType]
    }

    type ToursCount {
      total: Int
      tours: Int
      activities: Int
      transportation: Int
    }

    type CityLocalization {
      id: ID!

      description: String

      languageId: ID!

      name: String!
    }
  `,
];
