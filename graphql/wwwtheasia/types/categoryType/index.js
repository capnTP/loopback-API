module.exports = [
  /* eslint-disable-next-line no-inline-comments */
  /* GraphQL */ `
    type CategoryType {
      id: ID!

      categories(where: CategoryFilter): [Category]

      localizations: [CategoryTypeLocalization]

      name: String

      order: Int

      thumbnailUrl: String
    }

    type CategoryTypeLocalization {
      id: ID!

      language: Language
      languageId: ID

      name: String
    }

    input CategoryTypesFilter {
      city_slug: String

      order: String
    }
  `,
];
