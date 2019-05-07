module.exports = [
  /* eslint-disable-next-line no-inline-comments */
  /* GraphQL */ `
    type Feature {
      id: String

      localizations: [FeatureLocalization]

      name: String
    }

    type FeatureLocalization {
      id: String

      language: Language
      languageId: ID

      name: String
    }
  `,
];
