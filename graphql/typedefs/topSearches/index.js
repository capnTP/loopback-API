module.exports = [
  `
    type TopSearches {
      id: ID!
      keyword: String
      url: String
      localization: [String]
    }

    input TopSearchInput {
      id: ID
      keyword: String
      url: String
      lang: String
      localization: [String]
    }
  `,
];
