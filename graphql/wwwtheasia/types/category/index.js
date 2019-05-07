module.exports = [
  /* eslint-disable-next-line no-inline-comments */
  /* GraphQL */ `
    type Category {
      id: ID!

      localizations: [CategoryLocalization]

      name: String
      imageUrl: String
    }

    type CategoryLocalization {
      id: ID!

      language: Language
      languageId: ID

      name: String
    }

    input CategoryFilter {
      count: CategoryCount
    }

    input CategoryCount {
      gt: Int
    }
  `,
];
